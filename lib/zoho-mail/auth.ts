import "server-only";

import { readZohoMailConfiguration } from "./config";
import { ZohoMailError } from "./errors";
import { normalizeZohoBaseUrl } from "./oauth";
import type {
  Fetcher,
  ZohoOAuthConfiguration,
  ZohoTokenResult,
} from "./types";

const EXPIRY_BUFFER_MS = 60_000;

function tokenResult(
  payload: unknown,
  requireRefreshToken = false,
): ZohoTokenResult {
  const failureCode = requireRefreshToken
    ? "OAUTH_TOKEN_EXCHANGE_FAILED"
    : "TOKEN_REFRESH_FAILED";
  if (!payload || typeof payload !== "object") {
    throw new ZohoMailError(failureCode, "Zoho OAuth failed");
  }
  const data = payload as Record<string, unknown>;
  if (typeof data.access_token !== "string" || !data.access_token) {
    throw new ZohoMailError(failureCode, "Zoho OAuth failed");
  }
  if (requireRefreshToken && (typeof data.refresh_token !== "string" || !data.refresh_token)) {
    throw new ZohoMailError(
      "OAUTH_REFRESH_TOKEN_MISSING",
      "Zoho did not return a refresh token. Reconnect and grant consent.",
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    expiresIn: typeof data.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : 3600,
    apiDomain: typeof data.api_domain === "string" ? data.api_domain : undefined,
  };
}

async function requestToken(
  accountsBaseUrl: string,
  body: URLSearchParams,
  fetcher: Fetcher,
  requireRefreshToken: boolean,
) {
  const response = await fetcher(
    new URL("/oauth/v2/token", normalizeZohoBaseUrl(accountsBaseUrl, "accounts")),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new ZohoMailError(
      requireRefreshToken ? "OAUTH_TOKEN_EXCHANGE_FAILED" : "TOKEN_REFRESH_FAILED",
      requireRefreshToken ? "Unable to complete Zoho OAuth" : "Unable to refresh Zoho access token",
      response.status,
    );
  }
  return tokenResult(await response.json(), requireRefreshToken);
}

export function exchangeZohoAuthorizationCode(
  input: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    accountsBaseUrl: string;
  },
  fetcher: Fetcher = fetch,
) {
  return requestToken(
    input.accountsBaseUrl,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
    fetcher,
    true,
  );
}

export function refreshZohoAccessToken(
  configuration: ZohoOAuthConfiguration,
  fetcher: Fetcher = fetch,
) {
  return requestToken(
    configuration.accountsBaseUrl,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      refresh_token: configuration.refreshToken,
    }),
    fetcher,
    false,
  );
}

export class ZohoAccessTokenManager {
  private cached?: { accessToken: string; expiresAt: number };
  private pending?: Promise<string>;

  constructor(
    private readonly configuration: ZohoOAuthConfiguration,
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async getAccessToken(forceRefresh = false) {
    if (
      !forceRefresh
      && this.cached
      && this.cached.expiresAt - EXPIRY_BUFFER_MS > this.now()
    ) {
      return this.cached.accessToken;
    }
    if (!forceRefresh && this.pending) return this.pending;

    const refresh = refreshZohoAccessToken(this.configuration, this.fetcher)
      .then((result) => {
        this.cached = {
          accessToken: result.accessToken,
          expiresAt: this.now() + result.expiresIn * 1000,
        };
        return result.accessToken;
      })
      .finally(() => {
        this.pending = undefined;
      });
    this.pending = refresh;
    return refresh;
  }

  clear() {
    this.cached = undefined;
  }
}

let productionManager: ZohoAccessTokenManager | undefined;

export function getZohoAccessToken(forceRefresh = false) {
  productionManager ??= new ZohoAccessTokenManager(readZohoMailConfiguration());
  return productionManager.getAccessToken(forceRefresh);
}
