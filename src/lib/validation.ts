const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Normalizes a phone number to E.164. Bare 10-digit numbers are treated as Indian mobiles.
 * Returns null when the number can't be understood.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;
  if (digits.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
  const local = digits.replace(/^0+/, "");
  if (/^[6-9]\d{9}$/.test(local)) return `+91${local}`;
  if (/^91[6-9]\d{9}$/.test(local)) return `+${local}`;
  return null;
}

export function normalizeEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  return value.length <= 254 && EMAIL_RE.test(value) ? value : null;
}

export function normalizeGstin(input: string): string | null {
  const value = input.trim().toUpperCase();
  return GSTIN_RE.test(value) ? value : null;
}

export type ClientInput = {
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  channel: "whatsapp" | "email";
  whatsappOptIn: boolean;
};

export type RawClient = { name?: string; phone?: string; email?: string; gstin?: string; channel?: string; whatsappOptIn?: boolean };

/** Validates and normalizes one client. Returns the clean value or a plain-language error. */
export function parseClient(raw: RawClient): { ok: true; value: ClientInput } | { ok: false; error: string } {
  const name = (raw.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Name is required." };
  if (name.length > 160) return { ok: false, error: "Name is too long." };

  let phone: string | null = null;
  if (raw.phone?.trim()) {
    phone = normalizePhone(raw.phone);
    if (!phone) return { ok: false, error: `"${raw.phone.trim()}" is not a valid phone number.` };
  }
  let email: string | null = null;
  if (raw.email?.trim()) {
    email = normalizeEmail(raw.email);
    if (!email) return { ok: false, error: `"${raw.email.trim()}" is not a valid email address.` };
  }
  let gstin: string | null = null;
  if (raw.gstin?.trim()) {
    gstin = normalizeGstin(raw.gstin);
    if (!gstin) return { ok: false, error: `"${raw.gstin.trim()}" is not a valid GSTIN.` };
  }
  if (!phone && !email) return { ok: false, error: "Add a phone number or an email address." };

  const wanted = (raw.channel ?? "").trim().toLowerCase();
  if (wanted && wanted !== "whatsapp" && wanted !== "email") return { ok: false, error: 'Channel must be "whatsapp" or "email".' };
  let channel: "whatsapp" | "email" = wanted === "email" ? "email" : wanted === "whatsapp" ? "whatsapp" : phone ? "whatsapp" : "email";
  if (channel === "whatsapp" && !phone) {
    if (wanted) return { ok: false, error: "WhatsApp reminders need a phone number." };
    channel = "email";
  }
  if (channel === "email" && !email) return { ok: false, error: "Email reminders need an email address." };

  return { ok: true, value: { name, phone, email, gstin, channel, whatsappOptIn: Boolean(raw.whatsappOptIn) && phone !== null } };
}
