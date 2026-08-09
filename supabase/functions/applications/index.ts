import { createClient } from "npm:@supabase/supabase-js@2.112.2";

import {
  type ApplicationInsert,
  type ApplicationResult,
  createApplicationHandler,
} from "./handler.ts";
import { verifyTurnstileToken } from "./turnstile.ts";

const APPLICATION_DOCUMENTS_BUCKET = "application-documents";

function requiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server environment: ${name}`);
  return value;
}

const supabaseUrl = requiredEnvironment("SUPABASE_URL");
const supabaseSecretKey =
  Deno.env.get("SUPABASE_SECRET_KEY") ||
  requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const turnstileSecret = requiredEnvironment("TURNSTILE_SECRET");

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const handler = createApplicationHandler({
  now: () => new Date(),
  generateId: () => crypto.randomUUID(),

  async consumeRateLimit(ipHash) {
    const { data, error } = await supabase.rpc(
      "consume_application_submission_limit",
      { p_ip_hash: ipHash },
    );
    if (error || !Array.isArray(data) || !data[0]) {
      throw new Error("Rate limit operation failed");
    }

    return {
      allowed: Boolean(data[0].allowed),
      retryAfterSeconds: Number(data[0].retry_after_seconds) || 0,
    };
  },

  verifyTurnstile: (token, clientIp) =>
    verifyTurnstileToken(token, clientIp, turnstileSecret),

  async uploadDocument(path, bytes, contentType) {
    const { error } = await supabase.storage
      .from(APPLICATION_DOCUMENTS_BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (error) throw new Error("Storage upload failed");
  },

  async removeDocuments(paths) {
    const { error } = await supabase.storage
      .from(APPLICATION_DOCUMENTS_BUCKET)
      .remove(paths);
    if (error) throw new Error("Storage cleanup failed");
  },

  async createApplication(input: ApplicationInsert) {
    const { data, error } = await supabase
      .from("applications")
      .insert(input)
      .select("id,application_number,status,rental_weeks,created_at")
      .single();

    if (error || !data) throw new Error("Application insert failed");
    return data as ApplicationResult;
  },

  logServerError(event, requestId) {
    console.error(JSON.stringify({ event, request_id: requestId }));
  },
});

const port = Number(Deno.env.get("PORT") || "8000");

Deno.serve({ hostname: "0.0.0.0", port }, (request) => {
  if (request.method === "GET" && new URL(request.url).pathname === "/health") {
    return Response.json({ status: "ok" });
  }

  return handler(request);
});
