import { LogOut } from "lucide-react";
import Link from "next/link";

import { UnreadReplyNotifications } from "@/components/notifications/unread-reply-notifications";
import { Avatar, BrandLogo, Button } from "@/components/ui";
import { signOut } from "@/lib/auth/actions";
import type { UnreadReplySnapshot } from "@/lib/notifications/types";

import styles from "./app-shell.module.css";
import { PrimaryNav } from "./primary-nav";

export function AppShell({ children, staffEmail, initialNotifications }: {
  children: React.ReactNode;
  staffEmail: string;
  initialNotifications: UnreadReplySnapshot;
}) {
  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <Link className={styles.brand} href="/applications" aria-label="DLride Ops applications">
          <BrandLogo className={styles.brandLogo} priority />
        </Link>

        <PrimaryNav />

        <div className={styles.account}>
          <UnreadReplyNotifications initialSnapshot={initialNotifications} />
          <Avatar className={styles.avatar} name={staffEmail} size="sm" />
          <div className={styles.accountCopy}>
            <span className={styles.email}>{staffEmail}</span>
            <span className={styles.role}>Operations</span>
          </div>
          <form action={signOut}>
            <Button className={styles.signOut} type="submit" variant="ghost" size="sm">
              <LogOut aria-hidden="true" />
              <span>Sign Out</span>
            </Button>
          </form>
        </div>
      </header>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
