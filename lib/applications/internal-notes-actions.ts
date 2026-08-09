"use server";

import { refresh, revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/staff";
import { isApplicationId } from "@/lib/applications/detail";
import { createServerDataClient } from "@/lib/supabase/server";

export type InternalNotesResult =
  | { success: true; notes: string }
  | { success: false; message: string };

const MAX_INTERNAL_NOTES_LENGTH = 10_000;

export async function updateApplicationInternalNotes(
  applicationId: string,
  notes: string,
): Promise<InternalNotesResult> {
  const staff = await requireStaff();

  if (!isApplicationId(applicationId)) {
    return { success: false, message: "The application could not be updated." };
  }

  const normalizedNotes = notes.trim();
  if (normalizedNotes.length > MAX_INTERNAL_NOTES_LENGTH) {
    return { success: false, message: "Internal notes must be 10,000 characters or fewer." };
  }

  const supabase = createServerDataClient();
  const { data, error } = await supabase.rpc("update_application_internal_notes", {
    p_application_id: applicationId,
    p_internal_notes: normalizedNotes || null,
    p_performed_by: staff.id,
  });

  if (error || !data) {
    console.error(JSON.stringify({
      event: "application_internal_notes_update_failed",
      code: error?.code ?? "missing_result",
    }));
    return {
      success: false,
      message: error?.code === "P0002"
        ? "This application is no longer available."
        : "Unable to save internal notes. Please try again.",
    };
  }

  revalidatePath(`/applications/${applicationId}`);
  refresh();

  return { success: true, notes: normalizedNotes };
}
