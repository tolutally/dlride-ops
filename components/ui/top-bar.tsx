import type { HTMLAttributes, ReactNode } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type TopBarProps = HTMLAttributes<HTMLElement> & {
  context?: ReactNode;
  search?: ReactNode;
  actions?: ReactNode;
};

export function TopBar({ context, search, actions, className, ...props }: TopBarProps) {
  return (
    <header className={cn(styles.topBar, className)} {...props}>
      {context ? <div className={styles.topBarContext}>{context}</div> : null}
      {search ? <div className={styles.topBarSearch}>{search}</div> : null}
      {actions ? <div className={styles.topBarActions}>{actions}</div> : null}
    </header>
  );
}
