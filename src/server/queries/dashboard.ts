import "server-only";
import type { Db } from "../db";

export type Cell = { requestId: string; status: "pending" | "received" };

export type Board = {
  columns: { id: string; name: string }[];
  rows: {
    clientId: string;
    clientName: string;
    linkId: string | null;
    lastReminderAt: Date | null;
    cells: Record<string, Cell>;
    pending: number;
  }[];
};

/** The month's grid: one row per client, one column per document type in use. */
export async function getBoard(db: Db, firmId: string, periodId: string): Promise<Board> {
  const requests = await db.query<{
    id: string;
    clientId: string;
    clientName: string;
    typeId: string;
    typeName: string;
    status: "pending" | "received";
    linkId: string | null;
    lastReminderAt: Date | null;
  }>(
    `select q.id, c.id as "clientId", c.name as "clientName", d.id as "typeId", d.name as "typeName", q.status,
            (select l.id from upload_links l where l.client_id = c.id and l.period_id = q.period_id) as "linkId",
            (select max(r.created_at) from reminder_log r
              where r.client_id = c.id and r.period_id = q.period_id and r.status in ('sent', 'mock')) as "lastReminderAt"
       from document_requests q
       join clients c on c.id = q.client_id
       join document_types d on d.id = q.document_type_id
      where q.firm_id = $1 and q.period_id = $2
      order by lower(c.name), c.id, d.sort_order, d.name`,
    [firmId, periodId],
  );

  const columns = new Map<string, string>();
  const rows = new Map<string, Board["rows"][number]>();
  for (const r of requests) {
    columns.set(r.typeId, r.typeName);
    let row = rows.get(r.clientId);
    if (!row) {
      row = { clientId: r.clientId, clientName: r.clientName, linkId: r.linkId, lastReminderAt: r.lastReminderAt, cells: {}, pending: 0 };
      rows.set(r.clientId, row);
    }
    row.cells[r.typeId] = { requestId: r.id, status: r.status };
    if (r.status === "pending") row.pending++;
  }
  // Columns follow the firm's own ordering of document types.
  const order = await db.query<{ id: string }>("select id from document_types where firm_id = $1 order by sort_order, name", [firmId]);
  return {
    columns: order.filter((t) => columns.has(t.id)).map((t) => ({ id: t.id, name: columns.get(t.id)! })),
    rows: [...rows.values()],
  };
}

export type ClientRequest = {
  id: string;
  name: string;
  status: "pending" | "received";
  uploads: { id: string; fileName: string; sizeBytes: number; createdAt: string }[];
};

/** One client's documents for a period, with the files received for each. */
export function getClientRequests(db: Db, firmId: string, clientId: string, periodId: string): Promise<ClientRequest[]> {
  return db.query<ClientRequest>(
    `select q.id, d.name, q.status,
            coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'fileName', u.file_name, 'sizeBytes', u.size_bytes, 'createdAt', u.created_at)
                                       order by u.created_at)
                        from uploads u where u.request_id = q.id), '[]') as uploads
       from document_requests q join document_types d on d.id = q.document_type_id
      where q.firm_id = $1 and q.client_id = $2 and q.period_id = $3
      order by d.sort_order, d.name`,
    [firmId, clientId, periodId],
  );
}
