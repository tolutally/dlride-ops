export type MailtrapTemplateVariables = Record<string, string>;

export type ApplicationEmailTemplates = {
  applicationReceived: string;
  applicationApproved: string;
  moreInformationRequired: string;
  applicationDenied: string;
  applicationCancelled: string;
};

export type MailtrapConfiguration = {
  apiToken: string;
  fromEmail: string;
  fromName: string;
  replyToEmail?: string;
  replyToName?: string;
  templates: ApplicationEmailTemplates;
};

export type ApplicationReceivedEmail = {
  first_name: string;
  application_number: string;
  email: string;
};

type WorkflowEmailBase = ApplicationReceivedEmail & {
  application_id: string;
};

export type WorkflowEmailEvent =
  | (WorkflowEmailBase & {
      event_type: "application.approved";
      assigned_car: string;
      pickup_date: string;
      pickup_time: string;
      pickup_location: string;
      pickup_instructions?: string | null;
    })
  | (WorkflowEmailBase & {
      event_type: "application.more_information_requested";
      message_to_customer: string;
    })
  | (WorkflowEmailBase & {
      event_type: "application.denied";
      decision_reason?: string | null;
    })
  | (WorkflowEmailBase & {
      event_type: "application.cancelled";
      cancellation_note?: string | null;
    });

export type MailtrapTemplateEmail = {
  toEmail: string;
  toName: string;
  templateUuid: string;
  templateVariables: MailtrapTemplateVariables;
};

export type MailtrapTextEmail = {
  toEmail: string;
  toName: string;
  ccEmail?: string;
  ccName?: string;
  subject: string;
  text: string;
};

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function required(value: string, name: string) {
  if (!value.trim()) throw new Error(`Missing Mailtrap configuration: ${name}`);
  return value.trim();
}

function applicationVariables(application: {
  first_name: string;
  application_number: string;
}) {
  const applicationNumber = application.application_number.trim();
  if (!applicationNumber) {
    throw new Error("Application email is missing application_number");
  }

  return {
    first_name: application.first_name,
    application_number: applicationNumber,
  };
}

export function validateMailtrapConfiguration(
  configuration: MailtrapConfiguration,
): MailtrapConfiguration {
  return {
    apiToken: required(configuration.apiToken, "MAILTRAP_API_TOKEN"),
    fromEmail: required(configuration.fromEmail, "MAILTRAP_FROM_EMAIL"),
    fromName: required(configuration.fromName, "MAILTRAP_FROM_NAME"),
    replyToEmail: configuration.replyToEmail?.trim() || undefined,
    replyToName: configuration.replyToName?.trim() || undefined,
    templates: configuration.templates,
  };
}

export function formatCustomerPickupDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid pickup date in workflow event");
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Invalid pickup date in workflow event");
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatCustomerPickupTime(value: string) {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.exec(value);
  if (!match) throw new Error("Invalid pickup time in workflow event");

  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export function buildApplicationReceivedEmail(
  application: ApplicationReceivedEmail,
  templates: ApplicationEmailTemplates,
): MailtrapTemplateEmail {
  return {
    toEmail: application.email,
    toName: application.first_name,
    templateUuid: required(
      templates.applicationReceived,
      "MAILTRAP_TEMPLATE_APPLICATION_RECEIVED",
    ),
    templateVariables: applicationVariables(application),
  };
}

export function buildWorkflowEmail(
  event: WorkflowEmailEvent,
  templates: ApplicationEmailTemplates,
): MailtrapTemplateEmail {
  const base = applicationVariables(event);

  switch (event.event_type) {
    case "application.approved":
      return {
        toEmail: event.email,
        toName: event.first_name,
        templateUuid: required(
          templates.applicationApproved,
          "MAILTRAP_TEMPLATE_APPLICATION_APPROVED",
        ),
        templateVariables: {
          ...base,
          assigned_car: event.assigned_car,
          pickup_date: formatCustomerPickupDate(event.pickup_date),
          pickup_time: formatCustomerPickupTime(event.pickup_time),
          pickup_location: event.pickup_location,
          pickup_instructions: event.pickup_instructions ?? "",
        },
      };
    case "application.more_information_requested":
      return {
        toEmail: event.email,
        toName: event.first_name,
        templateUuid: required(
          templates.moreInformationRequired,
          "MAILTRAP_TEMPLATE_MORE_INFORMATION_REQUIRED",
        ),
        templateVariables: {
          ...base,
          message_to_customer: event.message_to_customer,
        },
      };
    case "application.denied":
      return {
        toEmail: event.email,
        toName: event.first_name,
        templateUuid: required(
          templates.applicationDenied,
          "MAILTRAP_TEMPLATE_APPLICATION_DENIED",
        ),
        templateVariables: {
          ...base,
          decision_reason: event.decision_reason ?? "",
        },
      };
    case "application.cancelled":
      return {
        toEmail: event.email,
        toName: event.first_name,
        templateUuid: required(
          templates.applicationCancelled,
          "MAILTRAP_TEMPLATE_APPLICATION_CANCELLED",
        ),
        templateVariables: {
          ...base,
          cancellation_note: event.cancellation_note ?? "",
        },
      };
  }
}

export async function sendMailtrapTemplateEmail(
  email: MailtrapTemplateEmail,
  configuration: MailtrapConfiguration,
  fetcher: Fetcher = fetch,
) {
  const config = validateMailtrapConfiguration(configuration);
  const applicationNumber = email.templateVariables.application_number;
  if (typeof applicationNumber !== "string" || !applicationNumber.trim()) {
    throw new Error("Application email is missing application_number");
  }
  const response = await fetcher("https://send.api.mailtrap.io/api/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: config.fromEmail, name: config.fromName },
      ...(config.replyToEmail
        ? {
            reply_to: {
              email: config.replyToEmail,
              ...(config.replyToName ? { name: config.replyToName } : {}),
            },
          }
        : {}),
      to: [{ email: email.toEmail, name: email.toName }],
      template_uuid: email.templateUuid,
      template_variables: email.templateVariables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mailtrap request failed with status ${response.status}`);
  }
}

export async function sendMailtrapTextEmail(
  email: MailtrapTextEmail,
  configuration: MailtrapConfiguration,
  fetcher: Fetcher = fetch,
) {
  const config = validateMailtrapConfiguration(configuration);
  const response = await fetcher("https://send.api.mailtrap.io/api/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { email: config.fromEmail, name: config.fromName },
      ...(config.replyToEmail
        ? {
            reply_to: {
              email: config.replyToEmail,
              ...(config.replyToName ? { name: config.replyToName } : {}),
            },
          }
        : {}),
      to: [{ email: email.toEmail, name: email.toName }],
      ...(email.ccEmail
        ? {
            cc: [{
              email: email.ccEmail,
              ...(email.ccName ? { name: email.ccName } : {}),
            }],
          }
        : {}),
      subject: email.subject,
      text: email.text,
      category: "application-notification",
    }),
  });

  if (!response.ok) {
    throw new Error(`Mailtrap request failed with status ${response.status}`);
  }
}
