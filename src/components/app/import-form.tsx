"use client";

import { useActionState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-status";
import { importClients } from "@/server/actions/clients";

export function ImportForm() {
  const [state, action] = useActionState(importClients, undefined);
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <Field label="CSV file" htmlFor="file" hint="Columns: name, phone, email, gstin, channel. Only name and one of phone or email are needed.">
        <Input id="file" name="file" type="file" accept=".csv,text/csv" required className="h-auto py-2" />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="whatsappOptIn" className="mt-0.5 size-4 accent-(--accent)" />
        <span>
          These clients have agreed to get WhatsApp reminders from us.
          <span className="block text-xs text-muted">Leave unticked if you are not sure. You can record consent per client later.</span>
        </span>
      </label>
      <div className="flex gap-3">
        <SubmitButton pendingLabel="Importing…">Import clients</SubmitButton>
        <ButtonLink href="/app/clients" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
