import { ZohoMailClient } from "./client";
import { ZohoMailError } from "./errors";
import type {
  ZohoMessageContent,
  ZohoMessageHeaders,
  ZohoMessageSummary,
  ZohoAttachment,
  ZohoAttachmentContent,
  ZohoReplyInput,
  ZohoSendMessageInput,
  ZohoUploadedAttachment,
} from "./types";

type ZohoEnvelope = { data?: unknown };

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function timestamp(value: string) {
  const milliseconds = Number(value);
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? new Date(milliseconds).toISOString()
    : "";
}

export function normalizeZohoMessage(value: unknown): ZohoMessageSummary {
  if (!value || typeof value !== "object") {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned an invalid message");
  }
  const record = value as Record<string, unknown>;
  const messageId = text(record, "messageId");
  const folderId = text(record, "folderId");
  if (!messageId || !folderId) {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned an invalid message");
  }
  const receivedAt = timestamp(text(record, "receivedTime"));
  return {
    message_id: messageId,
    folder_id: folderId,
    thread_id: text(record, "threadId") || null,
    sender: text(record, "fromAddress") || text(record, "sender"),
    recipient: text(record, "toAddress"),
    subject: text(record, "subject"),
    received_at: receivedAt,
    has_attachments: ["1", "true"].includes(text(record, "hasAttachment").toLowerCase()),
  };
}

export async function listRecentZohoMessages(
  client: ZohoMailClient,
  accountId: string,
  limit = 5,
) {
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
  const response = await client.request<ZohoEnvelope>(
    `/api/accounts/${encodeURIComponent(accountId)}/messages/view?start=1&limit=${safeLimit}&status=all&sortBy=date&sortorder=false&includeto=true&includesent=false`,
  );
  if (!Array.isArray(response.data)) {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned an invalid message list");
  }
  return response.data.map(normalizeZohoMessage);
}

function firstHeader(
  headers: Record<string, unknown>,
  ...names: string[]
): string | null {
  const entry = Object.entries(headers).find(([key]) =>
    names.some((name) => key.toLowerCase() === name.toLowerCase())
  );
  if (!entry) return null;
  const value = entry[1];
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string");
    return typeof first === "string" && first.trim() ? first.trim() : null;
  }
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function readZohoMessageHeaders(
  client: ZohoMailClient,
  accountId: string,
  message: Pick<ZohoMessageSummary, "message_id" | "folder_id">,
): Promise<ZohoMessageHeaders> {
  const response = await client.request<ZohoEnvelope>(
    `/api/accounts/${encodeURIComponent(accountId)}/folders/${encodeURIComponent(message.folder_id)}/messages/${encodeURIComponent(message.message_id)}/header?raw=false`,
  );
  if (!response.data || typeof response.data !== "object") {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned invalid message headers");
  }
  const data = response.data as Record<string, unknown>;
  const headerContent = data.headerContent;
  if (!headerContent || typeof headerContent !== "object" || Array.isArray(headerContent)) {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned invalid message headers");
  }
  const headers = headerContent as Record<string, unknown>;
  return {
    message_id: message.message_id,
    message_id_header: firstHeader(headers, "Message-Id", "Message-ID"),
    in_reply_to: firstHeader(headers, "In-Reply-To"),
    from: firstHeader(headers, "From"),
    to: firstHeader(headers, "To", "Delivered-To"),
  };
}

