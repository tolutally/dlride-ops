import {
  type ApplicationInsert,
  type ApplicationSubmissionDependencies,
  createApplicationHandler,
} from "./handler.ts";

const APPLICATION_ID = "550e8400-e29b-41d4-a716-446655440000";
const CREATED_AT = "2026-01-01T12:00:00.000Z";

function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  message = "Values differ",
) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(
      `${message}: expected ${expectedJson}, received ${actualJson}`,
    );
  }
}

function jpegFile(name = "browser-name-is-ignored.jpeg") {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00])], name, {
    type: "application/octet-stream",
  });
}

function createForm() {
  const form = new FormData();
  form.set("first_name", "Taylor");
  form.set("last_name", "Rider");
  form.set("email", "taylor@example.com");
  form.set("phone", "+1 403 555 0100");
  form.set("street_address", "100 Main Street");
  form.set("city", "Calgary");
  form.set("state", "Alberta");
  form.set("postal_code", "T2P 1J9");
  form.set("rental_start_date", "2026-02-01");
  form.set("rental_end_date", "2026-02-15");
  form.set("pickup_time", "09:30");
  form.set("dropoff_time", "17:00");
  form.set("intended_vehicle_use", "gig_work");
  form.set("payment_method", "card");
  form.set("additional_information", "Evening pickup preferred.");
  form.set("sms_consent", "true");
  form.set("company_name", "");
  form.set("cf-turnstile-response", "valid-token");
  form.set("drivers_license", jpegFile());
  form.set("proof_of_address", jpegFile("proof.pdf"));
  return form;
}

function createRequest(form: FormData) {
  return new Request("https://api.example.test/applications", {
    method: "POST",
    headers: {
      "authorization": "Bearer test-internal-token",
      "cf-connecting-ip": "203.0.113.10",
    },
    body: form,
  });
}

type TestState = {
  uploads: string[];
  removed: string[];
  inserted: ApplicationInsert | null;
  receivedEmails: Array<{
    first_name: string;
    application_number: string;
    email: string;
  }>;
  verifyCalls: number;
  errors: string[];
};

function createHarness(
  overrides: Partial<ApplicationSubmissionDependencies> = {},
) {
  const state: TestState = {
    uploads: [],
    removed: [],
    inserted: null,
    receivedEmails: [],
    verifyCalls: 0,
    errors: [],
  };

  const dependencies: ApplicationSubmissionDependencies = {
    internalApiToken: "test-internal-token",
    now: () => new Date("2026-01-01T12:00:00.000Z"),
    generateId: () => APPLICATION_ID,
    consumeRateLimit: () =>
      Promise.resolve({ allowed: true, retryAfterSeconds: 0 }),
    verifyTurnstile: () => {
      state.verifyCalls += 1;
      return Promise.resolve(true);
    },
    uploadDocument: (path) => {
      state.uploads.push(path);
      return Promise.resolve();
    },
    removeDocuments: (paths) => {
      state.removed.push(...paths);
      return Promise.resolve();
    },
    createApplication: (application) => {
      state.inserted = application;
      return Promise.resolve({
        id: application.id,
        application_number: "DLR-000001",
        status: "under_review",
        rental_weeks: application.rental_weeks,
        created_at: CREATED_AT,
      });
    },
    sendApplicationReceivedEmail: (application) => {
      state.receivedEmails.push(application);
      return Promise.resolve();
    },
    logServerError: (event) => {
      state.errors.push(event);
    },
    ...overrides,
  };

  return { handler: createApplicationHandler(dependencies), state };
}

Deno.test("application API rejects requests without the internal bearer token", async () => {
  const { handler, state } = createHarness();
  const response = await handler(
    new Request("https://api.example.test/applications", {
      method: "POST",
      headers: { "cf-connecting-ip": "203.0.113.10" },
      body: createForm(),
    }),
  );
  const body = await responseBody(response);

  assertEquals(response.status, 401);
  assertEquals(response.headers.get("www-authenticate"), "Bearer");
  assertEquals(body.error?.code, "UNAUTHORIZED");
  assertEquals(state.uploads, []);
  assertEquals(state.verifyCalls, 0);
});

async function responseBody(response: Response) {
  return await response.json() as {
    success: boolean;
    data?: Record<string, unknown>;
    error?: {
      code: string;
      message: string;
      details?: Array<{ field: string }>;
    };
  };
}

Deno.test("valid application uploads documents and creates a complete record", async () => {
  const { handler, state } = createHarness();
  const response = await handler(createRequest(createForm()));
  const body = await responseBody(response);

  assertEquals(response.status, 201);
  assertEquals(body, {
    success: true,
    data: {
      id: APPLICATION_ID,
      application_number: "DLR-000001",
      status: "under_review",
      rental_weeks: 2,
      created_at: CREATED_AT,
    },
  });
  assertEquals(state.uploads, [
    `${APPLICATION_ID}/drivers-license.jpg`,
    `${APPLICATION_ID}/proof-of-address.jpg`,
  ]);
  assert(state.inserted !== null);
  assertEquals(state.inserted.drivers_license_path, state.uploads[0]);
  assertEquals(state.inserted.proof_of_address_path, state.uploads[1]);
  assertEquals(state.inserted.pickup_time, "09:30");
  assertEquals(state.inserted.dropoff_time, "17:00");
  assertEquals(state.receivedEmails, [{
    first_name: "Taylor",
    application_number: "DLR-000001",
    email: "taylor@example.com",
  }]);
});

