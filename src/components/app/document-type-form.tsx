"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/field";
import { FormMessage, SubmitButton } from "@/components/ui/form-status";
import { addDocumentType } from "@/server/actions/documents";

export function DocumentTypeForm() {
  const [state, action] = useActionState(addDocumentType, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <label htmlFor="name" className="sr-only">
          Document name
        </label>
        <Input id="name" name="name" required maxLength={80} placeholder="e.g. E-way bills" className="min-w-0 flex-1 basis-56" />
        <SubmitButton pendingLabel="Adding…">Add document</SubmitButton>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="assignToAll" className="size-4 accent-(--accent)" />
        Collect this from every active client
      </label>
    </form>
  );
}
