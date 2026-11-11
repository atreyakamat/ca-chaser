import type { Metadata } from "next";
import { Suspense } from "react";
import { PartyPopper } from "lucide-react";
import { UploadList } from "@/components/upload-list";
import { formatDay, formatMonth } from "@/lib/dates";
import { site } from "@/lib/site";
import { loadUploadContext } from "@/server/uploads";

export const metadata: Metadata = { title: "Send your documents", robots: { index: false, follow: false } };

export default function UploadPage({ params }: PageProps<"/u/[token]">) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <Suspense fallback={<div aria-busy="true" aria-label="Loading" className="h-72 animate-pulse rounded-2xl bg-surface-raised" />}>
        <Upload params={params} />
      </Suspense>
      <p className="mt-10 text-center text-xs text-muted">Sent securely with {site.name}. Only your CA&apos;s team can open these files.</p>
    </main>
  );
}

async function Upload({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await loadUploadContext(token);

  if (!context) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold">This link has expired</h1>
        <p className="mt-2 text-sm text-muted">Please ask your CA to send you a new link.</p>
      </div>
    );
  }

  const pending = context.requests.filter((r) => r.status === "pending").length;
  return (
    <>
      <p className="text-sm text-muted">{context.firmName}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">
        {context.clientName}: documents for {formatMonth(context.month)}
      </h1>
      {context.requests.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-surface p-6 text-sm text-muted">Nothing is needed from you this month.</p>
      ) : pending === 0 ? (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent">
          <PartyPopper className="size-4 shrink-0" aria-hidden /> All done. Thank you! You can still add more files below.
        </p>
      ) : (
        <p className="mt-2 text-muted">
          {pending} of {context.requests.length} still needed.{" "}
          {context.overdue ? `They were due on ${formatDay(context.dueDate)}.` : `Please send them by ${formatDay(context.dueDate)}.`}
        </p>
      )}
      <div className="mt-6">
        <UploadList token={token} requests={context.requests} />
      </div>
      <p className="mt-4 text-xs text-muted">PDF, photo, Excel or CSV. Up to 5 MB per file.</p>
    </>
  );
}
