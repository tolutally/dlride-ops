import type { WorkflowCommand } from "./actions.ts";
import type { WorkflowDecision } from "./engine.ts";
import type { WorkflowEvent } from "./events.ts";
import type { WorkflowState } from "./states.ts";

export type ApplicationSnapshot = {
  id: string;
  status: WorkflowState;
};

export type ApplicationActivity = {
  id: string;
  applicationId: string;
  action: WorkflowCommand["action"];
  previousStatus: WorkflowState;
  newStatus: WorkflowState;
  note: string | null;
  performedBy: string;
  createdAt: string;
};

export type WorkflowPersistenceResult = {
  application: ApplicationSnapshot;
  activity: ApplicationActivity;
  event: WorkflowEvent;
};

export interface ApplicationRepository {
  findById(applicationId: string): Promise<ApplicationSnapshot | null>;
  applyWorkflowAction(
    command: WorkflowCommand,
    decision: WorkflowDecision,
  ): Promise<WorkflowPersistenceResult>;
}
