import "server-only";
import { addDays, formatDay, formatMonth, todayIn, type DateString } from "@/lib/dates";
import { activePeriodMonth, OVERDUE_OFFSETS, scheduledKind } from "@/lib/periods";
import { buildMessage, type MessageKind } from "@/lib/templates";
import type { Firm } from "../auth/dal";
import { asSystem, withFirm } from "../db";
import { uploadUrl } from "../links";
import { canDeliver, send, type Channel } from "../messaging";
import { ensurePeriod, type Period } from "../periods";

export type ReminderOutcome = "sent" | "mock" | "failed" | "skipped" | "duplicate" | "nothing-pending";

type Target = {
  clientName: string;
  phone: string | null;
  email: string | null;
  channel: Channel;
  whatsappOptIn: boolean;
  linkId: string | null;
  pending: string[];
};

/** Picks where a reminder can go, or explains why it can't. */
function route(target: Target): { channel: Channel; to: string } | { skip: string; channel: Channel } {
  const emailFallback = target.email ? { channel: "email" as const, to: target.email } : null;
  if (target.channel === "email") return emailFallback ?? { skip: "No email address on file", channel: "email" };
  if (!target.phone) return emailFallback ?? { skip: "No phone number on file", channel: "whatsapp" };
  if (!target.whatsappOptIn) return emailFallback ?? { skip: "Client has not agreed to WhatsApp reminders", channel: "whatsapp" };
  if (!canDeliver("whatsapp")) return emailFallback ?? { skip: "WhatsApp sending is not connected yet", channel: "whatsapp" };
  return { channel: "whatsapp", to: target.phone };
}

/**
 * Sends one reminder to one client about what they still owe for a period, and records it.
 * With a `dedupeKey`, a second call with the same key does nothing, so retries can't double-send.
 */
export async function remindClient(
  firm: Firm,
  period: Period,
  clientId: string,
  kind: MessageKind,
  dedupeKey: string | null,
): Promise<ReminderOutcome> {
  const claim = await withFirm(firm.id, async (db) => {
    const target = await db.one<Target>(
      `select c.name as "clientName", c.phone, c.email, c.channel, c.whatsapp_opt_in as "whatsappOptIn",
              (select l.id from upload_links l where l.client_id = c.id and l.period_id = $2) as "linkId",
              coalesce((select array_agg(d.name order by d.sort_order, d.name)
                          from document_requests q join document_types d on d.id = q.document_type_id
                         where q.client_id = c.id and q.period_id = $2 and q.status = 'pending'), '{}') as pending
         from clients c
        where c.id = $1 and c.firm_id = $3 and c.active`,
      [clientId, period.id, firm.id],
    );
    if (!target || target.pending.length === 0 || !target.linkId) return { outcome: "nothing-pending" as const };

    const message = buildMessage({
      kind,
      firmName: firm.name,
      clientName: target.clientName,
      monthLabel: formatMonth(period.month),
      dueLabel: formatDay(period.dueDate),
      pending: target.pending,
      link: uploadUrl(target.linkId),
    });
    const destination = route(target);
    const skipped = "skip" in destination;

    // Record first, send second: if two runs race, only the one that inserts the row sends.
    const row = await db.one<{ id: string }>(
      `insert into reminder_log (firm_id, client_id, period_id, kind, channel, status, detail, body, dedupe_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (dedupe_key) do nothing
       returning id`,
      [firm.id, clientId, period.id, kind, destination.channel, skipped ? "skipped" : "failed", skipped ? destination.skip : "Sending did not finish", message.text, dedupeKey],
    );
    if (!row) return { outcome: "duplicate" as const };
    if (skipped) return { outcome: "skipped" as const };
    return { outcome: "send" as const, logId: row.id, message, destination };
  });
  if (claim.outcome !== "send") return claim.outcome;

  const result = await send({ ...claim.destination, ...claim.message });
  await withFirm(firm.id, (db) =>
    db.query("update reminder_log set status = $1, detail = $2 where id = $3", [result.status, result.detail ?? null, claim.logId]),
  );
  return result.status;
}

export type RunSummary = Record<ReminderOutcome, number> & { period: DateString | null };

function emptySummary(): RunSummary {
  return { sent: 0, mock: 0, failed: 0, skipped: 0, duplicate: 0, "nothing-pending": 0, period: null };
}

/**
 * The daily job for one firm: opens the current period once its request date has arrived, then
 * messages every client who still owes documents if today is a scheduled day. A client who has
 * never been asked for this period gets the request straight away, so a missed day self-heals.
 */
export async function runForFirm(firm: Firm, now: Date = new Date()): Promise<RunSummary> {
  const summary = emptySummary();
  const today = todayIn(firm.timezone, now);
  const month = activePeriodMonth(today, { requestDay: firm.requestDay, dueDay: firm.dueDay, offsets: firm.offsets });

  const { period, clients } = await withFirm(firm.id, async (db) => {
    const period = await ensurePeriod(db, firm, month);
    const clients = await db.query<{ id: string; contacted: boolean }>(
      `select c.id,
              exists (select 1 from reminder_log r
                       where r.client_id = c.id and r.period_id = $1 and r.kind <> 'nudge') as contacted
         from clients c
        where c.firm_id = $2 and c.active
          and exists (select 1 from document_requests q where q.client_id = c.id and q.period_id = $1 and q.status = 'pending')
        order by c.name`,
      [period.id, firm.id],
    );
    return { period, clients };
  });
  summary.period = period.month;

  if (today > addDays(period.dueDate, Math.max(...OVERDUE_OFFSETS))) return summary;
  const scheduled = scheduledKind(today, period, firm.offsets);

  for (const client of clients) {
    const kind = client.contacted ? scheduled : today <= period.dueDate ? "request" : (scheduled ?? "overdue");
    if (!kind) continue;
    const outcome = await remindClient(firm, period, client.id, kind, `${period.id}:${client.id}:${today}`);
    summary[outcome]++;
  }
  return summary;
}

/** The daily job for every firm. One firm failing does not stop the others. */
export async function runDaily(now: Date = new Date()): Promise<{ firms: number; errors: number; totals: Omit<RunSummary, "period"> }> {
  const firms = await asSystem((db) =>
    db.query<Firm>(
      `select id, name, timezone, request_day as "requestDay", due_day as "dueDay", reminder_offsets as offsets from firms order by created_at`,
    ),
  );
  const totals: Omit<RunSummary, "period"> = { sent: 0, mock: 0, failed: 0, skipped: 0, duplicate: 0, "nothing-pending": 0 };
  let errors = 0;
  for (const firm of firms) {
    try {
      const summary = await runForFirm(firm, now);
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] += summary[key];
    } catch (error) {
      errors++;
      console.error(`Reminder run failed for firm ${firm.id}`, error);
    }
  }
  return { firms: firms.length, errors, totals };
}
