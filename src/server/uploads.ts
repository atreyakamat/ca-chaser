import "server-only";
import { randomUUID } from "node:crypto";
import type { DateString } from "@/lib/dates";
import { inspectUpload } from "@/lib/files";
import { asSystem, isUuid } from "./db";
import { linkIdFromToken } from "./links";
import { storage } from "./storage";

const MAX_FILES_PER_LINK = 100;

export type UploadContext = {
  firmName: string;
  clientName: string;
  month: DateString;
  dueDate: DateString;
  requests: { id: string; name: string; status: "pending" | "received"; files: string[] }[];
};

type LinkRow = { firmId: string; clientId: string; periodId: string; firmName: string; clientName: string; month: DateString; dueDate: DateString };

const LINK_QUERY = `
  select l.firm_id as "firmId", l.client_id as "clientId", l.period_id as "periodId",
         f.name as "firmName", c.name as "clientName", p.month, p.due_date as "dueDate"
    from upload_links l
    join firms f on f.id = l.firm_id
    join clients c on c.id = l.client_id
    join periods p on p.id = l.period_id
   where l.id = $1 and l.expires_at > now() and c.active`;

/**
 * Everything the public upload page shows for a link. The signed token is the only credential,
 * so every query here is pinned to the link's own client and period.
 */
export async function loadUploadContext(token: string): Promise<UploadContext | null> {
  const linkId = linkIdFromToken(token);
  if (!linkId) return null;
  return asSystem(async (db) => {
    const link = await db.one<LinkRow>(LINK_QUERY, [linkId]);
    if (!link) return null;
    const requests = await db.query<UploadContext["requests"][number]>(
      `select q.id, d.name, q.status,
              coalesce((select array_agg(u.file_name order by u.created_at) from uploads u where u.request_id = q.id), '{}') as files
         from document_requests q join document_types d on d.id = q.document_type_id
        where q.client_id = $1 and q.period_id = $2
        order by d.sort_order, d.name`,
      [link.clientId, link.periodId],
    );
    return { firmName: link.firmName, clientName: link.clientName, month: link.month, dueDate: link.dueDate, requests };
  });
}

export type UploadResult = { ok: true } | { ok: false; status: number; error: string };

/** Validates and stores one file sent through an upload link, and marks its document received. */
export async function acceptUpload(token: string, requestId: string, name: string, bytes: Uint8Array): Promise<UploadResult> {
  const expired: UploadResult = { ok: false, status: 404, error: "This link has expired. Ask your CA for a new one." };
  const linkId = linkIdFromToken(token);
  if (!linkId) return expired;
  if (!isUuid(requestId)) return { ok: false, status: 400, error: "Choose which document this file is for." };

  const inspected = inspectUpload(name, bytes);
  if (!inspected.ok) return { ok: false, status: 400, error: inspected.error };
  const { file } = inspected;

  const target = await asSystem(async (db) => {
    const link = await db.one<LinkRow>(LINK_QUERY, [linkId]);
    if (!link) return "expired" as const;
    const request = await db.one("select 1 from document_requests where id = $1 and client_id = $2 and period_id = $3", [
      requestId,
      link.clientId,
      link.periodId,
    ]);
    if (!request) return "no-request" as const;
    const count = await db.one<{ count: number }>(
      `select count(*) as count from uploads u join document_requests q on q.id = u.request_id
        where q.client_id = $1 and q.period_id = $2`,
      [link.clientId, link.periodId],
    );
    if ((count?.count ?? 0) >= MAX_FILES_PER_LINK) return "full" as const;
    return link;
  });
  if (target === "expired") return expired;
  if (target === "no-request") return { ok: false, status: 400, error: "Choose which document this file is for." };
  if (target === "full") return { ok: false, status: 429, error: "You've reached the file limit for this month. Contact your CA." };

  const key = `${target.firmId}/${target.month.slice(0, 7)}/${target.clientId}/${randomUUID()}.${file.ext}`;
  await storage().put(key, bytes, file.contentType);
  try {
    await asSystem(async (db) => {
      await db.query(
        `insert into uploads (firm_id, request_id, storage_key, file_name, content_type, size_bytes)
         values ($1, $2, $3, $4, $5, $6)`,
        [target.firmId, requestId, key, file.fileName, file.contentType, bytes.byteLength],
      );
      await db.query("update document_requests set status = 'received', received_at = coalesce(received_at, now()) where id = $1", [requestId]);
    });
  } catch (error) {
    await storage().remove(key).catch(() => {});
    throw error;
  }
  return { ok: true };
}
