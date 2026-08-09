import {
  extractApplicationNumber,
  MAX_INBOUND_ATTACHMENT_BYTES,
  sanitizeInboundFilename,
  syncInboundMessages,
  validateInboundAttachment,
  type InboundMessageRepository,
  type InboundMessageSource,
  type InboundSourceAttachment,
  type InboundSourceMessage,
  type InboundSourceSummary,
  type StoreInboundAttachmentInput,
  type StoreInboundMessageInput,
} from "./inbound-sync.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message = "Values differ") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
}

async function assertRejects(callback: () => unknown | Promise<unknown>, message: string) {
  try {
    await callback();
  } catch (error) {
    assert(String(error).includes(message), `Expected error containing ${message}`);
    return;
  }
  throw new Error(`Expected operation to reject with ${message}`);
}

const MATCHED_APPLICATION = {
  id: "20000000-0000-4000-8000-000000000124",
  application_number: "DLR-000124",
};

function summary(
  id: string,
  overrides: Partial<InboundSourceSummary> = {},
): InboundSourceSummary {
  return {
    zoho_message_id: id,
    folder_id: "inbox-folder",
    thread_id: `thread-${id}`,
    subject: `Re: More information needed — DLR-000124`,
    received_at: "2026-08-09T15:00:00.000Z",
    has_attachments: false,
    ...overrides,
  };
}

function message(
  value: InboundSourceSummary,
  overrides: Partial<InboundSourceMessage> = {},
): InboundSourceMessage {
  return {
    ...value,
    external_message_id: `<${value.zoho_message_id}@customer.example>`,
    sender_email: "customer@example.com",
    recipient_email: "applications@dlride.com",
    body_text: "Here is the information you requested.",
    body_html: "<p>Here is the information you requested.</p>",
    in_reply_to: "<outbound@dlride.com>",
    attachments: [],
    ...overrides,
  };
}

type HarnessOverrides = {
  summaries?: InboundSourceSummary[];
  hydrate?: (summary: InboundSourceSummary) => Promise<InboundSourceMessage>;
  downloadAttachment?: (
    summary: InboundSourceSummary,
    attachment: InboundSourceAttachment,
  ) => Promise<Uint8Array>;
  hasZohoMessage?: (zohoMessageId: string) => Promise<boolean>;
  storeMessage?: InboundMessageRepository["storeMessage"];
  uploadAttachment?: InboundMessageRepository["uploadAttachment"];
  storeAttachment?: InboundMessageRepository["storeAttachment"];
};

function createHarness(overrides: HarnessOverrides = {}) {
  const state = {
    hydrated: [] as string[],
    downloaded: [] as string[],
    messages: [] as StoreInboundMessageInput[],
    uploads: [] as Array<{ path: string; bytes: Uint8Array; mimeType: string }>,
    attachments: [] as StoreInboundAttachmentInput[],
    removed: [] as string[],
    markedFailed: [] as string[],
    errors: [] as Array<{ message: string; context?: Record<string, unknown> }>,
  };
  const summaries = overrides.summaries ?? [summary("zoho-1")];

  const source: InboundMessageSource = {
    list: () => Promise.resolve(summaries),
    hydrate: overrides.hydrate ?? ((value) => {
      state.hydrated.push(value.zoho_message_id);
      return Promise.resolve(message(value));
    }),
    downloadAttachment: overrides.downloadAttachment ?? ((value, attachment) => {
      state.downloaded.push(`${value.zoho_message_id}:${attachment.attachment_id}`);
      return Promise.resolve(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]));
    }),
  };

  const repository: InboundMessageRepository = {
    hasZohoMessage: overrides.hasZohoMessage ?? (() => Promise.resolve(false)),
    storeMessage: overrides.storeMessage ?? ((input) => {
      state.messages.push(input);
      const matched = input.application_number === MATCHED_APPLICATION.application_number;
      return Promise.resolve({
        id: `stored-${state.messages.length}`,
        inserted: true,
        application_id: matched ? MATCHED_APPLICATION.id : null,
        status: matched ? "matched" : "unmatched",
      });
    }),
    uploadAttachment: overrides.uploadAttachment ?? ((path, bytes, mimeType) => {
      state.uploads.push({ path, bytes, mimeType });
      return Promise.resolve();
    }),
    storeAttachment: overrides.storeAttachment ?? ((input) => {
      state.attachments.push(input);
      return Promise.resolve();
    }),
    removeAttachment: (path) => {
      state.removed.push(path);
      return Promise.resolve();
    },
    markMessageFailed: (messageId) => {
      state.markedFailed.push(messageId);
      return Promise.resolve();
    },
  };

  return {
    dependencies: {
      source,
      repository,
      logger: {
        info() {},
        warn() {},
        error(errorMessage: string, context?: Record<string, unknown>) {
          state.errors.push({ message: errorMessage, context });
        },
      },
    },
    state,
  };
}

