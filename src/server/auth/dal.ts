import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { asSystem, isUuid } from "../db";
import { readSession } from "./session";

export type Firm = {
  id: string;
  name: string;
  timezone: string;
  requestDay: number;
  dueDay: number;
  offsets: number[];
};

export type Member = {
  user: { id: string; name: string; email: string };
  firm: Firm;
  role: "owner" | "member";
};

type Row = {
  user_id: string;
  user_name: string;
  email: string;
  role: "owner" | "member";
  firm_id: string;
  firm_name: string;
  timezone: string;
  request_day: number;
  due_day: number;
  reminder_offsets: number[];
};

/**
 * Data access layer entry point. Checks the session cookie AND the membership in the database
 * on every request, so a removed member loses access immediately. Tenant queries must use the
 * firm id returned here, never an id sent by the browser.
 */
export const getMember = cache(async (): Promise<Member | null> => {
  const session = await readSession();
  if (!session || !isUuid(session.userId) || !isUuid(session.firmId)) return null;

  const row = await asSystem((db) =>
    db.one<Row>(
      `select u.id as user_id, u.name as user_name, u.email, m.role,
              f.id as firm_id, f.name as firm_name, f.timezone, f.request_day, f.due_day, f.reminder_offsets
         from firm_members m
         join users u on u.id = m.user_id
         join firms f on f.id = m.firm_id
        where m.user_id = $1 and m.firm_id = $2`,
      [session.userId, session.firmId],
    ),
  );
  if (!row) return null;

  return {
    user: { id: row.user_id, name: row.user_name, email: row.email },
    firm: {
      id: row.firm_id,
      name: row.firm_name,
      timezone: row.timezone,
      requestDay: row.request_day,
      dueDay: row.due_day,
      offsets: row.reminder_offsets,
    },
    role: row.role,
  };
});

export async function requireMember(): Promise<Member> {
  const member = await getMember();
  if (!member) redirect("/login");
  return member;
}
