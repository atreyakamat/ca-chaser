import type { Metadata } from "next";
import { DocumentTypeForm } from "@/components/app/document-type-form";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setDocumentTypeActive } from "@/server/actions/documents";
import { requireMember } from "@/server/auth/dal";
import { withFirm } from "@/server/db";
import { listDocumentTypes } from "@/server/queries/clients";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const member = await requireMember();
  const types = await withFirm(member.firm.id, (db) => listDocumentTypes(db, member.firm.id));
  return (
    <>
      <PageHeader title="Documents" description="The documents you collect each month. Choose which ones each client sends on their client page." />
      <Card className="mb-6 max-w-2xl p-6">
        <DocumentTypeForm />
      </Card>
      <Card className="max-w-2xl divide-y divide-border">
        {types.map((type) => (
          <div key={type.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className={type.active ? "truncate text-sm font-medium" : "truncate text-sm text-muted line-through"}>{type.name}</p>
              <p className="text-xs text-muted">
                {type.clients} {type.clients === 1 ? "client" : "clients"}
              </p>
            </div>
            <form action={setDocumentTypeActive}>
              <input type="hidden" name="id" value={type.id} />
              <input type="hidden" name="active" value={String(!type.active)} />
              <Button type="submit" variant="ghost" size="sm" aria-label={`${type.active ? "Stop collecting" : "Collect again"}: ${type.name}`}>
                {type.active ? "Stop collecting" : "Collect again"}
              </Button>
            </form>
          </div>
        ))}
      </Card>
    </>
  );
}
