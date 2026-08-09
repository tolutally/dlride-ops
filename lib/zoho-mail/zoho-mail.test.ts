import { findZohoMailboxAccount, isZohoSendAliasAuthorized, normalizeZohoAccount } from "./accounts.ts";
import { ZohoAccessTokenManager } from "./auth.ts";
import { ZohoMailClient } from "./client.ts";
import { ZohoMailError } from "./errors.ts";
import { normalizeZohoMessage } from "./messages.ts";
import {
  callbackAccountsBaseUrl,
  createZohoAuthorizationUrl,
  mailBaseUrlForAccountsBaseUrl,
  ZOHO_MAIL_OAUTH_SCOPES,
} from "./oauth.ts";

function assertEquals(actual: unknown, expected: unknown, message = "Values differ") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function assertRejects(
  callback: () => unknown | Promise<unknown>,
  code: string,
) {
  try {
    await callback();
  } catch (error) {
    assertEquals(error instanceof ZohoMailError ? error.code : "", code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

Deno.test("OAuth URL requests offline account read and message read/create access", () => {
  const url = createZohoAuthorizationUrl({
    accountsBaseUrl: "https://accounts.zoho.com",
    clientId: "client-id",
    redirectUri: "https://ops.example.com/api/auth/zoho/callback",
    state: "secure-state",
  });

  assertEquals(url.origin, "https://accounts.zoho.com");
  assertEquals(url.pathname, "/oauth/v2/auth");
  assertEquals(url.searchParams.get("access_type"), "offline");
  assertEquals(url.searchParams.get("prompt"), "consent");
  assertEquals(url.searchParams.get("state"), "secure-state");
  assertEquals(url.searchParams.get("scope"), ZOHO_MAIL_OAUTH_SCOPES.join(","));
});

Deno.test("Zoho data-center handling maps official accounts and mail domains", async () => {
  assertEquals(
    callbackAccountsBaseUrl("https://accounts.zohocloud.ca", "https://accounts.zoho.com"),
    "https://accounts.zohocloud.ca",
  );
  assertEquals(
    mailBaseUrlForAccountsBaseUrl("https://accounts.zohocloud.ca"),
    "https://mail.zohocloud.ca",
  );
  await assertRejects(
    () => callbackAccountsBaseUrl("https://accounts.zoho.com.attacker.test", "https://accounts.zoho.com"),
    "CONFIGURATION_ERROR",
  );
});

Deno.test("access token manager refreshes once and reuses a valid cached token", async () => {
  let calls = 0;
  const manager = new ZohoAccessTokenManager({
    clientId: "client-id",
    clientSecret: "client-secret",
    refreshToken: "refresh-token",
    accountsBaseUrl: "https://accounts.zoho.com",
  }, () => {
    calls += 1;
    return Promise.resolve(Response.json({ access_token: "access-token", expires_in: 3600 }));
  }, () => 1_000);

  assertEquals(await manager.getAccessToken(), "access-token");
  assertEquals(await manager.getAccessToken(), "access-token");
  assertEquals(calls, 1);
});

Deno.test("account matching selects hello mailbox and requires an enabled send alias", () => {
  const account = normalizeZohoAccount({
    accountId: "123",
    mailboxAddress: "hello@dlride.com",
    primaryEmailAddress: "hello@dlride.com",
    emailAddress: [
      { mailId: "hello@dlride.com" },
      { mailId: "applications@dlride.com" },
    ],
    sendMailDetails: [
      { fromAddress: "hello@dlride.com", status: true },
      { fromAddress: "applications@dlride.com", status: true },
    ],
  });

  assertEquals(findZohoMailboxAccount([account], "hello@dlride.com")?.accountId, "123");
  assertEquals(isZohoSendAliasAuthorized(account, "applications@dlride.com"), true);
  assertEquals(isZohoSendAliasAuthorized(account, "other@dlride.com"), false);
});

Deno.test("message list values normalize to the server contract", () => {
  assertEquals(normalizeZohoMessage({
    messageId: "message-1",
    folderId: "folder-1",
    threadId: "thread-1",
    fromAddress: "customer@example.com",
    toAddress: "applications@dlride.com",
    subject: "Rental question",
    receivedTime: "1709887053409",
    hasAttachment: "1",
  }), {
    message_id: "message-1",
    folder_id: "folder-1",
    thread_id: "thread-1",
    sender: "customer@example.com",
    recipient: "applications@dlride.com",
    subject: "Rental question",
    received_at: "2024-03-08T08:37:33.409Z",
    has_attachments: true,
  });
});

Deno.test("client refreshes once after an unauthorized response", async () => {
  const tokens: boolean[] = [];
  let calls = 0;
  const client = new ZohoMailClient(
    "https://mail.zoho.com",
    (force) => {
      tokens.push(Boolean(force));
      return Promise.resolve(force ? "fresh-token" : "old-token");
    },
    () => {
      calls += 1;
      return Promise.resolve(calls === 1
        ? new Response(null, { status: 401 })
        : Response.json({ status: { code: 200 }, data: [] }));
    },
  );

  await client.request("/api/accounts");
  assertEquals(tokens, [false, true]);
  assertEquals(calls, 2);
});

Deno.test("client reports Zoho rate limits without leaking response data", async () => {
  const client = new ZohoMailClient(
    "https://mail.zoho.com",
    () => Promise.resolve("token"),
    () => Promise.resolve(new Response("provider detail", {
      status: 429,
      headers: { "Retry-After": "60" },
    })),
  );

  await assertRejects(() => client.request("/api/accounts"), "RATE_LIMITED");
});
