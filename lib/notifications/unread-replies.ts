import "server-only";

import { createServerAuthClient } from "@/lib/supabase/server";

import { notificationPreview } from "./format";
import type { UnreadReplyNotification, UnreadReplySnapshot } from "./types";

const NOTIFICATION_LIMIT = 10;

type MessageRow = {
  id: string;
  application_id: string | null;
  application_number: string | null;
  subject: string;
  body_text: string;
  received_at: string;
};

type ApplicationRow = {
  id: string;
  application_number: string;
  first_name: string;
  last_name: string;
};

export function emptyUnreadReplySnapshot(): UnreadReplySnapshot {
  return {
    total: 0,
    items: [],
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchUnreadReplyNotifications(): Promise<UnreadReplySnapshot> {
  const generatedAt = new Date().toISOString();

  try {
    const supabase = await createServerAuthClient();
    const [countResult, messagesResult] = await Promise.all([
      supabase
        .from("application_messages")
        .select("id", { count: "exact", head: true })
        .eq("direction", "inbound")
        .eq("status", "matched")
        .eq("is_read", false)
        .not("application_id", "is", null),
      supabase
        .from("application_messages")
        .select("id,application_id,application_number,subject,body_text,received_at")
        .eq("direction", "inbound")
        .eq("status", "matched")
        .eq("is_read", false)
        .not("application_id", "is", null)
        .order("received_at", { ascending: false })
        .limit(NOTIFICATION_LIMIT),
    ]);

    if (countResult.error || messagesResult.error) {
      console.error(JSON.stringify({
        event: "unread_reply_notifications_query_failed",
        countCode: countResult.error?.code,
        listCode: messagesResult.error?.code,
      }));
      return { total: 0, items: [], generatedAt };
    }

    const messages = (messagesResult.data ?? []) as MessageRow[];
    const applicationIds = [...new Set(
      messages.flatMap((message) => message.application_id ? [message.application_id] : []),
    )];

    if (applicationIds.length === 0) {
      return { total: countResult.count ?? 0, items: [], generatedAt };
    }

    const { data: applications, error: applicationsError } = await supabase
      .from("applications")
      .select("id,application_number,first_name,last_name")
      .in("id", applicationIds);

    if (applicationsError) {
      console.error(JSON.stringify({
        event: "unread_reply_notification_applications_query_failed",
        code: applicationsError.code,
      }));
      return { total: countResult.count ?? 0, items: [], generatedAt };
    }

    const applicationById = new Map(
      ((applications ?? []) as ApplicationRow[]).map((application) => [application.id, application]),
    );
    const items = messages.flatMap<UnreadReplyNotification>((message) => {
      if (!message.application_id) return [];
      const application = applicationById.get(message.application_id);
      if (!application) return [];
      return [{
        id: message.id,
        applicationId: application.id,
        applicationNumber: application.application_number || message.application_number || "Application",
        customerName: `${application.first_name} ${application.last_name}`.trim(),
        preview: notificationPreview(message.body_text, message.subject),
        receivedAt: message.received_at,
      }];
    });

    return {
      total: countResult.count ?? 0,
      items,
      generatedAt,
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: "unread_reply_notifications_failed",
      message: error instanceof Error ? error.message : "unknown",
    }));
    return { total: 0, items: [], generatedAt };
  }
}

