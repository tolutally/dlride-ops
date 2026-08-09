import type { WorkflowCommand } from "./actions.ts";
import { WorkflowEngine } from "./engine.ts";
import { ApplicationNotFoundError } from "./errors.ts";
import type {
  ApplicationRepository,
  WorkflowPersistenceResult,
} from "./repository.ts";

export class ApplicationWorkflowService {
  constructor(
    private readonly repository: ApplicationRepository,
    private readonly engine = new WorkflowEngine(),
  ) {}

  async perform(command: WorkflowCommand): Promise<WorkflowPersistenceResult> {
    const application = await this.repository.findById(command.applicationId);
    if (!application) throw new ApplicationNotFoundError(command.applicationId);

    const decision = this.engine.decide(application.status, command);
    return await this.repository.applyWorkflowAction(command, decision);
  }
}
