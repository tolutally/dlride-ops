import { Badge, type BadgeProps } from "./badge";
import { STATUS_CONFIG, type ApplicationStatus } from "@/lib/design-system/status";
import { LEAD_STATUS_CONFIG, type LeadStatus } from "@/lib/design-system/lead-status";

export type StatusBadgeProps = Omit<BadgeProps, "children" | "tone" | "icon"> & {
  status: ApplicationStatus;
  showIcon?: boolean;
};

export function StatusBadge({ status, showIcon = true, ...props }: StatusBadgeProps) {
  const definition = STATUS_CONFIG[status];
  return (
    <Badge
      tone={definition.tone}
      icon={showIcon ? definition.icon : undefined}
      {...props}
    >
      {definition.label}
    </Badge>
  );
}

export type LeadStatusBadgeProps = Omit<BadgeProps, "children" | "tone" | "icon"> & {
  status: LeadStatus;
  showIcon?: boolean;
};

export function LeadStatusBadge({ status, showIcon = true, ...props }: LeadStatusBadgeProps) {
  const definition = LEAD_STATUS_CONFIG[status];
  return (
    <Badge
      tone={definition.tone}
      icon={showIcon ? definition.icon : undefined}
      {...props}
    >
      {definition.label}
    </Badge>
  );
}
