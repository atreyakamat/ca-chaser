import { MAX_UPLOAD_BYTES } from "@/lib/files";
import { acceptUpload } from "@/server/uploads";

const json = (status: number, body: { ok: boolean; error?: string }) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request, { params }: RouteContext<"/api/u/[token]/upload">) {
  const { token } = await params;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) return json(413, { ok: false, error: "That file is over 5 MB. Please send a smaller copy." });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, error: "The upload didn't arrive properly. Please try again." });
  }
  const file = form.get("file");
  const requestId = form.get("requestId");
  if (!(file instanceof File) || typeof requestId !== "string") return json(400, { ok: false, error: "Choose a file to send." });
  if (file.size > MAX_UPLOAD_BYTES) return json(413, { ok: false, error: "That file is over 5 MB. Please send a smaller copy." });

  try {
    const result = await acceptUpload(token, requestId, file.name, new Uint8Array(await file.arrayBuffer()));
    return result.ok ? json(200, { ok: true }) : json(result.status, { ok: false, error: result.error });
  } catch (error) {
    console.error("Upload failed", error);
    return json(500, { ok: false, error: "We couldn't save that file. Please try again." });
  }
}
