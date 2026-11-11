"use client";

import { useActionState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-status";
import { saveClient } from "@/server/actions/clients";

type Props = {
  client?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    channel: "whatsapp" | "email";
    whatsappOptIn: boolean;
    active: boolean;
    requirements: string[];
  };
  documentTypes: { id: string; name: string }[];
};

export function ClientForm({ client, documentTypes }: Props) {
  const [state, action] = useActionState(saveClient, undefined);
  const value = (key: "name" | "phone" | "email" | "gstin") => state?.values?.[key] ?? client?.[key] ?? "";
  const required = new Set(client ? client.requirements : documentTypes.map((d) => d.id));

  return (
    <form action={action} className="space-y-6">
      {client && <input type="hidden" name="id" value={client.id} />}
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client name" htmlFor="name" className="sm:col-span-2">
          <Input id="name" name="name" required maxLength={160} defaultValue={value("name")} />
        </Field>
        <Field label="WhatsApp number" htmlFor="phone" hint="10-digit Indian mobile, or with country code.">
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" defaultValue={value("phone")} />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="off" defaultValue={value("email")} />
        </Field>
        <Field label="GSTIN" htmlFor="gstin" hint="Optional.">
          <Input id="gstin" name="gstin" maxLength={15} autoCapitalize="characters" autoComplete="off" defaultValue={value("gstin")} />
        </Field>
        <Field label="Send reminders by" htmlFor="channel">
          <Select id="channel" name="channel" defaultValue={state?.values?.channel || client?.channel || "whatsapp"}>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </Select>
        </Field>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="whatsappOptIn" defaultChecked={client?.whatsappOptIn ?? false} className="mt-0.5 size-4 accent-(--accent)" />
        <span>
          This client has agreed to get WhatsApp reminders from us.
          <span className="block text-xs text-muted">Required before any WhatsApp message is sent to them.</span>
        </span>
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Documents to collect every month</legend>
        {documentTypes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Add document types first, on the Documents page.</p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {documentTypes.map((doc) => (
              <label key={doc.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
                <input type="checkbox" name="requirements" value={doc.id} defaultChecked={required.has(doc.id)} className="size-4 accent-(--accent)" />
                {doc.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {client && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="active" defaultChecked={client.active} className="mt-0.5 size-4 accent-(--accent)" />
          <span>
            Active
            <span className="block text-xs text-muted">Untick to stop chasing this client. Their past documents are kept.</span>
          </span>
        </label>
      )}

      <div className="flex gap-3">
        <SubmitButton>{client ? "Save changes" : "Add client"}</SubmitButton>
        <ButtonLink href="/app/clients" variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
