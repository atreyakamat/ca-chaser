"use server";

import { revalidatePath } from "next/cache";
import { todayIn } from "@/lib/dates";
import { requireMember } from "../auth/dal";
import { isUuid, withFirm } from "../db";
import { text, type FormState } from "../form";
import { syncOpenPeriod } from "../periods";

const MAX_DOCUMENT_TYPES = 30;

export async function addDocumentType(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  const name = text(formData, "name").replace(/\s+/g, " ");
  if (!name || name.length > 80) return { error: "Enter a name of up to 80 characters." };
  const assignToAll = formData.get("assignToAll") === "on";

  const result = await withFirm(member.firm.id, async (db) => {
    const stats = await db.one<{ count: number; next: number }>(
      "select count(*) as count, coalesce(max(sort_order), 0) + 1 as next from document_types where firm_id = $1",
      [member.firm.id],
    );
    if ((stats?.count ?? 0) >= MAX_DOCUMENT_TYPES) return "limit" as const;
    const row = await db.one<{ id: string }>(
      "insert into document_types (firm_id, name, sort_order) values ($1, $2, $3) on conflict (firm_id, name) do nothing returning id",
      [member.firm.id, name, stats?.next ?? 1],
    );
    if (!row) return "duplicate" as const;
    if (assignToAll) {
      await db.query(
        "insert into client_requirements (firm_id, client_id, document_type_id) select firm_id, id, $2 from clients where firm_id = $1 and active",
        [member.firm.id, row.id],
      );
      await syncOpenPeriod(db, member.firm.id, todayIn(member.firm.timezone));
    }
    return "ok" as const;
  });
  if (result === "limit") return { error: `You can have up to ${MAX_DOCUMENT_TYPES} document types.` };
  if (result === "duplicate") return { error: "You already have a document with that name." };
  revalidatePath("/app/documents");
  return { notice: `Added "${name}".` };
}

export async function setDocumentTypeActive(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = text(formData, "id");
  if (!isUuid(id)) return;
  const active = formData.get("active") === "true";
  await withFirm(member.firm.id, async (db) => {
    await db.query("update document_types set active = $1 where id = $2 and firm_id = $3", [active, id, member.firm.id]);
    await syncOpenPeriod(db, member.firm.id, todayIn(member.firm.timezone));
  });
  revalidatePath("/app/documents");
}
