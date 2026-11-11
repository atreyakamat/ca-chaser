import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { requireMember } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const member = await requireMember();
  return <PageHeader title="Dashboard" description={member.firm.name} />;
}
