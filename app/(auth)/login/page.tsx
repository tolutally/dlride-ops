import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { BrandLogo } from "@/components/ui";
import { getStaff } from "@/lib/auth/staff";

import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Secure staff access to DLride operations.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getStaff()) redirect("/applications");

  return (
    <main className={styles.page}>
      <section className={styles.loginPanel} aria-labelledby="login-title">
        <div className={styles.brand}>
          <BrandLogo className={styles.brandLogo} priority />
        </div>

        <div className={styles.heading}>
          <p className={styles.eyebrow}>Staff workspace</p>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to review and manage rental applications.</p>
        </div>

        <LoginForm />

        <p className={styles.securityNote}>Access is limited to authorized DLride staff.</p>
      </section>
    </main>
  );
}
