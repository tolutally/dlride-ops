import type { WorkflowCommand } from "./actions.ts";
import {
  InvalidWorkflowTransitionError,
  WorkflowMetadataError,
} from "./errors.ts";
import type {
  ApplicationRepository,
  ApplicationSnapshot,
  WorkflowPersistenceResult,
} from "./repository.ts";
import { ApplicationWorkflowService } from "./service.ts";
import type { WorkflowState } from "./states.ts";

const APPLICATION_ID = "550e8400-e29b-41d4-a716-446655440000";
const PERFORMED_BY = "2c1b9028-8fa8-4e88-a647-c68c6d3c7c52";
const APPLICATION_NUMBER = "DLR-000001";
const FIRST_NAME = "Avery";
const EMAIL = "avery@example.com";

function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message = "Values differ") {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, received ${actualJson}`);
  }
}

async function assertRejects(
  operation: () => Promise<unknown>,
  errorType: new (...arguments_: never[]) => Error,
  message: string,
) {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof errorType, `Expected ${errorType.name}`);
    assertEquals(error.message, message);
    return;
  }
  throw new Error(`Expected ${errorType.name}`);
}

class InMemoryApplicationRepository implements ApplicationRepository {
  readonly persisted: Array<{
    command: WorkflowCommand;
    previousStatus: WorkflowState;
    newStatus: WorkflowState;
    note: string | null;
  }> = [];

  constructor(private application: ApplicationSnapshot | null) {}

  findById(applicationId: string) {
    if (this.application?.id !== applicationId) return Promise.resolve(null);
    return Promise.resolve({ ...this.application });
  }

  applyWorkflowAction(
    command: WorkflowCommand,
    decision: {
      previousStatus: WorkflowState;
      newStatus: WorkflowState;
      activityNote: string | null;
      eventType: WorkflowPersistenceResult["event"]["type"];
    },
  ) {
    if (!this.application) throw new Error("Application missing");

    this.application = { ...this.application, status: decision.newStatus };
    this.persisted.push({
      command,
      previousStatus: decision.previousStatus,
      newStatus: decision.newStatus,
      note: decision.activityNote,
    });

    return Promise.resolve({
      application: { ...this.application },
      activity: {
        id: "activity-id",
        applicationId: command.applicationId,
        action: command.action,
        previousStatus: decision.previousStatus,
        newStatus: decision.newStatus,
        note: decision.activityNote,
        performedBy: command.performedBy,
        createdAt: "2026-08-09T01:00:00.000Z",
      },
      event: {
        id: "event-id",
        type: decision.eventType,
        applicationId: command.applicationId,
        activityId: "activity-id",
        payload: {
          action: command.action,
          previousStatus: decision.previousStatus,
          newStatus: decision.newStatus,
          ...(command.action !== "approve_application"
            ? { performedBy: command.performedBy }
            : {}),
          applicationNumber: APPLICATION_NUMBER,
          firstName: FIRST_NAME,
          email: EMAIL,
          ...(command.action === "approve_application" && command.assignedCar
            ? { assignedCar: command.assignedCar.trim() }
            : {}),
          ...(command.action === "approve_application" && command.pickupDate
            ? { pickupDate: command.pickupDate.trim() }
            : {}),
          ...(command.action === "approve_application" && command.pickupTime
            ? { pickupTime: command.pickupTime.trim() }
            : {}),
          ...(command.action === "approve_application" && command.pickupLocation
            ? { pickupLocation: command.pickupLocation.trim() }
            : {}),
          ...(command.action === "approve_application" && command.pickupInstructions?.trim()
            ? { pickupInstructions: command.pickupInstructions.trim() }
            : {}),
          ...(command.action === "request_more_information" && command.messageToCustomer
            ? { messageToCustomer: command.messageToCustomer.trim() }
            : {}),
          ...(command.action === "deny_application"
            ? { decisionReason: command.decisionReason?.trim() ?? "" }
            : {}),
          ...(command.action === "cancel_application"
            ? { cancellationNote: command.cancellationNote?.trim() ?? "" }
            : {}),
        },
        createdAt: "2026-08-09T01:00:00.000Z",
      },
    });
  }
}

function command(
  action: WorkflowCommand["action"],
  metadata: Partial<WorkflowCommand> = {},
): WorkflowCommand {
  return {
    applicationId: APPLICATION_ID,
    action,
    performedBy: PERFORMED_BY,
    assignedCar: "2022 Toyota Corolla",
    pickupDate: "2099-01-02",
    pickupTime: "14:00",
    pickupLocation: "1160 Crescent Ridge, Buford, Georgia",
    pickupInstructions: "Please arrive 10 minutes early.",
    messageToCustomer: "Please upload a clearer document.",
    decisionReason: "Eligibility requirements were not met.",
    cancellationNote: "Application cancelled at your request.",
    ...metadata,
  };
}

Deno.test("all allowed transitions produce the defined next state", async () => {
  const transitions: Array<
    [WorkflowState, WorkflowCommand["action"], WorkflowState]
  > = [
    ["under_review", "request_more_information", "more_information_required"],
    ["under_review", "approve_application", "approved"],
    ["under_review", "deny_application", "denied"],
    ["under_review", "cancel_application", "cancelled"],
    ["more_information_required", "resume_review", "under_review"],
    ["more_information_required", "cancel_application", "cancelled"],
  ];

  for (const [currentStatus, action, expectedStatus] of transitions) {
    const repository = new InMemoryApplicationRepository({
      id: APPLICATION_ID,
      status: currentStatus,
    });
    const result = await new ApplicationWorkflowService(repository).perform(
      command(action),
    );
    assertEquals(result.application.status, expectedStatus);
  }
});

Deno.test("terminal and unsupported transitions fail clearly", async () => {
  const invalid: Array<
    [WorkflowState, WorkflowCommand["action"], string]
  > = [
    [
      "approved",
      "resume_review",
      "Cannot resume review for an application that is approved.",
    ],
    [
      "approved",
      "deny_application",
      "Cannot deny an application that is already approved.",
    ],
    [
      "denied",
      "approve_application",
      "Cannot approve an application that is already denied.",
    ],
    [
      "cancelled",
      "resume_review",
      "Cannot resume review for an application that is cancelled.",
    ],
  ];

  for (const [status, action, expectedMessage] of invalid) {
    const repository = new InMemoryApplicationRepository({
      id: APPLICATION_ID,
      status,
    });
    const service = new ApplicationWorkflowService(repository);
    await assertRejects(
      () => service.perform(command(action)),
      InvalidWorkflowTransitionError,
      expectedMessage,
    );
    assertEquals(repository.persisted.length, 0);
  }
});

Deno.test("request more information requires customer message", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });
  const service = new ApplicationWorkflowService(repository);

  await assertRejects(
    () =>
      service.perform(
        command("request_more_information", { messageToCustomer: "  " }),
      ),
    WorkflowMetadataError,
    "message_to_customer is required to request more information.",
  );
});

Deno.test("approve application requires an assigned car", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });
  const service = new ApplicationWorkflowService(repository);

  await assertRejects(
    () => service.perform(command("approve_application", { assignedCar: "  " })),
    WorkflowMetadataError,
    "assigned_car is required to approve an application.",
  );
  assertEquals(repository.persisted.length, 0);
});

Deno.test("approve application requires a pickup date", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });
  const service = new ApplicationWorkflowService(repository);

  await assertRejects(
    () => service.perform(command("approve_application", { pickupDate: "  " })),
    WorkflowMetadataError,
    "pickup_date is required to approve an application.",
  );
  assertEquals(repository.persisted.length, 0);
});

Deno.test("approve application requires a pickup time", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });
  const service = new ApplicationWorkflowService(repository);

  await assertRejects(
    () => service.perform(command("approve_application", { pickupTime: null })),
    WorkflowMetadataError,
    "pickup_time is required to approve an application.",
  );
  assertEquals(repository.persisted.length, 0);
});

Deno.test("approve application requires a pickup location", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });
  const service = new ApplicationWorkflowService(repository);

  await assertRejects(
    () => service.perform(command("approve_application", { pickupLocation: "" })),
    WorkflowMetadataError,
    "pickup_location is required to approve an application.",
  );
  assertEquals(repository.persisted.length, 0);
});

Deno.test("deny application allows an empty decision reason", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });
  const service = new ApplicationWorkflowService(repository);

  const result = await service.perform(
    command("deny_application", { decisionReason: null }),
  );

  assertEquals(result.application.status, "denied");
  assertEquals(result.activity.note, null);
  assertEquals(result.event.payload.decisionReason, "");
});

Deno.test("cancel application includes an empty customer cancellation note", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });

  const result = await new ApplicationWorkflowService(repository).perform(
    command("cancel_application", { cancellationNote: null }),
  );

  assertEquals(result.application.status, "cancelled");
  assertEquals(result.activity.note, null);
  assertEquals(result.event.payload.cancellationNote, "");
});

Deno.test("workflow action creates an immutable activity-shaped result", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });
  const result = await new ApplicationWorkflowService(repository).perform(
    command("request_more_information"),
  );

  assertEquals(result.activity, {
    id: "activity-id",
    applicationId: APPLICATION_ID,
    action: "request_more_information",
    previousStatus: "under_review",
    newStatus: "more_information_required",
    note: "Customer request:\nPlease upload a clearer document.",
    performedBy: PERFORMED_BY,
    createdAt: "2026-08-09T01:00:00.000Z",
  });
  assertEquals(repository.persisted.length, 1);
});

Deno.test("workflow action emits the matching event", async () => {
  const repository = new InMemoryApplicationRepository({
    id: APPLICATION_ID,
    status: "under_review",
  });
  const result = await new ApplicationWorkflowService(repository).perform(
    command("approve_application"),
  );

  assertEquals(result.event.type, "application.approved");
  assertEquals(result.event.payload, {
    action: "approve_application",
    previousStatus: "under_review",
    newStatus: "approved",
    applicationNumber: APPLICATION_NUMBER,
    firstName: FIRST_NAME,
    email: EMAIL,
    assignedCar: "2022 Toyota Corolla",
    pickupDate: "2099-01-02",
    pickupTime: "14:00",
    pickupLocation: "1160 Crescent Ridge, Buford, Georgia",
    pickupInstructions: "Please arrive 10 minutes early.",
  });
});
