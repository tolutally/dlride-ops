import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  isZohoSendAliasAuthorized,
  resolveZohoMailboxAccount,
} from "@/lib/zoho-mail/accounts";
import { exchangeZohoAuthorizationCode } from "@/lib/zoho-mail/auth";
import { ZohoMailClient } from "@/lib/zoho-mail/client";
import { readZohoSetupConfiguration } from "@/lib/zoho-mail/config";
import { ZohoMailError } from "@/lib/zoho-mail/errors";
import {
  callbackAccountsBaseUrl,
  constantTimeEqual,
  mailBaseUrlForAccountsBaseUrl,
} from "@/lib/zoho-mail/oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "dlride_zoho_oauth_state";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlResponse(body: string, secureCookie: boolean, status = 200) {
  const response = new NextResponse(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/api/auth/zoho",
    maxAge: 0,
  });
  return response;
}

function page(title: string, content: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>body{margin:0;background:#f5f6f7;color:#191b20;font:15px/1.55 ui-sans-serif,system-ui,sans-serif}.card{max-width:720px;margin:8vh auto;padding:32px;background:#fff;border:1px solid #e4e7eb;border-radius:14px}h1{font-size:24px;margin:0 0 8px}p{color:#616975}pre{overflow:auto;padding:18px;background:#f7f8fa;border:1px solid #e4e7eb;border-radius:8px;white-space:pre-wrap;word-break:break-all}.ok{color:#28704b;font-weight:650}.warning{color:#805b14;font-weight:650}@media(max-width:760px){.card{margin:0;min-height:100vh;border:0;border-radius:0;padding:24px 18px}}</style></head><body><main class="card">${content}</main></body></html>`;
}

function errorMessage(error: unknown) {
  if (!(error instanceof ZohoMailError)) return "Unable to connect Zoho Mail. Please try again.";
  switch (error.code) {
    case "OAUTH_ACCESS_DENIED":
      return "Zoho authorization was denied.";
    case "OAUTH_STATE_INVALID":
      return "The OAuth setup session is invalid or expired. Start the connection again.";
    case "OAUTH_REFRESH_TOKEN_MISSING":
      return "Zoho did not return a refresh token. Start again and grant consent.";
    case "MAILBOX_NOT_FOUND":
      return "The authenticated Zoho user does not contain the required hello@dlride.com mailbox.";
    case "OAUTH_SETUP_DISABLED":
      return "Zoho OAuth setup is disabled.";
    default:
      return "Unable to connect Zoho Mail. Check the server configuration and try again.";
  }
}

export async function GET(request: NextRequest) {
  const secureCookie = request.nextUrl.protocol === "https:";
  try {
    const configuration = readZohoSetupConfiguration();
    const query = request.nextUrl.searchParams;
    if (query.get("error")) {
      throw new ZohoMailError("OAUTH_ACCESS_DENIED", "Zoho authorization was denied", 400);
    }

    const expectedState = request.cookies.get(STATE_COOKIE)?.value ?? "";
    const returnedState = query.get("state") ?? "";
    if (!expectedState || !returnedState || !constantTimeEqual(expectedState, returnedState)) {
      throw new ZohoMailError("OAUTH_STATE_INVALID", "Invalid OAuth state", 400);
    }
    const code = query.get("code");
    if (!code) {
      throw new ZohoMailError("OAUTH_CODE_MISSING", "Authorization code missing", 400);
    }

    const redirectUri = configuration.redirectUri
      ?? new URL("/api/auth/zoho/callback", request.url).toString();
    const accountsBaseUrl = callbackAccountsBaseUrl(
      query.get("accounts-server"),
      configuration.accountsBaseUrl,
    );
    const token = await exchangeZohoAuthorizationCode({
      clientId: configuration.clientId,
      clientSecret: configuration.clientSecret,
      code,
      redirectUri,
      accountsBaseUrl,
    });
    if (!token.refreshToken) {
      throw new ZohoMailError("OAUTH_REFRESH_TOKEN_MISSING", "Refresh token missing");
    }

    // The authorization response is authoritative for the user's data center.
    // A configured production URL may still point at another region during setup.
    const mailApiBaseUrl = mailBaseUrlForAccountsBaseUrl(accountsBaseUrl);
    const client = new ZohoMailClient(mailApiBaseUrl, async () => token.accessToken);
    const account = await resolveZohoMailboxAccount(client, configuration.mailAddress);
    const aliasReady = isZohoSendAliasAuthorized(account, configuration.fromAlias);
    const values = [
      `ZOHO_REFRESH_TOKEN=${token.refreshToken}`,
      `ZOHO_MAIL_ACCOUNT_ID=${account.accountId}`,
      `ZOHO_MAIL_ADDRESS=${configuration.mailAddress}`,
      `ZOHO_MAIL_FROM_ALIAS=${configuration.fromAlias}`,
      `ZOHO_ACCOUNTS_BASE_URL=${accountsBaseUrl}`,
      `ZOHO_MAIL_API_BASE_URL=${mailApiBaseUrl}`,
    ].join("\n");

    return htmlResponse(page("Zoho Mail connected", `
      <p class="ok">OAuth connection successful</p>
      <h1>Zoho Mail connected</h1>
      <p>Mailbox: <strong>${escapeHtml(configuration.mailAddress)}</strong></p>
      <p>Send Mail As alias: <strong>${escapeHtml(configuration.fromAlias)}</strong> — <span class="${aliasReady ? "ok" : "warning"}">${aliasReady ? "authorized" : "not currently authorized; configure this address in Zoho Mail before sending"}</span></p>
      <pre>${escapeHtml(values)}</pre>
      <p>Copy these values into Railway secrets now. Then remove <code>ZOHO_SETUP_SECRET</code> and set <code>ZOHO_OAUTH_SETUP_ENABLED=false</code>.</p>
    `), secureCookie);
  } catch (error) {
    const code = error instanceof ZohoMailError ? error.code : "UNEXPECTED_ERROR";
    console.error(JSON.stringify({ event: "zoho_oauth_setup_failed", code }));
    const status = error instanceof ZohoMailError ? error.status : 500;
    return htmlResponse(page("Zoho Mail connection failed", `
      <p class="warning">OAuth connection failed</p>
      <h1>Zoho Mail was not connected</h1>
      <p>${escapeHtml(errorMessage(error))}</p>
    `), secureCookie, status);
  }
}
