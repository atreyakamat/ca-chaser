import { randomUUID } from "node:crypto";
import type { Firm } from "@/server/auth/dal";
import { asSystem } from "@/server/db";

export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

/** Creates an isolated firm with the default schedule (ask on the 1st, due on the 10th). */
export async function createFirm(name = `Test firm ${randomUUID().slice(0, 8)}`): Promise<Firm> {
  const row = await asSystem((db) => db.one<{ id: string }>("insert into firms (name) values ($1) returning id", [name]));
  return { id: row!.id, name, timezone: "Asia/Kolkata", requestDay: 1, dueDay: 10, offsets: [7, 3, 1] };
}

export async function addDocumentType(firmId: string, name: string): Promise<string> {
  const row = await asSystem((db) => db.one<{ id: string }>("insert into document_types (firm_id, name) values ($1, $2) returning id", [firmId, name]));
  return row!.id;
}

export async function addClient(
  firmId: string,
  documentTypeIds: string[],
  overrides: { name?: string; phone?: string | null; email?: string | null; channel?: "whatsapp" | "email"; optIn?: boolean } = {},
): Promise<string> {
  return asSystem(async (db) => {
    const email = overrides.email === undefined ? `${randomUUID().slice(0, 8)}@example.com` : overrides.email;
    const client = await db.one<{ id: string }>(
      `insert into clients (firm_id, name, phone, email, channel, whatsapp_opt_in) values ($1, $2, $3, $4, $5, $6) returning id`,
      [firmId, overrides.name ?? "Test client", overrides.phone ?? null, email, overrides.channel ?? "email", overrides.optIn ?? false],
    );
    await db.query(
      "insert into client_requirements (firm_id, client_id, document_type_id) select $1, $2, unnest($3::uuid[])",
      [firmId, client!.id, documentTypeIds],
    );
    return client!.id;
  });
}

export async function deleteFirm(firmId: string): Promise<void> {
  await asSystem((db) => db.query("delete from firms where id = $1", [firmId]));
}
