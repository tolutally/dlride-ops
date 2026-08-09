"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui";

import styles from "./applications-queue.module.css";

export function QueueError() {
  const router = useRouter();

  return (
    <div className={`${styles.stateCard} ${styles.errorState}`} role="alert">
      <div className={styles.errorIcon}><AlertTriangle aria-hidden="true" /></div>
      <div className={styles.errorCopy}>
        <h2 className={styles.errorTitle}>Applications could not be loaded</h2>
        <p className={styles.errorDescription}>Something interrupted the request. Please try again.</p>
        <Button className={styles.errorAction} variant="secondary" size="sm" onClick={() => router.refresh()}>
          Retry
        </Button>
      </div>
    </div>
  );
}
