export type ZohoMailErrorCode =
  | "CONFIGURATION_ERROR"
  | "OAUTH_SETUP_DISABLED"
  | "OAUTH_ACCESS_DENIED"
  | "OAUTH_STATE_INVALID"
  | "OAUTH_CODE_MISSING"
  | "OAUTH_TOKEN_EXCHANGE_FAILED"
  | "OAUTH_REFRESH_TOKEN_MISSING"
  | "TOKEN_REFRESH_FAILED"
  | "MAILBOX_NOT_FOUND"
  | "MAILBOX_MISMATCH"
  | "ALIAS_NOT_AUTHORIZED"
  | "RATE_LIMITED"
  | "API_REQUEST_FAILED"
  | "INVALID_RESPONSE";

export class ZohoMailError extends Error {
  constructor(
    public readonly code: ZohoMailErrorCode,
    message: string,
    public readonly status = 500,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ZohoMailError";
  }
}

