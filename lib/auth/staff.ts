import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createServerAuthClient } from "@/lib/supabase/server";

export type StaffIdentity = {
  id: string;
  email: string;
};

export const getStaff = cache(async (): Promise<StaffIdentity | null> => {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user?.id || !data.user.email) return null;

  return {
    id: data.user.id,
    email: data.user.email,
  };
});

export async function requireStaff() {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return staff;
}
