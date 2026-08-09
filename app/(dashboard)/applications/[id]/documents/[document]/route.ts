import { getStaff } from "@/lib/auth/staff";
import { createServerDataClient } from "@/lib/supabase/server";
import { isApplicationId } from "@/lib/applications/detail";

const DOCUMENT_COLUMNS = {
  "drivers-license": "drivers_license_path",
  "proof-of-address": "proof_of_address_path",
} as const;

type DocumentType = keyof typeof DOCUMENT_COLUMNS;

function isDocumentType(value: string): value is DocumentType {
  return value in DOCUMENT_COLUMNS;
}

function unavailable(status: 404 | 503) {
  return Response.json(
    { success: false, error: { code: "DOCUMENT_UNAVAILABLE", message: "This document is unavailable." } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; document: string }> },
) {
  const staff = await getStaff();
  if (!staff) {
    return Response.redirect(new URL("/login", request.url), 307);
  }

  const { id, document } = await params;
  if (!isApplicationId(id) || !isDocumentType(document)) return unavailable(404);

  const column = DOCUMENT_COLUMNS[document];
  const supabase = createServerDataClient();
  const { data, error } = await supabase
    .from("applications")
    .select(`id,${column}`)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ event: "application_document_query_failed", code: error.code }));
    return unavailable(503);
  }

  const path = (data as Record<string, unknown> | null)?.[column];
  if (typeof path !== "string" || !path.startsWith(`${id}/`)) return unavailable(404);

  const { data: signedDocument, error: signedUrlError } = await supabase.storage
    .from("application-documents")
    .createSignedUrl(path, 300);

  if (signedUrlError || !signedDocument?.signedUrl) {
    console.error(JSON.stringify({
      event: "application_document_signing_failed",
      code: signedUrlError?.name ?? "missing_signed_url",
    }));
    return unavailable(503);
  }

  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Location: signedDocument.signedUrl,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
