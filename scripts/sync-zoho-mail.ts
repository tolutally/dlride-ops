import {
  createSupabaseInboundMessageRepository,
  createZohoInboundMessageSource,
  syncInboundMessages,
  type InboundSyncLogger,
} from "../lib/zoho-mail/index";

function safeLog(
  level: "info" | "warn" | "error",
  event: string,
  context: Record<string, unknown> = {},
) {
  console[level](JSON.stringify({ event, ...context }));
}

const logger: InboundSyncLogger = {
  info: (event, context) => safeLog("info", event, context),
  warn: (event, context) => safeLog("warn", event, context),
  error: (event, context) => safeLog("error", event, context),
};

function configuredLimit() {
  const value = Number(process.env.ZOHO_MAIL_SYNC_LIMIT ?? "100");
  return Number.isFinite(value) ? value : 100;
}

try {
  const result = await syncInboundMessages({
    source: createZohoInboundMessageSource(),
    repository: createSupabaseInboundMessageRepository(),
    logger,
  }, { limit: configuredLimit() });
  // A per-message failure is isolated and reported in the summary. The worker
  // exits successfully so the next scheduled poll can retry that message.
  safeLog("info", "inbound_mail_sync_finished", result);
} catch (error) {
  const errorCode = error && typeof error === "object" && "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : error instanceof Error
    ? error.name
    : "UNKNOWN_ERROR";
  safeLog("error", "inbound_mail_sync_stopped", { error_code: errorCode });
  process.exitCode = 1;
}
