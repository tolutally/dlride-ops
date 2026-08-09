import { redirect, unstable_rethrow } from "next/navigation";

import { fetchApplications } from "@/lib/applications/query";
import { queueUrl } from "@/lib/applications/query-params";
import type { ApplicationQueueFilters } from "@/lib/applications/types";

import styles from "./applications-queue.module.css";
import { QueueError } from "./queue-error";
import { QueueTable } from "./queue-table";

export async function QueueResults({ filters }: { filters: ApplicationQueueFilters }) {
  const result = await loadApplications(filters);
  if (!result) {
    return (
      <>
        <div className={styles.resultsHeader}><h2>Application Table</h2></div>
        <QueueError />
      </>
    );
  }

  if (result.total > 0 && result.page > result.totalPages) {
    redirect(queueUrl(filters, { page: result.totalPages }));
  }

  const firstResult = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastResult = Math.min(result.page * result.pageSize, result.total);

  return (
    <>
      <div className={styles.resultsHeader}>
        <div>
          <h2>Application Table</h2>
          <p className={styles.resultCount}>
            {result.total === 0
              ? "No applications"
              : `Showing ${firstResult}–${lastResult} of ${result.total}`}
          </p>
        </div>
      </div>
      <QueueTable result={result} filters={filters} />
    </>
  );
}

async function loadApplications(filters: ApplicationQueueFilters) {
  try {
    return await fetchApplications(filters);
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
