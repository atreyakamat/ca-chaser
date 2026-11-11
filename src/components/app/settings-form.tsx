"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-status";
import { saveSettings } from "@/server/actions/settings";

type Props = { name: string; requestDay: number; dueDay: number; offsets: number[]; canEdit: boolean };

export function SettingsForm({ name, requestDay, dueDay, offsets, canEdit }: Props) {
  const [state, action] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      <fieldset disabled={!canEdit} className="space-y-5">
        <Field label="Firm name" htmlFor="name" hint="Shown to your clients in every reminder.">
          <Input id="name" name="name" required maxLength={120} defaultValue={name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ask for documents on day" htmlFor="requestDay" hint="Day of the following month, 1 to 28.">
            <Input id="requestDay" name="requestDay" type="number" min={1} max={28} required defaultValue={requestDay} />
          </Field>
          <Field label="Documents due on day" htmlFor="dueDay" hint="Must be after the request day.">
            <Input id="dueDay" name="dueDay" type="number" min={1} max={28} required defaultValue={dueDay} />
          </Field>
        </div>
        <Field label="Follow up this many days before the due date" htmlFor="offsets" hint="Separate with commas, for example 7, 3, 1.">
          <Input id="offsets" name="offsets" inputMode="numeric" defaultValue={offsets.join(", ")} />
        </Field>
      </fieldset>
      {canEdit ? <SubmitButton>Save settings</SubmitButton> : <p className="text-sm text-muted">Only the firm owner can change these.</p>}
    </form>
  );
}
