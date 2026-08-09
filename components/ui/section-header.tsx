import type { HTMLAttributes, ReactNode } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type SectionHeaderProps = HTMLAttributes<HTMLElement> & {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function SectionHeader({ title, description, actions, className, ...props }: SectionHeaderProps) {
  return (
    <header className={cn(styles.sectionHeader, className)} {...props}>
      <div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {description ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.sectionActions}>{actions}</div> : null}
    </header>
  );
}
