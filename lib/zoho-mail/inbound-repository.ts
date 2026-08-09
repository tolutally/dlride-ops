import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  AllowedInboundAttachmentType,
  InboundMessageRepository,
  StoreInboundAttachmentInput,
  StoreInboundMessageInput,
  StoredInboundMessage,
} from "./inbound-sync";

export const INBOUND_ATTACHMENT_BUCKET = "application-email-attachments";

function requiredServerEnvironment(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing server configuration: ${names.join(" or ")}`);
}

function assertNoSupabaseError(error: { message: string } | null, operation: string) {
  if (error) throw new Error(`${operation} failed`);
}

type StoreMessageRpcRow = {
  message_id: string;
  application_id: string | null;
  message_status: "matched" | "unmatched" | "failed";
  inserted: boolean;
};

export class SupabaseInboundMessageRepository implements InboundMessageRepository {
  constructor(private readonly client: SupabaseClient) {}

  async hasZohoMessage(zohoMessageId: string) {
    const { data, error } = await this.client
      .from("application_messages")
      .select("id")
      .eq("zoho_message_id", zohoMessageId)
      .limit(1)
      .maybeSingle();
    assertNoSupabaseError(error, "Inbound message lookup");
    return Boolean(data);
  }

  async storeMessage(input: StoreInboundMessageInput): Promise<StoredInboundMessage> {
    const { data, error } = await this.client.rpc(
      "store_inbound_application_message",
      {
        p_application_number: input.application_number,
        p_sender_email: input.sender_email,
        p_recipient_email: input.recipient_email,
        p_subject: input.subject,
        p_body_text: input.body_text,
        p_external_message_id: input.external_message_id,
        p_received_at: input.received_at,
        p_body_html: input.body_html,
        p_zoho_message_id: input.zoho_message_id,
        p_zoho_thread_id: input.zoho_thread_id,
        p_in_reply_to: input.in_reply_to,
        p_has_attachments: input.has_attachments,
      },
    );
    assertNoSupabaseError(error, "Inbound message storage");
    const row = (Array.isArray(data) ? data[0] : data) as StoreMessageRpcRow | null;
    if (!row?.message_id || typeof row.inserted !== "boolean") {
      throw new Error("Inbound message storage returned an invalid result");
    }
    return {
      id: row.message_id,
      inserted: row.inserted,
      application_id: row.application_id,
      status: row.message_status,
    };
  }

  async uploadAttachment(
    path: string,
    bytes: Uint8Array,
    mimeType: AllowedInboundAttachmentType,
  ) {
    const { error } = await this.client.storage
      .from(INBOUND_ATTACHMENT_BUCKET)
      .upload(path, bytes, { contentType: mimeType, upsert: false });
    assertNoSupabaseError(error, "Inbound attachment upload");
  }

  async storeAttachment(input: StoreInboundAttachmentInput) {
    const { error } = await this.client.from("message_attachments").insert({
      message_id: input.message_id,
      filename: input.filename,
      mime_type: input.mime_type,
      storage_path: input.storage_path,
      file_size: input.file_size,
    });
    assertNoSupabaseError(error, "Inbound attachment metadata storage");
  }

  async removeAttachment(path: string) {
    const { data, error } = await this.client.storage
      .from(INBOUND_ATTACHMENT_BUCKET)
      .remove([path]);
    assertNoSupabaseError(error, "Inbound attachment cleanup");
    if (!data?.some((item) => item.name === path || path.endsWith(`/${item.name}`))) {
      throw new Error("Inbound attachment cleanup did not confirm removal");
    }
  }

  async markMessageFailed(messageId: string) {
    const { data, error } = await this.client
      .from("application_messages")
      .update({ status: "failed" })
      .eq("id", messageId)
      .select("id")
      .maybeSingle();
    assertNoSupabaseError(error, "Inbound message failure update");
    if (!data) throw new Error("Inbound message failure update found no message");
  }
}

export function createSupabaseInboundMessageRepository() {
  const url = requiredServerEnvironment("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredServerEnvironment(
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SECRET_KEYS",
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return new SupabaseInboundMessageRepository(client);
}
