import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";
import { ProspectsTable } from "@/components/prospects/prospects-table";
import { fetchLeads } from "@/lib/leads/query";

import styles from "@/components/prospects/prospects.module.css";

export const metadata: Metadata = {
  title: "Prospects",
  description: "Review prospect contact details captured by lead-source integrations.",
};

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const { leads } = await fetchLeads();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <PageHeader
          className={styles.header}
          title="Prospects"
          description="Contact details captured by the chat widget and other lead-source integrations."
        />

        <section className={styles.resultsSection} aria-label="Prospects">
          <ProspectsTable leads={leads} />
        </section>
      </div>
    </main>
  );
}
