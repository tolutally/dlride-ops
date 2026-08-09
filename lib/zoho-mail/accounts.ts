import { ZohoMailClient } from "./client";
import { ZohoMailError } from "./errors";
import type { ZohoMailAccount, ZohoSendAddress } from "./types";

type ZohoEnvelope = { data?: unknown };

function text(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : "";
}

function enabled(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeSendAddresses(record: Record<string, unknown>): ZohoSendAddress[] {
  if (!Array.isArray(record.sendMailDetails)) return [];
  return record.sendMailDetails.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const details = entry as Record<string, unknown>;
    const address = text(details, "fromAddress").toLowerCase();
    if (!address) return [];
    return [{
      address,
      displayName: text(details, "displayName") || null,
      enabled: enabled(details.status),
    }];
  });
}

export function normalizeZohoAccount(value: unknown): ZohoMailAccount {
  if (!value || typeof value !== "object") {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned an invalid account");
  }
  const record = value as Record<string, unknown>;
  const accountId = text(record, "accountId");
  const mailboxAddress = text(record, "mailboxAddress").toLowerCase();
  const primaryEmailAddress = text(record, "primaryEmailAddress").toLowerCase();
  if (!accountId || (!mailboxAddress && !primaryEmailAddress)) {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned an invalid account");
  }

  const emailAddresses = Array.isArray(record.emailAddress)
    ? record.emailAddress.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const address = text(entry as Record<string, unknown>, "mailId").toLowerCase();
        return address ? [address] : [];
      })
    : [];

  return {
    accountId,
    mailboxAddress,
    primaryEmailAddress,
    emailAddresses,
    sendAddresses: normalizeSendAddresses(record),
  };
}

export async function listZohoMailAccounts(client: ZohoMailClient) {
  const response = await client.request<ZohoEnvelope>("/api/accounts");
  if (!Array.isArray(response.data)) {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned an invalid account list");
  }
  return response.data.map(normalizeZohoAccount);
}

export async function getZohoMailAccount(client: ZohoMailClient, accountId: string) {
  const response = await client.request<ZohoEnvelope>(
    `/api/accounts/${encodeURIComponent(accountId)}`,
  );
  return normalizeZohoAccount(response.data);
}

export function findZohoMailboxAccount(accounts: ZohoMailAccount[], mailbox: string) {
  const expected = mailbox.trim().toLowerCase();
  return accounts.find((account) =>
    account.mailboxAddress === expected
    || account.primaryEmailAddress === expected
    || account.emailAddresses.includes(expected)
  );
}

export async function resolveZohoMailboxAccount(
  client: ZohoMailClient,
  mailbox: string,
) {
  const account = findZohoMailboxAccount(await listZohoMailAccounts(client), mailbox);
  if (!account) {
    throw new ZohoMailError(
      "MAILBOX_NOT_FOUND",
      `Zoho mailbox ${mailbox} was not found for the authenticated user`,
      404,
    );
  }
  return getZohoMailAccount(client, account.accountId);
}

export async function verifyZohoMailboxIdentity(
  client: ZohoMailClient,
  accountId: string,
  mailbox: string,
) {
  const account = await getZohoMailAccount(client, accountId);
  if (!findZohoMailboxAccount([account], mailbox)) {
    throw new ZohoMailError(
      "MAILBOX_MISMATCH",
      `Configured Zoho account does not belong to ${mailbox}`,
      409,
    );
  }
  return account;
}

export function isZohoSendAliasAuthorized(account: ZohoMailAccount, alias: string) {
  const expected = alias.trim().toLowerCase();
  return account.sendAddresses.some((sender) =>
    sender.address === expected && sender.enabled
  );
}

