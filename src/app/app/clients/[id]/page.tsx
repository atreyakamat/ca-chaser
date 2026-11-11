import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { ClientForm } from "@/components/app/client-form";
import { PageHeader } from "@/components/app/page-header";
import { CopyLinkButton, NudgeButton } from "@/components/app/row-actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDay, formatMonth } from "@/lib/dates";
import { setRequestStatus } from "@/server/actions/requests";
import { requireMember } from "@/server/auth/dal";
import { isUuid, withFirm } from "@/server/db";
import { uploadUrl } from "@/server/links";
import { listPeriods } from "@/server/periods";
import { getClient, listDocumentTypes } from "@/server/queries/clients";
import { getClientRequests } from "@/server/queries/dashboard";

export const metadata: Metadata = { title: "Client" };

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function ClientPage({ params, searchParams }: PageProps<"/app/clients/[id]">) {
  const member = await requireMember();
  const { id } = await params;
  const wanted = (await searchParams).period;
  if (!isUuid(id)) notFound();

  const data = await withFirm(member.firm.id, async (db) => {
    const client = await getClient(db, member.firm.id, id);
    if (!client) return null;
    const periods = await listPeriods(db, member.firm.id);
    const period = periods.find((p) => p.month.slice(0, 7) === wanted) ?? periods[0] ?? null;
    const requests = period ? await getClientRequests(db, member.firm.id, id, period.id) : [];
    const link = period
      ? await db.one<{ id: string }>("select id from upload_links where client_id = $1 and period_id = $2", [id, period.id])
      : null;
    return { client, period, requests, linkId: link?.id ?? null, types: await listDocumentTypes(db, member.firm.id) };
  });
  if (!data) notFound();
  const { client, period, requests, linkId, types } = data;
  const pending = requests.filter((r) => r.status === "pending").length;
  const hasFiles = requests.some((r) => r.uploads.length > 0);

  return (
    <>
      <PageHeader
        title={client.name}
        description={
          <Link href="/app/clients" className="underline-offset-2 hover:underline">
            All clients
          </Link>
        }
      />

      {period && requests.length > 0 && (
        <Card className="mb-6 max-w-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <h2 className="font-semibold">{formatMonth(period.month)}</h2>
              <p className="text-sm text-muted">
                {pending === 0 ? "Everything received" : `${pending} of ${requests.length} pending`} · due {formatDay(period.dueDate)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {pending > 0 && <NudgeButton clientId={client.id} periodId={period.id} clientName={client.name} />}
              {linkId && <CopyLinkButton url={uploadUrl(linkId)} clientName={client.name} />}
              {hasFiles && (
                <ButtonLink href={`/api/export?client=${client.id}&period=${period.id}`} variant="ghost" size="sm">
                  <Download aria-hidden /> ZIP
                </ButtonLink>
              )}
            </div>
          </div>
          <ul className="divide-y divide-border">
            {requests.map((request) => (
              <li key={request.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{request.name}</p>
                    <p className={request.status === "received" ? "text-xs text-accent" : "text-xs text-warning"}>
                      {request.status === "received" ? "Received" : "Pending"}
                    </p>
                  </div>
                  <form action={setRequestStatus}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="status" value={request.status === "received" ? "pending" : "received"} />
                    <Button type="submit" variant="ghost" size="sm" aria-label={`${request.status === "received" ? "Mark as pending" : "Mark as received"}: ${request.name}`}>
                      {request.status === "received" ? "Mark as pending" : "Mark as received"}
                    </Button>
                  </form>
                </div>
                {request.uploads.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {request.uploads.map((upload) => (
                      <li key={upload.id} className="flex items-center justify-between gap-3 text-sm">
                        <a href={`/api/files/${upload.id}`} className="min-w-0 truncate text-accent underline-offset-2 hover:underline">
                          {upload.fileName}
                        </a>
                        <span className="shrink-0 text-xs text-muted">{formatSize(upload.sizeBytes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="max-w-2xl p-6">
        <h2 className="mb-5 font-semibold">Details</h2>
        <ClientForm
          client={client}
          documentTypes={types.filter((t) => t.active || client.requirements.includes(t.id)).map(({ id, name }) => ({ id, name }))}
        />
      </Card>
    </>
  );
}
