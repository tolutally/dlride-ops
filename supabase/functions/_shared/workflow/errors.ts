export class WorkflowError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkflowError";
  }
}

export class InvalidWorkflowTransitionError extends WorkflowError {
  constructor(message: string) {
    super("INVALID_WORKFLOW_TRANSITION", message);
    this.name = "InvalidWorkflowTransitionError";
  }
}

export class WorkflowMetadataError extends WorkflowError {
  constructor(message: string) {
    super("WORKFLOW_METADATA_REQUIRED", message);
    this.name = "WorkflowMetadataError";
  }
}

export class ApplicationNotFoundError extends WorkflowError {
  constructor(applicationId: string) {
    super("APPLICATION_NOT_FOUND", `Application ${applicationId} was not found.`);
    this.name = "ApplicationNotFoundError";
  }
}
