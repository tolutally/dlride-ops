"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button, Textarea } from "@/components/ui";
import { updateApplicationInternalNotes } from "@/lib/applications/internal-notes-actions";

import styles from "./application-detail.module.css";

export function InternalNotesEditor({ applicationId, initialNotes }: {
  applicationId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const fieldId = useId();
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function cancelEditing() {
    if (isPending) return;
    setNotes(savedNotes);
    setError(null);
    setEditing(false);
  }

  function saveNotes() {
    setError(null);
    startTransition(async () => {
      const result = await updateApplicationInternalNotes(applicationId, notes);
      if (!result.success) {
        setError(result.message);
        return;
      }

      setSavedNotes(result.notes);
      setNotes(result.notes);
      setEditing(false);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className={styles.reviewBlock}>
      <div className={styles.notesHeading}>
        <label className={styles.reviewLabel} htmlFor={fieldId}>Internal Notes</label>
        {!editing ? (
          <Button
            className={styles.editNotesButton}
            variant="ghost"
            size="sm"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" />
            Edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className={styles.notesEditor}>
          <Textarea
            id={fieldId}
            autoFocus
            maxLength={10000}
            rows={5}
            value={notes}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            onChange={(event) => setNotes(event.target.value)}
          />
          {error ? <p id={`${fieldId}-error`} className={styles.notesError} role="alert">{error}</p> : null}
          <div className={styles.notesActions}>
            <Button disabled={isPending} variant="ghost" size="sm" onClick={cancelEditing}>Cancel</Button>
            <Button
              disabled={isPending || notes.trim() === savedNotes}
              size="sm"
              onClick={saveNotes}
            >
              {isPending ? "Saving…" : "Save Notes"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className={savedNotes ? styles.reviewText : styles.emptyReviewText}>
            {savedNotes || "No internal notes yet."}
          </p>
          {saved ? <span className={styles.notesSaved} role="status">Saved</span> : null}
        </>
      )}
    </div>
  );
}
