"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { useId } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type CheckboxProps = CheckboxPrimitive.CheckboxProps & {
  label: string;
  description?: string;
};

export function Checkbox({ id: suppliedId, label, description, className, ...props }: CheckboxProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;

  return (
    <div className={styles.checkboxRow}>
      <CheckboxPrimitive.Root id={id} className={cn(styles.checkbox, className)} {...props}>
        <CheckboxPrimitive.Indicator className={styles.checkboxIndicator}>
          <Check aria-hidden="true" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className={styles.checkboxCopy}>
        <label className={styles.label} htmlFor={id}>{label}</label>
        {description ? <span className={styles.checkboxDescription}>{description}</span> : null}
      </div>
    </div>
  );
}
