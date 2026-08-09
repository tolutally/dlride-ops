import type { WorkflowAction } from "./actions.ts";
import type { WorkflowState } from "./states.ts";

export const WORKFLOW_EVENTS = [
  "application.review_started",
  "application.more_information_requested",
  "application.review_resumed",
  "application.approved",
  "application.denied",
  "application.cancelled",
] as const;

export type WorkflowEventType = typeof WORKFLOW_EVENTS[number];

export const ACTION_EVENT_MAP: Record<WorkflowAction, WorkflowEventType> = {
  approve_application: "application.approved",
  request_more_information: "application.more_information_requested",
  resume_review: "application.review_resumed",
  deny_application: "application.denied",
  cancel_application: "application.cancelled",
};

export type WorkflowEvent = {
  id: string;
  type: WorkflowEventType;
  applicationId: string;
  activityId: string;
  payload: {
    action: WorkflowAction;
    previousStatus: WorkflowState;
    newStatus: WorkflowState;
    performedBy?: string;
    applicationNumber: string;
    firstName: string;
    email: string;
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
  createdAt: string;
};
