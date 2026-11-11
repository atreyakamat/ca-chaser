// Applies db/migrations/*.sql in order, once each. Safe to run repeatedly and concurrently.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

export async function migrate(connectionString, { log = console.log } = {}) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("select pg_advisory_lock(7241001)");
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const { rows } = await client.query("select name from schema_migrations");
    const done = new Set(rows.map((r) => r.name));
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      await client.query("begin");
      try {
        await client.query(readFileSync(path.join(dir, file), "utf8"));
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
        log(`applied ${file}`);
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(7241001)").catch(() => {});
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  migrate(url).then(
    () => console.log("migrations up to date"),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
