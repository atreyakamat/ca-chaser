import type { Metadata } from "next";
import { ImportForm } from "@/components/app/import-form";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Import clients" };

export default function ImportClientsPage() {
  return (
    <>
      <PageHeader
        title="Import clients"
        description={
          <>
            Save your list from Excel as CSV, or start from{" "}
            <a href="/clients-template.csv" download className="font-medium text-accent underline-offset-2 hover:underline">
              our template
            </a>
            . Every imported client is set to send all your active documents.
          </>
        }
      />
      <Card className="max-w-2xl p-6">
        <ImportForm />
      </Card>
    </>
  );
}
