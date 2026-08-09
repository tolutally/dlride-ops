import "server-only";

import { requireStaff } from "@/lib/auth/staff";
import { createServerAuthClient } from "@/lib/supabase/server";

import type {
  ApplicationActivityItem,
  ApplicationDetail,
  ApplicationDetailResult,
  ApplicationMessage,
} from "./detail-types";

const CONVERSATION_PAGE_SIZE = 20;

const APPLICATION_DETAIL_COLUMNS = [
  "id",
  "application_number",
  "status",
  "first_name",
  "last_name",
  "email",
  "phone",
  "street_address",
  "city",
  "state",
  "postal_code",
  "rental_start_date",
  "rental_end_date",
  "pickup_date",
  "pickup_time",
  "pickup_location",
  "pickup_instructions",
  "dropoff_time",
  "rental_weeks",
  "assigned_car",
  "intended_vehicle_use",
  "payment_method",
  "additional_information",
  "drivers_license_path",
  "proof_of_address_path",
  "internal_notes",
  "decision_reason",
  "created_at",
  "updated_at",
  "reviewed_at",
].join(",");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isApplicationId(value: string) {
  return UUID_PATTERN.test(value);
}

export async function fetchApplicationDetail(id: string): Promise<ApplicationDetailResult | null> {
  if (!isApplicationId(id)) return null;

  await requireStaff();
  const supabase = await createServerAuthClient();
  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select(APPLICATION_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (applicationError) {
    console.error(JSON.stringify({
      event: "application_detail_query_failed",
      code: applicationError.code,
      message: applicationError.message,
      details: applicationError.details,
      hint: applicationError.hint,
    }));
    throw new Error("Application could not be loaded");
  }

  if (!application) return null;

  const { data: activity, error: activityError } = await supabase
    .from("application_activity")
    .select("id,action,note,created_at")
    .eq("application_id", id)
    .order("created_at", { ascending: true });

  if (activityError) {
    console.error(JSON.stringify({
      event: "application_activity_query_failed",
      code: activityError.code,
    }));
    throw new Error("Application activity could not be loaded");
  }

  let { data: recentMessages, error: messagesError } = await supabase
    .from("application_messages")
    .select("id,direction,sender_email,recipient_email,subject,body_text,received_at,is_read,message_attachments(id,filename,mime_type,file_size)")
    .eq("application_id", id)
    .eq("status", "matched")
    .order("received_at", { ascending: false })
    .limit(CONVERSATION_PAGE_SIZE + 1);

  // Keep the detail page available during rolling deploys where application
  // code reaches an environment just before the unread-state migration.
  if (messagesError?.code === "42703") {
    const legacyResult = await supabase
      .from("application_messages")
      .select("id,direction,sender_email,recipient_email,subject,body_text,received_at,message_attachments(id,filename,mime_type,file_size)")
      .eq("application_id", id)
      .eq("status", "matched")
      .order("received_at", { ascending: false })
      .limit(CONVERSATION_PAGE_SIZE + 1);
    recentMessages = legacyResult.data?.map((message) => ({ ...message, is_read: true })) ?? null;
    messagesError = legacyResult.error;
  }

  if (messagesError) {
    console.error(JSON.stringify({
      event: "application_messages_query_failed",
      code: messagesError.code,
    }));
    throw new Error("Application conversation could not be loaded");
  }

  let unreadCount = 0;
  const unreadResult = await supabase
    .from("application_messages")
    .select("id", { count: "exact", head: true })
    .eq("application_id", id)
    .eq("direction", "inbound")
    .eq("status", "matched")
    .eq("is_read", false);

  if (unreadResult.error?.code !== "42703") {
    if (unreadResult.error) {
      console.error(JSON.stringify({
        event: "application_unread_messages_query_failed",
        code: unreadResult.error.code,
      }));
    } else {
      unreadCount = unreadResult.count ?? 0;
    }
  }

  const hasEarlier = (recentMessages?.length ?? 0) > CONVERSATION_PAGE_SIZE;
  const messages = (recentMessages ?? []).slice(0, CONVERSATION_PAGE_SIZE).reverse().map((message) => ({
    ...message,
    attachments: message.message_attachments ?? [],
  })) as unknown as ApplicationMessage[];

  return {
    application: application as unknown as ApplicationDetail,
    activity: (activity ?? []) as unknown as ApplicationActivityItem[],
    conversation: {
      messages,
      hasEarlier,
      hasUnread: unreadCount > 0,
      unreadCount,
    },
  };
}
