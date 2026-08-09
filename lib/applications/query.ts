import "server-only";

import { requireStaff } from "@/lib/auth/staff";
import { createServerAuthClient } from "@/lib/supabase/server";

import type {
  ApplicationQueueFilters,
  ApplicationQueueItem,
  ApplicationQueueResult,
} from "./types";

export const APPLICATION_PAGE_SIZE = 25;

const QUEUE_COLUMNS = [
  "id",
  "application_number",
  "first_name",
  "last_name",
  "email",
  "phone",
  "rental_start_date",
  "rental_end_date",
  "pickup_time",
  "dropoff_time",
  "rental_weeks",
  "intended_vehicle_use",
  "status",
  "created_at",
].join(",");

function searchTerms(query: string) {
  return query
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}@.+_\-]/gu, ""))
    .filter(Boolean)
    .slice(0, 5);
}

export async function fetchApplications(filters: ApplicationQueueFilters): Promise<ApplicationQueueResult> {
  await requireStaff();
  const supabase = await createServerAuthClient();
  const from = (filters.page - 1) * APPLICATION_PAGE_SIZE;
  const to = from + APPLICATION_PAGE_SIZE - 1;

  let query = supabase
    .from("applications")
    .select(QUEUE_COLUMNS, { count: "exact" });

  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.vehicleUse !== "all") {
    query = query.eq("intended_vehicle_use", filters.vehicleUse);
  }
  if (filters.query) {
    for (const term of searchTerms(filters.query)) {
      const pattern = `%${term}%`;
      const conditions = [
        `application_number.ilike.${pattern}`,
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
      ];

      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(term)) {
        conditions.push(`id.eq.${term}`);
      }

      query = query.or(conditions.join(","));
    }
  }

  const ascending = filters.direction === "asc";
  if (filters.sortBy === "applicant_name") {
    query = query
      .order("last_name", { ascending })
      .order("first_name", { ascending })
      .order("created_at", { ascending: false });
  } else {
    const column = filters.sortBy === "submitted" ? "created_at" : filters.sortBy;
    query = query
      .order(column, { ascending })
      .order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error(JSON.stringify({
      event: "applications_queue_query_failed",
      code: error.code,
    }));
    throw new Error("Applications could not be loaded");
  }

  const applications = (data ?? []) as unknown as ApplicationQueueItem[];
  const applicationIds = applications.map((application) => application.id);
  const unreadByApplication = new Map<string, number>();

  if (applicationIds.length > 0) {
    const unreadResult = await supabase.rpc("get_application_unread_reply_counts", {
      p_application_ids: applicationIds,
    });

    if (!unreadResult.error) {
      for (const row of (unreadResult.data ?? []) as Array<{ application_id: string; unread_count: number | string }>) {
        unreadByApplication.set(row.application_id, Number(row.unread_count));
      }
    } else {
      // This narrow fallback keeps the queue usable during a rolling deploy in
      // which the app reaches production just before the aggregation function.
      const fallback = await supabase
        .from("application_messages")
        .select("application_id")
        .in("application_id", applicationIds)
        .eq("direction", "inbound")
        .eq("status", "matched")
        .eq("is_read", false);

      if (fallback.error) {
        console.error(JSON.stringify({
          event: "application_unread_reply_counts_query_failed",
          rpcCode: unreadResult.error.code,
          fallbackCode: fallback.error.code,
        }));
      } else {
        for (const row of fallback.data ?? []) {
          if (!row.application_id) continue;
          unreadByApplication.set(
            row.application_id,
            (unreadByApplication.get(row.application_id) ?? 0) + 1,
          );
        }
      }
    }
  }

  const total = count ?? 0;
  return {
    applications: applications.map((application) => ({
      ...application,
      unread_reply_count: unreadByApplication.get(application.id) ?? 0,
    })),
    total,
    totalPages: Math.max(1, Math.ceil(total / APPLICATION_PAGE_SIZE)),
    page: filters.page,
    pageSize: APPLICATION_PAGE_SIZE,
  };
}
