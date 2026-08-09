import "server-only";

import { ZohoMailError } from "./errors";
import type {
  ZohoMailConfiguration,
  ZohoSetupConfiguration,
} from "./types";

const DEFAULT_ACCOUNTS_BASE_URL = "https://accounts.zoho.com";
const DEFAULT_MAIL_API_BASE_URL = "https://mail.zoho.com";

function value(name: string) {
  return process.env[name]?.trim() ?? "";
}

function required(name: string) {
  const configured = value(name);
  if (!configured) {
    throw new ZohoMailError(
      "CONFIGURATION_ERROR",
      `Missing Zoho configuration: ${name}`,
    );
  }
  return configured;
}

export function readZohoMailConfiguration(): ZohoMailConfiguration {
  return {
    clientId: required("ZOHO_CLIENT_ID"),
    clientSecret: required("ZOHO_CLIENT_SECRET"),
    refreshToken: required("ZOHO_REFRESH_TOKEN"),
    accountId: required("ZOHO_MAIL_ACCOUNT_ID"),
    mailAddress: required("ZOHO_MAIL_ADDRESS").toLowerCase(),
    fromAlias: required("ZOHO_MAIL_FROM_ALIAS").toLowerCase(),
    accountsBaseUrl: value("ZOHO_ACCOUNTS_BASE_URL") || DEFAULT_ACCOUNTS_BASE_URL,
    mailApiBaseUrl: value("ZOHO_MAIL_API_BASE_URL") || DEFAULT_MAIL_API_BASE_URL,
  };
}

export function readZohoSetupConfiguration(): ZohoSetupConfiguration {
  const enabled = value("ZOHO_OAUTH_SETUP_ENABLED") === "true";
  if (!enabled) {
    throw new ZohoMailError(
      "OAUTH_SETUP_DISABLED",
      "Zoho OAuth setup is disabled",
      404,
    );
  }
  return {
    enabled,
    setupSecret: required("ZOHO_SETUP_SECRET"),
    clientId: required("ZOHO_CLIENT_ID"),
    clientSecret: required("ZOHO_CLIENT_SECRET"),
    accountsBaseUrl: value("ZOHO_ACCOUNTS_BASE_URL") || DEFAULT_ACCOUNTS_BASE_URL,
    mailApiBaseUrl: value("ZOHO_MAIL_API_BASE_URL") || undefined,
    mailAddress: (value("ZOHO_MAIL_ADDRESS") || "hello@dlride.com").toLowerCase(),
    fromAlias: (value("ZOHO_MAIL_FROM_ALIAS") || "applications@dlride.com").toLowerCase(),
    redirectUri: value("ZOHO_OAUTH_REDIRECT_URI") || undefined,
  };
}
