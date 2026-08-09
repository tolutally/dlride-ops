"use client";

import { Inbox, SearchX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  EmptyState,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableMetadata,
  TableRow,
  TableShell,
} from "@/components/ui";
import {
  formatRentalRange,
  formatRentalTime,
  formatRentalWeeks,
  formatSubmittedDate,
  vehicleUseLabel,
} from "@/lib/applications/format";
import type { ApplicationQueueFilters, ApplicationQueueResult } from "@/lib/applications/types";
import { UNREAD_REPLIES_READ_EVENT } from "@/lib/notifications/types";

import styles from "./applications-queue.module.css";
import { QueueKeyboardShortcuts } from "./queue-keyboard-shortcuts";
import { QueuePagination } from "./queue-pagination";

export function QueueTable({ result, filters }: {
  result: ApplicationQueueResult;
  filters: ApplicationQueueFilters;
}) {
  const [locallyReadApplications, setLocallyReadApplications] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    function onRepliesRead(event: Event) {
      const applicationId = (event as CustomEvent<{ applicationId?: string }>).detail?.applicationId;
      if (!applicationId) return;
      setLocallyReadApplications((current) => new Set(current).add(applicationId));
    }

    window.addEventListener(UNREAD_REPLIES_READ_EVENT, onRepliesRead);
    return () => window.removeEventListener(UNREAD_REPLIES_READ_EVENT, onRepliesRead);
  }, []);

  const hasActiveFilters = Boolean(
    filters.query || filters.status !== "all" || filters.vehicleUse !== "all",
  );

  if (result.applications.length === 0) {
    return (
      <div className={styles.stateCard}>
        <EmptyState
          icon={hasActiveFilters ? SearchX : Inbox}
          title={hasActiveFilters ? "No matching applications" : "No applications yet"}
          description={
            hasActiveFilters
              ? "Try adjusting your search or clearing one of the active filters."
              : "Applications submitted through the website will appear here."
          }
        />
      </div>
    );
  }

  return (
    <>
      <QueueKeyboardShortcuts />
      <TableShell className={styles.queueShell} stickyHeader>
        <Table className={styles.queueTable}>
          <TableHeader>
            <TableRow>
              <TableHead>Application ID</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Rental Dates</TableHead>
              <TableHead>Pickup / Drop-off</TableHead>
              <TableHead>Rental Weeks</TableHead>
              <TableHead>Vehicle Use</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.applications.map((application) => (
              <TableRow className={styles.queueRow} clickable key={application.id}>
                <TableCell data-label="Application ID">
                  <Link
                    className={styles.applicationLink}
                    data-queue-row-link
                    href={`/applications/${application.id}`}
                  >
                    {application.application_number}
                  </Link>
                  <TableMetadata className={styles.applicationUuid}>{application.id.slice(0, 8)}</TableMetadata>
                </TableCell>
                <TableCell data-label="Applicant">
                  <div className={styles.applicant}>{application.first_name} {application.last_name}</div>
                  <TableMetadata className={styles.applicantEmail}>{application.email}</TableMetadata>
                </TableCell>
                <TableCell className={styles.phone} data-label="Phone">{application.phone}</TableCell>
                <TableCell className={styles.dates} data-label="Rental Dates">
                  {formatRentalRange(application.rental_start_date, application.rental_end_date)}
                </TableCell>
                <TableCell className={styles.times} data-label="Pickup / Drop-off">
                  <div>Pickup {formatRentalTime(application.pickup_time)}</div>
                  <TableMetadata>Drop-off {formatRentalTime(application.dropoff_time)}</TableMetadata>
                </TableCell>
                <TableCell className={styles.weeks} data-label="Rental Weeks">
                  {formatRentalWeeks(application.rental_weeks)}
                </TableCell>
                <TableCell data-label="Vehicle Use">
                  {vehicleUseLabel(application.intended_vehicle_use)}
                </TableCell>
                <TableCell data-label="Status">
                  <div className={styles.statusStack}>
                    <StatusBadge status={application.status} />
                    {application.unread_reply_count > 0 && !locallyReadApplications.has(application.id) ? (
                      <span className={styles.newReplyIndicator}>
                        <span className={styles.newReplyDot} aria-hidden="true" />
                        New reply
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className={styles.submitted} data-label="Submitted">
                  {formatSubmittedDate(application.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
      <QueuePagination
        filters={filters}
        currentPage={result.page}
        totalPages={result.totalPages}
      />
    </>
  );
}
