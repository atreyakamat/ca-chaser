import { zipSync, type Zippable } from "fflate";
import { safeFileName } from "@/lib/files";
import { getMember } from "@/server/auth/dal";
import { isUuid, withFirm } from "@/server/db";
import { storage } from "@/server/storage";

const MAX_ZIP_BYTES = 150 * 1024 * 1024;

/** One client's files for one month as a ZIP, with a folder per document type. */
export async function GET(request: Request) {
  const member = await getMember();
  if (!member) return new Response("Sign in to download these files.", { status: 401 });
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client");
  const periodId = url.searchParams.get("period");
  if (!isUuid(clientId) || !isUuid(periodId)) return new Response("Not found", { status: 404 });

  const files = await withFirm(member.firm.id, (db) =>
    db.query<{ storageKey: string; fileName: string; sizeBytes: number; folder: string; clientName: string; month: string }>(
      `select u.storage_key as "storageKey", u.file_name as "fileName", u.size_bytes as "sizeBytes",
              d.name as folder, c.name as "clientName", p.month
         from uploads u
         join document_requests q on q.id = u.request_id
         join document_types d on d.id = q.document_type_id
         join clients c on c.id = q.client_id
         join periods p on p.id = q.period_id
        where u.firm_id = $1 and q.client_id = $2 and q.period_id = $3
        order by d.sort_order, u.created_at`,
      [member.firm.id, clientId, periodId],
    ),
  );
  if (files.length === 0) return new Response("No files have been received yet.", { status: 404 });
  if (files.reduce((sum, f) => sum + f.sizeBytes, 0) > MAX_ZIP_BYTES) {
    return new Response("These files are too large to zip together. Download them one at a time.", { status: 413 });
  }

  const store = storage();
  const entries: Zippable = {};
  for (const file of files) {
    const folder = safeFileName(file.folder);
    let name = `${folder}/${file.fileName}`;
    for (let n = 2; name in entries; n++) name = `${folder}/${n}-${file.fileName}`;
    // Most uploads are already compressed (PDF, JPEG, XLSX), so store them as they are.
    entries[name] = [await store.get(file.storageKey), { level: 0 }];
  }
  const zipName = safeFileName(`${files[0].clientName} ${files[0].month.slice(0, 7)}.zip`);
  return new Response(new Blob([zipSync(entries) as BlobPart]), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`,
      "cache-control": "private, no-store",
    },
  });
}
