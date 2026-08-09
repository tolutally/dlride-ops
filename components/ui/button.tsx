import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import Link, { type LinkProps } from "next/link";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "success"
  | "warning";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  ghost: styles.buttonGhost,
  destructive: styles.buttonDestructive,
  success: styles.buttonSuccess,
  warning: styles.buttonWarning,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: styles.buttonSm,
  md: styles.buttonMd,
  lg: styles.buttonLg,
};

function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean | undefined,
  className: string | undefined,
) {
  return cn(
    styles.button,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && styles.buttonFull,
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", fullWidth, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses(variant, size, fullWidth, className)}
        {...props}
      />
    );
  },
);

export type ButtonLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps | "href"> & {
  children: ReactNode;
  className?: string;
  variant?: Exclude<ButtonVariant, "destructive">;
  size?: ButtonSize;
  fullWidth?: boolean;
  "aria-disabled"?: boolean;
};

export function ButtonLink({
  className,
  variant = "secondary",
  size = "md",
  fullWidth,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClasses(variant, size, fullWidth, className)}
      {...props}
    />
  );
}
