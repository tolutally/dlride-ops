import type { HTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn(styles.divider, className)} {...props} />;
}
