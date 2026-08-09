"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  Button,
  Dialog,
  DialogClose,
  FormField,
  Input,
  Textarea,
} from "@/components/ui";
import {
  performApplicationWorkflowAction,
  type ApplicationWorkflowAction,
} from "@/lib/applications/workflow-actions";
import type { ApplicationStatus } from "@/lib/design-system/status";

import styles from "./application-detail.module.css";

type OpenAction = ApplicationWorkflowAction | null;
type ApprovalFieldErrors = Partial<Record<
  "assignedCar" | "pickupDate" | "pickupTime" | "pickupLocation",
  string
>>;

const DEFAULT_PICKUP_LOCATION = "1160 Crescent Ridge, Buford, Georgia";
const APPROVAL_ERROR_FIELDS: Record<string, keyof ApprovalFieldErrors> = {
  "Please enter the car being assigned.": "assignedCar",
  "Please select a pickup date.": "pickupDate",
  "Please select a valid pickup date.": "pickupDate",
  "Pickup date cannot be in the past.": "pickupDate",
  "Please select a pickup time.": "pickupTime",
  "Please select a valid pickup time.": "pickupTime",
  "Please enter the pickup location.": "pickupLocation",
};

const DIALOG_COPY: Record<ApplicationWorkflowAction, { title: string; description: string }> = {
  approve_application: {
    title: "Approve Application",
    description: "Confirm the vehicle and pickup details for the customer.",
  },
  request_more_information: {
    title: "Request More Information",
    description: "Write a clear request for the customer.",
  },
  resume_review: {
    title: "Resume review?",
    description: "This returns the application to Under Review.",
  },
  deny_application: {
    title: "Deny application?",
    description: "You may include a customer-facing reason before denying this application.",
  },
  cancel_application: {
    title: "Cancel application?",
    description: "This ends the application workflow. You may add a cancellation note.",
  },
};

function pendingLabel(action: ApplicationWorkflowAction) {
  switch (action) {
    case "approve_application": return "Approving...";
    case "request_more_information": return "Sending request...";
    case "resume_review": return "Resuming…";
    default: return "Saving…";
  }
}

function confirmLabel(action: ApplicationWorkflowAction) {
  switch (action) {
    case "approve_application": return "Approve Application";
    case "request_more_information": return "Send Request";
    case "resume_review": return "Resume Review";
    case "deny_application": return "Deny Application";
    case "cancel_application": return "Cancel Application";
  }
}

function confirmVariant(action: ApplicationWorkflowAction) {
  switch (action) {
    case "approve_application": return "success" as const;
    case "request_more_information": return "warning" as const;
    case "deny_application":
    case "cancel_application": return "destructive" as const;
    case "resume_review": return "primary" as const;
  }
}

