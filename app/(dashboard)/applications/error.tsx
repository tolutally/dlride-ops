"use client";

import { PageHeader } from "@/components/ui";
import { QueueError } from "@/components/applications/queue-error";

import styles from "@/components/applications/applications-queue.module.css";

export default function ApplicationsError() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          className={styles.header}
          title="Applications"
          description="Review incoming rental applications."
        />
        <QueueError />
      </div>
    </main>
  );
}
