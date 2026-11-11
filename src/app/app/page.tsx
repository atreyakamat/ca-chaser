import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Check, Clock, Download } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CopyLinkButton, NudgeButton } from "@/components/app/row-actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatDay, formatMonth, todayIn } from "@/lib/dates";
import { activePeriodMonth } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { openRequests } from "@/server/actions/requests";
import { requireMember } from "@/server/auth/dal";
import { withFirm } from "@/server/db";
import { env } from "@/server/env";
import { uploadUrl } from "@/server/links";
import { listPeriods } from "@/server/periods";
import { getBoard } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "complete", label: "Complete" },
] as const;

export default async function DashboardPage({ searchParams }: PageProps<"/app">) {
  const member = await requireMember();
  const params = await searchParams;
  const firm = member.firm;
  const today = todayIn(firm.timezone);
  const activeMonth = activePeriodMonth(today, { requestDay: firm.requestDay, dueDay: firm.dueDay, offsets: firm.offsets });

  const { periods, period, board, clientCount } = await withFirm(firm.id, async (db) => {
    const periods = await listPeriods(db, firm.id);
    const wanted = typeof params.period === "string" ? params.period : null;
    const period = periods.find((p) => p.month.slice(0, 7) === wanted) ?? periods[0] ?? null;
    const board = period ? await getBoard(db, firm.id, period.id) : null;
    const count = await db.one<{ count: number }>("select count(*) as count from clients where firm_id = $1 and active", [firm.id]);
    return { periods, period, board, clientCount: count?.count ?? 0 };
  });

  const testMode = env().MESSAGING_MODE === "mock";
  const canOpenNewer = !periods.some((p) => p.month === activeMonth);
  const openForm = (
    <form action={openRequests}>
      <Button type="submit" disabled={clientCount === 0}>
        Open requests for {formatMonth(activeMonth)}
      </Button>
    </form>
  );

  if (!period || !board) {
    return (
      <>
        <PageHeader title="Dashboard" description={firm.name} />
        <Card className="max-w-2xl p-8">
          <h2 className="text-lg font-semibold">Start chasing in two steps</h2>
          <ol className="mt-4 space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">1</span>
              <div>
                <p className="font-medium">Add your clients</p>
                <p className="text-muted">
                  {clientCount > 0 ? `${clientCount} added so far.` : "Add them one at a time or import a CSV."}{" "}
                  <Link href="/app/clients" className="font-medium text-accent underline-offset-2 hover:underline">
                    Go to clients
                  </Link>
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">2</span>
              <div>
                <p className="font-medium">Open this month&apos;s requests</p>
                <p className="mb-3 text-muted">
                  Every client gets a message with their own upload link.{" "}
                  {testMode ? "You are in test mode, so messages are recorded but not sent." : "After this, it happens automatically each month."}
                </p>
                {openForm}
              </div>
            </li>
          </ol>
        </Card>
      </>
    );
  }

  const overdue = today > period.dueDate;
  const filter = FILTERS.some((f) => f.key === params.filter) ? (params.filter as (typeof FILTERS)[number]["key"]) : "all";
  const rows = board.rows.filter((r) => (filter === "pending" ? r.pending > 0 : filter === "complete" ? r.pending === 0 : true));
  const totalRequests = board.rows.reduce((sum, r) => sum + Object.keys(r.cells).length, 0);
  const pendingRequests = board.rows.reduce((sum, r) => sum + r.pending, 0);
  const percent = totalRequests === 0 ? 0 : Math.round(((totalRequests - pendingRequests) / totalRequests) * 100);
  const completeClients = board.rows.filter((r) => r.pending === 0).length;
  const monthParam = period.month.slice(0, 7);
  const href = (next: { period?: string; filter?: string }) => {
    const query = new URLSearchParams({ period: next.period ?? monthParam, filter: next.filter ?? filter });
    return `/app?${query}`;
  };

  return (
    <>
      <PageHeader
        title={formatMonth(period.month)}
        description={`${overdue ? "Was due" : "Due"} ${formatDay(period.dueDate)} · ${firm.name}`}
        actions={canOpenNewer ? openForm : undefined}
      />

      {testMode && (
        <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          Test mode: reminders are recorded in Activity but not sent to clients.
        </p>
      )}

      {periods.length > 1 && (
        <nav aria-label="Month" className="mb-4 flex flex-wrap gap-2">
          {periods.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              href={href({ period: p.month.slice(0, 7), filter: "all" })}
              aria-current={p.id === period.id ? "page" : undefined}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-sm",
                p.id === period.id ? "bg-foreground text-background" : "bg-surface text-muted hover:text-foreground",
              )}
            >
              {formatMonth(p.month)}
            </Link>
          ))}
        </nav>
      )}

      <section aria-label="Summary" className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: "Documents received", value: `${percent}%` },
          { label: "Clients complete", value: `${completeClients} of ${board.rows.length}` },
          { label: overdue ? "Documents overdue" : "Documents pending", value: String(pendingRequests) },
        ].map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-xs text-muted sm:text-sm">{tile.label}</p>
            <p className="mt-2 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{tile.value}</p>
          </Card>
        ))}
      </section>

      <nav aria-label="Filter clients" className="mb-3 flex gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href({ filter: f.key })}
            aria-current={f.key === filter ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              f.key === filter ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {board.rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">
          No documents were requested this month. Tick the documents each client sends on their{" "}
          <Link href="/app/clients" className="font-medium text-accent underline-offset-2 hover:underline">
            client page
          </Link>
          .
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">No clients match this filter.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="sticky left-0 bg-surface px-4 py-3 font-medium">Client</th>
                {board.columns.map((column) => (
                  <th key={column.id} scope="col" className="px-2 py-3 text-center font-medium">
                    {column.name}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 font-medium whitespace-nowrap">Last reminder</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.clientId}>
                  <th scope="row" className="sticky left-0 max-w-[11rem] truncate bg-surface px-4 py-3 font-medium">
                    <Link href={`/app/clients/${row.clientId}?period=${monthParam}`} className="underline-offset-2 hover:underline">
                      {row.clientName}
                    </Link>
                  </th>
                  {board.columns.map((column) => (
                    <td key={column.id} className="px-2 py-3 text-center">
                      <StatusDot cell={row.cells[column.id]?.status} overdue={overdue} />
                    </td>
                  ))}
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {row.lastReminderAt ? formatDateTime(row.lastReminderAt, firm.timezone) : "Not yet"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {row.pending > 0 && <NudgeButton clientId={row.clientId} periodId={period.id} clientName={row.clientName} />}
                      {row.linkId && <CopyLinkButton url={uploadUrl(row.linkId)} clientName={row.clientName} />}
                      <ButtonLink
                        href={`/api/export?client=${row.clientId}&period=${period.id}`}
                        variant="ghost"
                        size="sm"
                        aria-label={`Download ${row.clientName}'s files as a ZIP`}
                      >
                        <Download aria-hidden /> ZIP
                      </ButtonLink>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function StatusDot({ cell, overdue }: { cell: "pending" | "received" | undefined; overdue: boolean }) {
  if (!cell) return <span className="text-muted" aria-label="Not needed">–</span>;
  const style =
    cell === "received"
      ? { label: "Received", className: "bg-accent-soft text-accent", Icon: Check }
      : overdue
        ? { label: "Overdue", className: "bg-danger-soft text-danger", Icon: AlertCircle }
        : { label: "Pending", className: "bg-warning-soft text-warning", Icon: Clock };
  return (
    <span className={cn("inline-flex size-7 items-center justify-center rounded-full", style.className)} title={style.label}>
      <style.Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{style.label}</span>
    </span>
  );
}
