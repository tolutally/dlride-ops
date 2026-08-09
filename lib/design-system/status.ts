import {
  CircleAlert,
  CircleCheck,
  CircleDotDashed,
  CircleMinus,
  CircleX,
  type LucideIcon,
} from "lucide-react";

import type { BadgeTone } from "@/components/ui/badge";

export const APPLICATION_STATUSES = [
  "under_review",
  "more_information_required",
  "approved",
  "denied",
  "cancelled",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type StatusDefinition = {
  label: string;
  tone: BadgeTone;
  icon: LucideIcon;
};

export const STATUS_CONFIG: Record<ApplicationStatus, StatusDefinition> = {
  under_review: {
    label: "Under Review",
    tone: "blue",
    icon: CircleDotDashed,
  },
  more_information_required: {
    label: "Needs Info",
    tone: "amber",
    icon: CircleAlert,
  },
  approved: {
    label: "Approved",
    tone: "green",
    icon: CircleCheck,
  },
  denied: {
    label: "Denied",
    tone: "red",
    icon: CircleX,
  },
  cancelled: {
    label: "Cancelled",
    tone: "neutral",
    icon: CircleMinus,
  },
};
