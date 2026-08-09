import { VEHICLE_USE_LABELS, type VehicleUse } from "./types";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const submittedFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Edmonton",
});

const rentalTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatRentalDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function formatSubmittedDate(value: string) {
  return submittedFormatter.format(new Date(value));
}

export function formatRentalRange(start: string, end: string) {
  return `${formatRentalDate(start)} – ${formatRentalDate(end)}`;
}

export function formatRentalTime(value: string | null) {
  if (!value) return "Not provided";

  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return value;

  return rentalTimeFormatter.format(new Date(Date.UTC(2000, 0, 1, hour, minute)));
}

export function formatRentalWeeks(weeks: number) {
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

export function vehicleUseLabel(value: VehicleUse) {
  return VEHICLE_USE_LABELS[value];
}
