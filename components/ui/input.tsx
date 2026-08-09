import { forwardRef, type InputHTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(styles.input, className)} {...props} />;
  },
);
