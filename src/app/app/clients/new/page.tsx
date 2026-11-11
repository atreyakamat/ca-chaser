import type { Metadata } from "next";
import { ClientForm } from "@/components/app/client-form";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { requireMember } from "@/server/auth/dal";
import { withFirm } from "@/server/db";
import { listDocumentTypes } from "@/server/queries/clients";

export const metadata: Metadata = { title: "Add client" };

export default async function NewClientPage() {
  const member = await requireMember();
  const types = await withFirm(member.firm.id, (db) => listDocumentTypes(db, member.firm.id));
  return (
    <>
      <PageHeader title="Add client" />
      <Card className="max-w-2xl p-6">
        <ClientForm documentTypes={types.filter((t) => t.active).map(({ id, name }) => ({ id, name }))} />
      </Card>
    </>
  );
}
