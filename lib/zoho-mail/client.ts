import "server-only";

import { getZohoAccessToken } from "./auth";
import { readZohoMailConfiguration } from "./config";
import { ZohoMailError } from "./errors";
import { normalizeZohoBaseUrl } from "./oauth";
import type { Fetcher } from "./types";

type TokenProvider = (forceRefresh?: boolean) => Promise<string>;

function retryAfterSeconds(response: Response) {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export class ZohoMailClient {
  private readonly baseUrl: string;

  constructor(
    mailApiBaseUrl: string,
    private readonly accessToken: TokenProvider,
    private readonly fetcher: Fetcher = fetch,
  ) {
    this.baseUrl = normalizeZohoBaseUrl(mailApiBaseUrl, "mail");
  }

  async request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    if (!path.startsWith("/api/")) {
      throw new ZohoMailError("CONFIGURATION_ERROR", "Invalid Zoho Mail API path");
    }
    const token = await this.accessToken(retried);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Zoho-oauthtoken ${token}`);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      headers,
      cache: "no-store",
    });
    if (response.status === 401 && !retried) {
      return this.request<T>(path, init, true);
    }
    if (response.status === 429) {
      throw new ZohoMailError(
        "RATE_LIMITED",
        "Zoho Mail rate limit exceeded",
        429,
        retryAfterSeconds(response),
      );
    }
    if (!response.ok) {
      throw new ZohoMailError(
        "API_REQUEST_FAILED",
        "Zoho Mail request failed",
        response.status,
      );
    }

    const payload = await response.json() as T & {
      status?: { code?: number; description?: string };
    };
    if (payload.status?.code && payload.status.code >= 400) {
      throw new ZohoMailError(
        "API_REQUEST_FAILED",
        "Zoho Mail request failed",
        payload.status.code,
      );
    }
    return payload;
  }

  async requestBinary(
    path: string,
    init: RequestInit = {},
    retried = false,
  ): Promise<{ bytes: Uint8Array; contentType: string | null }> {
    if (!path.startsWith("/api/")) {
      throw new ZohoMailError("CONFIGURATION_ERROR", "Invalid Zoho Mail API path");
    }
    const token = await this.accessToken(retried);
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/octet-stream");
    headers.set("Authorization", `Zoho-oauthtoken ${token}`);

    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      headers,
      cache: "no-store",
    });
    if (response.status === 401 && !retried) {
      return this.requestBinary(path, init, true);
    }
    if (response.status === 429) {
      throw new ZohoMailError(
        "RATE_LIMITED",
        "Zoho Mail rate limit exceeded",
        429,
        retryAfterSeconds(response),
      );
    }
    if (!response.ok) {
      throw new ZohoMailError(
        "API_REQUEST_FAILED",
        "Zoho Mail attachment request failed",
        response.status,
      );
    }

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get("content-type"),
    };
  }
}

export function createZohoMailClient() {
  const configuration = readZohoMailConfiguration();
  return new ZohoMailClient(configuration.mailApiBaseUrl, getZohoAccessToken);
}
