import type { ApplicationStatus } from "@/lib/design-system/status";

export const VEHICLE_USES = [
  "gig_work",
  "road_trips",
  "personal_use",
  "travel_nursing",
  "other",
] as const;

export type VehicleUse = (typeof VEHICLE_USES)[number];

export const VEHICLE_USE_LABELS: Record<VehicleUse, string> = {
  gig_work: "Gig Work",
  road_trips: "Road Trips",
  personal_use: "Personal Use",
  travel_nursing: "Travel Nursing",
  other: "Other",
};

export type ApplicationQueueItem = {
  id: string;
  application_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  rental_start_date: string;
  rental_end_date: string;
  pickup_time: string | null;
  dropoff_time: string | null;
  rental_weeks: number;
  intended_vehicle_use: VehicleUse;
  status: ApplicationStatus;
  created_at: string;
  unread_reply_count: number;
};

export const APPLICATION_SORT_FIELDS = [
  "submitted",
  "rental_start_date",
  "rental_weeks",
  "applicant_name",
] as const;

export type ApplicationSortField = (typeof APPLICATION_SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

export type ApplicationQueueFilters = {
  query: string;
  status: ApplicationStatus | "all";
  vehicleUse: VehicleUse | "all";
  sortBy: ApplicationSortField;
  direction: SortDirection;
  page: number;
};

export type ApplicationQueueResult = {
  applications: ApplicationQueueItem[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};
