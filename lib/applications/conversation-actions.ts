"use server";

import { randomUUID } from "node:crypto";
import { refresh, revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/staff";
import { createServerAuthClient, createServerDataClient } from "@/lib/supabase/server";
import {
  createZohoMailClient,
  replyToZohoMessage,
  sendZohoMessage,
  uploadZohoMessageAttachment,
} from "@/lib/zoho-mail";
import { readZohoMailConfiguration } from "@/lib/zoho-mail/config";

import { isApplicationId } from "./detail";
import type { ApplicationMessage } from "./detail-types";

const PAGE_SIZE = 20;
const MAX_BODY_LENGTH = 20_000;
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

type StoredOutboundMessage = Omit<ApplicationMessage, "attachments">;

export type SendReplyResult =
  | { success: true; message: ApplicationMessage }
  | { success: false; message: string };

function normalizedAttachments(value: FormDataEntryValue[]) {
  return value.filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function validFiles(files: File[]) {
  return files.length <= MAX_ATTACHMENTS && files.every((file) =>
    ALLOWED_TYPES.has(file.type) && file.size <= MAX_ATTACHMENT_SIZE
  );
}

function zohoMessageId(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const data = (response as { data?: unknown }).data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const value = record.messageId ?? record.message_id;
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function safeFilename(filename: string) {
  return filename.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "attachment";
}

export async function markConversationRead(applicationId: string) {
  await requireStaff();
  if (!isApplicationId(applicationId)) return { success: false as const, markedRead: 0 };
  const supabase = createServerDataClient();
  const { data, error } = await supabase
    .from("application_messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .eq("direction", "inbound")
    .eq("status", "matched")
    .eq("is_read", false)
    .select("id");
  if (error) {
    console.error(JSON.stringify({ event: "conversation_mark_read_failed", code: error.code }));
    return { success: false as const, markedRead: 0 };
  }

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/applications");
  return { success: true as const, markedRead: data?.length ?? 0 };
}

export async function loadEarlierMessages(applicationId: string, before: string) {
  await requireStaff();
  if (!isApplicationId(applicationId) || !Number.isFinite(Date.parse(before))) {
    return { messages: [] as ApplicationMessage[], hasEarlier: false };
  }
  const supabase = await createServerAuthClient();
  let { data, error } = await supabase
    .from("application_messages")
    .select("id,direction,sender_email,recipient_email,subject,body_text,received_at,is_read,message_attachments(id,filename,mime_type,file_size)")
    .eq("application_id", applicationId)
    .eq("status", "matched")
    .lt("received_at", before)
    .order("received_at", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (error?.code === "42703") {
    const legacyResult = await supabase
      .from("application_messages")
      .select("id,direction,sender_email,recipient_email,subject,body_text,received_at,message_attachments(id,filename,mime_type,file_size)")
      .eq("application_id", applicationId)
      .eq("status", "matched")
      .lt("received_at", before)
      .order("received_at", { ascending: false })
      .limit(PAGE_SIZE + 1);
    data = legacyResult.data?.map((message) => ({ ...message, is_read: true })) ?? null;
    error = legacyResult.error;
  }
  if (error) return { messages: [] as ApplicationMessage[], hasEarlier: false };
  data ??= [];
  const hasEarlier = data.length > PAGE_SIZE;
  const messages = data.slice(0, PAGE_SIZE).reverse().map((message) => ({
    ...message,
    attachments: message.message_attachments ?? [],
  })) as unknown as ApplicationMessage[];
  return { messages, hasEarlier };
}

export async function sendApplicationReply(
  applicationId: string,
  formData: FormData,
): Promise<SendReplyResult> {
  await requireStaff();
  if (!isApplicationId(applicationId)) {
    return { success: false, message: "We couldn't send your reply. Please try again." };
  }
  const body = String(formData.get("body") ?? "").trim();
  const files = normalizedAttachments(formData.getAll("attachments"));
  if ((!body && files.length === 0) || body.length > MAX_BODY_LENGTH || !validFiles(files)) {
    return { success: false, message: "Check your reply and attachments, then try again." };
  }

  const supabase = createServerDataClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("id,application_number,email")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError || !application) {
    return { success: false, message: "We couldn't send your reply. Please try again." };
  }
  const { data: latestInbound } = await supabase
    .from("application_messages")
    .select("zoho_message_id,zoho_thread_id,subject")
    .eq("application_id", applicationId)
    .eq("direction", "inbound")
    .eq("status", "matched")
    .not("zoho_message_id", "is", null)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    const configuration = readZohoMailConfiguration();
    const client = createZohoMailClient();
    const uploaded = await Promise.all(files.map(async (file) =>
      uploadZohoMessageAttachment(client, configuration.accountId, {
        name: file.name,
        type: file.type,
        bytes: await file.arrayBuffer(),
      })
    ));
    const subject = latestInbound?.subject?.trim() || `DLride Rentals — ${application.application_number}`;
    const input = {
      fromAddress: configuration.fromAlias,
      toAddress: application.email,
      subject,
      content: body,
      mailFormat: "plaintext" as const,
      attachments: uploaded.length ? uploaded : undefined,
    };
    const response = latestInbound?.zoho_message_id
      ? await replyToZohoMessage(client, configuration.accountId, {
          ...input,
          messageId: latestInbound.zoho_message_id,
        })
      : await sendZohoMessage(client, configuration.accountId, input);
    const providerId = zohoMessageId(response) ?? randomUUID();
    const sentAt = new Date().toISOString();
    const { data: stored, error: storeError } = await supabase
      .rpc("store_outbound_application_message", {
        p_application_id: application.id,
        p_sender_email: configuration.fromAlias,
        p_recipient_email: application.email,
        p_subject: subject,
        p_body_text: body,
        p_external_message_id: `zoho-outbound:${providerId}`,
        p_received_at: sentAt,
        p_zoho_message_id: zohoMessageId(response),
        p_zoho_thread_id: latestInbound?.zoho_thread_id ?? null,
        p_in_reply_to: latestInbound?.zoho_message_id ?? null,
        p_has_attachments: files.length > 0,
      })
      .single();
    if (storeError || !stored) throw storeError ?? new Error("Outbound message was not stored");
    const storedMessage = stored as unknown as StoredOutboundMessage;

    const storedAttachments = [];
    for (const file of files) {
      const path = `${application.id}/${storedMessage.id}/${randomUUID()}-${safeFilename(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("application-email-attachments")
        .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (uploadError) {
        console.error(JSON.stringify({ event: "outbound_attachment_storage_failed", code: uploadError.message }));
        continue;
      }
      const { data: attachment, error: attachmentError } = await supabase
        .from("message_attachments")
        .insert({ message_id: storedMessage.id, filename: file.name, mime_type: file.type, storage_path: path, file_size: file.size })
        .select("id,filename,mime_type,file_size")
        .single();
      if (!attachmentError && attachment) storedAttachments.push(attachment);
    }

    revalidatePath(`/applications/${applicationId}`);
    refresh();
    return { success: true, message: { ...storedMessage, attachments: storedAttachments } as ApplicationMessage };
  } catch (error) {
    console.error(JSON.stringify({ event: "application_reply_failed", error: error instanceof Error ? error.message : "unknown" }));
    return { success: false, message: "We couldn't send your reply. Please try again." };
  }
}
