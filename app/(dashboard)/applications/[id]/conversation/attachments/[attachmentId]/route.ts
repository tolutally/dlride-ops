import { redirect } from "next/navigation";

import { requireStaff } from "@/lib/auth/staff";
import { isApplicationId } from "@/lib/applications/detail";
import { createServerDataClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  await requireStaff();
  const { id, attachmentId } = await context.params;
  if (!isApplicationId(id) || !isApplicationId(attachmentId)) return new Response("Not found", { status: 404 });
  const supabase = createServerDataClient();
  const { data: attachment, error } = await supabase
    .from("message_attachments")
    .select("storage_path,application_messages!inner(application_id)")
    .eq("id", attachmentId)
    .eq("application_messages.application_id", id)
    .maybeSingle();
  if (error || !attachment) return new Response("Not found", { status: 404 });
  const { data, error: signedUrlError } = await supabase.storage
    .from("application-email-attachments")
    .createSignedUrl(attachment.storage_path, 300);
  if (signedUrlError || !data?.signedUrl) return new Response("Attachment unavailable", { status: 502 });
  redirect(data.signedUrl);
}
