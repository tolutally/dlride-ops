import "server-only";

import { requireStaff } from "@/lib/auth/staff";
import { createServerAuthClient } from "@/lib/supabase/server";

import type { Lead, LeadListResult } from "./types";

export const LEAD_PAGE_SIZE = 50;

const LEAD_COLUMNS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "phone",
  "message",
  "source",
  "status",
  "created_at",
].join(",");

export async function fetchLeads(): Promise<LeadListResult> {
  await requireStaff();
  const supabase = await createServerAuthClient();

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(LEAD_PAGE_SIZE);

  if (error) {
    console.error(JSON.stringify({
      event: "leads_query_failed",
      code: error.code,
      message: error.message,
    }));
    throw new Error("Prospects could not be loaded");
  }

  return { leads: (data ?? []) as unknown as Lead[] };
}
