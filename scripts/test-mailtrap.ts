import {
  buildApplicationReceivedEmail,
  buildWorkflowEmail,
  sendMailtrapTemplateEmail,
  type MailtrapConfiguration,
} from "../supabase/functions/_shared/application-email.ts";

function environment(name: string) {
  return Deno.env.get(name) ?? "";
}

const recipient = environment("MAILTRAP_TO_EMAIL").trim();
if (!recipient) throw new Error("MAILTRAP_TO_EMAIL is required for template tests");

const configuration: MailtrapConfiguration = {
  apiToken: environment("MAILTRAP_API_TOKEN"),
  fromEmail: environment("MAILTRAP_FROM_EMAIL"),
  fromName: environment("MAILTRAP_FROM_NAME"),
  replyToEmail: environment("MAILTRAP_REPLY_TO_EMAIL") || undefined,
  replyToName: environment("MAILTRAP_REPLY_TO_NAME") || undefined,
  templates: {
    applicationReceived: environment("MAILTRAP_TEMPLATE_APPLICATION_RECEIVED"),
    applicationApproved: environment("MAILTRAP_TEMPLATE_APPLICATION_APPROVED"),
    moreInformationRequired: environment("MAILTRAP_TEMPLATE_MORE_INFORMATION_REQUIRED"),
    applicationDenied: environment("MAILTRAP_TEMPLATE_APPLICATION_DENIED"),
    applicationCancelled: environment("MAILTRAP_TEMPLATE_APPLICATION_CANCELLED"),
  },
};

const base = {
  application_id: "00000000-0000-4000-8000-000000000001",
  application_number: "DLR-999999",
  first_name: "Mailtrap Test",
  email: recipient,
};

const templateTests = [
  {
    name: "Application Received",
    email: buildApplicationReceivedEmail(base, configuration.templates),
  },
  {
    name: "Application Approved",
    email: buildWorkflowEmail({
      ...base,
      event_type: "application.approved",
      assigned_car: "2022 Toyota Corolla",
      pickup_date: "2026-08-15",
      pickup_time: "14:00",
      pickup_location: "1160 Crescent Ridge, Buford, Georgia",
      pickup_instructions: "Please arrive 10 minutes early and bring your original ID.",
    }, configuration.templates),
  },
  {
    name: "More Information Required",
    email: buildWorkflowEmail({
      ...base,
      event_type: "application.more_information_requested",
      message_to_customer: "Please upload a clearer copy of your driver's licence.",
    }, configuration.templates),
  },
  {
    name: "Application Denied",
    email: buildWorkflowEmail({
      ...base,
      event_type: "application.denied",
      decision_reason: "We were unable to verify the documentation provided.",
    }, configuration.templates),
  },
  {
    name: "Application Cancelled",
    email: buildWorkflowEmail({
      ...base,
      event_type: "application.cancelled",
      cancellation_note: "Application cancelled at your request.",
    }, configuration.templates),
  },
];

for (const templateTest of templateTests) {
  await sendMailtrapTemplateEmail(templateTest.email, configuration);
  console.log(`${templateTest.name} test email sent.`);
}