export async function listZohoMessageAttachments(
  client: ZohoMailClient,
  accountId: string,
  message: Pick<ZohoMessageSummary, "message_id" | "folder_id">,
): Promise<ZohoAttachment[]> {
  const response = await client.request<ZohoEnvelope>(
    `/api/accounts/${encodeURIComponent(accountId)}/folders/${encodeURIComponent(message.folder_id)}/messages/${encodeURIComponent(message.message_id)}/attachmentinfo?includeInline=false`,
  );
  if (!response.data || typeof response.data !== "object") {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned invalid attachment information");
  }
  const attachments = (response.data as Record<string, unknown>).attachments;
  if (!Array.isArray(attachments)) return [];
  return attachments.map((value) => {
    if (!value || typeof value !== "object") {
      throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned an invalid attachment");
    }
    const record = value as Record<string, unknown>;
    const attachmentId = text(record, "attachmentId");
    const filename = text(record, "attachmentName");
    const size = Number(text(record, "attachmentSize"));
    if (!attachmentId || !filename || !Number.isFinite(size) || size < 0) {
      throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned an invalid attachment");
    }
    return { attachment_id: attachmentId, filename, size };
  });
}

export async function downloadZohoMessageAttachment(
  client: ZohoMailClient,
  accountId: string,
  message: Pick<ZohoMessageSummary, "message_id" | "folder_id">,
  attachmentId: string,
): Promise<ZohoAttachmentContent> {
  const response = await client.requestBinary(
    `/api/accounts/${encodeURIComponent(accountId)}/folders/${encodeURIComponent(message.folder_id)}/messages/${encodeURIComponent(message.message_id)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return { bytes: response.bytes, content_type: response.contentType };
}

export async function readZohoMessage(
  client: ZohoMailClient,
  accountId: string,
  message: Pick<ZohoMessageSummary, "message_id" | "folder_id">,
): Promise<ZohoMessageContent> {
  const response = await client.request<ZohoEnvelope>(
    `/api/accounts/${encodeURIComponent(accountId)}/folders/${encodeURIComponent(message.folder_id)}/messages/${encodeURIComponent(message.message_id)}/content`,
  );
  if (!response.data || typeof response.data !== "object") {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned invalid message content");
  }
  const content = text(response.data as Record<string, unknown>, "content");
  return { message_id: message.message_id, folder_id: message.folder_id, content };
}

function messageBody(input: ZohoSendMessageInput) {
  return JSON.stringify({
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    subject: input.subject,
    content: input.content,
    mailFormat: input.mailFormat ?? "plaintext",
    encoding: "UTF-8",
    attachments: input.attachments,
  });
}

export function sendZohoMessage(
  client: ZohoMailClient,
  accountId: string,
  input: ZohoSendMessageInput,
) {
  return client.request<ZohoEnvelope>(
    `/api/accounts/${encodeURIComponent(accountId)}/messages`,
    { method: "POST", body: messageBody(input) },
  );
}

export function replyToZohoMessage(
  client: ZohoMailClient,
  accountId: string,
  input: ZohoReplyInput,
) {
  return client.request<ZohoEnvelope>(
    `/api/accounts/${encodeURIComponent(accountId)}/messages/${encodeURIComponent(input.messageId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        subject: input.subject,
        content: input.content,
        mailFormat: input.mailFormat ?? "plaintext",
        encoding: "UTF-8",
        attachments: input.attachments,
        action: "reply",
      }),
    },
  );
}

export async function uploadZohoMessageAttachment(
  client: ZohoMailClient,
  accountId: string,
  file: { name: string; type: string; bytes: ArrayBuffer },
): Promise<ZohoUploadedAttachment> {
  const response = await client.request<ZohoEnvelope>(
    `/api/accounts/${encodeURIComponent(accountId)}/messages/attachments?fileName=${encodeURIComponent(file.name)}&isInline=false`,
    {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file.bytes,
    },
  );
  if (!response.data || typeof response.data !== "object" || Array.isArray(response.data)) {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned invalid attachment metadata");
  }
  const data = response.data as Record<string, unknown>;
  const storeName = text(data, "storeName");
  const attachmentName = text(data, "attachmentName");
  const attachmentPath = text(data, "attachmentPath");
  if (!storeName || !attachmentName || !attachmentPath) {
    throw new ZohoMailError("INVALID_RESPONSE", "Zoho returned invalid attachment metadata");
  }
  return { storeName, attachmentName, attachmentPath };
}
