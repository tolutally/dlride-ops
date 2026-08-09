import { useId, type ReactNode } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type FormFieldProps = {
  label: string;
  children: (fieldProps: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: true;
  }) => ReactNode;
  id?: string;
  hint?: string;
  error?: string;
  className?: string;
};

export function FormField({ label, children, id: suppliedId, hint, error, className }: FormFieldProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const descriptionId = hint || error ? `${id}-description` : undefined;

  return (
    <div className={cn(styles.field, error && styles.fieldInvalid, className)}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      {children({
        id,
        "aria-describedby": descriptionId,
        "aria-invalid": error ? true : undefined,
      })}
      {error ? (
        <p id={descriptionId} className={styles.error}>{error}</p>
      ) : hint ? (
        <p id={descriptionId} className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}
