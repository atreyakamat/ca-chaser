import { parseClient, type ClientInput } from "./validation";

export const MAX_IMPORT_ROWS = 1000;

/** RFC 4180 parser: quoted fields, escaped quotes, CRLF or LF, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const HEADER_ALIASES: Record<string, "name" | "phone" | "email" | "gstin" | "channel"> = {
  name: "name",
  "client name": "name",
  client: "name",
  phone: "phone",
  mobile: "phone",
  whatsapp: "phone",
  "phone number": "phone",
  "mobile number": "phone",
  email: "email",
  "email address": "email",
  gstin: "gstin",
  gst: "gstin",
  "gst number": "gstin",
  channel: "channel",
};

export type ImportResult = {
  clients: ClientInput[];
  errors: { line: number; message: string }[];
};

/** Turns a CSV with a header row into validated clients, reporting every bad line. */
export function parseClientCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { clients: [], errors: [{ line: 1, message: "The file is empty." }] };

  const columns = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  if (!columns.includes("name")) {
    return { clients: [], errors: [{ line: 1, message: 'The first row must have a "name" column.' }] };
  }
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    return { clients: [], errors: [{ line: 1, message: `Import at most ${MAX_IMPORT_ROWS} clients at a time.` }] };
  }

  const clients: ClientInput[] = [];
  const errors: ImportResult["errors"] = [];
  rows.slice(1).forEach((cells, index) => {
    const raw: Record<string, string> = {};
    columns.forEach((column, i) => {
      if (column && raw[column] === undefined) raw[column] = cells[i] ?? "";
    });
    const parsed = parseClient(raw);
    if (parsed.ok) clients.push(parsed.value);
    else errors.push({ line: index + 2, message: parsed.error });
  });
  return { clients, errors };
}
