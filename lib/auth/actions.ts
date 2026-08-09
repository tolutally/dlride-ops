"use server";

import { redirect } from "next/navigation";

import { createServerAuthClient } from "@/lib/supabase/server";

export type SignInState = {
  error?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const fieldErrors: SignInState["fieldErrors"] = {};

  if (!EMAIL_PATTERN.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  let signInFailed = false;
  try {
    const supabase = await createServerAuthClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    signInFailed = Boolean(error);
  } catch {
    console.error(JSON.stringify({ event: "staff_sign_in_unavailable" }));
    return { error: "Sign in is temporarily unavailable. Please try again." };
  }

  if (signInFailed) return { error: "Invalid email or password." };
  redirect("/applications");
}

export async function signOut() {
  try {
    const supabase = await createServerAuthClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error(JSON.stringify({ event: "staff_sign_out_failed" }));
  } catch {
    console.error(JSON.stringify({ event: "staff_sign_out_unavailable" }));
  }

  redirect("/login");
}
