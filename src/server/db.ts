import "server-only";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env";

// Keep calendar dates as "YYYY-MM-DD" strings and counts as numbers.
types.setTypeParser(types.builtins.DATE, (value) => value);
types.setTypeParser(types.builtins.INT8, (value) => Number(value));

const globalForDb = globalThis as unknown as { pgPool?: Pool };

function pool(): Pool {
  if (!globalForDb.pgPool) {
    globalForDb.pgPool = new Pool({ connectionString: env().DATABASE_URL, max: 5, idleTimeoutMillis: 10_000 });
  }
  return globalForDb.pgPool;
}

export type Db = {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
  one<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T | null>;
};

function wrap(client: PoolClient): Db {
  return {
    async query<T extends QueryResultRow>(text: string, params?: unknown[]) {
      return (await client.query<T>(text, params)).rows;
    },
    async one<T extends QueryResultRow>(text: string, params?: unknown[]) {
      const rows = (await client.query<T>(text, params)).rows;
      return rows.length > 0 ? rows[0] : null;
    },
  };
}

async function transaction<T>(setup: ((client: PoolClient) => Promise<void>) | null, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    if (setup) await setup(client);
    const result = await fn(wrap(client));
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Runs `fn` in a transaction that can only see and change one firm's rows.
 * Row-level security enforces this in the database, whatever the queries say.
 */
export function withFirm<T>(firmId: string, fn: (db: Db) => Promise<T>): Promise<T> {
  if (!isUuid(firmId)) throw new Error("withFirm needs a firm id");
  return transaction(async (client) => {
    await client.query("set local role app_user");
    await client.query("select set_config('app.firm_id', $1, true)", [firmId]);
  }, fn);
}

/**
 * Runs `fn` in a transaction with no tenant restriction. Only for code that has no firm yet
 * (sign-in, sign-up) or serves a verified public link or the scheduler.
 */
export function asSystem<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return transaction(null, fn);
}

export async function closePool(): Promise<void> {
  await globalForDb.pgPool?.end();
  globalForDb.pgPool = undefined;
}
