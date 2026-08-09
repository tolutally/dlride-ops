import type { HTMLAttributes, ReactNode } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <header className={cn(styles.pageHeader, className)} {...props}>
      <div>
        {eyebrow ? <p className={styles.pageEyebrow}>{eyebrow}</p> : null}
        <h1 className={styles.pageTitle}>{title}</h1>
        {description ? <p className={styles.pageDescription}>{description}</p> : null}
      </div>
      {actions ? <div className={styles.pageActions}>{actions}</div> : null}
    </header>
  );
}
