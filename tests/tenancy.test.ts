import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Firm } from "@/server/auth/dal";
import { closePool, withFirm } from "@/server/db";
import { addClient, addDocumentType, createFirm, deleteFirm, hasDatabase } from "./support/db";

describe.skipIf(!hasDatabase)("tenant isolation (row-level security)", () => {
  let a: Firm, b: Firm, clientA: string, clientB: string;

  beforeAll(async () => {
    a = await createFirm();
    b = await createFirm();
    clientA = await addClient(a.id, [await addDocumentType(a.id, "Sales invoices")], { name: "A's client" });
    clientB = await addClient(b.id, [await addDocumentType(b.id, "Sales invoices")], { name: "B's client" });
  });

  afterAll(async () => {
    await deleteFirm(a.id);
    await deleteFirm(b.id);
    await closePool();
  });

  it("shows a firm only its own rows, even with no WHERE clause", async () => {
    const rows = await withFirm(a.id, (db) => db.query<{ id: string }>("select id from clients"));
    expect(rows.map((r) => r.id)).toEqual([clientA]);
    const firms = await withFirm(a.id, (db) => db.query<{ id: string }>("select id from firms"));
    expect(firms.map((f) => f.id)).toEqual([a.id]);
    const types = await withFirm(a.id, (db) => db.query<{ firm_id: string }>("select firm_id from document_types"));
    expect(types.every((t) => t.firm_id === a.id)).toBe(true);
  });

  it("cannot read, change or delete another firm's rows by id", async () => {
    expect(await withFirm(a.id, (db) => db.query("select 1 from clients where id = $1", [clientB]))).toEqual([]);
    expect(await withFirm(a.id, (db) => db.query("update clients set name = 'hacked' where id = $1 returning id", [clientB]))).toEqual([]);
    expect(await withFirm(a.id, (db) => db.query("delete from clients where id = $1 returning id", [clientB]))).toEqual([]);
    const intact = await withFirm(b.id, (db) => db.one<{ name: string }>("select name from clients where id = $1", [clientB]));
    expect(intact?.name).toBe("B's client");
  });

  it("cannot write rows into another firm", async () => {
    await expect(
      withFirm(a.id, (db) => db.query("insert into clients (firm_id, name, email) values ($1, 'planted', 'x@example.com')", [b.id])),
    ).rejects.toThrow(/row-level security/);
    await expect(withFirm(a.id, (db) => db.query("update clients set firm_id = $1 where id = $2", [b.id, clientA]))).rejects.toThrow(/row-level security/);
  });

  it("cannot reach sign-in data or other firms' settings", async () => {
    await expect(withFirm(a.id, (db) => db.query("select * from users"))).rejects.toThrow(/permission denied/);
    await expect(withFirm(a.id, (db) => db.query("select * from auth_attempts"))).rejects.toThrow(/permission denied/);
    expect(await withFirm(a.id, (db) => db.query("update firms set name = 'x' where id = $1 returning id", [b.id]))).toEqual([]);
  });

  it("sees nothing for a firm id that does not exist, and rolls back on error", async () => {
    expect(await withFirm(randomUUID(), (db) => db.query("select 1 from clients"))).toEqual([]);
    await expect(
      withFirm(a.id, async (db) => {
        await db.query("update clients set name = 'changed' where id = $1", [clientA]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const row = await withFirm(a.id, (db) => db.one<{ name: string }>("select name from clients where id = $1", [clientA]));
    expect(row?.name).toBe("A's client");
  });

  it("rejects a requirement that mixes two firms' rows", async () => {
    const typeB = await addDocumentType(b.id, "Bank statement");
    await expect(
      withFirm(a.id, (db) => db.query("insert into client_requirements (firm_id, client_id, document_type_id) values ($1, $2, $3)", [a.id, clientA, typeB])),
    ).rejects.toThrow(/foreign key/);
  });
});
