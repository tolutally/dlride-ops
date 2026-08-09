import { Skeleton } from "@/components/ui";

import styles from "@/components/applications/application-detail.module.css";

function LoadingSurface({ rows = 6 }: { rows?: number }) {
  return (
    <section className={`${styles.surface} ${styles.loadingSurface}`}>
      <Skeleton width="9rem" height="1.125rem" />
      <div className={styles.loadingGrid}>
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className={styles.loadingSurface}>
            <Skeleton width="4.5rem" height="0.625rem" />
            <Skeleton height="0.875rem" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ApplicationDetailLoading() {
  return (
    <main className={styles.page} aria-label="Loading application">
      <div className={styles.container}>
        <header className={styles.loadingHeader}>
          <Skeleton width="7rem" height="0.875rem" />
          <Skeleton width="13rem" height="1.875rem" />
          <Skeleton width="10rem" height="1rem" />
          <Skeleton width="15rem" height="0.75rem" />
        </header>
        <div className={styles.detailLayout}>
          <div className={styles.mainColumn}>
            <LoadingSurface />
            <LoadingSurface rows={4} />
            <LoadingSurface rows={2} />
          </div>
          <aside className={styles.reviewColumn}>
            <LoadingSurface rows={4} />
          </aside>
        </div>
      </div>
    </main>
  );
}
