import "server-only";
import { addDays, type DateString } from "@/lib/dates";
import { LINK_GRACE_DAYS, periodDates } from "@/lib/periods";
import type { Firm } from "./auth/dal";
import type { Db } from "./db";

export type Period = { id: string; month: DateString; requestDate: DateString; dueDate: DateString };

const PERIOD_COLUMNS = `id, month, request_date as "requestDate", due_date as "dueDate"`;

/**
 * Brings a period's requests and upload links in line with what each active client owes:
 * adds what's missing and drops untouched requests that are no longer required.
 */
export async function syncRequests(db: Db, firmId: string, periodId: string): Promise<void> {
  await db.query(
    `insert into document_requests (firm_id, client_id, period_id, document_type_id)
     select r.firm_id, r.client_id, $2, r.document_type_id
       from client_requirements r
       join clients c on c.id = r.client_id
       join document_types d on d.id = r.document_type_id
      where r.firm_id = $1 and c.active and d.active
     on conflict (client_id, period_id, document_type_id) do nothing`,
    [firmId, periodId],
  );
  await db.query(
    `delete from document_requests q
      where q.firm_id = $1 and q.period_id = $2 and q.status = 'pending'
        and not exists (select 1 from uploads u where u.request_id = q.id)
        and not exists (
          select 1 from client_requirements r
            join clients c on c.id = r.client_id
            join document_types d on d.id = r.document_type_id
           where r.client_id = q.client_id and r.document_type_id = q.document_type_id and c.active and d.active)`,
    [firmId, periodId],
  );
  await db.query(
    `insert into upload_links (firm_id, client_id, period_id, expires_at)
     select distinct q.firm_id, q.client_id, q.period_id, (p.due_date + $3::int)::timestamptz
       from document_requests q join periods p on p.id = q.period_id
      where q.firm_id = $1 and q.period_id = $2
     on conflict (client_id, period_id) do nothing`,
    [firmId, periodId, LINK_GRACE_DAYS + 1],
  );
}

/** Creates the period for `month` if needed, then syncs its requests. */
export async function ensurePeriod(db: Db, firm: Firm, month: DateString): Promise<Period> {
  const dates = periodDates(month, { requestDay: firm.requestDay, dueDay: firm.dueDay, offsets: firm.offsets });
  await db.query(
    "insert into periods (firm_id, month, request_date, due_date) values ($1, $2, $3, $4) on conflict (firm_id, month) do nothing",
    [firm.id, dates.month, dates.requestDate, dates.dueDate],
  );
  const period = (await db.one<Period>(`select ${PERIOD_COLUMNS} from periods where firm_id = $1 and month = $2`, [firm.id, dates.month]))!;
  await syncRequests(db, firm.id, period.id);
  return period;
}

export function listPeriods(db: Db, firmId: string): Promise<Period[]> {
  return db.query<Period>(`select ${PERIOD_COLUMNS} from periods where firm_id = $1 order by month desc limit 24`, [firmId]);
}

/** After a client or checklist change, re-syncs the newest period while it is still being collected. */
export async function syncOpenPeriod(db: Db, firmId: string, today: DateString): Promise<void> {
  const latest = await db.one<Period>(`select ${PERIOD_COLUMNS} from periods where firm_id = $1 order by month desc limit 1`, [firmId]);
  if (latest && addDays(latest.dueDate, LINK_GRACE_DAYS) >= today) await syncRequests(db, firmId, latest.id);
}
