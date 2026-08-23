import { createLeadHandler, type LeadInsert, type LeadSubmissionDependencies } from "./leads-handler.ts";

const LEAD_ID = "660e8400-e29b-41d4-a716-446655440000";
const CREATED_AT = "2026-08-23T12:00:00.000Z";

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

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    first_name: "Taylor",
    last_name: "Rider",
    email: "taylor@example.com",
    phone: "+1 403 555 0100",
    message: "Interested in a weekly rental.",
    ...overrides,
  };
}

function createRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new Request("https://api.example.test/leads", {
    method: "POST",
    headers: {
      "authorization": "Bearer test-leads-token",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function createTestState() {
  const state = {
    inserted: null as LeadInsert | null,
  };

  const dependencies: LeadSubmissionDependencies = {
    internalApiToken: "test-leads-token",
    generateId: () => LEAD_ID,
    createLead: (lead) => {
      state.inserted = lead;
      return Promise.resolve({ id: lead.id, status: "new", created_at: CREATED_AT });
    },
    logServerError: () => {},
  };

  return { state, dependencies };
}

Deno.test("lead submission succeeds with valid fields and defaults source to botpress", async () => {
  const { state, dependencies } = createTestState();
  const handler = createLeadHandler(dependencies);

  const response = await handler(createRequest(createBody()));
  const body = await response.json();

  assertEquals(response.status, 201);
  assertEquals(body, {
    success: true,
    data: { id: LEAD_ID, status: "new", created_at: CREATED_AT },
  });
  assertEquals(state.inserted, {
    id: LEAD_ID,
    first_name: "Taylor",
    last_name: "Rider",
    email: "taylor@example.com",
    phone: "+1 403 555 0100",
    message: "Interested in a weekly rental.",
    source: "botpress",
  });
});

Deno.test("lead submission rejects a missing or invalid bearer token", async () => {
  const { dependencies } = createTestState();
  const handler = createLeadHandler(dependencies);

  const response = await handler(
    createRequest(createBody(), { authorization: "Bearer wrong-token" }),
  );
  const body = await response.json();

  assertEquals(response.status, 401);
  assertEquals(body.error.code, "UNAUTHORIZED");
});

Deno.test("lead submission validates required fields", async () => {
  const { dependencies } = createTestState();
  const handler = createLeadHandler(dependencies);

  const response = await handler(
    createRequest({ first_name: "", email: "not-an-email" }),
  );
  const body = await response.json();

  assertEquals(response.status, 422);
  assertEquals(body.error.code, "VALIDATION_ERROR");
  assertEquals(body.error.details, [
    { field: "first_name", message: "First name is required." },
    { field: "email", message: "A valid email is required." },
  ]);
});

Deno.test("lead submission accepts a custom source", async () => {
  const { state, dependencies } = createTestState();
  const handler = createLeadHandler(dependencies);

  await handler(createRequest(createBody({ source: "website" })));

  assertEquals(state.inserted?.source, "website");
});

Deno.test("lead submission returns 500 when saving fails", async () => {
  const { dependencies } = createTestState();
  dependencies.createLead = () => Promise.reject(new Error("db error"));
  const handler = createLeadHandler(dependencies);

  const response = await handler(createRequest(createBody()));
  const body = await response.json();

  assertEquals(response.status, 500);
  assertEquals(body.error.code, "INTERNAL_ERROR");
});
