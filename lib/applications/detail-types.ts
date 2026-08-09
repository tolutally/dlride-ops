import type { ApplicationStatus } from "@/lib/design-system/status";

import type { VehicleUse } from "./types";

export type PaymentMethod = "cash" | "e-transfer" | "card";

export type ApplicationDetail = {
  id: string;
  application_number: string;
  status: ApplicationStatus;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  rental_start_date: string;
  rental_end_date: string;
  pickup_date: string | null;
  pickup_time: string | null;
  pickup_location: string | null;
  pickup_instructions: string | null;
  dropoff_time: string | null;
  rental_weeks: number;
  assigned_car: string | null;
  intended_vehicle_use: VehicleUse;
  payment_method: PaymentMethod;
  additional_information: string | null;
  drivers_license_path: string | null;
  proof_of_address_path: string | null;
  internal_notes: string | null;
  decision_reason: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

export type ApplicationActivityAction =
  | "application_created"
  | "request_more_information"
  | "resume_review"
  | "approve_application"
  | "deny_application"
  | "cancel_application"
  | "internal_notes_updated"
  | "customer_replied";

export type ApplicationActivityItem = {
  id: string;
  action: ApplicationActivityAction;
  note: string | null;
  created_at: string;
};

export type MessageAttachment = {
  id: string;
  filename: string;
  mime_type: "application/pdf" | "image/jpeg" | "image/png";
  file_size: number;
};

export type ApplicationMessage = {
  id: string;
  direction: "inbound" | "outbound";
  sender_email: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  received_at: string;
  is_read: boolean;
  attachments: MessageAttachment[];
};

export type ApplicationConversation = {
  messages: ApplicationMessage[];
  hasEarlier: boolean;
  hasUnread: boolean;
  unreadCount: number;
};

export type ApplicationDetailResult = {
  application: ApplicationDetail;
  activity: ApplicationActivityItem[];
  conversation: ApplicationConversation;
};
