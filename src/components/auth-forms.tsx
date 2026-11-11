"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-status";
import { login, signup } from "@/server/actions/auth";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Firm name" htmlFor="firmName">
        <Input id="firmName" name="firmName" autoComplete="organization" required maxLength={120} defaultValue={state?.values?.firmName} />
      </Field>
      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required maxLength={120} defaultValue={state?.values?.name} />
      </Field>
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.values?.email} />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <SubmitButton size="lg" className="w-full" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}
