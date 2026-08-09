import { FileQuestion } from "lucide-react";

import { ButtonLink, EmptyState } from "@/components/ui";

import styles from "@/components/applications/application-detail.module.css";

export default function ApplicationNotFound() {
  return (
    <main className={styles.statePage}>
      <div className={styles.stateSurface}>
        <EmptyState
          icon={FileQuestion}
          title="Application not found"
          description="This application may have been removed, or the link may be incorrect."
          action={(
            <ButtonLink className={styles.stateAction} href="/applications">
              Return to Applications
            </ButtonLink>
          )}
        />
      </div>
    </main>
  );
}
