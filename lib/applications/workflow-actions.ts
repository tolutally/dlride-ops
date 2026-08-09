"use server";

import { refresh, revalidatePath } from "next/cache";

import { requireStaff } from "@/lib/auth/staff";
import { isApplicationId } from "@/lib/applications/detail";
import { sendWorkflowNotification } from "@/lib/mail/application-notifications";
import { createServerDataClient } from "@/lib/supabase/server";

const WORKFLOW_ACTIONS = [
  "approve_application",
  "request_more_information",
  "resume_review",
  "deny_application",
  "cancel_application",
] as const;

export type ApplicationWorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export type WorkflowActionInput = {
  applicationId: string;
  action: ApplicationWorkflowAction;
  assignedCar?: string;
  pickupDate?: string;
  pickupTime?: string;
  pickupLocation?: string;
  pickupInstructions?: string;
  messageToCustomer?: string;
  decisionReason?: string;
  cancellationNote?: string;
  note?: string;
};

export type WorkflowActionResult =
  | { success: true; newStatus: string }
  | { success: false; code: "VALIDATION_ERROR" | "ACTION_UNAVAILABLE" | "UPDATE_FAILED"; message: string };

const MAX_WORKFLOW_TEXT_LENGTH = 5_000;

function cleanText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function performApplicationWorkflowAction(
  input: WorkflowActionInput,
): Promise<WorkflowActionResult> {
  const staff = await requireStaff();

  if (!isApplicationId(input.applicationId) || !WORKFLOW_ACTIONS.includes(input.action)) {
    return { success: false, code: "VALIDATION_ERROR", message: "The workflow request is invalid." };
  }

  const messageToCustomer = cleanText(input.messageToCustomer);
  const decisionReason = cleanText(input.decisionReason);
  const cancellationNote = cleanText(input.cancellationNote);
  const note = cleanText(input.note);
  const assignedCar = cleanText(input.assignedCar);
  const pickupDate = cleanText(input.pickupDate);
  const pickupTime = cleanText(input.pickupTime);
  const pickupLocation = cleanText(input.pickupLocation);
  const pickupInstructions = cleanText(input.pickupInstructions);
  const suppliedText = [
    messageToCustomer,
    decisionReason,
    cancellationNote,
    note,
    pickupInstructions,
  ]
    .filter(Boolean) as string[];

  if (suppliedText.some((value) => value.length > MAX_WORKFLOW_TEXT_LENGTH)) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Workflow notes must be 5,000 characters or fewer.",
    };
  }
  if (input.action === "approve_application" && !assignedCar) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Please enter the car being assigned.",
    };
  }
  if (input.action === "approve_application" && !pickupDate) {
    return { success: false, code: "VALIDATION_ERROR", message: "Please select a pickup date." };
  }
  if (input.action === "approve_application" && !isIsoDate(pickupDate)) {
    return { success: false, code: "VALIDATION_ERROR", message: "Please select a valid pickup date." };
  }
  if (
    input.action === "approve_application"
    && pickupDate
    && pickupDate < new Date().toISOString().slice(0, 10)
  ) {
    return { success: false, code: "VALIDATION_ERROR", message: "Pickup date cannot be in the past." };
  }
  if (input.action === "approve_application" && !pickupTime) {
    return { success: false, code: "VALIDATION_ERROR", message: "Please select a pickup time." };
  }
  if (input.action === "approve_application" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(pickupTime ?? "")) {
    return { success: false, code: "VALIDATION_ERROR", message: "Please select a valid pickup time." };
  }
  if (input.action === "approve_application" && !pickupLocation) {
    return { success: false, code: "VALIDATION_ERROR", message: "Please enter the pickup location." };
  }
  if (input.action === "request_more_information" && !messageToCustomer) {
    return {
      success: false,
      code: "VALIDATION_ERROR",
      message: "Please enter what information you need from the customer.",
    };
  }
  const supabase = createServerDataClient();
  const { data, error } = await supabase.rpc("perform_application_workflow_action", {
    p_application_id: input.applicationId,
    p_action: input.action,
    p_performed_by: staff.id,
    p_message_to_customer: messageToCustomer,
    p_decision_reason: decisionReason,
    p_note: note,
    p_assigned_car: assignedCar,
    p_pickup_date: pickupDate,
    p_pickup_time: pickupTime,
    p_pickup_location: pickupLocation,
    p_pickup_instructions: pickupInstructions,
    p_cancellation_note: cancellationNote,
  });

  if (error || !Array.isArray(data) || !data[0]) {
    const unavailable = error?.code === "23514" || error?.code === "P0002";
    console.error(JSON.stringify({
      event: "application_workflow_action_failed",
      action: input.action,
      code: error?.code ?? "missing_result",
    }));
    return unavailable
      ? {
          success: false,
          code: "ACTION_UNAVAILABLE",
          message: "This action is no longer available for this application.",
        }
      : {
          success: false,
          code: "UPDATE_FAILED",
          message: "Unable to update the application. Please try again.",
        };
  }

  const workflowResult = data[0] as {
    new_status?: unknown;
    event_type?: unknown;
    event_payload?: unknown;
  };
  const newStatus = workflowResult.new_status;
  if (typeof newStatus !== "string") {
    console.error(JSON.stringify({
      event: "application_workflow_action_invalid_result",
      action: input.action,
    }));
    return {
      success: false,
      code: "UPDATE_FAILED",
      message: "Unable to update the application. Please try again.",
    };
  }

  try {
    await sendWorkflowNotification(workflowResult);
  } catch {
    console.error(JSON.stringify({
      event: "application_workflow_email_failed",
      action: input.action,
      application_id: input.applicationId,
    }));
  }

  revalidatePath(`/applications/${input.applicationId}`);
  revalidatePath("/applications");
  refresh();

  return { success: true, newStatus };
}
