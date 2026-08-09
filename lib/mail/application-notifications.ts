import "server-only";

import {
  buildWorkflowEmail,
  sendMailtrapTemplateEmail,
  type MailtrapConfiguration,
  type WorkflowEmailEvent,
} from "@/supabase/functions/_shared/application-email";

type WorkflowRpcEmailRow = {
  event_type?: unknown;
  event_payload?: unknown;
};

function configuration(): MailtrapConfiguration {
  return {
    apiToken: process.env.MAILTRAP_API_TOKEN ?? "",
    fromEmail: process.env.MAILTRAP_FROM_EMAIL ?? "",
    fromName: process.env.MAILTRAP_FROM_NAME ?? "",
    replyToEmail: process.env.MAILTRAP_REPLY_TO_EMAIL,
    replyToName: process.env.MAILTRAP_REPLY_TO_NAME,
    templates: {
      applicationReceived: process.env.MAILTRAP_TEMPLATE_APPLICATION_RECEIVED ?? "",
      applicationApproved: process.env.MAILTRAP_TEMPLATE_APPLICATION_APPROVED ?? "",
      moreInformationRequired:
        process.env.MAILTRAP_TEMPLATE_MORE_INFORMATION_REQUIRED ?? "",
      applicationDenied: process.env.MAILTRAP_TEMPLATE_APPLICATION_DENIED ?? "",
      applicationCancelled: process.env.MAILTRAP_TEMPLATE_APPLICATION_CANCELLED ?? "",
    },
  };
}

function stringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function optionalStringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

function parseWorkflowEmailEvent(row: WorkflowRpcEmailRow): WorkflowEmailEvent | null {
  if (!row.event_payload || typeof row.event_payload !== "object") return null;
  const payload = row.event_payload as Record<string, unknown>;
  const eventType = typeof row.event_type === "string" ? row.event_type : null;
  const applicationId = stringValue(payload, "application_id");
  const applicationNumber = stringValue(payload, "application_number");
  const firstName = stringValue(payload, "first_name");
  const email = stringValue(payload, "email");

  if (!applicationId || !applicationNumber || !firstName || !email) return null;
  const base = {
    application_id: applicationId,
    application_number: applicationNumber,
    first_name: firstName,
    email,
  };

  switch (eventType) {
    case "application.approved": {
      const assignedCar = stringValue(payload, "assigned_car");
      const pickupDate = stringValue(payload, "pickup_date");
      const pickupTime = stringValue(payload, "pickup_time");
      const pickupLocation = stringValue(payload, "pickup_location");
      if (!assignedCar || !pickupDate || !pickupTime || !pickupLocation) return null;
      return {
        ...base,
        event_type: eventType,
        assigned_car: assignedCar,
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        pickup_location: pickupLocation,
        pickup_instructions: optionalStringValue(payload, "pickup_instructions"),
      };
    }
    case "application.more_information_requested": {
      const messageToCustomer = stringValue(payload, "message_to_customer");
      if (!messageToCustomer) return null;
      return { ...base, event_type: eventType, message_to_customer: messageToCustomer };
    }
    case "application.denied":
      return {
        ...base,
        event_type: eventType,
        decision_reason: optionalStringValue(payload, "decision_reason"),
      };
    case "application.cancelled":
      return {
        ...base,
        event_type: eventType,
        cancellation_note: optionalStringValue(payload, "cancellation_note"),
      };
    default:
      return null;
  }
}

export async function sendWorkflowNotification(row: WorkflowRpcEmailRow) {
  const event = parseWorkflowEmailEvent(row);
  if (!event) {
    if (
      row.event_type === "application.approved"
      || row.event_type === "application.more_information_requested"
      || row.event_type === "application.denied"
      || row.event_type === "application.cancelled"
    ) {
      throw new Error("Workflow email event is missing required application data");
    }
    return;
  }

  const config = configuration();
  await sendMailtrapTemplateEmail(
    buildWorkflowEmail(event, config.templates),
    config,
  );
}