export function ApplicationReviewActions({
  applicationId,
  status,
  defaultPickupDate,
  defaultPickupTime,
  defaultPickupLocation = DEFAULT_PICKUP_LOCATION,
}: {
  applicationId: string;
  status: ApplicationStatus;
  defaultPickupDate: string;
  defaultPickupTime: string;
  defaultPickupLocation?: string;
}) {
  const router = useRouter();
  const [openAction, setOpenAction] = useState<OpenAction>(null);
  const [assignedCar, setAssignedCar] = useState("");
  const [pickupDate, setPickupDate] = useState(defaultPickupDate);
  const [pickupTime, setPickupTime] = useState(defaultPickupTime.slice(0, 5));
  const [pickupLocation, setPickupLocation] = useState(defaultPickupLocation);
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [messageToCustomer, setMessageToCustomer] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [cancellationNote, setCancellationNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approvalFieldErrors, setApprovalFieldErrors] = useState<ApprovalFieldErrors>({});
  const [isPending, startTransition] = useTransition();

  if (status !== "under_review" && status !== "more_information_required") return null;

  function open(action: ApplicationWorkflowAction) {
    setError(null);
    setApprovalFieldErrors({});
    setOpenAction(action);
  }

  function resetDialog() {
    setOpenAction(null);
    setAssignedCar("");
    setPickupDate(defaultPickupDate);
    setPickupTime(defaultPickupTime.slice(0, 5));
    setPickupLocation(defaultPickupLocation);
    setPickupInstructions("");
    setMessageToCustomer("");
    setInternalNote("");
    setDecisionReason("");
    setCancellationNote("");
    setApprovalFieldErrors({});
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isPending) {
      resetDialog();
    }
  }

  function submit(action: ApplicationWorkflowAction) {
    const trimmedAssignedCar = assignedCar.trim();
    const trimmedPickupDate = pickupDate.trim();
    const trimmedPickupTime = pickupTime.trim();
    const trimmedPickupLocation = pickupLocation.trim();
    const trimmedPickupInstructions = pickupInstructions.trim();
    const trimmedMessage = messageToCustomer.trim();
    const trimmedReason = decisionReason.trim();
    if (action === "approve_application") {
      const fieldErrors: ApprovalFieldErrors = {};
      if (!trimmedAssignedCar) fieldErrors.assignedCar = "Please enter the car being assigned.";
      if (!trimmedPickupDate) {
        fieldErrors.pickupDate = "Please select a pickup date.";
      } else if (trimmedPickupDate < new Date().toISOString().slice(0, 10)) {
        fieldErrors.pickupDate = "Pickup date cannot be in the past.";
      }
      if (!trimmedPickupTime) fieldErrors.pickupTime = "Please select a pickup time.";
      if (!trimmedPickupLocation) fieldErrors.pickupLocation = "Please enter the pickup location.";
      if (Object.keys(fieldErrors).length > 0) {
        setApprovalFieldErrors(fieldErrors);
        setError(null);
        return;
      }
    }
    if (action === "request_more_information" && !trimmedMessage) {
      setError("Please enter what information you need from the customer.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await performApplicationWorkflowAction({
        applicationId,
        action,
        assignedCar: action === "approve_application" ? trimmedAssignedCar : undefined,
        pickupDate: action === "approve_application" ? trimmedPickupDate : undefined,
        pickupTime: action === "approve_application" ? trimmedPickupTime : undefined,
        pickupLocation: action === "approve_application" ? trimmedPickupLocation : undefined,
        pickupInstructions: action === "approve_application" ? trimmedPickupInstructions : undefined,
        messageToCustomer: action === "request_more_information" ? trimmedMessage : undefined,
        decisionReason: action === "deny_application" ? trimmedReason : undefined,
        cancellationNote: action === "cancel_application" ? cancellationNote.trim() : undefined,
        note: action === "approve_application" || action === "request_more_information"
          ? internalNote
          : undefined,
      });

      if (!result.success) {
        const approvalErrorField = action === "approve_application"
          ? APPROVAL_ERROR_FIELDS[result.message]
          : undefined;
        if (approvalErrorField) {
          setApprovalFieldErrors({ [approvalErrorField]: result.message });
          setError(null);
        } else {
          setError(result.message);
        }
        return;
      }

      resetDialog();
      router.refresh();
    });
  }

  const dialogCopy = openAction ? DIALOG_COPY[openAction] : null;

  return (
    <div className={styles.workflowSection}>
      <span className={styles.reviewLabel}>Actions</span>
      <div className={styles.workflowActions}>
        {status === "under_review" ? (
          <>
            <Button disabled={isPending} variant="success" onClick={() => open("approve_application")}>Approve</Button>
            <Button disabled={isPending} variant="warning" onClick={() => open("request_more_information")}>
              Request More Information
            </Button>
            <Button className={styles.denyAction} disabled={isPending} variant="destructive" onClick={() => open("deny_application")}>Deny</Button>
            <Button className={styles.cancelAction} disabled={isPending} variant="ghost" onClick={() => open("cancel_application")}>Cancel</Button>
          </>
        ) : (
          <>
            <Button disabled={isPending} onClick={() => open("resume_review")}>Resume Review</Button>
            <Button className={styles.cancelAction} disabled={isPending} variant="ghost" onClick={() => open("cancel_application")}>Cancel</Button>
          </>
        )}
      </div>

      {openAction && dialogCopy ? (
        <Dialog
          open
          onOpenChange={handleOpenChange}
          title={dialogCopy.title}
          description={dialogCopy.description}
          footer={(
            <>
              <DialogClose asChild>
                <Button className={styles.modalAction} disabled={isPending} variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                className={styles.modalAction}
                disabled={isPending}
                variant={confirmVariant(openAction)}
                onClick={() => submit(openAction)}
              >
                {isPending ? pendingLabel(openAction) : confirmLabel(openAction)}
              </Button>
            </>
          )}
        >
          <div className={styles.workflowDialogBody}>
            {openAction === "approve_application" ? (
              <>
                <FormField
                  label="Assigned Car"
                  hint="Enter the vehicle being assigned to this customer."
                  error={approvalFieldErrors.assignedCar}
                >
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      autoFocus
                      disabled={isPending}
                      value={assignedCar}
                      onChange={(event) => {
                        setAssignedCar(event.target.value);
                        setApprovalFieldErrors((current) => ({ ...current, assignedCar: undefined }));
                      }}
                    />
                  )}
                </FormField>
                <div className={styles.approvalScheduleFields}>
                  <FormField label="Pickup Date" error={approvalFieldErrors.pickupDate}>
                    {(fieldProps) => (
                      <Input
                        {...fieldProps}
                        disabled={isPending}
                        type="date"
                        value={pickupDate}
                        onChange={(event) => {
                          setPickupDate(event.target.value);
                          setApprovalFieldErrors((current) => ({ ...current, pickupDate: undefined }));
                        }}
                      />
                    )}
                  </FormField>
                  <FormField label="Pickup Time" error={approvalFieldErrors.pickupTime}>
                    {(fieldProps) => (
                      <Input
                        {...fieldProps}
                        disabled={isPending}
                        type="time"
                        value={pickupTime}
                        onChange={(event) => {
                          setPickupTime(event.target.value);
                          setApprovalFieldErrors((current) => ({ ...current, pickupTime: undefined }));
                        }}
                      />
                    )}
                  </FormField>
                </div>
                <FormField label="Pickup Location" error={approvalFieldErrors.pickupLocation}>
                  {(fieldProps) => (
                    <Input
                      {...fieldProps}
                      disabled={isPending}
                      value={pickupLocation}
                      onChange={(event) => {
                        setPickupLocation(event.target.value);
                        setApprovalFieldErrors((current) => ({ ...current, pickupLocation: undefined }));
                      }}
                    />
                  )}
                </FormField>
                <FormField
                  label="Pickup Instructions / Additional Information"
                  hint="Optional · shared with the customer."
                >
                  {(fieldProps) => (
                    <Textarea
                      {...fieldProps}
                      disabled={isPending}
                      maxLength={5000}
                      rows={3}
                      value={pickupInstructions}
                      onChange={(event) => setPickupInstructions(event.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Internal Note" hint="Optional · staff only.">
                  {(fieldProps) => (
                    <Textarea
                      {...fieldProps}
                      disabled={isPending}
                      maxLength={5000}
                      rows={3}
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                    />
                  )}
                </FormField>
              </>
            ) : null}

            {openAction === "request_more_information" ? (
              <>
                <FormField
                  label="What do you need from the customer?"
                  error={error === "Please enter what information you need from the customer." ? error : undefined}
                >
                  {(fieldProps) => (
                    <Textarea
                      {...fieldProps}
                      autoFocus
                      maxLength={5000}
                      rows={4}
                      value={messageToCustomer}
                      onChange={(event) => setMessageToCustomer(event.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Optional Internal Note">
                  {(fieldProps) => (
                    <Textarea
                      {...fieldProps}
                      maxLength={5000}
                      rows={3}
                      value={internalNote}
                      onChange={(event) => setInternalNote(event.target.value)}
                    />
                  )}
                </FormField>
              </>
            ) : null}

            {openAction === "deny_application" ? (
              <FormField label="Decision Reason" hint="Optional · shared with the customer.">
                {(fieldProps) => (
                  <Textarea
                    {...fieldProps}
                    autoFocus
                    maxLength={5000}
                    rows={4}
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                  />
                )}
              </FormField>
            ) : null}

            {openAction === "cancel_application" ? (
              <FormField label="Cancellation Note" hint="Optional · shared with the customer.">
                {(fieldProps) => (
                  <Textarea
                    {...fieldProps}
                    autoFocus
                    maxLength={5000}
                    rows={3}
                    value={cancellationNote}
                    onChange={(event) => setCancellationNote(event.target.value)}
                  />
                )}
              </FormField>
            ) : null}

            {error
              && error !== "Please enter what information you need from the customer." ? (
              <p className={styles.workflowError} role="alert">{error}</p>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
