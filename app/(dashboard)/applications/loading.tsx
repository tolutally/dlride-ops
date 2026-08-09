import { PageHeader, Skeleton } from "@/components/ui";
import { QueueLoading } from "@/components/applications/queue-loading";

import styles from "@/components/applications/applications-queue.module.css";

export default function ApplicationsLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          className={styles.header}
          title="Applications"
          description="Review incoming rental applications."
        />
        <div className={styles.controls}>
          <div className={`${styles.search} ${styles.desktopSearch}`}><Skeleton height="2.375rem" /></div>
          <div className={styles.desktopFilterRow}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} width="10.25rem" height="2.375rem" />
            ))}
          </div>
        </div>
        <section className={styles.resultsSection} aria-label="Loading applications">
          <div className={styles.resultsHeader}><h2>Application Table</h2></div>
          <QueueLoading />
        </section>
      </div>
    </main>
  );
}
