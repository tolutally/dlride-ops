import { PageHeader, Skeleton } from "@/components/ui";

import styles from "@/components/prospects/prospects.module.css";

export default function ProspectsLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          className={styles.header}
          title="Prospects"
          description="Contact details captured by the chat widget and other lead-source integrations."
        />
        <section className={styles.resultsSection} aria-label="Loading prospects">
          <div className={styles.stateCard}>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} style={{ padding: "var(--space-4) var(--space-5)" }}>
                <Skeleton height="1.25rem" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
