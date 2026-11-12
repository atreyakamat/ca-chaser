import { getMember } from "@/server/auth/dal";
import { isUuid, withFirm } from "@/server/db";
import { storage } from "@/server/storage";

/** Streams one uploaded file to a signed-in member of the firm that owns it. */
export async function GET(_request: Request, { params }: RouteContext<"/api/files/[id]">) {
  const member = await getMember();
  if (!member) return new Response("Sign in to download this file.", { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  const upload = await withFirm(member.firm.id, (db) =>
    db.one<{ storageKey: string; fileName: string; contentType: string }>(
      `select storage_key as "storageKey", file_name as "fileName", content_type as "contentType"
         from uploads where id = $1 and firm_id = $2`,
      [id, member.firm.id],
    ),
  );
  if (!upload) return new Response("Not found", { status: 404 });

  const bytes = await storage().get(upload.storageKey);
  return new Response(new Blob([bytes as BlobPart]), {
    headers: {
      "content-type": upload.contentType,
      // Always a download, never rendered inline on our origin.
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(upload.fileName)}`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
