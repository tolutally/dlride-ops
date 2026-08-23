import { Users } from "lucide-react";

import {
  EmptyState,
  LeadStatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableMetadata,
  TableRow,
  TableShell,
} from "@/components/ui";
import { formatLeadReceivedAt, leadFullName, leadSourceLabel } from "@/lib/leads/format";
import type { Lead } from "@/lib/leads/types";

import styles from "./prospects.module.css";

export function ProspectsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className={styles.stateCard}>
        <EmptyState
          icon={Users}
          title="No prospects yet"
          description="Leads captured from the chat widget and other integrations will appear here."
        />
      </div>
    );
  }

  return (
    <TableShell className={styles.tableShell} stickyHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prospect</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell data-label="Prospect">
                <div className={styles.contact}>{leadFullName(lead)}</div>
                <TableMetadata className={styles.email}>{lead.email}</TableMetadata>
              </TableCell>
              <TableCell className={styles.phone} data-label="Phone">
                {lead.phone || <TableMetadata>Not provided</TableMetadata>}
              </TableCell>
              <TableCell className={styles.message} data-label="Message">
                {lead.message || <TableMetadata>No message</TableMetadata>}
              </TableCell>
              <TableCell data-label="Source">{leadSourceLabel(lead.source)}</TableCell>
              <TableCell data-label="Status">
                <LeadStatusBadge status={lead.status} />
              </TableCell>
              <TableCell className={styles.received} data-label="Received">
                {formatLeadReceivedAt(lead.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableShell>
  );
}
