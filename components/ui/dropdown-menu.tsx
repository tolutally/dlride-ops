"use client";

import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export function DropdownMenu({ trigger, children, align = "end" }: {
  trigger: ReactNode;
  children: ReactNode;
  align?: MenuPrimitive.DropdownMenuContentProps["align"];
}) {
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger asChild>{trigger}</MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content align={align} sideOffset={6} className={styles.menuContent}>
          {children}
        </MenuPrimitive.Content>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  );
}

export function DropdownMenuItem({ icon: Icon, danger, shortcut, className, children, ...props }:
  MenuPrimitive.DropdownMenuItemProps & {
    icon?: LucideIcon;
    danger?: boolean;
    shortcut?: string;
  }) {
  return (
    <MenuPrimitive.Item
      className={cn(styles.menuItem, danger && styles.menuItemDanger, className)}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
      {shortcut ? <span className={styles.menuShortcut}>{shortcut}</span> : null}
    </MenuPrimitive.Item>
  );
}

export function DropdownMenuLabel(props: MenuPrimitive.DropdownMenuLabelProps) {
  return <MenuPrimitive.Label className={styles.menuLabel} {...props} />;
}

export function DropdownMenuSeparator(props: MenuPrimitive.DropdownMenuSeparatorProps) {
  return <MenuPrimitive.Separator className={styles.menuSeparator} {...props} />;
}
