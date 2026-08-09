const APPLICATION_NUMBER_PATTERN = /\bDLR-\d{6}\b/gi;
export const MAX_INBOUND_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type InboundSourceSummary = {
  zoho_message_id: string;
  folder_id: string;
  thread_id: string | null;
  subject: string;
  received_at: string;
  has_attachments: boolean;
};

export type InboundSourceAttachment = {
  attachment_id: string;
  filename: string;
  size: number;
};

export type InboundSourceMessage = InboundSourceSummary & {
  external_message_id: string;
  sender_email: string;
  recipient_email: string;
  body_text: string;
  body_html: string | null;
  in_reply_to: string | null;
  attachments: InboundSourceAttachment[];
};

export type StoredInboundMessage = {
  id: string;
  inserted: boolean;
  application_id: string | null;
  status: "matched" | "unmatched" | "failed";
};

export type StoreInboundMessageInput = {
  application_number: string | null;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  external_message_id: string;
  zoho_message_id: string;
  zoho_thread_id: string | null;
  in_reply_to: string | null;
  has_attachments: boolean;
  received_at: string;
};

export type StoreInboundAttachmentInput = {
  message_id: string;
  filename: string;
  mime_type: AllowedInboundAttachmentType;
  storage_path: string;
  file_size: number;
};

export interface InboundMessageSource {
  list(limit: number): Promise<InboundSourceSummary[]>;
  hydrate(summary: InboundSourceSummary): Promise<InboundSourceMessage>;
  downloadAttachment(
    summary: InboundSourceSummary,
    attachment: InboundSourceAttachment,
  ): Promise<Uint8Array>;
}

export interface InboundMessageRepository {
  hasZohoMessage(zohoMessageId: string): Promise<boolean>;
  storeMessage(input: StoreInboundMessageInput): Promise<StoredInboundMessage>;
  uploadAttachment(
    path: string,
    bytes: Uint8Array,
    mimeType: AllowedInboundAttachmentType,
  ): Promise<void>;
  storeAttachment(input: StoreInboundAttachmentInput): Promise<void>;
  removeAttachment(path: string): Promise<void>;
  markMessageFailed(messageId: string): Promise<void>;
}

export interface InboundSyncLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export type InboundSyncResult = {
  listed: number;
  processed: number;
  matched: number;
  unmatched: number;
  duplicates: number;
  failed: number;
  attachments_saved: number;
  attachments_skipped: number;
  attachments_failed: number;
};

export type AllowedInboundAttachmentType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png";

export type ValidatedInboundAttachment = {
  mime_type: AllowedInboundAttachmentType;
  extension: "pdf" | "jpg" | "png";
  size: number;
};

const noopLogger: InboundSyncLogger = {
  info() {},
  warn() {},
  error() {},
};

export function extractApplicationNumber(subject: string): string | null {
  const matches = subject.match(APPLICATION_NUMBER_PATTERN) ?? [];
  const distinct = [...new Set(matches.map((match) => match.toUpperCase()))];
  return distinct.length === 1 ? distinct[0] : null;
}

function hasBytes(bytes: Uint8Array, expected: number[]) {
  return expected.every((byte, index) => bytes[index] === byte);
}

export function validateInboundAttachment(
  bytes: Uint8Array,
): ValidatedInboundAttachment | null {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_INBOUND_ATTACHMENT_BYTES) {
    return null;
  }
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) {
    return { mime_type: "image/jpeg", extension: "jpg", size: bytes.byteLength };
  }
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime_type: "image/png", extension: "png", size: bytes.byteLength };
  }
  if (hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime_type: "application/pdf", extension: "pdf", size: bytes.byteLength };
  }
  return null;
}

export function sanitizeInboundFilename(filename: string) {
  const basename = filename.split(/[\\/]/).pop() ?? "attachment";
  const withoutControls = [...basename].filter((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 32 && codePoint !== 127;
  }).join("");
  const sanitized = withoutControls
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 180);
  return sanitized || "attachment";
}

function storagePath(
  applicationId: string | null,
  messageId: string,
  extension: ValidatedInboundAttachment["extension"],
) {
  const root = applicationId ?? "unmatched";
  return `${root}/${messageId}/${crypto.randomUUID()}.${extension}`;
}

function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length <= 80) return code;
  }
  return error instanceof Error ? error.name : "UNKNOWN_ERROR";
}

