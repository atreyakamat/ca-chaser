import { rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signLinkToken } from "@/lib/link-token";
import type { Firm } from "@/server/auth/dal";
import { asSystem, closePool, withFirm } from "@/server/db";
import { syncOpenPeriod } from "@/server/periods";
import { runForFirm } from "@/server/reminders/engine";
import { acceptUpload, loadUploadContext } from "@/server/uploads";
import { addClient, addDocumentType, createFirm, deleteFirm, hasDatabase } from "./support/db";

// 09:00 IST on the given November 2026 day.
const day = (d: number) => new Date(`2026-11-${String(d).padStart(2, "0")}T03:30:00Z`);
const PDF = new TextEncoder().encode("%PDF-1.7 test");

describe.skipIf(!hasDatabase)("reminder engine and upload links", () => {
  let firm: Firm, sales: string, bank: string, emailClient: string, noConsent: string;

  const logs = (clientId: string) =>
    withFirm(firm.id, (db) => db.query<{ kind: string; status: string; channel: string; body: string }>("select kind, status, channel, body from reminder_log where client_id = $1 order by created_at", [clientId]));
  const tokenFor = async (clientId: string) => {
    const link = await withFirm(firm.id, (db) => db.one<{ id: string }>("select id from upload_links where client_id = $1", [clientId]));
    return signLinkToken(link!.id, process.env.SESSION_SECRET!);
  };

  beforeAll(async () => {
    firm = await createFirm("Kamat & Associates");
    sales = await addDocumentType(firm.id, "Sales invoices");
    bank = await addDocumentType(firm.id, "Bank statement");
    emailClient = await addClient(firm.id, [sales, bank], { name: "Email Client" });
    noConsent = await addClient(firm.id, [sales], { name: "No Consent", phone: "+919876543210", email: null, channel: "whatsapp", optIn: false });
  });

  afterAll(async () => {
    await rm(path.join(process.cwd(), ".data", "uploads", firm.id), { recursive: true, force: true });
    await deleteFirm(firm.id);
    await closePool();
  });

  it("opens October's requests on 1 November and asks each client once", async () => {
    const summary = await runForFirm(firm, day(1));
    expect(summary).toMatchObject({ period: "2026-10-01", mock: 1, skipped: 1 });

    const sent = await logs(emailClient);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ kind: "request", status: "mock", channel: "email" });
    expect(sent[0].body).toContain("- Bank statement\n- Sales invoices");
    expect(sent[0].body).toMatch(/\/u\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it("never messages a client on WhatsApp without recorded consent", async () => {
    expect(await logs(noConsent)).toMatchObject([{ kind: "request", status: "skipped", channel: "whatsapp" }]);
  });

  it("does not send twice when the job runs again the same day", async () => {
    const summary = await runForFirm(firm, day(1));
    expect(summary).toMatchObject({ mock: 0, duplicate: 2 });
    expect(await logs(emailClient)).toHaveLength(1);
  });

  it("stays quiet on unscheduled days and follows up on scheduled ones", async () => {
    expect(await runForFirm(firm, day(2))).toMatchObject({ mock: 0, duplicate: 0 });
    expect(await runForFirm(firm, day(3))).toMatchObject({ mock: 1 });
    expect((await logs(emailClient)).map((l) => l.kind)).toEqual(["request", "followup"]);
  });

  it("asks a client added mid-month straight away", async () => {
    const late = await addClient(firm.id, [bank], { name: "Late Joiner" });
    await withFirm(firm.id, (db) => syncOpenPeriod(db, firm.id, "2026-11-05"));
    expect(await runForFirm(firm, day(5))).toMatchObject({ mock: 1 });
    expect(await logs(late)).toMatchObject([{ kind: "request" }]);
  });

  it("shows the client what is pending and accepts their files", async () => {
    const token = await tokenFor(emailClient);
    const before = await loadUploadContext(token);
    expect(before).toMatchObject({ firmName: "Kamat & Associates", clientName: "Email Client", month: "2026-10-01", dueDate: "2026-11-10" });
    expect(before!.requests.map((r) => [r.name, r.status])).toEqual([
      ["Bank statement", "pending"],
      ["Sales invoices", "pending"],
    ]);

    for (const request of before!.requests) {
      expect(await acceptUpload(token, request.id, `${request.name}.pdf`, PDF)).toEqual({ ok: true });
    }
    const after = await loadUploadContext(token);
    expect(after!.requests.every((r) => r.status === "received" && r.files.length === 1)).toBe(true);
  });

  it("stops reminding once everything is in", async () => {
    await runForFirm(firm, day(7));
    expect((await logs(emailClient)).map((l) => l.kind)).toEqual(["request", "followup"]);
  });

  it("rejects bad tokens, bad files and other clients' documents", async () => {
    const token = await tokenFor(noConsent);
    const mine = (await loadUploadContext(token))!.requests[0].id;
    const theirs = (await loadUploadContext(await tokenFor(emailClient)))!.requests[0].id;

    expect(await loadUploadContext("not-a-token")).toBeNull();
    expect(await loadUploadContext(signLinkToken("00000000-0000-4000-8000-000000000000", process.env.SESSION_SECRET!))).toBeNull();
    expect(await acceptUpload(token, theirs, "a.pdf", PDF)).toMatchObject({ ok: false, status: 400 });
    expect(await acceptUpload(token, mine, "a.exe", PDF)).toMatchObject({ ok: false, status: 400 });
    expect(await acceptUpload(token, mine, "a.pdf", new TextEncoder().encode("not a pdf"))).toMatchObject({ ok: false, status: 400 });
    expect(await acceptUpload("not-a-token", mine, "a.pdf", PDF)).toMatchObject({ ok: false, status: 404 });
  });

  it("turns links off when they expire or the client is made inactive", async () => {
    const token = await tokenFor(noConsent);
    const mine = (await loadUploadContext(token))!.requests[0].id;
    await asSystem((db) => db.query("update upload_links set expires_at = now() - interval '1 minute' where client_id = $1", [noConsent]));
    expect(await loadUploadContext(token)).toBeNull();
    expect(await acceptUpload(token, mine, "a.pdf", PDF)).toMatchObject({ ok: false, status: 404 });

    await asSystem((db) => db.query("update upload_links set expires_at = now() + interval '1 day' where client_id = $1", [noConsent]));
    expect(await loadUploadContext(token)).not.toBeNull();
    await asSystem((db) => db.query("update clients set active = false where id = $1", [noConsent]));
    expect(await loadUploadContext(token)).toBeNull();
  });

  it("sends overdue reminders, then goes quiet for good", async () => {
    const stillPending = await addClient(firm.id, [sales], { name: "Slow Payer" });
    await withFirm(firm.id, (db) => syncOpenPeriod(db, firm.id, "2026-11-09"));
    await runForFirm(firm, day(9));
    // Slow Payer and Late Joiner both still owe documents two days after the due date.
    expect(await runForFirm(firm, day(12))).toMatchObject({ mock: 2 });
    expect((await logs(stillPending)).map((l) => l.kind)).toEqual(["request", "overdue"]);
    expect(await runForFirm(firm, day(20))).toMatchObject({ mock: 0, skipped: 0 });
  });
});
