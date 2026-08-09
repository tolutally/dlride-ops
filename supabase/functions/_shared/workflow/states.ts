export const WORKFLOW_STATES = [
  "under_review",
  "more_information_required",
  "approved",
  "denied",
  "cancelled",
] as const;

export type WorkflowState = typeof WORKFLOW_STATES[number];

export function isWorkflowState(value: unknown): value is WorkflowState {
  return typeof value === "string" &&
    WORKFLOW_STATES.includes(value as WorkflowState);
}
