import { APPLICATION_SORT_FIELDS, type ApplicationQueueFilters, VEHICLE_USES } from "./types";
import { APPLICATION_STATUSES } from "@/lib/design-system/status";

export type QueueSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function includes<const T extends readonly string[]>(values: T, value: string | undefined): value is T[number] {
  return Boolean(value && values.includes(value as T[number]));
}

export function parseQueueFilters(params: QueueSearchParams): ApplicationQueueFilters {
  const rawStatus = first(params.status);
  const rawVehicleUse = first(params.use);
  const rawSort = first(params.sort);
  const rawDirection = first(params.direction);
  const rawPage = Number.parseInt(first(params.page) ?? "1", 10);

  return {
    query: (first(params.q) ?? "").trim().slice(0, 120),
    status: includes(APPLICATION_STATUSES, rawStatus) ? rawStatus : "all",
    vehicleUse: includes(VEHICLE_USES, rawVehicleUse) ? rawVehicleUse : "all",
    sortBy: includes(APPLICATION_SORT_FIELDS, rawSort) ? rawSort : "submitted",
    direction: rawDirection === "asc" ? "asc" : "desc",
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function queueUrl(filters: ApplicationQueueFilters, overrides: Partial<ApplicationQueueFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.query) params.set("q", next.query);
  if (next.status !== "all") params.set("status", next.status);
  if (next.vehicleUse !== "all") params.set("use", next.vehicleUse);
  if (next.sortBy !== "submitted") params.set("sort", next.sortBy);
  if (next.direction !== "desc") params.set("direction", next.direction);
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();
  return query ? `/applications?${query}` : "/applications";
}
