import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requireMember } from "@/server/auth/dal";
import { withFirm } from "@/server/db";

export const metadata: Metadata = { title: "Activity" };

type Entry = {
  id: string;
  clientName: string;
  kind: "request" | "followup" | "overdue" | "nudge";
  channel: "whatsapp" | "email";
  status: "sent" | "mock" | "failed" | "skipped";
  detail: string | null;
  body: string;
  createdAt: Date;
};

const KIND = { request: "First request", followup: "Follow-up", overdue: "Overdue reminder", nudge: "Nudge" } as const;
const STATUS = {
  sent: { label: "Sent", className: "bg-accent-soft text-accent" },
  mock: { label: "Test mode", className: "bg-surface-raised text-muted" },
  failed: { label: "Failed", className: "bg-danger-soft text-danger" },
  skipped: { label: "Not sent", className: "bg-warning-soft text-warning" },
} as const;

export default async function ActivityPage() {
  const member = await requireMember();
  const entries = await withFirm(member.firm.id, (db) =>
    db.query<Entry>(
      `select r.id, c.name as "clientName", r.kind, r.channel, r.status, r.detail, r.body, r.created_at as "createdAt"
         from reminder_log r join clients c on c.id = r.client_id
        where r.firm_id = $1
        order by r.created_at desc
        limit 200`,
      [member.firm.id],
    ),
  );

  return (
    <>
      <PageHeader title="Activity" description="Every reminder, newest first." />
      {entries.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">No reminders yet. They appear here once a month&apos;s requests are opened.</Card>
      ) : (
        <Card className="divide-y divide-border">
          {entries.map((entry) => (
            <details key={entry.id} className="group px-4 py-3">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{entry.clientName}</span>
                <span className="text-muted">
                  {KIND[entry.kind]} by {entry.channel === "whatsapp" ? "WhatsApp" : "email"}
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS[entry.status].className)}>{STATUS[entry.status].label}</span>
                <span className="ml-auto text-xs text-muted">{formatDateTime(entry.createdAt, member.firm.timezone)}</span>
              </summary>
              {entry.detail && entry.status !== "sent" && <p className="mt-2 text-sm text-muted">{entry.detail}</p>}
              <pre className="mt-2 rounded-lg bg-surface-raised p-3 font-sans text-sm whitespace-pre-wrap">{entry.body}</pre>
            </details>
          ))}
        </Card>
      )}
    </>
  );
}
