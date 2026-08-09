"use client";

import { LockKeyhole } from "lucide-react";
import { useActionState } from "react";

import { Button, FormField, Input } from "@/components/ui";
import { signIn, type SignInState } from "@/lib/auth/actions";

import styles from "./auth.module.css";

const INITIAL_STATE: SignInState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, INITIAL_STATE);

  return (
    <form className={styles.form} action={action} noValidate>
      <FormField label="Email" error={state.fieldErrors?.email}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@dlride.com"
            required
          />
        )}
      </FormField>

      <FormField label="Password" error={state.fieldErrors?.password}>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        )}
      </FormField>

      {state.error ? (
        <p className={styles.formError} role="alert">{state.error}</p>
      ) : null}

      <Button className={styles.submit} type="submit" size="lg" fullWidth disabled={pending}>
        <LockKeyhole aria-hidden="true" />
        {pending ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
