import { forwardApplicationSubmission } from "./submission-gateway.ts";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

Deno.test("public application gateway adds server authorization and preserves multipart data", async () => {
  const form = new FormData();
  form.set("first_name", "Taylor");
  form.set("cf-turnstile-response", "browser-token");
  const request = new Request("https://ops.dlride.com/applications", {
    method: "POST",
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      cookie: "staff-session=must-not-forward",
    },
    body: form,
  });
  const capturedRequests: Request[] = [];

  const response = await forwardApplicationSubmission(
    request,
    {
      apiUrl: "http://dlride-api.railway.internal:8000/applications",
      internalApiToken: "internal-secret",
    },
    {
      fetch: (input, init) => {
        capturedRequests.push(new Request(input, init));
        return Promise.resolve(Response.json(
          { success: true, data: { application_number: "DLR-000124" } },
          { status: 201 },
        ));
      },
    },
  );

  const capturedRequest = capturedRequests[0];
  assert(capturedRequest);
  assertEquals(capturedRequest.url, "http://dlride-api.railway.internal:8000/applications");
  assertEquals(capturedRequest.headers.get("authorization"), "Bearer internal-secret");
  assertEquals(capturedRequest.headers.get("cf-connecting-ip"), "203.0.113.10");
  assertEquals(capturedRequest.headers.get("cookie"), null);
  assert(capturedRequest.headers.get("content-type")?.startsWith("multipart/form-data; boundary="));
  const forwardedForm = await capturedRequest.formData();
  assertEquals(forwardedForm.get("first_name"), "Taylor");
  assertEquals(forwardedForm.get("cf-turnstile-response"), "browser-token");
  assertEquals(response.status, 201);
  assertEquals((await response.json()).data.application_number, "DLR-000124");
});

Deno.test("gateway preserves upstream validation and rate-limit responses", async () => {
  const response = await forwardApplicationSubmission(
    new Request("https://ops.dlride.com/applications", { method: "POST", body: new FormData() }),
    { apiUrl: "http://api/applications", internalApiToken: "secret" },
    {
      fetch: () => Promise.resolve(Response.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Try again later." } },
        { status: 429, headers: { "Retry-After": "3600" } },
      )),
    },
  );

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("retry-after"), "3600");
  assertEquals((await response.json()).error.code, "RATE_LIMITED");
});

Deno.test("gateway returns a concise 503 when the private API is unreachable", async () => {
  const events: string[] = [];
  const response = await forwardApplicationSubmission(
    new Request("https://ops.dlride.com/applications", { method: "POST", body: new FormData() }),
    { apiUrl: "http://api/applications", internalApiToken: "secret" },
    {
      fetch: () => Promise.reject(new Error("private network unavailable")),
      logError: (event) => events.push(event),
    },
  );

  assertEquals(response.status, 503);
  assertEquals((await response.json()).error.code, "APPLICATION_SUBMISSION_UNAVAILABLE");
  assertEquals(events, ["application_submission_gateway_failed"]);
});
