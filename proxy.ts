import type { NextRequest } from "next/server";

import { forwardApplicationSubmission } from "@/lib/applications/submission-gateway";
import { isPublicApplicationSubmission } from "@/lib/auth/routes";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (isPublicApplicationSubmission(request.nextUrl.pathname, request.method)) {
    const applicationsApiUrl = process.env.APPLICATIONS_API_URL?.trim();
    const internalApiToken = process.env.INTERNAL_API_TOKEN?.trim();
    if (!applicationsApiUrl || !internalApiToken) {
      console.error(JSON.stringify({ event: "application_submission_gateway_not_configured" }));
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

    return forwardApplicationSubmission(
      request,
      {
        apiUrl: new URL("/applications", applicationsApiUrl).toString(),
        internalApiToken,
      },
      {
        logError(event) {
          console.error(JSON.stringify({ event }));
        },
      },
    );
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/login",
    "/applications/:path*",
    "/customers/:path*",
    "/rentals/:path*",
    "/fleet/:path*",
    "/renewals/:path*",
    "/settings/:path*",
  ],
};