Deno.test("application creation succeeds when the received email fails", async () => {
  const { handler, state } = createHarness({
    sendApplicationReceivedEmail: () =>
      Promise.reject(new Error("simulated failure")),
  });

  const response = await handler(createRequest(createForm()));
  const body = await responseBody(response);

  assertEquals(response.status, 201);
  assertEquals(body.data?.application_number, "DLR-000001");
  assertEquals(state.errors, ["application_received_email_failed"]);
});

Deno.test("missing required field is rejected", async () => {
  const form = createForm();
  form.delete("first_name");
  const { handler, state } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 422);
  assertEquals(body.error?.code, "VALIDATION_ERROR");
  assertEquals(body.error?.details?.[0]?.field, "first_name");
  assertEquals(state.uploads, []);
});

Deno.test("missing pickup time is rejected", async () => {
  const form = createForm();
  form.delete("pickup_time");
  const { handler, state } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 422);
  assertEquals(body.error?.message, "Pickup time is required.");
  assertEquals(state.uploads, []);
});

Deno.test("invalid drop-off time is rejected", async () => {
  const form = createForm();
  form.set("dropoff_time", "25:15");
  const { handler, state } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 422);
  assertEquals(
    body.error?.message,
    "Drop-off time must use 24-hour HH:MM format.",
  );
  assertEquals(state.uploads, []);
});

Deno.test("payment method outside the website values is rejected", async () => {
  const form = createForm();
  form.set("payment_method", "cheque");
  const { handler, state } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 422);
  assertEquals(body.error?.message, "Payment method is invalid.");
  assertEquals(state.uploads, []);
});

Deno.test("rental end before start is rejected", async () => {
  const form = createForm();
  form.set("rental_end_date", "2026-01-31");
  const { handler } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 422);
  assertEquals(
    body.error?.message,
    "Rental end date must be after rental start date.",
  );
});

Deno.test("rental shorter than seven days is rejected", async () => {
  const form = createForm();
  form.set("rental_end_date", "2026-02-07");
  const { handler } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 422);
  assertEquals(body.error?.message, "Minimum rental period is 7 days.");
});

Deno.test("invalid Turnstile token is rejected before uploads", async () => {
  const { handler, state } = createHarness({
    verifyTurnstile: () => Promise.resolve(false),
  });
  const response = await handler(createRequest(createForm()));
  const body = await responseBody(response);

  assertEquals(response.status, 403);
  assertEquals(body.error?.code, "BOT_VERIFICATION_FAILED");
  assertEquals(state.uploads, []);
});

Deno.test("populated honeypot receives a generic validation failure", async () => {
  const form = createForm();
  form.set("company_name", "Spam Incorporated");
  const { handler, state } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 422);
  assertEquals(body.error, {
    code: "VALIDATION_ERROR",
    message: "The application could not be submitted.",
  });
  assertEquals(state.verifyCalls, 0);
});

Deno.test("rate limit returns 429 and Retry-After", async () => {
  const { handler } = createHarness({
    consumeRateLimit: () =>
      Promise.resolve({ allowed: false, retryAfterSeconds: 900 }),
  });
  const response = await handler(createRequest(createForm()));
  const body = await responseBody(response);

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "900");
  assertEquals(body.error?.code, "RATE_LIMITED");
});

Deno.test("document over 10 MB is rejected", async () => {
  const form = createForm();
  const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
  oversized.set([0xff, 0xd8, 0xff]);
  form.set("drivers_license", new File([oversized], "license.jpg"));
  const { handler } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 413);
  assertEquals(body.error?.code, "PAYLOAD_TOO_LARGE");
});

Deno.test("document type is detected from bytes and invalid content is rejected", async () => {
  const form = createForm();
  form.set(
    "drivers_license",
    new File([new TextEncoder().encode("not an image")], "license.jpg", {
      type: "image/jpeg",
    }),
  );
  const { handler } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 415);
  assertEquals(body.error?.code, "UNSUPPORTED_MEDIA_TYPE");
});

Deno.test("failed second upload cleans up the first and creates no record", async () => {
  const uploaded: string[] = [];
  const removed: string[] = [];
  let createCalled = false;
  const { handler } = createHarness({
    uploadDocument: (path) => {
      if (path.includes("proof-of-address")) {
        return Promise.reject(new Error("simulated failure"));
      }
      uploaded.push(path);
      return Promise.resolve();
    },
    removeDocuments: (paths) => {
      removed.push(...paths);
      return Promise.resolve();
    },
    createApplication: () => {
      createCalled = true;
      return Promise.reject(new Error("must not run"));
    },
  });

  const response = await handler(createRequest(createForm()));
  const body = await responseBody(response);

  assertEquals(response.status, 500);
  assertEquals(body.error?.code, "UPLOAD_FAILED");
  assertEquals(removed, uploaded);
  assertEquals(createCalled, false);
});

Deno.test("failed database insert cleans up both uploaded documents", async () => {
  const removed: string[] = [];
  const { handler, state } = createHarness({
    removeDocuments: (paths) => {
      removed.push(...paths);
      return Promise.resolve();
    },
    createApplication: () => Promise.reject(new Error("simulated failure")),
  });

  const response = await handler(createRequest(createForm()));
  const body = await responseBody(response);

  assertEquals(response.status, 500);
  assertEquals(body.error?.code, "APPLICATION_CREATE_FAILED");
  assertEquals(removed, state.uploads);
});

Deno.test("eight rental days calculate to two rental weeks", async () => {
  const form = createForm();
  form.set("rental_end_date", "2026-02-09");
  const { handler, state } = createHarness();
  const response = await handler(createRequest(form));
  const body = await responseBody(response);

  assertEquals(response.status, 201);
  assertEquals(state.inserted?.rental_weeks, 2);
  assertEquals(body.data?.rental_weeks, 2);
});
