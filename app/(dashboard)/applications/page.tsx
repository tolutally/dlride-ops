import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/ui";
import { QueueControls } from "@/components/applications/queue-controls";
import { QueueLoading } from "@/components/applications/queue-loading";
import { QueueResults } from "@/components/applications/queue-results";
import { parseQueueFilters, type QueueSearchParams } from "@/lib/applications/query-params";

import styles from "@/components/applications/applications-queue.module.css";

export const metadata: Metadata = {
  title: "Applications",
  description: "Review incoming DLride rental applications.",
};

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<QueueSearchParams>;
}) {
  const filters = parseQueueFilters(await searchParams);
  const resultsKey = [
    filters.query,
    filters.status,
    filters.vehicleUse,
    filters.sortBy,
    filters.direction,
    filters.page,
  ].join(":");

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          className={styles.header}
          title="Applications"
          description="Review incoming rental applications."
        />

        <QueueControls key={resultsKey} filters={filters} />

        <section className={styles.resultsSection} aria-label="Applications queue">
          <Suspense key={resultsKey} fallback={<QueueLoading />}>
            <QueueResults filters={filters} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
