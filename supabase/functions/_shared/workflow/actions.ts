import type { WorkflowState } from "./states.ts";

export const WORKFLOW_ACTIONS = [
  "approve_application",
  "request_more_information",
  "resume_review",
  "deny_application",
  "cancel_application",
] as const;

export type WorkflowAction = typeof WORKFLOW_ACTIONS[number];

export type WorkflowCommand = {
  applicationId: string;
  action: WorkflowAction;
  performedBy: string;
  assignedCar?: string | null;
  pickupDate?: string | null;
  pickupTime?: string | null;
  pickupLocation?: string | null;
  pickupInstructions?: string | null;
  messageToCustomer?: string | null;
  decisionReason?: string | null;
  cancellationNote?: string | null;
  note?: string | null;
};

export const TRANSITION_MAP: Record<
  WorkflowState,
  Partial<Record<WorkflowAction, WorkflowState>>
> = {
  under_review: {
    request_more_information: "more_information_required",
    approve_application: "approved",
    deny_application: "denied",
    cancel_application: "cancelled",
  },
  more_information_required: {
    resume_review: "under_review",
    cancel_application: "cancelled",
  },
  approved: {},
  denied: {},
  cancelled: {},
};

export const ACTION_LABELS: Record<WorkflowAction, string> = {
  approve_application: "Approve Application",
  request_more_information: "Request More Information",
  resume_review: "Resume Review",
  deny_application: "Deny Application",
  cancel_application: "Cancel Application",
};
