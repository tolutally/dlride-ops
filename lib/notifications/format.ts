const PREVIEW_LENGTH = 120;

export function notificationPreview(body: string, subject = "") {
  const normalized = body.replace(/\s+/g, " ").trim() || subject.replace(/\s+/g, " ").trim();
  if (!normalized) return "New customer reply";
  if (normalized.length <= PREVIEW_LENGTH) return normalized;
  return `${normalized.slice(0, PREVIEW_LENGTH - 1).trimEnd()}…`;
}

export function relativeReplyTime(receivedAt: string, now: string) {
  const timestamp = Date.parse(receivedAt);
  const current = Date.parse(now);
  if (!Number.isFinite(timestamp) || !Number.isFinite(current)) return "Recently";

  const seconds = Math.max(0, Math.floor((current - timestamp) / 1000));
  if (seconds < 45) return "Just now";
  if (seconds < 90) return "1 min ago";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: new Date(timestamp).getFullYear() === new Date(current).getFullYear()
      ? undefined
      : "numeric",
  }).format(new Date(timestamp));
}

