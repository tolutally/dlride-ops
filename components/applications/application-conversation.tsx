"use client";

import { FileImage, FileText, LoaderCircle, Mail, MessageCircle, Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { Button, ButtonLink, Dialog } from "@/components/ui";
import {
  loadEarlierMessages,
  markConversationRead,
  sendApplicationReply,
} from "@/lib/applications/conversation-actions";
import type {
  ApplicationConversation,
  ApplicationMessage,
  MessageAttachment,
} from "@/lib/applications/detail-types";
import { UNREAD_REPLIES_READ_EVENT } from "@/lib/notifications/types";

import styles from "./application-detail.module.css";

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function fileType(value: string) {
  if (value === "application/pdf") return "PDF";
  if (value === "image/png") return "PNG";
  return "JPG";
}

function splitQuotedHistory(body: string) {
  const normalized = body.replace(/\r\n?/g, "\n").trim();
  const patterns = [
    /^On .{8,200}wrote:\s*$/im,
    /^From:\s+.+\nSent:\s+.+\nTo:\s+.+/im,
    /^-{2,}\s*Original Message\s*-{2,}$/im,
  ];
  const index = patterns.reduce((best, pattern) => {
    const match = pattern.exec(normalized);
    return match && (best < 0 || match.index < best) ? match.index : best;
  }, -1);
  if (index < 1) return { current: normalized, quoted: "" };
  return { current: normalized.slice(0, index).trim(), quoted: normalized.slice(index).trim() };
}

function senderLabel(message: ApplicationMessage, customerName: string) {
  return message.direction === "inbound" ? customerName : "DLride Rentals";
}

function MessageBlock({ message, customerName, onViewAttachment }: {
  message: ApplicationMessage;
  customerName: string;
  onViewAttachment: (attachment: MessageAttachment) => void;
}) {
  const body = splitQuotedHistory(message.body_text);
  return (
    <li className={message.direction === "outbound" ? styles.messageOutbound : styles.messageInbound}>
      <div className={styles.messageMeta}>
        <strong>{senderLabel(message, customerName)}</strong>
        {message.direction === "inbound" && !message.is_read ? (
          <span className={styles.messageNewBadge}>New</span>
        ) : null}
        <span aria-hidden="true">·</span>
        <time dateTime={message.received_at}>{formatMessageTime(message.received_at)}</time>
      </div>
      <span className="sr-only">
        {message.direction === "inbound" ? "Customer message" : "Message sent by DLride"}
      </span>
      {body.current ? <p className={styles.messageBody}>{body.current}</p> : null}
      {body.quoted ? (
        <details className={styles.quotedHistory}>
          <summary>Show previous message</summary>
          <p>{body.quoted}</p>
        </details>
      ) : null}
      {message.attachments.length ? (
        <div className={styles.messageAttachments} aria-label="Attachments">
          {message.attachments.map((attachment) => (
            <button
              className={styles.messageAttachment}
              key={attachment.id}
              type="button"
              onClick={() => onViewAttachment(attachment)}
            >
              {attachment.mime_type.startsWith("image/") ? <FileImage aria-hidden="true" /> : <FileText aria-hidden="true" />}
              <span>
                <strong>{attachment.filename}</strong>
                <small>{fileType(attachment.mime_type)} · {formatBytes(attachment.file_size)}</small>
              </span>
              <span className={styles.attachmentView}>View</span>
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function ApplicationConversationPanel({
  applicationId,
  customerEmail,
  customerFirstName,
  customerName,
  initial,
  active = true,
  onRead,
}: {
  applicationId: string;
  customerEmail: string;
  customerFirstName: string;
  customerName: string;
  initial: ApplicationConversation;
  active?: boolean;
  onRead?: () => void;
}) {
  const [messages, setMessages] = useState(initial.messages);
  const [hasEarlier, setHasEarlier] = useState(initial.hasEarlier);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [hasUnread, setHasUnread] = useState(initial.hasUnread);
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);
  const [isSending, startSending] = useTransition();
  const [isLoadingEarlier, startLoadingEarlier] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const newestRef = useRef<HTMLDivElement>(null);
  const markingReadRef = useRef(false);

  useEffect(() => {
    if (!active || !hasUnread || markingReadRef.current) return;
    markingReadRef.current = true;
    void markConversationRead(applicationId).then((result) => {
      markingReadRef.current = false;
      if (!result.success) return;
      setMessages((current) => current.map((message) =>
        message.direction === "inbound" ? { ...message, is_read: true } : message
      ));
      setHasUnread(false);
      onRead?.();
      window.dispatchEvent(new CustomEvent(UNREAD_REPLIES_READ_EVENT, {
        detail: { applicationId, markedRead: result.markedRead },
      }));
    });
  }, [active, applicationId, hasUnread, onRead]);

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 224)}px`;
  }

  function chooseFiles(selected: FileList | null) {
    if (!selected) return;
    const next = [...files, ...Array.from(selected)];
    if (next.length > MAX_FILES) {
      setFileError("You can attach up to 3 files.");
      return;
    }
    if (next.some((file) => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE)) {
      setFileError("Use PDF, JPG, or PNG files up to 10 MB each.");
      return;
    }
    setFileError(null);
    setFiles(next);
    if (fileRef.current) fileRef.current.value = "";
  }

  function sendReply() {
    setError(null);
    setSent(false);
    const formData = new FormData();
    formData.set("body", body);
    files.forEach((file) => formData.append("attachments", file));
    startSending(async () => {
      const result = await sendApplicationReply(applicationId, formData);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setMessages((current) => [...current, result.message]);
      setBody("");
      setFiles([]);
      setSent(true);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      requestAnimationFrame(() => newestRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    });
  }

  function loadEarlier() {
    const oldest = messages[0]?.received_at;
    if (!oldest) return;
    startLoadingEarlier(async () => {
      const result = await loadEarlierMessages(applicationId, oldest);
      setMessages((current) => [...result.messages, ...current]);
      setHasEarlier(result.hasEarlier);
    });
  }

  return (
    <section className={`${styles.surface} ${styles.conversationSurface}`} aria-labelledby="conversation-heading">
      <div className={styles.conversationHeader}>
        <div>
          <div className={styles.conversationTitle}>
            <Mail aria-hidden="true" />
            <h2 id="conversation-heading">Conversation</h2>
            {hasUnread ? <span className={styles.newReplyBadge}>New reply</span> : null}
          </div>
          <p>{customerEmail}</p>
        </div>
      </div>

      {hasEarlier ? (
        <Button className={styles.loadEarlier} variant="ghost" size="sm" disabled={isLoadingEarlier} onClick={loadEarlier}>
          {isLoadingEarlier ? "Loading…" : "Load earlier messages"}
        </Button>
      ) : null}

      {messages.length ? (
        <ol className={styles.messageList} aria-label="Application messages">
          {messages.map((message) => (
            <MessageBlock
              key={message.id}
              message={message}
              customerName={customerName}
              onViewAttachment={setPreviewAttachment}
            />
          ))}
        </ol>
      ) : (
        <div className={styles.conversationEmpty}>
          <p>No messages yet.</p>
          <span>Customer replies and messages sent from DLride Ops will appear here.</span>
        </div>
      )}
      <div ref={newestRef} />

      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewAttachment(null);
        }}
        title={previewAttachment?.filename ?? "Attachment preview"}
        description={previewAttachment
          ? `${fileType(previewAttachment.mime_type)} · ${formatBytes(previewAttachment.file_size)}`
          : undefined}
        size="wide"
        bodyClassName={styles.attachmentPreviewBody}
        footer={previewAttachment ? (
          <>
            <Button variant="ghost" onClick={() => setPreviewAttachment(null)}>Close</Button>
            <ButtonLink
              href={`/applications/${applicationId}/conversation/attachments/${previewAttachment.id}?download=1`}
              variant="secondary"
              download
            >
              Download
            </ButtonLink>
          </>
        ) : undefined}
      >
        {previewAttachment ? (
          <div className={styles.attachmentPreview} data-attachment-preview="true">
            {previewAttachment.mime_type === "application/pdf" ? (
              <iframe
                src={`/applications/${applicationId}/conversation/attachments/${previewAttachment.id}`}
                title={`Preview ${previewAttachment.filename}`}
              />
            ) : (
              // This authenticated route redirects to a short-lived private Storage URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/applications/${applicationId}/conversation/attachments/${previewAttachment.id}`}
                alt={previewAttachment.filename}
              />
            )}
          </div>
        ) : null}
      </Dialog>

      <div className={styles.replyComposer}>
        <label className="sr-only" htmlFor={`reply-${applicationId}`}>Reply to {customerFirstName}</label>
        <textarea
          ref={textareaRef}
          id={`reply-${applicationId}`}
          value={body}
          rows={2}
          maxLength={20000}
          placeholder={`Write a reply to ${customerFirstName}...`}
          onChange={(event) => {
            setBody(event.target.value);
            setSent(false);
            resizeTextarea();
          }}
        />
        {files.length ? (
          <ul className={styles.selectedAttachments} aria-label="Selected attachments">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.lastModified}`}>
                <Paperclip aria-hidden="true" />
                <span>{file.name}</span>
                <small>{formatBytes(file.size)}</small>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                  <X aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {fileError ? <p className={styles.composerError} role="alert">{fileError}</p> : null}
        {error ? <p className={styles.composerError} role="alert">{error}</p> : null}
        {sent ? <p className={styles.composerSuccess} role="status">Reply sent</p> : null}
        <div className={styles.composerActions}>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            multiple
            onChange={(event) => chooseFiles(event.target.files)}
          />
          <Button className={styles.attachButton} variant="ghost" size="md" disabled={isSending || files.length >= MAX_FILES} onClick={() => fileRef.current?.click()} aria-label="Attach files">
            <Paperclip aria-hidden="true" />
            Attach
          </Button>
          <Button className={styles.sendReplyButton} size="md" disabled={isSending || (!body.trim() && files.length === 0)} onClick={sendReply}>
            {isSending ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : <Send aria-hidden="true" />}
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function ApplicationConversationDrawer({
  applicationId,
  customerEmail,
  customerFirstName,
  customerName,
  initial,
}: {
  applicationId: string;
  customerEmail: string;
  customerFirstName: string;
  customerName: string;
  initial: ApplicationConversation;
}) {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(initial.hasUnread);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === "#conversation") setOpen(true);
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.querySelector("[data-attachment-preview='true']")) return;
        setOpen(false);
        if (window.location.hash === "#conversation") {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        }
        requestAnimationFrame(() => launcherRef.current?.focus());
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function closeDrawer() {
    setOpen(false);
    if (window.location.hash === "#conversation") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  return (
    <>
      <button
        ref={launcherRef}
        className={styles.conversationLauncher}
        type="button"
        aria-label={`Open conversation with ${customerFirstName}`}
        aria-expanded={open}
        aria-controls="conversation"
        onClick={() => setOpen(true)}
      >
        <MessageCircle aria-hidden="true" />
        {hasUnread ? <span className={styles.launcherUnread}><span className="sr-only">New reply</span></span> : null}
      </button>

      <div className={`${styles.conversationDrawerRoot} ${open ? styles.conversationDrawerOpen : ""}`} aria-hidden={!open}>
        <button className={styles.conversationBackdrop} type="button" tabIndex={open ? 0 : -1} aria-label="Close conversation" onClick={closeDrawer} />
        <aside
          id="conversation"
          className={styles.conversationDrawer}
          role="dialog"
          aria-modal="true"
          aria-label={`Conversation with ${customerName}`}
        >
          <div className={styles.drawerTopBar}>
            <span>Application conversation</span>
            <button ref={closeButtonRef} type="button" aria-label="Close conversation" onClick={closeDrawer}>
              <X aria-hidden="true" />
            </button>
          </div>
          <div className={styles.drawerScrollArea}>
            <ApplicationConversationPanel
              applicationId={applicationId}
              customerEmail={customerEmail}
              customerFirstName={customerFirstName}
              customerName={customerName}
              initial={initial}
              active={open}
              onRead={() => setHasUnread(false)}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
