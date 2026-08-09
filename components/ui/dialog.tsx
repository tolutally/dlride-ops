"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { IconButton } from "./icon-button";
import styles from "./ui.module.css";
import { cn } from "./utils";

export type DialogProps = {
  trigger?: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: "md" | "wide";
  bodyClassName?: string;
};

export function Dialog({
  trigger,
  title,
  description,
  children,
  footer,
  open,
  onOpenChange,
  size = "md",
  bodyClassName,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={styles.dialogOverlay} />
        <DialogPrimitive.Content
          className={cn(styles.dialogContent, size === "wide" && styles.dialogContentWide)}
        >
          <div className={styles.dialogHeader}>
            <DialogPrimitive.Title className={styles.dialogTitle}>{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className={styles.dialogDescription}>
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <div className={cn(styles.dialogBody, bodyClassName)}>{children}</div>
          {footer ? <div className={styles.dialogFooter}>{footer}</div> : null}
          <DialogPrimitive.Close asChild>
            <IconButton className={styles.dialogClose} variant="ghost" size="sm" label="Close dialog">
              <X aria-hidden="true" />
            </IconButton>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogClose = DialogPrimitive.Close;
