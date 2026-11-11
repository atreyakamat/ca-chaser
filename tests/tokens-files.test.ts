import { describe, expect, it } from "vitest";
import { inspectUpload, MAX_UPLOAD_BYTES, safeFileName } from "@/lib/files";
import { signLinkToken, verifyLinkToken } from "@/lib/link-token";
import { buildMessage } from "@/lib/templates";
import { hashPassword, verifyPassword } from "@/server/auth/password";

const ID = "3f2b8c1e-9d4a-4f6b-8a2c-1e5d7f9b0c3a";
const SECRET = "a-test-secret-that-is-long-enough-000";

describe("link tokens", () => {
  it("round-trips and is URL safe", () => {
    const token = signLinkToken(ID, SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(verifyLinkToken(token, SECRET)).toBe(ID);
  });

  it("rejects forged, altered and malformed tokens", () => {
    const token = signLinkToken(ID, SECRET);
    const [id, signature] = token.split(".");
    expect(verifyLinkToken(token, "another-secret-that-is-long-enough-00")).toBeNull();
    expect(verifyLinkToken(`${signLinkToken("00000000-0000-4000-8000-000000000000", SECRET).split(".")[0]}.${signature}`, SECRET)).toBeNull();
    expect(verifyLinkToken(`${id}.${signature.slice(0, -1)}`, SECRET)).toBeNull();
    for (const bad of ["", ".", "abc", `${id}.`, `${token}.extra`]) expect(verifyLinkToken(bad, SECRET)).toBeNull();
  });
});

describe("uploads", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 hello");

  it("accepts a real PDF and uses our own content type", () => {
    expect(inspectUpload("Bank Statement Oct.PDF", pdf)).toEqual({
      ok: true,
      file: { fileName: "Bank Statement Oct.PDF", ext: "pdf", contentType: "application/pdf" },
    });
  });

  it("rejects wrong types, disguised files, empty and oversized files", () => {
    expect(inspectUpload("run.exe", pdf)).toMatchObject({ ok: false });
    expect(inspectUpload("page.html", pdf)).toMatchObject({ ok: false });
    expect(inspectUpload("fake.pdf", new TextEncoder().encode("<script>alert(1)</script>"))).toMatchObject({ ok: false });
    expect(inspectUpload("a.pdf", new Uint8Array())).toMatchObject({ ok: false });
    expect(inspectUpload("a.pdf", new Uint8Array(MAX_UPLOAD_BYTES + 1))).toMatchObject({ ok: false });
  });

  it("makes file names safe", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\Users\\me\\invoice <1>.pdf")).toBe("invoice _1_.pdf");
    expect(safeFileName("...")).toBe("file");
    expect(safeFileName("बिल 01.pdf")).toBe("बिल 01.pdf");
  });
});

describe("messages", () => {
  const base = { firmName: "Kamat & Associates", clientName: "Rohan", monthLabel: "October 2026", dueLabel: "10 Nov", pending: ["Purchase invoices", "Bank statement"], link: "https://example.com/u/abc" };

  it("lists what is pending with the link and due date", () => {
    const { subject, text } = buildMessage({ ...base, kind: "request" });
    expect(subject).toBe("Kamat & Associates: documents needed for October 2026");
    expect(text).toContain("- Purchase invoices\n- Bank statement");
    expect(text).toContain("https://example.com/u/abc");
    expect(text).toContain("Please send them by 10 Nov.");
  });

  it("changes tone once overdue", () => {
    expect(buildMessage({ ...base, kind: "overdue" }).text).toContain("They were due on 10 Nov.");
  });
});

describe("passwords", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong horse battery", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});
