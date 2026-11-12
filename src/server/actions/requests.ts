"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "../auth/dal";
import { isUuid, withFirm } from "../db";
import { text, type FormState } from "../form";
import type { Period } from "../periods";
import { remindClient, runForFirm } from "../reminders/engine";

const NUDGE_COOLDOWN_MINUTES = 10;

/** Opens the current month's requests now and sends the first message to every client who owes something. */
export async function openRequests(): Promise<void> {
  const member = await requireMember();
  await runForFirm(member.firm);
  revalidatePath("/app");
}

/** Sends one extra reminder to one client, at most once every few minutes. */
export async function nudgeClient(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const clientId = text(formData, "clientId");
  const periodId = text(formData, "periodId");
  if (!isUuid(clientId) || !isUuid(periodId)) return { error: "That client could not be found." };

  const found = await withFirm(member.firm.id, async (db) => {
    const period = await db.one<Period>(
      `select id, month, request_date as "requestDate", due_date as "dueDate" from periods where id = $1 and firm_id = $2`,
      [periodId, member.firm.id],
    );
    const recent = await db.one(
      `select 1 from reminder_log
        where client_id = $1 and period_id = $2 and kind = 'nudge' and created_at > now() - make_interval(mins => $3)`,
      [clientId, periodId, NUDGE_COOLDOWN_MINUTES],
    );
    return { period, recent: recent !== null };
  });
  if (!found.period) return { error: "That month could not be found." };
  if (found.recent) return { notice: "Already nudged a few minutes ago." };

  const outcome = await remindClient(member.firm, found.period, clientId, "nudge", null);
  revalidatePath("/app");
  switch (outcome) {
    case "sent":
      return { notice: "Reminder sent." };
    case "mock":
      return { notice: "Recorded (test mode, not sent)." };
    case "skipped":
      return { error: "Not sent. See Activity for the reason." };
    case "failed":
      return { error: "Sending failed. See Activity." };
    default:
      return { notice: "Nothing is pending for this client." };
  }
}

/** Lets the firm mark a document received (it arrived another way) or pending again (wrong file). */
export async function setRequestStatus(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = text(formData, "requestId");
  const status = text(formData, "status");
  if (!isUuid(id) || (status !== "pending" && status !== "received")) return;
  await withFirm(member.firm.id, (db) =>
    db.query(
      `update document_requests set status = $1, received_at = case when $1 = 'received' then coalesce(received_at, now()) end
        where id = $2 and firm_id = $3`,
      [status, id, member.firm.id],
    ),
  );
  revalidatePath("/app");
}
