"use server";

import { redirect } from "next/navigation";
import { MAX_IMPORT_ROWS, parseClientCsv } from "@/lib/csv";
import { todayIn } from "@/lib/dates";
import { parseClient } from "@/lib/validation";
import { requireMember } from "../auth/dal";
import { isUuid, withFirm } from "../db";
import { text, type FormState } from "../form";
import { syncOpenPeriod } from "../periods";

const MAX_CSV_BYTES = 512 * 1024;

export async function saveClient(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const id = text(formData, "id");
  const values = Object.fromEntries(["name", "phone", "email", "gstin", "channel"].map((key) => [key, text(formData, key)]));
  if (id && !isUuid(id)) return { error: "That client could not be found.", values };

  const parsed = parseClient({ ...values, whatsappOptIn: formData.get("whatsappOptIn") === "on" });
  if (!parsed.ok) return { error: parsed.error, values };
  const client = parsed.value;
  const requirements = formData.getAll("requirements").filter(isUuid);
  const active = id ? formData.get("active") === "on" : true;

  const saved = await withFirm(member.firm.id, async (db) => {
    const fields = [client.name, client.phone, client.email, client.gstin, client.channel, client.whatsappOptIn, active];
    const row = id
      ? await db.one<{ id: string }>(
          `update clients set name = $1, phone = $2, email = $3, gstin = $4, channel = $5, whatsapp_opt_in = $6, active = $7
            where id = $8 and firm_id = $9 returning id`,
          [...fields, id, member.firm.id],
        )
      : await db.one<{ id: string }>(
          `insert into clients (name, phone, email, gstin, channel, whatsapp_opt_in, active, firm_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
          [...fields, member.firm.id],
        );
    if (!row) return false;

    await db.query("delete from client_requirements where client_id = $1 and firm_id = $2", [row.id, member.firm.id]);
    await db.query(
      `insert into client_requirements (firm_id, client_id, document_type_id)
       select firm_id, $2, id from document_types where firm_id = $1 and id = any($3::uuid[])`,
      [member.firm.id, row.id, requirements],
    );
    await syncOpenPeriod(db, member.firm.id, todayIn(member.firm.timezone));
    return true;
  });
  if (!saved) return { error: "That client could not be found.", values };
  redirect("/app/clients");
}

export async function importClients(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file to import." };
  if (file.size > MAX_CSV_BYTES) return { error: "That file is too large. Import up to 1,000 clients at a time." };

  const { clients, errors } = parseClientCsv(await file.text());
  if (errors.length > 0) {
    const shown = errors.slice(0, 8).map((e) => `Line ${e.line}: ${e.message}`);
    const more = errors.length > shown.length ? ` And ${errors.length - shown.length} more.` : "";
    return { error: `Nothing was imported. Fix these and try again. ${shown.join(" ")}${more}` };
  }
  if (clients.length === 0) return { error: "That file has no clients in it." };
  const optIn = formData.get("whatsappOptIn") === "on";

  const added = await withFirm(member.firm.id, async (db) => {
    const existing = await db.one<{ count: number }>("select count(*) as count from clients where firm_id = $1", [member.firm.id]);
    if ((existing?.count ?? 0) + clients.length > MAX_IMPORT_ROWS * 5) return -1;

    // Skip rows whose phone or email is already on file, and repeats within the file itself.
    const inserted = await db.query<{ id: string }>(
      `with incoming as (
         select distinct on (coalesce(phone, email)) *
           from jsonb_to_recordset($2::jsonb) as t(name text, phone text, email text, gstin text, channel text)
       )
       insert into clients (firm_id, name, phone, email, gstin, channel, whatsapp_opt_in)
       select $1, i.name, i.phone, i.email, i.gstin, i.channel, $3 and i.phone is not null
         from incoming i
        where not exists (
          select 1 from clients c
           where c.firm_id = $1 and ((i.phone is not null and c.phone = i.phone) or (i.email is not null and c.email = i.email)))
       returning id`,
      [member.firm.id, JSON.stringify(clients), optIn],
    );
    await db.query(
      `insert into client_requirements (firm_id, client_id, document_type_id)
       select d.firm_id, c.id, d.id from unnest($2::uuid[]) as c(id) cross join document_types d
        where d.firm_id = $1 and d.active`,
      [member.firm.id, inserted.map((r) => r.id)],
    );
    await syncOpenPeriod(db, member.firm.id, todayIn(member.firm.timezone));
    return inserted.length;
  });
  if (added === -1) return { error: "That would take you past the client limit. Contact us to raise it." };

  const skipped = clients.length - added;
  redirect(`/app/clients?imported=${added}${skipped > 0 ? `&skipped=${skipped}` : ""}`);
}
