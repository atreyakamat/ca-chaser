import { createHmac, timingSafeEqual } from "node:crypto";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function mac(id: string, secret: string): string {
  return createHmac("sha256", secret).update(`upload-link:${id}`).digest("base64url").slice(0, 32);
}

/** A link token is the link's id plus a signature, so it can't be guessed or forged from the database. */
export function signLinkToken(id: string, secret: string): string {
  if (!UUID_RE.test(id)) throw new RangeError("id must be a UUID");
  return `${Buffer.from(id.replaceAll("-", ""), "hex").toString("base64url")}.${mac(id, secret)}`;
}

/** Returns the link id when the token is genuine, otherwise null. */
export function verifyLinkToken(token: string, secret: string): string | null {
  const [encoded, signature, ...rest] = token.split(".");
  if (!encoded || !signature || rest.length > 0) return null;
  const hex = Buffer.from(encoded, "base64url").toString("hex");
  if (hex.length !== 32) return null;
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const expected = Buffer.from(mac(id, secret));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}