Deno.test("matched reply stores the application reference and complete mail metadata", async () => {
  const { dependencies, state } = createHarness();
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.processed, 1);
  assertEquals(result.matched, 1);
  assertEquals(result.unmatched, 0);
  assertEquals(state.messages, [{
    application_number: MATCHED_APPLICATION.application_number,
    sender_email: "customer@example.com",
    recipient_email: "applications@dlride.com",
    subject: "Re: More information needed — DLR-000124",
    body_text: "Here is the information you requested.",
    body_html: "<p>Here is the information you requested.</p>",
    external_message_id: "<zoho-1@customer.example>",
    zoho_message_id: "zoho-1",
    zoho_thread_id: "thread-zoho-1",
    in_reply_to: "<outbound@dlride.com>",
    has_attachments: false,
    received_at: "2026-08-09T15:00:00.000Z",
  }]);
});

Deno.test("reply without an application number is stored as unmatched without guessing", async () => {
  const missingReference = summary("zoho-unmatched", { subject: "Rental question" });
  const { dependencies, state } = createHarness({ summaries: [missingReference] });
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.unmatched, 1);
  assertEquals(state.messages[0].application_number, null);
});

Deno.test("invalid or ambiguous subject references are unmatched", async () => {
  assertEquals(extractApplicationNumber("Re: application DLR-124"), null);
  assertEquals(
    extractApplicationNumber("Re: DLR-000124 and DLR-000125"),
    null,
  );
  assertEquals(
    extractApplicationNumber("Re: DLR-000124 (DLR-000124)"),
    "DLR-000124",
  );

  const ambiguous = summary("zoho-ambiguous", {
    subject: "Re: DLR-000124 and DLR-000125",
  });
  const { dependencies, state } = createHarness({ summaries: [ambiguous] });
  await syncInboundMessages(dependencies);
  assertEquals(state.messages[0].application_number, null);
});

Deno.test("already processed Zoho message is skipped before hydration", async () => {
  const { dependencies, state } = createHarness({
    hasZohoMessage: () => Promise.resolve(true),
  });
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.duplicates, 1);
  assertEquals(result.processed, 0);
  assertEquals(state.hydrated, []);
  assertEquals(state.messages, []);
});

Deno.test("store-level duplicate remains idempotent during concurrent polling", async () => {
  const { dependencies, state } = createHarness({
    storeMessage: (input) => {
      state.messages.push(input);
      return Promise.resolve({
        id: "existing-message",
        inserted: false,
        application_id: MATCHED_APPLICATION.id,
        status: "matched",
      });
    },
  });
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.duplicates, 1);
  assertEquals(result.processed, 0);
  assertEquals(state.messages.length, 1);
  assertEquals(state.uploads, []);
});

Deno.test("accepted attachment is byte-validated and stored under a private path", async () => {
  const attachment: InboundSourceAttachment = {
    attachment_id: "attachment-1",
    filename: "../../customer identity.pdf",
    size: 5,
  };
  const withAttachment = summary("zoho-attachment", { has_attachments: true });
  const { dependencies, state } = createHarness({
    summaries: [withAttachment],
    hydrate: (value) => Promise.resolve(message(value, { attachments: [attachment] })),
  });
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.attachments_saved, 1);
  assertEquals(state.uploads.length, 1);
  assert(state.uploads[0].path.startsWith(`${MATCHED_APPLICATION.id}/stored-1/`));
  assert(state.uploads[0].path.endsWith(".pdf"));
  assertEquals(/^https?:/i.test(state.uploads[0].path), false);
  assertEquals(state.uploads[0].mimeType, "application/pdf");
  assertEquals(state.attachments[0].filename, "customer identity.pdf");
  assertEquals(state.attachments[0].storage_path, state.uploads[0].path);
  assertEquals(state.attachments[0].file_size, 5);
});

