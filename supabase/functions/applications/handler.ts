const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type ApiErrorDetail = {
  field: string;
  message: string;
};

export type ValidatedDocument = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png" | "application/pdf";
  extension: "jpg" | "png" | "pdf";
};

export type ApplicationInsert = {
  id: string;
  first_name: string;
  last_name: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
  rental_start_date: string;
  rental_end_date: string;
  rental_weeks: number;
  intended_vehicle_use: string;
  payment_method: string;
  additional_information: string | null;
  drivers_license_path: string;
  proof_of_address_path: string;
  sms_consent: true;
};

export type ApplicationResult = {
  id: string;
  application_number: string;
  status: "submitted";
  rental_weeks: number;
  created_at: string;
};

export type ApplicationSubmissionDependencies = {
  now: () => Date;
  generateId: () => string;
  consumeRateLimit: (
    ipHash: string,
  ) => Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  verifyTurnstile: (token: string, clientIp: string) => Promise<boolean>;
  uploadDocument: (
    path: string,
    bytes: Uint8Array,
    contentType: ValidatedDocument["mimeType"],
  ) => Promise<void>;
  removeDocuments: (paths: string[]) => Promise<void>;
  createApplication: (application: ApplicationInsert) => Promise<ApplicationResult>;
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

function jsonResponse(body: unknown, status: number, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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

function getString(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return date;
}

function utcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

async function validateDocument(
  value: FormDataEntryValue | null,
  field: string,
  requiredMessage: string,
): Promise<ValidatedDocument | Response> {
  if (!(value instanceof File) || value.size === 0) {
    return errorResponse(422, "VALIDATION_ERROR", requiredMessage, [
      { field, message: requiredMessage },
    ]);
  }

  if (value.size > MAX_DOCUMENT_BYTES) {
    return errorResponse(
      413,
      "PAYLOAD_TOO_LARGE",
      "Each document must be 10 MB or smaller.",
      [{ field, message: "Document must be 10 MB or smaller." }],
    );
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { bytes, mimeType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { bytes, mimeType: "image/png", extension: "png" };
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { bytes, mimeType: "application/pdf", extension: "pdf" };
  }

  return errorResponse(
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Documents must be JPG, JPEG, PNG, or PDF files.",
    [{ field, message: "Document must be a JPG, JPEG, PNG, or PDF file." }],
  );
}

async function cleanupDocuments(
  dependencies: ApplicationSubmissionDependencies,
  paths: string[],
  requestId: string,
) {
  if (paths.length === 0) return;
  try {
    await dependencies.removeDocuments(paths);
  } catch {
    dependencies.logServerError("application_document_cleanup_failed", requestId);
  }
}

export function createApplicationHandler(
  dependencies: ApplicationSubmissionDependencies,
) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return errorResponse(405, "METHOD_NOT_ALLOWED", "Method not allowed.", undefined, {
        Allow: "POST, OPTIONS",
      });
    }
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("multipart/form-data")) {
      return errorResponse(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "The request must use multipart form data.",
      );
    }

    const clientIp = getClientIp(request);
    if (!clientIp) {
      return errorResponse(400, "BAD_REQUEST", "The request source could not be verified.");
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return errorResponse(400, "BAD_REQUEST", "The request could not be parsed.");
    }

    try {
      const rateLimit = await dependencies.consumeRateLimit(await sha256(clientIp));
      if (!rateLimit.allowed) {
        const retryAfter = Math.max(1, rateLimit.retryAfterSeconds || 1);
        return errorResponse(
          429,
          "RATE_LIMITED",
          "Too many applications submitted. Please try again later.",
          undefined,
          { "Retry-After": String(retryAfter) },
        );
      }
    } catch {
      dependencies.logServerError("application_rate_limit_failed", requestId);
      return errorResponse(500, "INTERNAL_ERROR", "The application could not be submitted.");
    }

    if (getString(form, "company_name") !== "") {
      return errorResponse(
        422,
        "VALIDATION_ERROR",
        "The application could not be submitted.",
      );
    }

    const turnstileToken = getString(form, "cf-turnstile-response");
    let turnstileValid = false;
    try {
      turnstileValid = Boolean(turnstileToken) &&
        await dependencies.verifyTurnstile(turnstileToken, clientIp);
    } catch {
      dependencies.logServerError("turnstile_verification_failed", requestId);
    }
    if (!turnstileValid) {
      return errorResponse(
        403,
        "BOT_VERIFICATION_FAILED",
        "Verification failed. Please try again.",
      );
    }

    const firstName = getString(form, "first_name");
    const lastName = getString(form, "last_name");
    const streetAddress = getString(form, "street_address");
    const city = getString(form, "city");
    const state = getString(form, "state");
    const postalCode = getString(form, "postal_code");
    const phone = getString(form, "phone");
    const email = getString(form, "email");
    const rentalStartDate = getString(form, "rental_start_date");
    const rentalEndDate = getString(form, "rental_end_date");
    const intendedVehicleUse = getString(form, "intended_vehicle_use");
    const paymentMethod = getString(form, "payment_method");
    const additionalInformation = getString(form, "additional_information");
    const smsConsent = getString(form, "sms_consent") === "true";

    const validationErrors: ApiErrorDetail[] = [];
    const requiredFields: Array<[string, string, string]> = [
      ["first_name", firstName, "First name is required."],
      ["last_name", lastName, "Last name is required."],
      ["street_address", streetAddress, "Street address is required."],
      ["city", city, "City is required."],
      ["state", state, "State is required."],
      ["postal_code", postalCode, "Postal code is required."],
      ["phone", phone, "Phone is required."],
      ["payment_method", paymentMethod, "Payment method is required."],
    ];
    for (const [field, value, message] of requiredFields) {
      if (!value) validationErrors.push({ field, message });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.push({ field: "email", message: "A valid email is required." });
    }

    const allowedVehicleUses = new Set([
      "gig_work",
      "road_trips",
      "personal_use",
      "travel_nursing",
      "other",
    ]);
    if (!allowedVehicleUses.has(intendedVehicleUse)) {
      validationErrors.push({
        field: "intended_vehicle_use",
        message: "Intended vehicle use is invalid.",
      });
    }

    const allowedPaymentMethods = new Set(["cash", "e-transfer", "card"]);
    if (paymentMethod && !allowedPaymentMethods.has(paymentMethod)) {
      validationErrors.push({
        field: "payment_method",
        message: "Payment method is invalid.",
      });
    }

    const startDate = parseIsoDate(rentalStartDate);
    const endDate = parseIsoDate(rentalEndDate);
    let rentalWeeks = 0;

    if (!startDate) {
      validationErrors.push({
        field: "rental_start_date",
        message: "A valid rental start date is required.",
      });
    } else if (startDate < utcDay(dependencies.now())) {
      validationErrors.push({
        field: "rental_start_date",
        message: "Rental start date cannot be in the past.",
      });
    }

    if (!endDate) {
      validationErrors.push({
        field: "rental_end_date",
        message: "A valid rental end date is required.",
      });
    } else if (startDate) {
      const rentalDays = (endDate.getTime() - startDate.getTime()) / 86_400_000;
      if (rentalDays <= 0) {
        validationErrors.push({
          field: "rental_end_date",
          message: "Rental end date must be after rental start date.",
        });
      } else if (rentalDays < 7) {
        validationErrors.push({
          field: "rental_end_date",
          message: "Minimum rental period is 7 days.",
        });
      } else {
        rentalWeeks = Math.ceil(rentalDays / 7);
      }
    }

    if (!smsConsent) {
      validationErrors.push({ field: "sms_consent", message: "SMS consent is required." });
    }
    if (validationErrors.length) {
      return errorResponse(
        422,
        "VALIDATION_ERROR",
        validationErrors[0].message,
        validationErrors,
      );
    }

    const driversLicense = await validateDocument(
      form.get("drivers_license"),
      "drivers_license",
      "Government ID is required.",
    );
    if (driversLicense instanceof Response) return driversLicense;

    const proofOfAddress = await validateDocument(
      form.get("proof_of_address"),
      "proof_of_address",
      "Proof of address is required.",
    );
    if (proofOfAddress instanceof Response) return proofOfAddress;

    const applicationId = dependencies.generateId();
    const driversLicensePath =
      `${applicationId}/drivers-license.${driversLicense.extension}`;
    const proofOfAddressPath =
      `${applicationId}/proof-of-address.${proofOfAddress.extension}`;
    const uploadedPaths: string[] = [];

    try {
      await dependencies.uploadDocument(
        driversLicensePath,
        driversLicense.bytes,
        driversLicense.mimeType,
      );
      uploadedPaths.push(driversLicensePath);

      await dependencies.uploadDocument(
        proofOfAddressPath,
        proofOfAddress.bytes,
        proofOfAddress.mimeType,
      );
      uploadedPaths.push(proofOfAddressPath);
    } catch {
      dependencies.logServerError("application_document_upload_failed", requestId);
      await cleanupDocuments(dependencies, uploadedPaths, requestId);
      return errorResponse(500, "UPLOAD_FAILED", "The documents could not be uploaded.");
    }

    let application: ApplicationResult;
    try {
      application = await dependencies.createApplication({
        id: applicationId,
        first_name: firstName,
        last_name: lastName,
        street_address: streetAddress,
        city,
        state,
        postal_code: postalCode,
        phone,
        email,
        rental_start_date: rentalStartDate,
        rental_end_date: rentalEndDate,
        rental_weeks: rentalWeeks,
        intended_vehicle_use: intendedVehicleUse,
        payment_method: paymentMethod,
        additional_information: additionalInformation || null,
        drivers_license_path: driversLicensePath,
        proof_of_address_path: proofOfAddressPath,
        sms_consent: true,
      });
    } catch {
      dependencies.logServerError("application_record_create_failed", requestId);
      await cleanupDocuments(dependencies, uploadedPaths, requestId);
      return errorResponse(
        500,
        "APPLICATION_CREATE_FAILED",
        "The application could not be submitted.",
      );
    }

    return jsonResponse({ success: true, data: application }, 201);
  };
}
