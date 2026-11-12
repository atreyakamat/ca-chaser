"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, FileUp, LoaderCircle } from "lucide-react";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES } from "@/lib/files";
import { cn } from "@/lib/utils";

type Request = { id: string; name: string; status: "pending" | "received"; files: string[] };

const SHRINK_ABOVE_BYTES = 1.5 * 1024 * 1024;
const MAX_EDGE = 2200;

/** Phone photos are often 5 to 10 MB. Scale big images down in the browser so they upload fast. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size <= SHRINK_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function RequestCard({ token, request }: { token: string; request: Request }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const received = request.status === "received";

  async function sendFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    const files = [...list];
    let sent = 0;
    for (const original of files) {
      setBusy(`Sending ${sent + 1} of ${files.length}…`);
      const file = await shrinkImage(original);
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`"${original.name}" is over 5 MB. Please send a smaller copy.`);
        break;
      }
      const body = new FormData();
      body.set("requestId", request.id);
      body.set("file", file);
      try {
        const response = await fetch(`/api/u/${token}/upload`, { method: "POST", body });
        const result = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;
        if (!response.ok || !result?.ok) {
          setError(result?.error ?? "We couldn't save that file. Please try again.");
          break;
        }
        sent++;
      } catch {
        setError("You seem to be offline. Check your connection and try again.");
        break;
      }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    if (sent > 0) router.refresh();
  }

  return (
    <li className={cn("rounded-2xl border bg-surface p-4", received ? "border-accent/40" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">{request.name}</h2>
          <p className={cn("mt-0.5 text-sm", received ? "text-accent" : "text-muted")}>
            {received ? (
              <span className="inline-flex items-center gap-1">
                <Check className="size-4" aria-hidden /> Received
              </span>
            ) : (
              "Not sent yet"
            )}
          </p>
        </div>
        <label
          className={cn(
            "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
            received ? "border border-border bg-surface hover:bg-surface-raised" : "bg-accent text-accent-foreground hover:bg-accent/90",
            busy && "pointer-events-none opacity-60",
          )}
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          {received ? "Add more" : "Upload"}
          <input
            ref={input}
            type="file"
            multiple
            accept={ACCEPT_ATTRIBUTE}
            className="sr-only"
            disabled={busy !== null}
            aria-label={`Upload ${request.name}`}
            onChange={(event) => void sendFiles(event.target.files)}
          />
        </label>
      </div>

      {request.files.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted">
          {request.files.map((name, i) => (
            <li key={i} className="truncate">
              {name}
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="text-sm">
        {busy && <span className="mt-3 block text-muted">{busy}</span>}
        {error && <span className="mt-3 block rounded-lg bg-danger-soft px-3 py-2 text-danger">{error}</span>}
      </p>
    </li>
  );
}

export function UploadList({ token, requests }: { token: string; requests: Request[] }) {
  return (
    <ul className="space-y-3">
      {requests.map((request) => (
        <RequestCard key={request.id} token={token} request={request} />
      ))}
    </ul>
  );
}
