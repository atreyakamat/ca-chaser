export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.xlsx,.xls,.csv,application/pdf,image/*";

type Kind = { ext: string; contentType: string; matches: (bytes: Uint8Array) => boolean };

const starts = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((b, i) => bytes[offset + i] === b);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

const KINDS: Record<string, Kind> = {
  pdf: { ext: "pdf", contentType: "application/pdf", matches: (b) => starts(b, ascii("%PDF-")) },
  jpg: { ext: "jpg", contentType: "image/jpeg", matches: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  jpeg: { ext: "jpg", contentType: "image/jpeg", matches: (b) => starts(b, [0xff, 0xd8, 0xff]) },
  png: { ext: "png", contentType: "image/png", matches: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47]) },
  webp: { ext: "webp", contentType: "image/webp", matches: (b) => starts(b, ascii("RIFF")) && starts(b, ascii("WEBP"), 8) },
  heic: { ext: "heic", contentType: "image/heic", matches: (b) => starts(b, ascii("ftyp"), 4) },
  xlsx: {
    ext: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    matches: (b) => starts(b, [0x50, 0x4b, 0x03, 0x04]),
  },
  xls: { ext: "xls", contentType: "application/vnd.ms-excel", matches: (b) => starts(b, [0xd0, 0xcf, 0x11, 0xe0]) },
  // Plain text: no NUL bytes in the first kilobyte.
  csv: { ext: "csv", contentType: "text/csv", matches: (b) => !b.subarray(0, 1024).includes(0) },
};

export type InspectedFile = { fileName: string; ext: string; contentType: string };

/** Strips paths and unusual characters so a client-chosen name is safe to store and show. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}._ ()-]/gu, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "")
    .trim();
  return (cleaned || "file").slice(-120);
}

/**
 * Checks an upload by size, extension and its first bytes. The content type we store comes from
 * this allowlist, never from the browser.
 */
export function inspectUpload(name: string, bytes: Uint8Array): { ok: true; file: InspectedFile } | { ok: false; error: string } {
  if (bytes.byteLength === 0) return { ok: false, error: "That file is empty." };
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "That file is over 5 MB. Please send a smaller copy." };
  const fileName = safeFileName(name);
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const kind = KINDS[ext];
  if (!kind) return { ok: false, error: "Please send a PDF, a photo, or an Excel or CSV file." };
  if (!kind.matches(bytes)) return { ok: false, error: "That file looks damaged or isn't the type its name says." };
  return { ok: true, file: { fileName, ext: kind.ext, contentType: kind.contentType } };
}
