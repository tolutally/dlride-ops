import { ZohoMailError } from "./errors";

export const ZOHO_MAIL_OAUTH_SCOPES = [
  "ZohoMail.accounts.READ",
  "ZohoMail.messages.READ",
  "ZohoMail.messages.CREATE",
] as const;

const ACCOUNTS_TO_MAIL_BASE_URL = new Map([
  ["https://accounts.zoho.com", "https://mail.zoho.com"],
  ["https://accounts.zoho.eu", "https://mail.zoho.eu"],
  ["https://accounts.zoho.in", "https://mail.zoho.in"],
  ["https://accounts.zoho.com.au", "https://mail.zoho.com.au"],
  ["https://accounts.zoho.jp", "https://mail.zoho.jp"],
  ["https://accounts.zohocloud.ca", "https://mail.zohocloud.ca"],
  ["https://accounts.zoho.com.cn", "https://mail.zoho.com.cn"],
  ["https://accounts.zoho.sa", "https://mail.zoho.sa"],
  ["https://accounts.zoho.uk", "https://mail.zoho.uk"],
  ["https://accounts.zoho.ae", "https://mail.zoho.ae"],
]);

export function normalizeZohoBaseUrl(value: string, kind: "accounts" | "mail") {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ZohoMailError("CONFIGURATION_ERROR", `Invalid Zoho ${kind} base URL`);
  }

  const normalized = `${url.protocol}//${url.host}`;
  const allowed = kind === "accounts"
    ? ACCOUNTS_TO_MAIL_BASE_URL.has(normalized)
    : [...ACCOUNTS_TO_MAIL_BASE_URL.values()].includes(normalized);
  if (url.protocol !== "https:" || url.pathname !== "/" || !allowed) {
    throw new ZohoMailError("CONFIGURATION_ERROR", `Invalid Zoho ${kind} base URL`);
  }
  return normalized;
}

export function mailBaseUrlForAccountsBaseUrl(accountsBaseUrl: string) {
  const accounts = normalizeZohoBaseUrl(accountsBaseUrl, "accounts");
  const mail = ACCOUNTS_TO_MAIL_BASE_URL.get(accounts);
  if (!mail) {
    throw new ZohoMailError("CONFIGURATION_ERROR", "Unsupported Zoho data center");
  }
  return mail;
}

export function callbackAccountsBaseUrl(
  providerValue: string | null,
  configuredValue: string,
) {
  return normalizeZohoBaseUrl(providerValue || configuredValue, "accounts");
}

export function createZohoAuthorizationUrl(input: {
  accountsBaseUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("/oauth/v2/auth", normalizeZohoBaseUrl(input.accountsBaseUrl, "accounts"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("scope", ZOHO_MAIL_OAUTH_SCOPES.join(","));
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", input.state);
  return url;
}

export function secureRandomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
