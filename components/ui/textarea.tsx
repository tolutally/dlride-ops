import { forwardRef, type TextareaHTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(styles.textarea, className)} {...props} />;
  },
);