async function storeAttachments(
  source: InboundMessageSource,
  repository: InboundMessageRepository,
  summary: InboundSourceSummary,
  message: InboundSourceMessage,
  storedMessageId: string,
  applicationId: string | null,
  logger: InboundSyncLogger,
  result: InboundSyncResult,
) {
  let acceptedAttachmentFailed = false;

  for (const attachment of message.attachments) {
    if (!Number.isFinite(attachment.size) || attachment.size <= 0 ||
      attachment.size > MAX_INBOUND_ATTACHMENT_BYTES) {
      result.attachments_skipped += 1;
      logger.warn("inbound_attachment_skipped", {
        zoho_message_id: summary.zoho_message_id,
        reason: "reported_size_not_allowed",
      });
      continue;
    }

    let path: string | null = null;
    try {
      const bytes = await source.downloadAttachment(summary, attachment);
      const validated = validateInboundAttachment(bytes);
      if (!validated) {
        result.attachments_skipped += 1;
        logger.warn("inbound_attachment_skipped", {
          zoho_message_id: summary.zoho_message_id,
          reason: "content_not_allowed",
        });
        continue;
      }

      path = storagePath(applicationId, storedMessageId, validated.extension);
      await repository.uploadAttachment(path, bytes, validated.mime_type);
      try {
        await repository.storeAttachment({
          message_id: storedMessageId,
          filename: sanitizeInboundFilename(attachment.filename),
          mime_type: validated.mime_type,
          storage_path: path,
          file_size: validated.size,
        });
      } catch (error) {
        await repository.removeAttachment(path).catch(() => undefined);
        throw error;
      }
      result.attachments_saved += 1;
    } catch (error) {
      acceptedAttachmentFailed = true;
      result.attachments_failed += 1;
      logger.error("inbound_attachment_failed", {
        zoho_message_id: summary.zoho_message_id,
        error_code: errorCode(error),
      });
    }
  }

  if (acceptedAttachmentFailed) {
    await repository.markMessageFailed(storedMessageId);
  }
}

export async function syncInboundMessages(
  dependencies: {
    source: InboundMessageSource;
    repository: InboundMessageRepository;
    logger?: InboundSyncLogger;
  },
  options: { limit?: number } = {},
): Promise<InboundSyncResult> {
  const logger = dependencies.logger ?? noopLogger;
  const requestedLimit = options.limit ?? 100;
  const limit = Math.min(200, Math.max(1, Math.floor(requestedLimit)));
  // A list failure is intentionally not isolated: the polling run must stop when
  // the provider cannot establish a trustworthy view of the mailbox.
  const summaries = await dependencies.source.list(limit);
  const result: InboundSyncResult = {
    listed: summaries.length,
    processed: 0,
    matched: 0,
    unmatched: 0,
    duplicates: 0,
    failed: 0,
    attachments_saved: 0,
    attachments_skipped: 0,
    attachments_failed: 0,
  };

  for (const summary of summaries) {
    try {
      if (await dependencies.repository.hasZohoMessage(summary.zoho_message_id)) {
        result.duplicates += 1;
        continue;
      }

      const message = await dependencies.source.hydrate(summary);
      const reference = extractApplicationNumber(message.subject);
      const stored = await dependencies.repository.storeMessage({
        application_number: reference,
        sender_email: message.sender_email,
        recipient_email: message.recipient_email,
        subject: message.subject,
        body_text: message.body_text,
        body_html: message.body_html,
        external_message_id: message.external_message_id,
        zoho_message_id: message.zoho_message_id,
        zoho_thread_id: message.thread_id,
        in_reply_to: message.in_reply_to,
        has_attachments: message.attachments.length > 0,
        received_at: message.received_at,
      });

      if (!stored.inserted) {
        result.duplicates += 1;
        continue;
      }

      result.processed += 1;
      if (stored.status === "matched" || stored.status === "unmatched") {
        result[stored.status] += 1;
      }
      if (message.attachments.length > 0) {
        await storeAttachments(
          dependencies.source,
          dependencies.repository,
          summary,
          message,
          stored.id,
          stored.application_id,
          logger,
          result,
        );
      }
    } catch (error) {
      result.failed += 1;
      logger.error("inbound_message_failed", {
        zoho_message_id: summary.zoho_message_id,
        error_code: errorCode(error),
      });
    }
  }

  logger.info("inbound_sync_completed", result);
  return result;
}
