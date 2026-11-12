import "server-only";
import { z } from "zod";

const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
    /** Shared secret the scheduler sends to /api/cron/reminders. The endpoint is disabled without it. */
    CRON_SECRET: optional,
    /** "local" writes to .data/uploads (development only); "supabase" uses Supabase Storage. */
    STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
    SUPABASE_URL: optional,
    SUPABASE_SERVICE_ROLE_KEY: optional,
    STORAGE_BUCKET: z.string().default("client-documents"),
    /** "mock" records every message without sending it; "live" sends email through Resend. */
    MESSAGING_MODE: z.enum(["mock", "live"]).default("mock"),
    RESEND_API_KEY: optional,
    EMAIL_FROM: optional,
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER === "supabase" && (!value.SUPABASE_URL || !value.SUPABASE_SERVICE_ROLE_KEY)) {
      ctx.addIssue({ code: "custom", path: ["STORAGE_DRIVER"], message: "supabase storage needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY" });
    }
    if (value.MESSAGING_MODE === "live" && (!value.RESEND_API_KEY || !value.EMAIL_FROM)) {
      ctx.addIssue({ code: "custom", path: ["MESSAGING_MODE"], message: "live messaging needs RESEND_API_KEY and EMAIL_FROM" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Validated server environment. Throws a readable error on first use if misconfigured. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\nSee .env.example.`);
  }
  cached = parsed.data;
  return cached;
}
