import { describe, expect, it } from "vitest";
import { parseClientCsv, parseCsv } from "@/lib/csv";
import { normalizeGstin, normalizePhone, parseClient } from "@/lib/validation";

describe("normalizePhone", () => {
  it("accepts the ways Indian mobiles are written", () => {
    for (const input of ["9876543210", "09876543210", "+91 98765 43210", "91-9876543210", "(+91) 98765-43210"]) {
      expect(normalizePhone(input)).toBe("+919876543210");
    }
  });

  it("keeps valid international numbers and rejects junk", () => {
    expect(normalizePhone("+14155550123")).toBe("+14155550123");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
    expect(normalizePhone("98765abcde")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("parseClient", () => {
  it("normalizes a full record", () => {
    const result = parseClient({ name: "  Coastal   Spices ", phone: "98765 43210", email: "Accounts@Example.COM", gstin: "30aaacc1234f1z5", whatsappOptIn: true });
    expect(result).toEqual({
      ok: true,
      value: { name: "Coastal Spices", phone: "+919876543210", email: "accounts@example.com", gstin: "30AAACC1234F1Z5", channel: "whatsapp", whatsappOptIn: true },
    });
  });

  it("defaults to email when there is no phone", () => {
    const result = parseClient({ name: "A", email: "a@example.com", whatsappOptIn: true });
    expect(result.ok && result.value.channel).toBe("email");
    expect(result.ok && result.value.whatsappOptIn).toBe(false);
  });

  it("explains what is wrong", () => {
    expect(parseClient({ name: "" })).toEqual({ ok: false, error: "Name is required." });
    expect(parseClient({ name: "A" })).toEqual({ ok: false, error: "Add a phone number or an email address." });
    expect(parseClient({ name: "A", phone: "123" })).toMatchObject({ ok: false });
    expect(parseClient({ name: "A", email: "a@example.com", channel: "whatsapp" })).toEqual({ ok: false, error: "WhatsApp reminders need a phone number." });
    expect(parseClient({ name: "A", phone: "9876543210", channel: "email" })).toEqual({ ok: false, error: "Email reminders need an email address." });
    expect(parseClient({ name: "A", phone: "9876543210", channel: "sms" })).toMatchObject({ ok: false });
    expect(normalizeGstin("NOTAGSTIN")).toBeNull();
  });
});

describe("CSV", () => {
  it("handles quotes, embedded commas and newlines, CRLF and a BOM", () => {
    expect(parseCsv('\uFEFFname,note\r\n"Rao, Sons","said ""hi""\nthere"\r\n\r\nplain,x')).toEqual([
      ["name", "note"],
      ["Rao, Sons", 'said "hi"\nthere'],
      ["plain", "x"],
    ]);
  });

  it("maps friendly headers and reports bad lines by number", () => {
    const { clients, errors } = parseClientCsv("Client Name,Mobile,Email\nRao & Sons,9876543210,\nNo Contact,,\nBad Phone,12,\nMail Only,,m@example.com\n");
    expect(clients.map((c) => [c.name, c.channel])).toEqual([
      ["Rao & Sons", "whatsapp"],
      ["Mail Only", "email"],
    ]);
    expect(errors).toEqual([
      { line: 3, message: "Add a phone number or an email address." },
      { line: 4, message: '"12" is not a valid phone number.' },
    ]);
  });

  it("needs a name column and some rows", () => {
    expect(parseClientCsv("").errors[0].message).toBe("The file is empty.");
    expect(parseClientCsv("phone\n9876543210").errors[0].message).toMatch(/name/);
  });
});
