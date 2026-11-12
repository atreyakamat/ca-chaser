import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/app/settings-form";
import { Card } from "@/components/ui/card";
import { addMonths, formatDay, formatMonth, todayIn } from "@/lib/dates";
import { periodDates, reminderSchedule } from "@/lib/periods";
import { requireMember } from "@/server/auth/dal";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Settings" };

const KIND_LABEL = { request: "First request", followup: "Follow-up", overdue: "Overdue reminder" } as const;

export default async function SettingsPage() {
  const { firm, role } = await requireMember();
  const month = addMonths(todayIn(firm.timezone), 0);
  const schedule = reminderSchedule(periodDates(month, { requestDay: firm.requestDay, dueDay: firm.dueDay, offsets: firm.offsets }), firm.offsets);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-[1fr_18rem]">
        <Card className="p-6">
          <SettingsForm name={firm.name} requestDay={firm.requestDay} dueDay={firm.dueDay} offsets={firm.offsets} canEdit={role === "owner"} />
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold">Schedule for {formatMonth(month)} documents</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {schedule.map((item) => (
                <li key={item.date} className="flex justify-between gap-3">
                  <span className="text-muted">{KIND_LABEL[item.kind]}</span>
                  <span className="tabular-nums">{formatDay(item.date)}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">Reminders go out around 9 am and stop as soon as a client has sent everything.</p>
          </Card>
          <Card className="p-6 text-sm">
            <h2 className="font-semibold">Sending</h2>
            <p className="mt-2 text-muted">
              {env().MESSAGING_MODE === "mock"
                ? "Test mode. Reminders are recorded in Activity but not sent."
                : "Live. Reminders are sent by email. WhatsApp is not connected yet, so WhatsApp clients with an email address get email."}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
