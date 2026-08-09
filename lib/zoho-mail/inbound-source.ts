import "server-only";

import { ZohoMailClient, createZohoMailClient } from "./client";
import { readZohoMailConfiguration } from "./config";
import { ZohoMailError } from "./errors";
import type {
  InboundMessageSource,
  InboundSourceAttachment,
  InboundSourceMessage,
  InboundSourceSummary,
} from "./inbound-sync";
import {
  downloadZohoMessageAttachment,
  listRecentZohoMessages,
  listZohoMessageAttachments,
  readZohoMessage,
  readZohoMessageHeaders,
} from "./messages";
import type { ZohoMessageSummary } from "./types";

function decodeAddressEntities(value: string) {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

export function extractMailboxAddress(value: string): string | null {
  const decoded = decodeAddressEntities(value);
  const match = decoded.match(
    /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?/i,
  );
  return match?.[0]?.toLowerCase() ?? null;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hexadecimal: string) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function htmlToPlainText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<\/?(?:p|div|tr|h[1-6]|blockquote)\b[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(?:li)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitBody(content: string): { body_text: string; body_html: string | null } {
  const isHtml = /<(?:!doctype|html|body|div|p|br|table|span|blockquote)\b/i.test(content);
  return isHtml
    ? { body_text: htmlToPlainText(content), body_html: content }
    : { body_text: content, body_html: null };
}

function providerSummary(summary: InboundSourceSummary): ZohoMessageSummary {
  return {
    message_id: summary.zoho_message_id,
    folder_id: summary.folder_id,
    thread_id: summary.thread_id,
    sender: "",
    recipient: "",
    subject: summary.subject,
    received_at: summary.received_at,
    has_attachments: summary.has_attachments,
  };
}

export class ZohoInboundMessageSource implements InboundMessageSource {
  private readonly listedMessages = new Map<string, ZohoMessageSummary>();

  constructor(
    private readonly client: ZohoMailClient,
    private readonly accountId: string,
    private readonly fallbackRecipient: string,
  ) {}

  async list(limit: number): Promise<InboundSourceSummary[]> {
    const messages = await listRecentZohoMessages(this.client, this.accountId, limit);
    this.listedMessages.clear();
    for (const message of messages) this.listedMessages.set(message.message_id, message);
    return messages.map((message) => ({
      zoho_message_id: message.message_id,
      folder_id: message.folder_id,
      thread_id: message.thread_id,
      subject: message.subject,
      received_at: message.received_at,
      has_attachments: message.has_attachments,
    }));
  }

  async hydrate(summary: InboundSourceSummary): Promise<InboundSourceMessage> {
    const listed = this.listedMessages.get(summary.zoho_message_id) ?? providerSummary(summary);
    const providerMessage = {
      message_id: summary.zoho_message_id,
      folder_id: summary.folder_id,
    };
    const [content, attachments] = await Promise.all([
      readZohoMessage(this.client, this.accountId, providerMessage),
      summary.has_attachments
        ? listZohoMessageAttachments(this.client, this.accountId, providerMessage)
        : Promise.resolve([]),
    ]);
    const headers = await readZohoMessageHeaders(
      this.client,
      this.accountId,
      providerMessage,
    ).catch(() => null);
    const senderEmail = extractMailboxAddress(headers?.from ?? listed.sender);
    if (!senderEmail) {
      throw new ZohoMailError("INVALID_RESPONSE", "Zoho message sender is invalid");
    }
    const recipientEmail = extractMailboxAddress(headers?.to ?? listed.recipient) ??
      this.fallbackRecipient;
    const body = splitBody(content.content);
    const receivedTime = Date.parse(summary.received_at);
    if (!Number.isFinite(receivedTime)) {
      throw new ZohoMailError("INVALID_RESPONSE", "Zoho message received date is invalid");
    }

    return {
      ...summary,
      external_message_id: headers?.message_id_header?.trim() ||
        `zoho:${summary.zoho_message_id}`,
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      body_text: body.body_text,
      body_html: body.body_html,
      in_reply_to: headers?.in_reply_to?.trim() || null,
      attachments: attachments.map((attachment) => ({
        attachment_id: attachment.attachment_id,
        filename: attachment.filename,
        size: attachment.size,
      })),
    };
  }

  async downloadAttachment(
    summary: InboundSourceSummary,
    attachment: InboundSourceAttachment,
  ) {
    const content = await downloadZohoMessageAttachment(
      this.client,
      this.accountId,
      providerSummary(summary),
      attachment.attachment_id,
    );
    return content.bytes;
  }
}

export function createZohoInboundMessageSource() {
  const configuration = readZohoMailConfiguration();
  return new ZohoInboundMessageSource(
    createZohoMailClient(),
    configuration.accountId,
    configuration.fromAlias || configuration.mailAddress,
  );
}
