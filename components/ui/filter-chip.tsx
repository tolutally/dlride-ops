import { X } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type FilterChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  removable?: boolean;
};

export function FilterChip({ active, removable, className, children, type = "button", ...props }: FilterChipProps) {
  return (
    <button
      type={type}
      className={cn(styles.filterChip, active && styles.filterChipActive, className)}
      aria-pressed={active}
      {...props}
    >
      {children}
      {removable ? <X aria-hidden="true" /> : null}
    </button>
  );
}
