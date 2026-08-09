import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn(styles.emptyState, className)} {...props}>
      <div className={styles.emptyIcon}><Icon aria-hidden="true" /></div>
      <h3 className={styles.emptyTitle}>{title}</h3>
      <p className={styles.emptyDescription}>{description}</p>
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}
