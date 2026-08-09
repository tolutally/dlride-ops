import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { WorkflowCommand } from "./actions.ts";
import type { WorkflowDecision } from "./engine.ts";
import type {
  ApplicationRepository,
  ApplicationSnapshot,
  WorkflowPersistenceResult,
} from "./repository.ts";
import { isWorkflowState } from "./states.ts";

type WorkflowRpcRow = {
  application_id: string;
  previous_status: string;
  new_status: string;
  activity_id: string;
  event_id: string;
  event_type: WorkflowDecision["eventType"];
  event_payload: {
    application_number: string;
    first_name: string;
    email: string;
    performed_by?: string;
    assigned_car?: string;
    pickup_date?: string;
    pickup_time?: string;
    pickup_location?: string;
    pickup_instructions?: string;
    message_to_customer?: string;
    decision_reason?: string;
    cancellation_note?: string;
    note?: string;
  };
  created_at: string;
};

export class SupabaseApplicationRepository implements ApplicationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(applicationId: string): Promise<ApplicationSnapshot | null> {
    const { data, error } = await this.client
      .from("applications")
      .select("id,status")
      .eq("id", applicationId)
      .maybeSingle();

    if (error) throw new Error("Unable to load application workflow state");
    if (!data) return null;
    if (!isWorkflowState(data.status)) {
      throw new Error("Application contains an invalid workflow state");
    }

    return { id: data.id, status: data.status };
  }

  async applyWorkflowAction(
    command: WorkflowCommand,
    decision: WorkflowDecision,
  ): Promise<WorkflowPersistenceResult> {
    const { data, error } = await this.client.rpc(
      "perform_application_workflow_action",
      {
        p_application_id: command.applicationId,
        p_action: command.action,
        p_performed_by: command.performedBy,
        p_message_to_customer: command.messageToCustomer ?? null,
        p_decision_reason: command.decisionReason ?? null,
        p_note: command.note ?? null,
        p_assigned_car: command.assignedCar ?? null,
        p_pickup_date: command.pickupDate ?? null,
        p_pickup_time: command.pickupTime ?? null,
        p_pickup_location: command.pickupLocation ?? null,
        p_pickup_instructions: command.pickupInstructions ?? null,
        p_cancellation_note: command.cancellationNote ?? null,
      },
    );

    if (error || !Array.isArray(data) || !data[0]) {
      throw new Error(error?.message || "Unable to perform workflow action");
    }

    const row = data[0] as WorkflowRpcRow;
    if (!isWorkflowState(row.previous_status) || !isWorkflowState(row.new_status)) {
      throw new Error("Workflow RPC returned an invalid state");
    }

    return {
      application: {
        id: row.application_id,
        status: row.new_status,
      },
      activity: {
        id: row.activity_id,
        applicationId: row.application_id,
        action: command.action,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        note: decision.activityNote,
        performedBy: command.performedBy,
        createdAt: row.created_at,
      },
      event: {
        id: row.event_id,
        type: row.event_type,
        applicationId: row.application_id,
        activityId: row.activity_id,
        payload: {
          action: command.action,
          previousStatus: row.previous_status,
          newStatus: row.new_status,
          applicationNumber: row.event_payload.application_number,
          firstName: row.event_payload.first_name,
          email: row.event_payload.email,
          ...(row.event_payload.performed_by
            ? { performedBy: row.event_payload.performed_by }
            : {}),
          ...(row.event_payload.assigned_car
            ? { assignedCar: row.event_payload.assigned_car }
            : {}),
          ...(row.event_payload.pickup_date
            ? { pickupDate: row.event_payload.pickup_date }
            : {}),
          ...(row.event_payload.pickup_time
            ? { pickupTime: row.event_payload.pickup_time }
            : {}),
          ...(row.event_payload.pickup_location
            ? { pickupLocation: row.event_payload.pickup_location }
            : {}),
          ...(command.action === "approve_application"
            ? { pickupInstructions: row.event_payload.pickup_instructions ?? "" }
            : {}),
          ...(row.event_payload.message_to_customer
            ? { messageToCustomer: row.event_payload.message_to_customer }
            : {}),
          ...(command.action === "deny_application"
            ? { decisionReason: row.event_payload.decision_reason ?? "" }
            : {}),
          ...(command.action === "cancel_application"
            ? { cancellationNote: row.event_payload.cancellation_note ?? "" }
            : {}),
          ...(row.event_payload.note
            ? { note: row.event_payload.note }
            : {}),
        },
        createdAt: row.created_at,
      },
    };
  }
}
