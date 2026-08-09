import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { authRedirectFor } from "@/lib/auth/routes";

import { getSupabasePublicConfig } from "./config";

const SESSION_RESPONSE_HEADERS = ["cache-control", "expires", "pragma"] as const;

export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabasePublicConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const destination = authRedirectFor(
    request.nextUrl.pathname,
    !error && typeof data?.claims?.sub === "string",
  );

  if (!destination) return response;

  const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  SESSION_RESPONSE_HEADERS.forEach((header) => {
    const value = response.headers.get(header);
    if (value) redirectResponse.headers.set(header, value);
  });
  redirectResponse.headers.set("Cache-Control", "private, no-store");
  return redirectResponse;
}
