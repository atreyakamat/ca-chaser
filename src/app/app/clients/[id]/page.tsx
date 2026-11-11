import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/app/client-form";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/server/auth/dal";
import { isUuid, withFirm } from "@/server/db";
import { getClient, listDocumentTypes } from "@/server/queries/clients";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/app/clients/[id]">) {
  const member = await requireMember();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { client, types } = await withFirm(member.firm.id, async (db) => ({
    client: await getClient(db, member.firm.id, id),
    types: await listDocumentTypes(db, member.firm.id),
  }));
  if (!client) notFound();

  return (
    <>
      <PageHeader title={client.name} />
      <Card className="max-w-2xl p-6">
        <ClientForm
          client={client}
          documentTypes={types.filter((t) => t.active || client.requirements.includes(t.id)).map(({ id, name }) => ({ id, name }))}
        />
      </Card>
    </>
  );
}
