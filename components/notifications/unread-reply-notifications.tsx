"use client";

import { Bell, MailCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { relativeReplyTime } from "@/lib/notifications/format";
import {
  UNREAD_REPLIES_READ_EVENT,
  type UnreadReplySnapshot,
} from "@/lib/notifications/types";

import styles from "./unread-reply-notifications.module.css";

const POLL_INTERVAL_MS = 30_000;

type ApiResponse =
  | { success: true; data: UnreadReplySnapshot }
  | { success: false; error: { code: string; message: string } };

function visualCount(total: number) {
  return total > 99 ? "99+" : String(total);
}

export function UnreadReplyNotifications({ initialSnapshot }: {
  initialSnapshot: UnreadReplySnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(initialSnapshot.generatedAt);
  const [open, setOpen] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const refreshNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications/unread-replies", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as ApiResponse;
      if (!response.ok || !payload.success) throw new Error("Notification refresh failed");
      setSnapshot(payload.data);
      setNow(payload.data.generatedAt);
      setRefreshFailed(false);
    } catch {
      setRefreshFailed(true);
    }
  }, []);

  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshNotifications();
    }, POLL_INTERVAL_MS);
    const updateTimes = window.setInterval(() => setNow(new Date().toISOString()), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshNotifications();
    };
    const refreshAfterRead = () => void refreshNotifications();

    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener(UNREAD_REPLIES_READ_EVENT, refreshAfterRead);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(updateTimes);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener(UNREAD_REPLIES_READ_EVENT, refreshAfterRead);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (!open) return;

    const mobile = window.matchMedia("(max-width: 720px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";
    requestAnimationFrame(() => closeRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => bellRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ) ?? [])];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!mobile && !rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  function closePanel() {
    setOpen(false);
    requestAnimationFrame(() => bellRef.current?.focus());
  }

  function togglePanel() {
    if (!open) void refreshNotifications();
    setOpen((current) => !current);
  }

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={bellRef}
        className={styles.bell}
        type="button"
        aria-label={snapshot.total > 0
          ? `${snapshot.total} unread customer ${snapshot.total === 1 ? "reply" : "replies"}`
          : "Customer reply notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="unread-reply-panel"
        onClick={togglePanel}
      >
        <Bell aria-hidden="true" />
        {snapshot.total > 0 ? (
          <span className={styles.countBadge} aria-hidden="true">{visualCount(snapshot.total)}</span>
        ) : null}
      </button>

      {open ? (
        <>
          <button className={styles.mobileOverlay} type="button" aria-label="Close notifications" onClick={closePanel} />
          <section
            ref={panelRef}
            id="unread-reply-panel"
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="unread-reply-title"
          >
            <div className={styles.mobileHandle} aria-hidden="true" />
            <header className={styles.panelHeader}>
              <div>
                <h2 id="unread-reply-title">Customer replies</h2>
                <p>{snapshot.total > 0
                  ? `${snapshot.total} unread ${snapshot.total === 1 ? "message" : "messages"}`
                  : "No unread messages"}</p>
              </div>
              <button ref={closeRef} className={styles.closeButton} type="button" aria-label="Close notifications" onClick={closePanel}>
                <X aria-hidden="true" />
              </button>
            </header>

            {snapshot.items.length ? (
              <ol className={styles.list} aria-label="Unread customer replies">
                {snapshot.items.map((item) => (
                  <li key={item.id}>
                    <Link className={styles.item} href={`/applications/${item.applicationId}#conversation`} onClick={() => setOpen(false)}>
                      <span className={styles.unreadDot} aria-hidden="true" />
                      <span className={styles.itemBody}>
                        <span className={styles.itemHeading}>
                          <strong>{item.customerName}</strong>
                          <time dateTime={item.receivedAt}>{relativeReplyTime(item.receivedAt, now)}</time>
                        </span>
                        <span className={styles.applicationNumber}>{item.applicationNumber}</span>
                        <span className={styles.preview}>{item.preview}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}><MailCheck aria-hidden="true" /></span>
                <strong>You&apos;re all caught up.</strong>
                <p>No new customer replies.</p>
              </div>
            )}

            {refreshFailed ? (
              <p className={styles.refreshError} role="status">Couldn&apos;t refresh. We&apos;ll try again shortly.</p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
