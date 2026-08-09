"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { Button, Dialog } from "@/components/ui";
import { documentFileName } from "@/lib/applications/detail-format";

import styles from "./application-detail.module.css";

export function ApplicationDocumentViewer({
  applicationId,
  documentType,
  label,
  path,
}: {
  applicationId: string;
  documentType: "drivers-license" | "proof-of-address";
  label: string;
  path: string | null;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <article className={styles.documentCard}>
      <div className={styles.documentIcon}><FileText aria-hidden="true" /></div>
      <div className={styles.documentCopy}>
        <h3>{label}</h3>
        <p>{path ? documentFileName(path) : "Document unavailable"}</p>
      </div>
      {path ? (
        <Dialog
          size="wide"
          bodyClassName={styles.documentDialogBody}
          title={label}
          description={documentFileName(path)}
          trigger={(
            <Button
              className={styles.documentAction}
              variant="secondary"
              size="sm"
              onClick={() => setLoaded(false)}
            >
              View Document
            </Button>
          )}
        >
          <div className={styles.documentViewer}>
            {!loaded ? <p className={styles.documentLoading}>Loading document preview…</p> : null}
            <iframe
              className={`${styles.documentFrame} ${loaded ? styles.documentFrameLoaded : ""}`}
              src={`/applications/${applicationId}/documents/${documentType}`}
              title={`${label} preview`}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
            />
          </div>
        </Dialog>
      ) : (
        <span className={styles.documentUnavailable}>Unavailable</span>
      )}
    </article>
  );
}
