import {
  CircleCheck,
  CircleX,
  PhoneCall,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import type { BadgeTone } from "@/components/ui/badge";

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "disqualified",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type LeadStatusDefinition = {
  label: string;
  tone: BadgeTone;
  icon: LucideIcon;
};

export const LEAD_STATUS_CONFIG: Record<LeadStatus, LeadStatusDefinition> = {
  new: { label: "New", tone: "blue", icon: Sparkles },
  contacted: { label: "Contacted", tone: "amber", icon: PhoneCall },
  qualified: { label: "Qualified", tone: "green", icon: CircleCheck },
  converted: { label: "Converted", tone: "green", icon: Trophy },
  disqualified: { label: "Disqualified", tone: "red", icon: CircleX },
};
