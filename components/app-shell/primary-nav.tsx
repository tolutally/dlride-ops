"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./app-shell.module.css";

const NAV_ITEMS = [
  { href: "/applications", label: "Applications" },
  { href: "/prospects", label: "Prospects" },
] as const;

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.primaryNav} aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
