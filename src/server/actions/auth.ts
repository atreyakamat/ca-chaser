"use server";

import { redirect } from "next/navigation";
import { normalizeEmail } from "@/lib/validation";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSession, destroySession } from "../auth/session";
import { asSystem } from "../db";
import { text, type FormState } from "../form";

const DEFAULT_DOCUMENT_TYPES = ["Sales invoices", "Purchase invoices", "Bank statement", "TDS challans"];
const MAX_FAILED_ATTEMPTS = 5;
// Compared against when the email is unknown, so a miss takes as long as a wrong password.
const DUMMY_HASH = hashPassword("not-a-real-password");

export async function signup(_previous: FormState, formData: FormData): Promise<FormState> {
  const firmName = text(formData, "firmName");
  const name = text(formData, "name");
  const email = normalizeEmail(text(formData, "email"));
  const password = String(formData.get("password") ?? "");
  const values = { firmName, name, email: text(formData, "email") };

  if (!firmName || firmName.length > 120) return { error: "Enter your firm's name.", values };
  if (!name || name.length > 120) return { error: "Enter your name.", values };
  if (!email) return { error: "Enter a valid email address.", values };
  if (password.length < 10) return { error: "Use a password of at least 10 characters.", values };
  if (password.length > 200) return { error: "That password is too long.", values };

  const passwordHash = await hashPassword(password);
  const created = await asSystem(async (db) => {
    const user = await db.one<{ id: string }>(
      "insert into users (email, name, password_hash) values ($1, $2, $3) on conflict (email) do nothing returning id",
      [email, name, passwordHash],
    );
    if (!user) return null;
    const firm = (await db.one<{ id: string }>("insert into firms (name) values ($1) returning id", [firmName]))!;
    await db.query("insert into firm_members (firm_id, user_id, role) values ($1, $2, 'owner')", [firm.id, user.id]);
    await db.query(
      "insert into document_types (firm_id, name, sort_order) select $1, name, ord from unnest($2::text[]) with ordinality as t(name, ord)",
      [firm.id, DEFAULT_DOCUMENT_TYPES],
    );
    return { userId: user.id, firmId: firm.id };
  });
  if (!created) return { error: "An account with that email already exists. Sign in instead.", values };

  await createSession(created);
  redirect("/app");
}

export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = text(formData, "email");
  const email = normalizeEmail(rawEmail);
  const password = String(formData.get("password") ?? "");
  const values = { email: rawEmail };
  const invalid = { error: "That email and password don't match.", values };
  if (!email || !password || password.length > 200) return invalid;

  const found = await asSystem(async (db) => {
    const failures = await db.one<{ count: number }>(
      "select count(*) as count from auth_attempts where email = $1 and not succeeded and created_at > now() - interval '15 minutes'",
      [email],
    );
    if ((failures?.count ?? 0) >= MAX_FAILED_ATTEMPTS) return "locked" as const;
    return db.one<{ id: string; password_hash: string; firm_id: string }>(
      `select u.id, u.password_hash, m.firm_id
         from users u join firm_members m on m.user_id = u.id
        where u.email = $1
        order by m.created_at
        limit 1`,
      [email],
    );
  });
  if (found === "locked") return { error: "Too many attempts. Try again in 15 minutes.", values };

  const ok = await verifyPassword(password, found?.password_hash ?? (await DUMMY_HASH));
  const succeeded = ok && found !== null;
  await asSystem(async (db) => {
    await db.query("insert into auth_attempts (email, succeeded) values ($1, $2)", [email, succeeded]);
    await db.query("delete from auth_attempts where created_at < now() - interval '1 day'");
  });
  if (!succeeded) return invalid;

  await createSession({ userId: found.id, firmId: found.firm_id });
  redirect("/app");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
