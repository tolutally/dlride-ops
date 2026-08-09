import type { ApplicationActivityAction, PaymentMethod } from "./detail-types";

const detailDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Edmonton",
});

const detailTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Edmonton",
});

const activityDateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  timeZone: "America/Edmonton",
});

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  "e-transfer": "E-transfer",
  card: "Card",
};

export const ACTIVITY_LABELS: Record<ApplicationActivityAction, string> = {
  application_created: "Application received",
  request_more_information: "Requested more information",
  resume_review: "Review resumed",
  approve_application: "Application approved",
  deny_application: "Application denied",
  cancel_application: "Application cancelled",
  internal_notes_updated: "Internal notes updated",
  customer_replied: "Customer replied",
};

export function formatDetailDateTime(value: string) {
  const date = new Date(value);
  return `${detailDateFormatter.format(date)} at ${detailTimeFormatter.format(date)}`;
}

export function formatActivityDateTime(value: string) {
  const date = new Date(value);
  return `${activityDateFormatter.format(date)}, ${detailTimeFormatter.format(date)}`;
}

export function documentFileName(path: string) {
  const fileName = path.split("/").at(-1);
  return fileName ? decodeURIComponent(fileName) : "Document";
}
