import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/server/env";
import { runDaily } from "@/server/reminders/engine";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Daily reminder run. Called by the scheduler with the shared secret; safe to call again the same day. */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const given = request.headers.get("authorization") ?? "";
  if (!timingSafeEqual(digest(given), digest(`Bearer ${secret}`))) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runDaily();
  return Response.json(result, { status: result.errors > 0 ? 500 : 200, headers: { "cache-control": "no-store" } });
}
