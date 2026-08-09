import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type BadgeTone = "neutral" | "blue" | "amber" | "green" | "red";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  icon?: LucideIcon;
};

const toneStyles: Record<BadgeTone, string> = {
  neutral: styles.badgeNeutral,
  blue: styles.badgeBlue,
  amber: styles.badgeAmber,
  green: styles.badgeGreen,
  red: styles.badgeRed,
};

export function Badge({ className, tone = "neutral", icon: Icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(styles.badge, toneStyles[tone], className)} {...props}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
