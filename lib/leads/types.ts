import type { LeadStatus } from "@/lib/design-system/lead-status";

export type Lead = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  message: string | null;
  source: string;
  status: LeadStatus;
  created_at: string;
};

export type LeadListResult = {
  leads: Lead[];
};
