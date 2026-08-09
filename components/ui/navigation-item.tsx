import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

import styles from "./ui.module.css";
import { cn } from "./utils";

export type NavigationItemProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: string | number;
};

export function SidebarNavigationItem({ href, icon: Icon, label, active, badge, className, ...props }: NavigationItemProps) {
  return (
    <Link
      href={href}
      className={cn(styles.navItem, active && styles.navItemActive, className)}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      <Icon className={styles.navIcon} aria-hidden="true" />
      <span>{label}</span>
      {badge !== undefined ? <span className={styles.navBadge}>{badge}</span> : null}
    </Link>
  );
}

export function MobileNavigationItem({ href, icon: Icon, label, active, className, ...props }: NavigationItemProps) {
  return (
    <Link
      href={href}
      className={cn(styles.mobileNavItem, active && styles.mobileNavItemActive, className)}
      aria-current={active ? "page" : undefined}
      {...props}
    >
      <Icon className={styles.navIcon} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
