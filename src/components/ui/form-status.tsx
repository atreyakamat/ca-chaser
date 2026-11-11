"use client";

import { useFormStatus } from "react-dom";
import type { FormState } from "@/server/form";
import { Button, type ButtonProps } from "./button";

/** Submit button that disables itself while its form is being sent. */
export function SubmitButton({ children, pendingLabel = "Saving…", ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Inline result of the last submit. */
export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state?.notice) {
    return (
      <p role="status" className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
        {state.notice}
      </p>
    );
  }
  return null;
}
