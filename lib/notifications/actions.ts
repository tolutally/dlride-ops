"use server";

import { revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/staff";
import { createServerDataClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markReplyNotificationRead(messageId: string, applicationId: string) {
  await requireStaff();
  if (!UUID_PATTERN.test(messageId) || !UUID_PATTERN.test(applicationId)) {
    return { success: false as const };
  }

  const { data, error } = await createServerDataClient()
    .from("application_messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("application_id", applicationId)
    .eq("direction", "inbound")
    .eq("status", "matched")
    .eq("is_read", false)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ event: "reply_notification_mark_read_failed", code: error.code }));
    return { success: false as const };
  }

  revalidatePath("/applications");
  revalidatePath(`/applications/${applicationId}`);
  return { success: true as const, changed: Boolean(data) };
}
