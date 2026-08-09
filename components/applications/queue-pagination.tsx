import { ArrowLeft, ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/ui";
import { queueUrl } from "@/lib/applications/query-params";
import type { ApplicationQueueFilters } from "@/lib/applications/types";

import styles from "./applications-queue.module.css";

export function QueuePagination({
  filters,
  currentPage,
  totalPages,
}: {
  filters: ApplicationQueueFilters;
  currentPage: number;
  totalPages: number;
}) {
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav className={styles.pagination} aria-label="Application pages">
      <ButtonLink
        href={hasPrevious ? queueUrl(filters, { page: currentPage - 1 }) : "#"}
        size="sm"
        className={!hasPrevious ? styles.disabledLink : undefined}
        aria-disabled={!hasPrevious}
        tabIndex={hasPrevious ? undefined : -1}
      >
        <ArrowLeft aria-hidden="true" />Previous
      </ButtonLink>
      <span className={styles.pageCount} aria-live="polite">
        Page {currentPage} of {totalPages}
      </span>
      <ButtonLink
        href={hasNext ? queueUrl(filters, { page: currentPage + 1 }) : "#"}
        size="sm"
        className={`${styles.paginationNext} ${!hasNext ? styles.disabledLink : ""}`}
        aria-disabled={!hasNext}
        tabIndex={hasNext ? undefined : -1}
      >
        Next<ArrowRight aria-hidden="true" />
      </ButtonLink>
    </nav>
  );
}
