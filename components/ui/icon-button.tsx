import { forwardRef, type ButtonHTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, className, variant = "secondary", size = "md", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          styles.iconButton,
          variant === "ghost" && styles.iconButtonGhost,
          size === "sm" && styles.iconButtonSm,
          size === "lg" && styles.iconButtonLg,
          className,
        )}
        {...props}
      />
    );
  },
);
