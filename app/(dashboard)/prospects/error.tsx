"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button, PageHeader } from "@/components/ui";

import styles from "@/components/prospects/prospects.module.css";

export default function ProspectsError() {
  const router = useRouter();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          className={styles.header}
          title="Prospects"
          description="Contact details captured by the chat widget and other lead-source integrations."
        />
        <div className={`${styles.stateCard} ${styles.errorState}`} role="alert">
          <div className={styles.errorIcon}><AlertTriangle aria-hidden="true" /></div>
          <div className={styles.errorCopy}>
            <h2 className={styles.errorTitle}>Prospects could not be loaded</h2>
            <p className={styles.errorDescription}>Something interrupted the request. Please try again.</p>
            <Button className={styles.errorAction} variant="secondary" size="sm" onClick={() => router.refresh()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
