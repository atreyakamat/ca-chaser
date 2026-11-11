import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/server/auth/dal";
import { withFirm } from "@/server/db";
import { listClients } from "@/server/queries/clients";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/app/clients">) {
  const member = await requireMember();
  const params = await searchParams;
  const clients = await withFirm(member.firm.id, (db) => listClients(db, member.firm.id));
  const imported = Number(params.imported);
  const skipped = Number(params.skipped);

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${clients.filter((c) => c.active).length} active`}
        actions={
          <>
            <ButtonLink href="/app/clients/import" variant="secondary">
              <Upload aria-hidden /> Import CSV
            </ButtonLink>
            <ButtonLink href="/app/clients/new">
              <Plus aria-hidden /> Add client
            </ButtonLink>
          </>
        }
      />

      {Number.isInteger(imported) && (
        <p role="status" className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          Imported {imported} {imported === 1 ? "client" : "clients"}.
          {skipped > 0 && ` Skipped ${skipped} already on your list.`}
        </p>
      )}

      {clients.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-medium">No clients yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Add the clients you chase every month, one at a time or from a CSV file.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Client</th>
                <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">Contact</th>
                <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">Reminders by</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((client) => (
                <tr key={client.id} className={client.active ? undefined : "text-muted"}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <Link href={`/app/clients/${client.id}`} className="underline-offset-2 hover:underline">
                      {client.name}
                    </Link>
                    {!client.active && <span className="ml-2 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-normal">Inactive</span>}
                  </th>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{client.phone ?? client.email}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {client.channel === "whatsapp" ? "WhatsApp" : "Email"}
                    {client.channel === "whatsapp" && !client.whatsappOptIn && <span className="ml-2 text-xs text-warning">No consent yet</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{client.documents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
