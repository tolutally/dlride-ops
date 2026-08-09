import { forwardRef, type SelectHTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(styles.select, className)} {...props} />;
  },
);