Deno.test("unsupported attachment content is ignored safely", async () => {
  const attachment: InboundSourceAttachment = {
    attachment_id: "attachment-unsupported",
    filename: "payload.svg",
    size: 5,
  };
  const value = summary("zoho-unsupported", { has_attachments: true });
  const { dependencies, state } = createHarness({
    summaries: [value],
    hydrate: (item) => Promise.resolve(message(item, { attachments: [attachment] })),
    downloadAttachment: () => Promise.resolve(new Uint8Array([1, 2, 3, 4, 5])),
  });
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.attachments_skipped, 1);
  assertEquals(result.attachments_failed, 0);
  assertEquals(state.uploads, []);
  assertEquals(state.attachments, []);
  assertEquals(state.markedFailed, []);
});

Deno.test("reported attachment over 10 MB is skipped without downloading", async () => {
  const attachment: InboundSourceAttachment = {
    attachment_id: "attachment-large",
    filename: "large.pdf",
    size: MAX_INBOUND_ATTACHMENT_BYTES + 1,
  };
  const value = summary("zoho-large", { has_attachments: true });
  const { dependencies, state } = createHarness({
    summaries: [value],
    hydrate: (item) => Promise.resolve(message(item, { attachments: [attachment] })),
  });
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.attachments_skipped, 1);
  assertEquals(state.downloaded, []);
  assertEquals(state.uploads, []);
});

Deno.test("attachment failure keeps the email and records a failed message safely", async () => {
  const attachment: InboundSourceAttachment = {
    attachment_id: "attachment-failed",
    filename: "identity.pdf",
    size: 5,
  };
  const value = summary("zoho-attachment-failure", { has_attachments: true });
  const { dependencies, state } = createHarness({
    summaries: [value],
    hydrate: (item) => Promise.resolve(message(item, { attachments: [attachment] })),
    uploadAttachment: () => Promise.reject(new Error("simulated upload failure")),
  });
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.processed, 1);
  assertEquals(result.attachments_failed, 1);
  assertEquals(state.messages.length, 1);
  assertEquals(state.markedFailed, ["stored-1"]);
  assertEquals(state.errors[0].message, "inbound_attachment_failed");
});

Deno.test("one message failure does not prevent a later message from syncing", async () => {
  const first = summary("zoho-bad");
  const second = summary("zoho-good", { subject: "Question without a reference" });
  const { dependencies, state } = createHarness({
    summaries: [first, second],
    hydrate: (value) => {
      state.hydrated.push(value.zoho_message_id);
      if (value.zoho_message_id === "zoho-bad") {
        return Promise.reject(new Error("simulated message failure"));
      }
      return Promise.resolve(message(value));
    },
  });
  const result = await syncInboundMessages(dependencies);

  assertEquals(result.failed, 1);
  assertEquals(result.processed, 1);
  assertEquals(result.unmatched, 1);
  assertEquals(state.hydrated, ["zoho-bad", "zoho-good"]);
  assertEquals(state.messages.length, 1);
  assertEquals(state.errors[0].message, "inbound_message_failed");
});

Deno.test("mailbox list failure stops the current sync run", async () => {
  const { dependencies } = createHarness();
  dependencies.source.list = () => Promise.reject(new Error("Zoho unavailable"));
  await assertRejects(() => syncInboundMessages(dependencies), "Zoho unavailable");
});

Deno.test("attachment validation trusts bytes rather than browser-style names", () => {
  assertEquals(validateInboundAttachment(new Uint8Array([0xff, 0xd8, 0xff])), {
    mime_type: "image/jpeg",
    extension: "jpg",
    size: 3,
  });
  assertEquals(validateInboundAttachment(new Uint8Array([1, 2, 3])), null);
  assertEquals(sanitizeInboundFilename("../../safe name.pdf"), "safe name.pdf");
});
