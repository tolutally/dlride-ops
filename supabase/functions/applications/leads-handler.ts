const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEXT_FIELD_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

export type ApiErrorDetail = {
  field: string;
  message: string;
};

export type LeadInsert = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  source: string;
};

export type LeadResult = {
  id: string;
  status: "new";
  created_at: string;
};

export type LeadSubmissionDependencies = {
  internalApiToken: string;
  generateId: () => string;
  createLead: (lead: LeadInsert) => Promise<LeadResult>;
  logServerError: (event: string, requestId: string) => void;
};

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
};

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: ApiErrorDetail[],
  headers?: Record<string, string>,
) {
  const body: ErrorBody = {
    success: false,
    error: { code, message },
  };

  if (details?.length) body.error.details = details;
  return jsonResponse(body, status, headers);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function createLeadHandler(dependencies: LeadSubmissionDependencies) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${dependencies.internalApiToken}`) {
      return errorResponse(
        401,
        "UNAUTHORIZED",
        "Authentication is required.",
        undefined,
        { "WWW-Authenticate": "Bearer" },
      );
    }

    if (request.method !== "POST") {
      return errorResponse(
        405,
        "METHOD_NOT_ALLOWED",
        "Method not allowed.",
        undefined,
        { Allow: "POST" },
      );
    }

    if (
      !(request.headers.get("content-type") || "").toLowerCase().startsWith(
        "application/json",
      )
    ) {
      return errorResponse(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "The request must use a JSON body.",
      );
    }

    let payload: Record<string, unknown>;
    try {
      const parsed = await request.json();
      if (typeof parsed !== "object" || parsed === null) throw new Error();
      payload = parsed as Record<string, unknown>;
    } catch {
      return errorResponse(400, "BAD_REQUEST", "The request body is not valid JSON.");
    }

    const firstName = readString(payload.first_name);
    const lastName = readString(payload.last_name);
    const email = readString(payload.email);
    const phone = readString(payload.phone);
    const message = readString(payload.message);
    const source = readString(payload.source) || "botpress";

    const validationErrors: ApiErrorDetail[] = [];

    if (!firstName) {
      validationErrors.push({ field: "first_name", message: "First name is required." });
    } else if (firstName.length > MAX_TEXT_FIELD_LENGTH) {
      validationErrors.push({ field: "first_name", message: "First name is too long." });
    }

    if (!email) {
      validationErrors.push({ field: "email", message: "A valid email is required." });
    } else if (!EMAIL_PATTERN.test(email)) {
      validationErrors.push({ field: "email", message: "A valid email is required." });
    }

    if (lastName.length > MAX_TEXT_FIELD_LENGTH) {
      validationErrors.push({ field: "last_name", message: "Last name is too long." });
    }

    if (phone.length > MAX_TEXT_FIELD_LENGTH) {
      validationErrors.push({ field: "phone", message: "Phone number is too long." });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      validationErrors.push({ field: "message", message: "Message is too long." });
    }

    if (source.length > MAX_TEXT_FIELD_LENGTH) {
      validationErrors.push({ field: "source", message: "Source is too long." });
    }

    if (validationErrors.length > 0) {
      return errorResponse(
        422,
        "VALIDATION_ERROR",
        "One or more fields are invalid.",
        validationErrors,
      );
    }

    try {
      const lead = await dependencies.createLead({
        id: dependencies.generateId(),
        first_name: firstName,
        last_name: lastName || null,
        email,
        phone: phone || null,
        message: message || null,
        source,
      });

      return jsonResponse({ success: true, data: lead }, 201);
    } catch {
      dependencies.logServerError("lead_creation_failed", requestId);
      return errorResponse(500, "INTERNAL_ERROR", "The lead could not be saved.");
    }
  };
}
