import {
  ACTION_LABELS,
  TRANSITION_MAP,
  type WorkflowAction,
  type WorkflowCommand,
} from "./actions.ts";
import { ACTION_EVENT_MAP, type WorkflowEventType } from "./events.ts";
import {
  InvalidWorkflowTransitionError,
  WorkflowMetadataError,
} from "./errors.ts";
import type { WorkflowState } from "./states.ts";

export type WorkflowDecision = {
  action: WorkflowAction;
  previousStatus: WorkflowState;
  newStatus: WorkflowState;
  activityNote: string | null;
  eventType: WorkflowEventType;
};

function humanStatus(status: WorkflowState) {
  return status.replaceAll("_", " ");
}

function invalidTransitionMessage(
  action: WorkflowAction,
  status: WorkflowState,
) {
  const current = humanStatus(status);
  switch (action) {
    case "approve_application":
      return `Cannot approve an application that is already ${current}.`;
    case "request_more_information":
      return `Cannot request more information for an application that is already ${current}.`;
    case "resume_review":
      return `Cannot resume review for an application that is ${current}.`;
    case "deny_application":
      return `Cannot deny an application that is already ${current}.`;
    case "cancel_application":
      return `Cannot cancel an application that is already ${current}.`;
  }
}

function requiredText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatPickupDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatPickupTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export class WorkflowEngine {
  decide(
    currentStatus: WorkflowState,
    command: WorkflowCommand,
  ): WorkflowDecision {
    if (!requiredText(command.performedBy)) {
      throw new WorkflowMetadataError(
        "performed_by is required for workflow actions.",
      );
    }

    const newStatus = TRANSITION_MAP[currentStatus][command.action];
    if (!newStatus) {
      throw new InvalidWorkflowTransitionError(
        invalidTransitionMessage(command.action, currentStatus),
      );
    }

    let activityNote = requiredText(command.note);
    if (command.action === "approve_application") {
      const assignedCar = requiredText(command.assignedCar);
      const pickupDate = requiredText(command.pickupDate);
      const pickupTime = requiredText(command.pickupTime);
      const pickupLocation = requiredText(command.pickupLocation);
      if (!assignedCar) {
        throw new WorkflowMetadataError(
          "assigned_car is required to approve an application.",
        );
      }
      if (!pickupDate) {
        throw new WorkflowMetadataError(
          "pickup_date is required to approve an application.",
        );
      }
      const parsedPickupDate = new Date(`${pickupDate}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)
        || Number.isNaN(parsedPickupDate.getTime())
        || parsedPickupDate.toISOString().slice(0, 10) !== pickupDate
      ) {
        throw new WorkflowMetadataError(
          "pickup_date must be a valid date.",
        );
      }
      if (pickupDate < new Date().toISOString().slice(0, 10)) {
        throw new WorkflowMetadataError(
          "pickup_date cannot be in the past.",
        );
      }
      if (!pickupTime) {
        throw new WorkflowMetadataError(
          "pickup_time is required to approve an application.",
        );
      }
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) {
        throw new WorkflowMetadataError(
          "pickup_time must be a valid time.",
        );
      }
      if (!pickupLocation) {
        throw new WorkflowMetadataError(
          "pickup_location is required to approve an application.",
        );
      }
      activityNote = [
        `Assigned Car:\n${assignedCar}`,
        `Pickup:\n${formatPickupDate(pickupDate)} at ${formatPickupTime(pickupTime)}`,
        `Location:\n${pickupLocation}`,
      ].join("\n\n");
    }
    if (command.action === "request_more_information") {
      const messageToCustomer = requiredText(command.messageToCustomer);
      if (!messageToCustomer) {
        throw new WorkflowMetadataError(
          "message_to_customer is required to request more information.",
        );
      }
      activityNote = `Customer request:\n${messageToCustomer}`;
    }
    if (command.action === "deny_application") {
      activityNote = requiredText(command.decisionReason);
    }
    if (command.action === "cancel_application") {
      activityNote = requiredText(command.cancellationNote);
    }

    return {
      action: command.action,
      previousStatus: currentStatus,
      newStatus,
      activityNote,
      eventType: ACTION_EVENT_MAP[command.action],
    };
  }

  label(action: WorkflowAction) {
    return ACTION_LABELS[action];
  }
}
