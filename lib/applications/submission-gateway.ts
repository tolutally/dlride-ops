export type ApplicationSubmissionGatewayConfig = {
  apiUrl: string;
  internalApiToken: string;
};

type GatewayDependencies = {
  fetch?: typeof fetch;
  logError?: (event: string) => void;
};

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "content-type",
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-real-ip",
  "x-request-id",
  "user-agent",
] as const;

const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "retry-after",
  "x-request-id",
] as const;

function gatewayFailure() {
  return Response.json(
    {
      success: false,
      error: {
        code: "APPLICATION_SUBMISSION_UNAVAILABLE",
        message: "Unable to submit the application. Please try again.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function forwardApplicationSubmission(
  request: Request,
  config: ApplicationSubmissionGatewayConfig,
  dependencies: GatewayDependencies = {},
) {
  const fetcher = dependencies.fetch ?? fetch;
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("authorization", `Bearer ${config.internalApiToken}`);

  try {
    const upstream = await fetcher(config.apiUrl, {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers({ "Cache-Control": "no-store" });
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    dependencies.logError?.("application_submission_gateway_failed");
    return gatewayFailure();
  }
}

