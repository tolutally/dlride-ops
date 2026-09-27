import {
  buildApplicationReceivedEmail,
  buildWorkflowEmail,
  sendMailtrapTemplateEmail,
  sendMailtrapTextEmail,
  type ApplicationEmailTemplates,
  type MailtrapConfiguration,
} from "./application-email.ts";

const templates: ApplicationEmailTemplates = {
  applicationReceived: "received-template",
  applicationApproved: "approved-template",
  moreInformationRequired: "more-info-template",
  applicationDenied: "denied-template",
  applicationCancelled: "cancelled-template",
};

const configuration: MailtrapConfiguration = {
  apiToken: "test-token",
  fromEmail: "sender@example.test",
  fromName: "Test Sender",
  replyToEmail: "replies@example.test",
  replyToName: "Test Replies",
  templates,
};

function assertEquals(actual: unknown, expected: unknown, message = "Values differ") {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}: expected ${expectedJson}, received ${actualJson}`);
  }
}

Deno.test("application received email contains only the base template variables", () => {
  const email = buildApplicationReceivedEmail({
    first_name: "James",
    application_number: "DLR-000124",
    email: "james@example.com",
  }, templates);

  assertEquals(email, {
    toEmail: "james@example.com",
    toName: "James",
    templateUuid: "received-template",
    templateVariables: {
      first_name: "James",
      application_number: "DLR-000124",
    },
  });
});

Deno.test("approval email formats pickup values for the customer", () => {
  const email = buildWorkflowEmail({
    event_type: "application.approved",
    application_id: "application-id",
    application_number: "DLR-000124",
    first_name: "James",
    email: "james@example.com",
    assigned_car: "2022 Toyota Corolla",
    pickup_date: "2026-08-15",
    pickup_time: "14:00",
    pickup_location: "1160 Crescent Ridge, Buford, Georgia",
    pickup_instructions: "Please arrive 10 minutes early and bring your original ID.",
  }, templates);

  assertEquals(email.templateVariables, {
    first_name: "James",
    application_number: "DLR-000124",
    assigned_car: "2022 Toyota Corolla",
    pickup_date: "August 15, 2026",
    pickup_time: "2:00 PM",
    pickup_location: "1160 Crescent Ridge, Buford, Georgia",
    pickup_instructions: "Please arrive 10 minutes early and bring your original ID.",
  });
});

Deno.test("more-information email preserves the exact customer message", () => {
  const message = "Please upload a clearer copy of the front of your driver's licence.";
  const email = buildWorkflowEmail({
    event_type: "application.more_information_requested",
    application_id: "application-id",
    application_number: "DLR-000124",
    first_name: "James",
    email: "james@example.com",
    message_to_customer: message,
  }, templates);

  assertEquals(email.templateVariables.message_to_customer, message);
  assertEquals("internal_note" in email.templateVariables, false);
});

Deno.test("optional customer-facing values are sent as empty strings", () => {
  const denied = buildWorkflowEmail({
    event_type: "application.denied",
    application_id: "application-id",
    application_number: "DLR-000124",
    first_name: "James",
    email: "james@example.com",
    decision_reason: null,
  }, templates);
  const cancelled = buildWorkflowEmail({
    event_type: "application.cancelled",
    application_id: "application-id",
    application_number: "DLR-000124",
    first_name: "James",
    email: "james@example.com",
  }, templates);

  assertEquals(denied.templateVariables.decision_reason, "");
  assertEquals(cancelled.templateVariables.cancellation_note, "");
});

Deno.test("denial and cancellation emails preserve reviewer-entered values", () => {
  const decisionReason = "We were unable to verify the documentation provided.";
  const cancellationNote = "Application cancelled at your request.";
  const denied = buildWorkflowEmail({
    event_type: "application.denied",
    application_id: "application-id",
    application_number: "DLR-000124",
    first_name: "James",
    email: "james@example.com",
    decision_reason: decisionReason,
  }, templates);
  const cancelled = buildWorkflowEmail({
    event_type: "application.cancelled",
    application_id: "application-id",
    application_number: "DLR-000124",
    first_name: "James",
    email: "james@example.com",
    cancellation_note: cancellationNote,
  }, templates);

  assertEquals(denied.templateVariables.decision_reason, decisionReason);
  assertEquals(cancelled.templateVariables.cancellation_note, cancellationNote);
});

Deno.test("Mailtrap sender uses the hosted template API without inline content", async () => {
  let request: RequestInit | undefined;
  await sendMailtrapTemplateEmail(
    buildApplicationReceivedEmail({
      first_name: "James",
      application_number: "DLR-000124",
      email: "james@example.com",
    }, templates),
    configuration,
    (_input, init) => {
      request = init;
      return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
    },
  );

  const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
  assertEquals(body, {
    from: { email: "sender@example.test", name: "Test Sender" },
    reply_to: { email: "replies@example.test", name: "Test Replies" },
    to: [{ email: "james@example.com", name: "James" }],
    template_uuid: "received-template",
    template_variables: {
      first_name: "James",
      application_number: "DLR-000124",
    },
  });
  assertEquals("subject" in body, false);
  assertEquals("html" in body, false);
  assertEquals("text" in body, false);
});

Deno.test("Mailtrap text sender builds a staff notification", async () => {
  let request: RequestInit | undefined;
  await sendMailtrapTextEmail({
    toEmail: "ops@example.test",
    toName: "DLride Rentals",
    ccEmail: "hello@example.test",
    ccName: "DLride",
    subject: "New rental application DLR-000124",
    text: "Review the application in DLride Ops.",
  }, configuration, (_input, init) => {
    request = init;
    return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }));
  });

  const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
  assertEquals(body, {
    from: { email: "sender@example.test", name: "Test Sender" },
    reply_to: { email: "replies@example.test", name: "Test Replies" },
    to: [{ email: "ops@example.test", name: "DLride Rentals" }],
    cc: [{ email: "hello@example.test", name: "DLride" }],
    subject: "New rental application DLR-000124",
    text: "Review the application in DLride Ops.",
    category: "application-notification",
  });
});

Deno.test("Mailtrap sender fails clearly when the From email is missing", async () => {
  let message = "";
  try {
    await sendMailtrapTemplateEmail(
      buildApplicationReceivedEmail({
        first_name: "James",
        application_number: "DLR-000124",
        email: "james@example.com",
      }, templates),
      { ...configuration, fromEmail: "" },
      () => Promise.resolve(new Response(null, { status: 200 })),
    );
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assertEquals(message, "Missing Mailtrap configuration: MAILTRAP_FROM_EMAIL");
});

Deno.test("Mailtrap sender omits Reply-To when its email is not configured", async () => {
  let request: RequestInit | undefined;
  await sendMailtrapTemplateEmail(
    buildApplicationReceivedEmail({
      first_name: "James",
      application_number: "DLR-000124",
      email: "james@example.com",
    }, templates),
    { ...configuration, replyToEmail: undefined },
    (_input, init) => {
      request = init;
      return Promise.resolve(new Response(null, { status: 200 }));
    },
  );

  const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
  assertEquals("reply_to" in body, false);
});

Deno.test("all five templates inherit the central From and Reply-To configuration", async () => {
  const messages = [
    buildApplicationReceivedEmail({
      first_name: "James",
      application_number: "DLR-000124",
      email: "james@example.com",
    }, templates),
    buildWorkflowEmail({
      event_type: "application.approved",
      application_id: "application-id",
      application_number: "DLR-000124",
      first_name: "James",
      email: "james@example.com",
      assigned_car: "2022 Toyota Corolla",
      pickup_date: "2026-08-15",
      pickup_time: "14:00",
      pickup_location: "1160 Crescent Ridge, Buford, Georgia",
    }, templates),
    buildWorkflowEmail({
      event_type: "application.more_information_requested",
      application_id: "application-id",
      application_number: "DLR-000124",
      first_name: "James",
      email: "james@example.com",
      message_to_customer: "Please upload a clearer document.",
    }, templates),
    buildWorkflowEmail({
      event_type: "application.denied",
      application_id: "application-id",
      application_number: "DLR-000124",
      first_name: "James",
      email: "james@example.com",
    }, templates),
    buildWorkflowEmail({
      event_type: "application.cancelled",
      application_id: "application-id",
      application_number: "DLR-000124",
      first_name: "James",
      email: "james@example.com",
    }, templates),
  ];

  const bodies: Array<Record<string, unknown>> = [];
  for (const message of messages) {
    await sendMailtrapTemplateEmail(message, configuration, (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Promise.resolve(new Response(null, { status: 200 }));
    });
  }

  assertEquals(bodies.length, 5);
  for (const body of bodies) {
    assertEquals(body.from, {
      email: "sender@example.test",
      name: "Test Sender",
    });
    assertEquals(body.reply_to, {
      email: "replies@example.test",
      name: "Test Replies",
    });
    const variables = body.template_variables as Record<string, unknown>;
    assertEquals(variables.application_number, "DLR-000124");
  }
});

Deno.test("all five application emails use the existing application number unchanged", () => {
  const applicationNumber = "CURRENT-APPLICATION-ID-42";
  const base = {
    application_id: "application-id",
    application_number: applicationNumber,
    first_name: "James",
    email: "james@example.com",
  };
  const messages = [
    buildApplicationReceivedEmail(base, templates),
    buildWorkflowEmail({
      ...base,
      event_type: "application.approved",
      assigned_car: "2022 Toyota Corolla",
      pickup_date: "2026-08-15",
      pickup_time: "14:00",
      pickup_location: "1160 Crescent Ridge, Buford, Georgia",
    }, templates),
    buildWorkflowEmail({
      ...base,
      event_type: "application.more_information_requested",
      message_to_customer: "Please upload a clearer document.",
    }, templates),
    buildWorkflowEmail({
      ...base,
      event_type: "application.denied",
    }, templates),
    buildWorkflowEmail({
      ...base,
      event_type: "application.cancelled",
    }, templates),
  ];

  for (const message of messages) {
    assertEquals(message.templateVariables.first_name, "James");
    assertEquals(message.templateVariables.application_number, applicationNumber);
  }
});

Deno.test("application email creation rejects a missing application number", () => {
  let message = "";
  try {
    buildApplicationReceivedEmail({
      first_name: "James",
      application_number: "   ",
      email: "james@example.com",
    }, templates);
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assertEquals(message, "Application email is missing application_number");
});

Deno.test("Mailtrap sender rejects a missing application number before making a request", async () => {
  let requested = false;
  let message = "";
  try {
    await sendMailtrapTemplateEmail({
      toEmail: "james@example.com",
      toName: "James",
      templateUuid: "received-template",
      templateVariables: { first_name: "James" },
    }, configuration, () => {
      requested = true;
      return Promise.resolve(new Response(null, { status: 200 }));
    });
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assertEquals(message, "Application email is missing application_number");
  assertEquals(requested, false);
});
