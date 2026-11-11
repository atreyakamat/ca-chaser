"use client";

import { useActionState, useState } from "react";
import { BellRing, Check, Link2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { nudgeClient } from "@/server/actions/requests";

function NudgeSubmit({ clientName }: { clientName: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending} aria-label={`Send a reminder to ${clientName}`}>
      <BellRing aria-hidden /> {pending ? "Sending…" : "Nudge"}
    </Button>
  );
}

/** Sends one extra reminder and shows what happened next to the button. */
export function NudgeButton({ clientId, periodId, clientName }: { clientId: string; periodId: string; clientName: string }) {
  const [state, action] = useActionState(nudgeClient, undefined);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="periodId" value={periodId} />
      <NudgeSubmit clientName={clientName} />
      <span aria-live="polite" className={state?.error ? "text-xs text-danger" : "text-xs text-muted"}>
        {state?.error ?? state?.notice}
      </span>
    </form>
  );
}

export function CopyLinkButton({ url, clientName }: { url: string; clientName: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`Copy upload link for ${clientName}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this upload link", url);
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Link2 aria-hidden />} {copied ? "Copied" : "Copy link"}
    </Button>
  );
}
