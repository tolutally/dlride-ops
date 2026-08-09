import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readZohoSetupConfiguration } from "@/lib/zoho-mail/config";
import { ZohoMailError } from "@/lib/zoho-mail/errors";
import {
  constantTimeEqual,
  createZohoAuthorizationUrl,
  secureRandomState,
} from "@/lib/zoho-mail/oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "dlride_zoho_oauth_state";

function suppliedSetupSecret(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  return request.nextUrl.searchParams.get("setup_secret") ?? "";
}

function failure(error: unknown) {
  const status = error instanceof ZohoMailError ? error.status : 500;
  return NextResponse.json(
    { success: false, error: { code: "ZOHO_SETUP_UNAVAILABLE", message: "Zoho setup is unavailable." } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function GET(request: NextRequest) {
  try {
    const configuration = readZohoSetupConfiguration();
    const supplied = suppliedSetupSecret(request);
    if (!supplied || !constantTimeEqual(supplied, configuration.setupSecret)) {
      return failure(new ZohoMailError("OAUTH_SETUP_DISABLED", "Zoho setup is unavailable", 404));
    }

    const state = secureRandomState();
    const redirectUri = configuration.redirectUri
      ?? new URL("/api/auth/zoho/callback", request.url).toString();
    const authorizationUrl = createZohoAuthorizationUrl({
      accountsBaseUrl: configuration.accountsBaseUrl,
      clientId: configuration.clientId,
      redirectUri,
      state,
    });
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: new URL(request.url).protocol === "https:",
      sameSite: "lax",
      path: "/api/auth/zoho",
      maxAge: 10 * 60,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return failure(error);
  }
}

