"use server";

import { revalidatePath } from "next/cache";
import { validateSchedule } from "@/lib/periods";
import { requireMember } from "../auth/dal";
import { withFirm } from "../db";
import { text, type FormState } from "../form";

export async function saveSettings(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireMember();
  if (member.role !== "owner") return { error: "Only the firm owner can change settings." };

  const name = text(formData, "name");
  if (!name || name.length > 120) return { error: "Enter your firm's name." };
  const requestDay = Number(text(formData, "requestDay"));
  const dueDay = Number(text(formData, "dueDay"));
  const rawOffsets = text(formData, "offsets");
  const offsets = rawOffsets ? rawOffsets.split(/[\s,]+/).filter(Boolean).map(Number) : [];
  const problem = validateSchedule({ requestDay, dueDay, offsets });
  if (problem) return { error: problem };
  const unique = [...new Set(offsets)].sort((a, b) => b - a);

  await withFirm(member.firm.id, (db) =>
    db.query("update firms set name = $1, request_day = $2, due_day = $3, reminder_offsets = $4 where id = $5", [name, requestDay, dueDay, unique, member.firm.id]),
  );
  revalidatePath("/app", "layout");
  return { notice: "Saved. Changes apply from the next month's requests." };
}
