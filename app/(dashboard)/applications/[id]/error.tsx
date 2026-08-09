"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button, ButtonLink, EmptyState } from "@/components/ui";

import styles from "@/components/applications/application-detail.module.css";

export default function ApplicationDetailError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Application detail failed to render", error.digest);
  }, [error.digest]);

  return (
    <main className={styles.statePage}>
      <div className={styles.stateSurface}>
        <EmptyState
          icon={AlertTriangle}
          title="Application could not be loaded"
          description="Something interrupted the request. Please try again."
          action={(
            <div className={styles.stateActions}>
              <Button variant="primary" onClick={() => retry()}>Retry</Button>
              <ButtonLink href="/applications" variant="secondary">Return to Applications</ButtonLink>
            </div>
          )}
        />
      </div>
    </main>
  );
}
