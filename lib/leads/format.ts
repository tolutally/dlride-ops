import type { Lead } from "./types";

const receivedFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Edmonton",
});

export function formatLeadReceivedAt(value: string) {
  return receivedFormatter.format(new Date(value));
}

export function leadFullName(lead: Pick<Lead, "first_name" | "last_name">) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ");
}

export function leadSourceLabel(source: string) {
  return source.charAt(0).toUpperCase() + source.slice(1);
}
