import {
  CalendarRange,
  ChevronLeft,
  Clock3,
  FileCheck2,
  FileText,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/ui";
import {
  ACTIVITY_LABELS,
  formatActivityDateTime,
  formatDetailDateTime,
  PAYMENT_METHOD_LABELS,
} from "@/lib/applications/detail-format";
import type {
  ApplicationActivityItem,
  ApplicationConversation,
  ApplicationDetail as ApplicationDetailRecord,
} from "@/lib/applications/detail-types";
import {
  formatRentalDate,
  formatRentalTime,
  formatRentalWeeks,
  vehicleUseLabel,
} from "@/lib/applications/format";

import styles from "./application-detail.module.css";
import { ApplicationDocumentViewer } from "./application-document-viewer";
import { ApplicationConversationDrawer } from "./application-conversation";
import { ApplicationReviewActions } from "./application-review-actions";
import { InternalNotesEditor } from "./internal-notes-editor";

type DetailFieldProps = {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
};

function DetailField({ label, children, wide }: DetailFieldProps) {
  return (
    <div className={wide ? styles.fieldWide : undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function SectionHeading({ icon: Icon, title }: {
  icon: typeof UserRound;
  title: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <Icon aria-hidden="true" />
      <h2>{title}</h2>
    </div>
  );
}

function ActivityTimeline({ activity, createdAt }: {
  activity: ApplicationActivityItem[];
  createdAt: string;
}) {
  const events = activity.length > 0
    ? activity
    : [{ id: "application-created", action: "application_created" as const, note: null, created_at: createdAt }];

  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id}>
          <span className={styles.timelineMarker} aria-hidden="true" />
          <div>
            <h3>{ACTIVITY_LABELS[event.action]}</h3>
            <time dateTime={event.created_at}>{formatActivityDateTime(event.created_at)}</time>
            {event.note && event.note.toLowerCase() !== "application created" ? (
              <p>{event.note}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ApplicationDetail({ application, activity, conversation }: {
  application: ApplicationDetailRecord;
  activity: ApplicationActivityItem[];
  conversation: ApplicationConversation;
}) {
  const fullName = `${application.first_name} ${application.last_name}`;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/applications">
            <ChevronLeft aria-hidden="true" />
            Applications
          </Link>
          <div className={styles.titleRow}>
            <h1>{application.application_number}</h1>
            <StatusBadge status={application.status} />
          </div>
          <p className={styles.applicantName}>{fullName}</p>
          <p className={styles.receivedAt}>
            Received <time dateTime={application.created_at}>{formatDetailDateTime(application.created_at)}</time>
          </p>
        </header>

        <div className={styles.detailLayout}>
          <div className={styles.mainColumn}>
            <section className={styles.surface} aria-labelledby="applicant-heading">
              <div id="applicant-heading"><SectionHeading icon={UserRound} title="Applicant" /></div>
              <dl className={styles.infoGrid}>
                <DetailField label="Full Name">{fullName}</DetailField>
                <DetailField label="Email">
                  <a className={styles.contactLink} href={`mailto:${application.email}`}>
                    <Mail aria-hidden="true" />{application.email}
                  </a>
                </DetailField>
                <DetailField label="Phone">
                  <a className={styles.contactLink} href={`tel:${application.phone}`}>
                    <Phone aria-hidden="true" />{application.phone}
                  </a>
                </DetailField>
                <DetailField label="Street Address" wide>{application.street_address}</DetailField>
                <DetailField label="City">{application.city}</DetailField>
                <DetailField label="State">{application.state}</DetailField>
                <DetailField label="ZIP Code">{application.postal_code}</DetailField>
              </dl>
            </section>

            <section className={styles.surface} aria-labelledby="rental-heading">
              <div id="rental-heading"><SectionHeading icon={CalendarRange} title="Rental Request" /></div>
              <div className={styles.rentalSummary}>
                <div className={styles.dateRange}>
                  <span>{formatRentalDate(application.rental_start_date)}</span>
                  <span className={styles.dateArrow} aria-hidden="true">→</span>
                  <span>{formatRentalDate(application.rental_end_date)}</span>
                </div>
                <div className={styles.weekCount}>{formatRentalWeeks(application.rental_weeks)}</div>
              </div>
              <dl className={styles.rentalMeta}>
                <DetailField label="Pickup Time">
                  {formatRentalTime(application.pickup_time)}
                </DetailField>
                <DetailField label="Drop-off Time">
                  {formatRentalTime(application.dropoff_time)}
                </DetailField>
                <DetailField label="Intended Vehicle Use">
                  {vehicleUseLabel(application.intended_vehicle_use)}
                </DetailField>
                <DetailField label="Preferred Payment Method">
                  {PAYMENT_METHOD_LABELS[application.payment_method] ?? application.payment_method}
                </DetailField>
              </dl>
            </section>

            {application.status === "approved" ? (
              <section className={styles.surface} aria-labelledby="pickup-heading">
                <div id="pickup-heading"><SectionHeading icon={MapPin} title="Pickup Details" /></div>
                <dl className={styles.infoGrid}>
                  <DetailField label="Assigned Car">
                    {application.assigned_car ?? "Not provided"}
                  </DetailField>
                  <DetailField label="Pickup Date">
                    {application.pickup_date
                      ? formatRentalDate(application.pickup_date)
                      : "Not provided"}
                  </DetailField>
                  <DetailField label="Pickup Time">
                    {formatRentalTime(application.pickup_time)}
                  </DetailField>
                  <DetailField label="Pickup Location" wide>
                    {application.pickup_location ?? "Not provided"}
                  </DetailField>
                  {application.pickup_instructions ? (
                    <DetailField label="Pickup Instructions" wide>
                      <p className={styles.longText}>{application.pickup_instructions}</p>
                    </DetailField>
                  ) : null}
                </dl>
              </section>
            ) : null}

            <section className={styles.surface} aria-labelledby="documents-heading">
              <div id="documents-heading"><SectionHeading icon={FileCheck2} title="Documents" /></div>
              <div className={styles.documentsGrid}>
                <ApplicationDocumentViewer
                  applicationId={application.id}
                  documentType="drivers-license"
                  label="Driver's Licence"
                  path={application.drivers_license_path}
                />
                <ApplicationDocumentViewer
                  applicationId={application.id}
                  documentType="proof-of-address"
                  label="Proof of Address"
                  path={application.proof_of_address_path}
                />
              </div>
            </section>

            {application.additional_information?.trim() ? (
              <section className={styles.surface} aria-labelledby="additional-heading">
                <div id="additional-heading"><SectionHeading icon={FileText} title="Additional Information" /></div>
                <p className={styles.longText}>{application.additional_information}</p>
              </section>
            ) : null}

            <section className={styles.surface} aria-labelledby="activity-heading">
              <div id="activity-heading"><SectionHeading icon={Clock3} title="Activity" /></div>
              <ActivityTimeline activity={activity} createdAt={application.created_at} />
            </section>
          </div>

          <aside className={styles.reviewColumn} aria-label="Application review">
            <section className={`${styles.surface} ${styles.reviewPanel}`}>
              <SectionHeading icon={FileCheck2} title="Review" />
              <div className={styles.reviewBlock}>
                <span className={styles.reviewLabel}>Current Status</span>
                <StatusBadge status={application.status} />
              </div>
              <ApplicationReviewActions
                applicationId={application.id}
                defaultPickupDate={application.rental_start_date}
                defaultPickupTime={application.pickup_time ?? ""}
                status={application.status}
              />
              <InternalNotesEditor
                key={application.updated_at}
                applicationId={application.id}
                initialNotes={application.internal_notes}
              />
              {application.decision_reason ? (
                <div className={styles.reviewBlock}>
                  <span className={styles.reviewLabel}>Decision Reason</span>
                  <p className={styles.reviewText}>{application.decision_reason}</p>
                </div>
              ) : null}
              {application.reviewed_at ? (
                <div className={styles.reviewBlock}>
                  <span className={styles.reviewLabel}>Reviewed At</span>
                  <time dateTime={application.reviewed_at}>{formatDetailDateTime(application.reviewed_at)}</time>
                </div>
              ) : null}
              <div className={styles.reviewMeta}>
                <Clock3 aria-hidden="true" />
                <span>Last updated {formatDetailDateTime(application.updated_at)}</span>
              </div>
            </section>

          </aside>
        </div>

        <ApplicationConversationDrawer
          applicationId={application.id}
          customerEmail={application.email}
          customerFirstName={application.first_name}
          customerName={fullName}
          initial={conversation}
        />
      </div>
    </main>
  );
}
