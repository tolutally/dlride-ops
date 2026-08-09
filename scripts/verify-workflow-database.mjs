import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationsDirectory = join(repositoryRoot, "supabase", "migrations");

const db = new PGlite({ extensions: { pgcrypto } });
const VALID_APPROVAL_DETAILS = {
  assignedCar: "2022 Toyota Corolla",
  pickupDate: "2099-01-02",
  pickupTime: "14:00",
  pickupLocation: "1160 Crescent Ridge, Buford, Georgia",
  pickupInstructions: "Please arrive 10 minutes early and call us when you arrive.",
};

async function expectDatabaseError(operation, expectedMessage) {
  await assert.rejects(operation, (error) => {
    assert.match(String(error?.message), expectedMessage);
    return true;
  });
}

async function applyMigrations() {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
  `);

  const migrationNames = (await readdir(migrationsDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const migrationName of migrationNames) {
    const migration = await readFile(join(migrationsDirectory, migrationName), "utf8");
    await db.exec(migration);
  }
}

async function createApplication(id, email) {
  const result = await db.query(
    `
      insert into public.applications (
        id,
        first_name,
        last_name,
        street_address,
        city,
        state,
        postal_code,
        phone,
        email,
        rental_start_date,
        rental_end_date,
        pickup_time,
        dropoff_time,
        rental_weeks,
        intended_vehicle_use,
        payment_method,
        drivers_license_path,
        proof_of_address_path,
        sms_consent
      )
      values (
        $1::uuid,
        'Avery',
        'Driver',
        '100 Test Street',
        'Calgary',
        'AB',
        'T1X 1X1',
        '+14035550123',
        $2,
        '2099-01-01',
        '2099-01-16',
        '09:30',
        '17:00',
        999,
        'personal_use',
        'card',
        $1::text || '/drivers-license.pdf',
        $1::text || '/proof-of-address.png',
        true
      )
      returning id, application_number, status, pickup_time, dropoff_time, rental_weeks
    `,
    [id, email],
  );

  return result.rows[0];
}

async function performAction(applicationId, action, options = {}) {
  const result = await db.query(
    `
      select *
      from public.perform_application_workflow_action(
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12
      )
    `,
    [
      applicationId,
      action,
      options.performedBy ?? "10000000-0000-4000-8000-000000000001",
      options.messageToCustomer ?? null,
      options.decisionReason ?? null,
      options.note ?? null,
      options.assignedCar ?? null,
      options.pickupDate ?? null,
      options.pickupTime ?? null,
      options.pickupLocation ?? null,
      options.pickupInstructions ?? null,
      options.cancellationNote ?? null,
    ],
  );

  return result.rows[0];
}

try {
  await applyMigrations();

  const firstApplicationId = "20000000-0000-4000-8000-000000000001";
  const firstApplication = await createApplication(
    firstApplicationId,
    "avery@example.com",
  );

  assert.equal(firstApplication.status, "under_review");
  assert.equal(firstApplication.rental_weeks, 3);
  assert.equal(firstApplication.pickup_time, "09:30:00");
  assert.equal(firstApplication.dropoff_time, "17:00:00");
  assert.match(firstApplication.application_number, /^DLR-\d{6}$/);

  const privateBucket = await db.query(
    "select public from storage.buckets where id = 'application-documents'",
  );
  assert.deepEqual(privateBucket.rows, [{ public: false }]);

  await db.exec("set role anon");
  await expectDatabaseError(
    () => db.query("select id from public.applications"),
    /permission denied/i,
  );
  await expectDatabaseError(
    () => db.query("select id from public.application_activity"),
    /permission denied/i,
  );
  await db.exec("reset role");

  await db.exec("set request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001'");
  await db.exec("set role authenticated");
  const staffApplications = await db.query(
    "select id from public.applications where id = $1",
    [firstApplicationId],
  );
  assert.deepEqual(staffApplications.rows, [{ id: firstApplicationId }]);
  const staffActivity = await db.query(
    "select action from public.application_activity where application_id = $1",
    [firstApplicationId],
  );
  assert.deepEqual(staffActivity.rows, [{ action: "application_created" }]);
  await expectDatabaseError(
    () => db.query(
      "update public.applications set internal_notes = 'bypass' where id = $1",
      [firstApplicationId],
    ),
    /permission denied/i,
  );
  await db.exec("reset role");

  await expectDatabaseError(
    () => db.query(
      `
        insert into public.applications (
          id,
          first_name,
          last_name,
          street_address,
          city,
          state,
          postal_code,
          phone,
          email,
          rental_start_date,
          rental_end_date,
          rental_weeks,
          intended_vehicle_use,
          payment_method,
          drivers_license_path,
          proof_of_address_path,
          sms_consent,
          status
        )
        values (
          '20000000-0000-4000-8000-000000000099',
          'Invalid',
          'State',
          '100 Test Street',
          'Calgary',
          'AB',
          'T1X 1X1',
          '+14035550199',
          'invalid-state@example.com',
          '2099-01-01',
          '2099-01-08',
          1,
          'personal_use',
          'card',
          '20000000-0000-4000-8000-000000000099/drivers-license.pdf',
          '20000000-0000-4000-8000-000000000099/proof-of-address.pdf',
          true,
          'approved'
        )
      `,
    ),
    /New applications must enter the workflow under review/,
  );

  const creationHistory = await db.query(
    `
      select activity.action, activity.new_status, event.event_type
      from public.application_activity as activity
      join public.application_workflow_events as event
        on event.activity_id = activity.id
      where activity.application_id = $1
    `,
    [firstApplicationId],
  );

  assert.deepEqual(creationHistory.rows, [
    {
      action: "application_created",
      new_status: "under_review",
      event_type: "application.review_started",
    },
  ]);

  await db.exec("set role service_role");
  await expectDatabaseError(
    () => db.query(
      `
        select *
        from public.perform_application_workflow_action(
          $1::uuid,
          'approve_application'::text,
          $2::uuid,
          null::text,
          null::text,
          null::text,
          'Bypass Car'::text,
          null::date,
          null::time,
          null::text,
          null::text,
          null::text
        )
      `,
      [firstApplicationId, "10000000-0000-4000-8000-000000000001"],
    ),
    /pickup_date is required/,
  );
  const notesUpdate = await db.query(
    "select public.update_application_internal_notes($1, $2, $3) as updated_at",
    [
      firstApplicationId,
      "Initial reviewer note.",
      "10000000-0000-4000-8000-000000000001",
    ],
  );
  assert.ok(notesUpdate.rows[0].updated_at);

  const requestedInformation = await performAction(
    firstApplicationId,
    "request_more_information",
    {
      messageToCustomer: "Please provide a clearer proof of address.",
      note: "Address document was unreadable during review.",
    },
  );
  assert.equal(requestedInformation.previous_status, "under_review");
  assert.equal(requestedInformation.new_status, "more_information_required");
  assert.equal(
    requestedInformation.event_type,
    "application.more_information_requested",
  );

  await expectDatabaseError(
    () => db.query(
      "update public.applications set status = 'approved' where id = $1",
      [firstApplicationId],
    ),
    /permission denied/i,
  );
  await db.exec("reset role");

  const notesAudit = await db.query(
    `
      select action, previous_status, new_status, note, performed_by
      from public.application_activity
      where application_id = $1
        and action = 'internal_notes_updated'
    `,
    [firstApplicationId],
  );
  assert.deepEqual(notesAudit.rows, [
    {
      action: "internal_notes_updated",
      previous_status: "under_review",
      new_status: "under_review",
      note: "Initial reviewer note.",
      performed_by: "10000000-0000-4000-8000-000000000001",
    },
  ]);

  const informationRequestMetadata = await db.query(
    `
      select application.internal_notes, event.payload
      from public.applications as application
      join public.application_activity as activity
        on activity.application_id = application.id
      join public.application_workflow_events as event
        on event.activity_id = activity.id
      where application.id = $1
        and activity.action = 'request_more_information'
    `,
    [firstApplicationId],
  );
  assert.equal(
    informationRequestMetadata.rows[0].internal_notes,
    "Initial reviewer note.\n\nAddress document was unreadable during review.",
  );
  assert.equal(
    informationRequestMetadata.rows[0].payload.message_to_customer,
    "Please provide a clearer proof of address.",
  );
  assert.equal(informationRequestMetadata.rows[0].payload.application_number, firstApplication.application_number);
  assert.equal(informationRequestMetadata.rows[0].payload.first_name, "Avery");
  assert.equal(informationRequestMetadata.rows[0].payload.email, "avery@example.com");
  assert.equal(informationRequestMetadata.rows[0].payload.internal_note, undefined);

  const informationRequestActivity = await db.query(
    `
      select note
      from public.application_activity
      where application_id = $1
        and action = 'request_more_information'
    `,
    [firstApplicationId],
  );
  assert.equal(
    informationRequestActivity.rows[0].note,
    "Customer request:\nPlease provide a clearer proof of address.",
  );

  const resumedReview = await performAction(firstApplicationId, "resume_review");
  assert.equal(resumedReview.previous_status, "more_information_required");
  assert.equal(resumedReview.new_status, "under_review");
  assert.equal(resumedReview.event_type, "application.review_resumed");

  await expectDatabaseError(
    () => performAction(firstApplicationId, "approve_application", {
      ...VALID_APPROVAL_DETAILS,
      assignedCar: null,
    }),
    /assigned_car is required to approve an application/,
  );
  await expectDatabaseError(
    () => performAction(firstApplicationId, "approve_application", {
      ...VALID_APPROVAL_DETAILS,
      pickupDate: null,
    }),
    /pickup_date is required to approve an application/,
  );
  await expectDatabaseError(
    () => performAction(firstApplicationId, "approve_application", {
      ...VALID_APPROVAL_DETAILS,
      pickupTime: null,
    }),
    /pickup_time is required to approve an application/,
  );
  await expectDatabaseError(
    () => performAction(firstApplicationId, "approve_application", {
      ...VALID_APPROVAL_DETAILS,
      pickupLocation: "  ",
    }),
    /pickup_location is required to approve an application/,
  );
  await expectDatabaseError(
    () => performAction(firstApplicationId, "approve_application", {
      ...VALID_APPROVAL_DETAILS,
      pickupDate: "2020-01-01",
    }),
    /pickup_date cannot be in the past/,
  );

  const stillUnderReview = await db.query(
    `
      select status, assigned_car, pickup_date, pickup_time, pickup_location
      from public.applications
      where id = $1
    `,
    [firstApplicationId],
  );
  assert.deepEqual(stillUnderReview.rows, [{
    status: "under_review",
    assigned_car: null,
    pickup_date: null,
    pickup_time: "09:30:00",
    pickup_location: null,
  }]);

  const approved = await performAction(firstApplicationId, "approve_application", {
    ...VALID_APPROVAL_DETAILS,
    assignedCar: "  2022 Toyota Corolla  ",
    pickupLocation: "  1160 Crescent Ridge, Buford, Georgia  ",
    pickupInstructions: "  Please arrive 10 minutes early and call us when you arrive.  ",
    note: "  Vehicle availability confirmed.  ",
  });
  assert.equal(approved.new_status, "approved");
  assert.equal(approved.event_type, "application.approved");

  const approvalMetadata = await db.query(
    `
      select
        application.status,
        application.assigned_car,
        application.pickup_date,
        application.pickup_time,
        application.pickup_location,
        application.pickup_instructions,
        application.internal_notes,
        activity.note as activity_note,
        event.payload
      from public.applications as application
      join public.application_activity as activity
        on activity.application_id = application.id
        and activity.action = 'approve_application'
      join public.application_workflow_events as event
        on event.activity_id = activity.id
      where application.id = $1
    `,
    [firstApplicationId],
  );
  assert.equal(approvalMetadata.rows[0].status, "approved");
  assert.equal(approvalMetadata.rows[0].assigned_car, "2022 Toyota Corolla");
  assert.equal(
    approvalMetadata.rows[0].pickup_date.toISOString().slice(0, 10),
    "2099-01-02",
  );
  assert.equal(approvalMetadata.rows[0].pickup_time, "14:00:00");
  assert.equal(
    approvalMetadata.rows[0].pickup_location,
    "1160 Crescent Ridge, Buford, Georgia",
  );
  assert.equal(
    approvalMetadata.rows[0].pickup_instructions,
    "Please arrive 10 minutes early and call us when you arrive.",
  );
  assert.equal(
    approvalMetadata.rows[0].internal_notes,
    "Initial reviewer note.\n\nAddress document was unreadable during review.\n\nVehicle availability confirmed.",
  );
  assert.equal(
    approvalMetadata.rows[0].activity_note,
    "Assigned Car:\n2022 Toyota Corolla\n\nPickup:\nJan 2, 2099 at 2:00 PM\n\nLocation:\n1160 Crescent Ridge, Buford, Georgia",
  );
  assert.equal(approvalMetadata.rows[0].payload.application_id, firstApplicationId);
  assert.equal(approvalMetadata.rows[0].payload.application_number, firstApplication.application_number);
  assert.equal(approvalMetadata.rows[0].payload.first_name, "Avery");
  assert.equal(approvalMetadata.rows[0].payload.email, "avery@example.com");
  assert.equal(approvalMetadata.rows[0].payload.assigned_car, "2022 Toyota Corolla");
  assert.equal(approvalMetadata.rows[0].payload.pickup_date, "2099-01-02");
  assert.equal(approvalMetadata.rows[0].payload.pickup_time, "14:00");
  assert.equal(
    approvalMetadata.rows[0].payload.pickup_location,
    "1160 Crescent Ridge, Buford, Georgia",
  );
  assert.equal(
    approvalMetadata.rows[0].payload.pickup_instructions,
    "Please arrive 10 minutes early and call us when you arrive.",
  );
  assert.equal(approvalMetadata.rows[0].payload.internal_note, undefined);
  assert.equal(approvalMetadata.rows[0].payload.internal_notes, undefined);
  assert.equal(approvalMetadata.rows[0].payload.performed_by, undefined);
  assert.equal(approvalMetadata.rows[0].payload.drivers_license_path, undefined);
  assert.equal(approvalMetadata.rows[0].payload.proof_of_address_path, undefined);

  await expectDatabaseError(
    () => performAction(firstApplicationId, "deny_application", {
      decisionReason: "No longer eligible",
    }),
    /Cannot deny an application that is already approved\./,
  );

  const secondApplicationId = "20000000-0000-4000-8000-000000000002";
  await createApplication(secondApplicationId, "blake@example.com");

  await expectDatabaseError(
    () => performAction(secondApplicationId, "request_more_information"),
    /message_to_customer is required/,
  );

  const thirdApplicationId = "20000000-0000-4000-8000-000000000003";
  await createApplication(thirdApplicationId, "casey@example.com");
  const deniedWithoutReason = await performAction(
    thirdApplicationId,
    "deny_application",
  );
  assert.equal(deniedWithoutReason.new_status, "denied");
  assert.equal(deniedWithoutReason.event_payload.decision_reason, "");
  const deniedWithoutReasonApplication = await db.query(
    "select decision_reason from public.applications where id = $1",
    [thirdApplicationId],
  );
  assert.equal(deniedWithoutReasonApplication.rows[0].decision_reason, null);

  const denied = await performAction(secondApplicationId, "deny_application", {
    decisionReason: "Eligibility requirements were not met.",
  });
  assert.equal(denied.new_status, "denied");
  assert.equal(denied.event_type, "application.denied");

  const deniedApplication = await db.query(
    `
      select status, decision_reason, reviewed_by, reviewed_at
      from public.applications
      where id = $1
    `,
    [secondApplicationId],
  );
  assert.equal(deniedApplication.rows[0].status, "denied");
  assert.equal(
    deniedApplication.rows[0].decision_reason,
    "Eligibility requirements were not met.",
  );
  assert.equal(
    deniedApplication.rows[0].reviewed_by,
    "10000000-0000-4000-8000-000000000001",
  );
  assert.ok(deniedApplication.rows[0].reviewed_at);

  const fourthApplicationId = "20000000-0000-4000-8000-000000000004";
  await createApplication(fourthApplicationId, "devon@example.com");
  const cancelledWithNote = await performAction(
    fourthApplicationId,
    "cancel_application",
    { cancellationNote: "Application cancelled at your request." },
  );
  assert.equal(cancelledWithNote.new_status, "cancelled");
  assert.equal(
    cancelledWithNote.event_payload.cancellation_note,
    "Application cancelled at your request.",
  );
  const cancelledApplication = await db.query(
    "select cancellation_note from public.applications where id = $1",
    [fourthApplicationId],
  );
  assert.equal(
    cancelledApplication.rows[0].cancellation_note,
    "Application cancelled at your request.",
  );

  const fifthApplicationId = "20000000-0000-4000-8000-000000000005";
  await createApplication(fifthApplicationId, "ellis@example.com");
  const cancelledWithoutNote = await performAction(
    fifthApplicationId,
    "cancel_application",
  );
  assert.equal(cancelledWithoutNote.new_status, "cancelled");
  assert.equal(cancelledWithoutNote.event_payload.cancellation_note, "");

  const workflowHistory = await db.query(
    `
      select action, previous_status, new_status, note, performed_by
      from public.application_activity
      where application_id = $1
      order by created_at, id
    `,
    [firstApplicationId],
  );
  assert.equal(workflowHistory.rows.length, 5);
  const workflowStates = workflowHistory.rows
    .map(({ action, previous_status, new_status }) => ({
      action,
      previous_status,
      new_status,
    }))
    .sort((left, right) => left.action.localeCompare(right.action));
  assert.deepEqual(
    workflowStates,
    [
      {
        action: "approve_application",
        previous_status: "under_review",
        new_status: "approved",
      },
      {
        action: "application_created",
        previous_status: null,
        new_status: "under_review",
      },
      {
        action: "internal_notes_updated",
        previous_status: "under_review",
        new_status: "under_review",
      },
      {
        action: "request_more_information",
        previous_status: "under_review",
        new_status: "more_information_required",
      },
      {
        action: "resume_review",
        previous_status: "more_information_required",
        new_status: "under_review",
      },
    ].sort((left, right) => left.action.localeCompare(right.action)),
  );

  await expectDatabaseError(
    () => db.query(
      `
        update public.application_activity
        set note = 'tampered'
        where application_id = $1
          and action = 'application_created'
      `,
      [firstApplicationId],
    ),
    /Workflow history is append-only/,
  );
  console.log("Database workflow verification passed.");
} finally {
  await db.close();
}
