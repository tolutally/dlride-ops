import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
} from "@/components/ui";

import styles from "./applications-queue.module.css";

export function QueueLoading() {
  return (
    <TableShell className={styles.queueShell} aria-label="Loading applications">
      <Table className={styles.queueTable}>
        <TableHeader>
          <TableRow>
            {[
              "Application ID",
              "Applicant",
              "Phone",
              "Rental Dates",
              "Rental Weeks",
              "Vehicle Use",
              "Status",
              "Submitted",
            ].map((heading) => <TableHead key={heading}>{heading}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 7 }, (_, index) => (
            <TableRow key={index}>
              <TableCell data-label="Application ID"><Skeleton width="6.5rem" height="0.75rem" /></TableCell>
              <TableCell data-label="Applicant">
                <div className={styles.skeletonLine}>
                  <Skeleton width="8rem" height="0.75rem" />
                  <Skeleton width="10rem" height="0.55rem" />
                </div>
              </TableCell>
              <TableCell data-label="Phone"><Skeleton width="7rem" height="0.7rem" /></TableCell>
              <TableCell data-label="Rental Dates"><Skeleton width="10rem" height="0.7rem" /></TableCell>
              <TableCell data-label="Rental Weeks"><Skeleton width="4rem" height="0.7rem" /></TableCell>
              <TableCell data-label="Vehicle Use"><Skeleton width="5.5rem" height="0.7rem" /></TableCell>
              <TableCell data-label="Status"><Skeleton width="5.5rem" height="1.4rem" /></TableCell>
              <TableCell data-label="Submitted"><Skeleton width="6rem" height="0.7rem" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
