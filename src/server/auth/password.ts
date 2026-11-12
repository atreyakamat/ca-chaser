import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 2 ** 15;
const KEY_LENGTH = 64;
// scrypt needs 128 * N * r bytes of memory; allow headroom over Node's 32 MB default.
const MAX_MEMORY = 128 * N * 8 * 2;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: 8, p: 1, maxmem: MAX_MEMORY });
  return `scrypt$${N}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, salt, hash] = stored.split("$");
  const n = Number(cost);
  if (scheme !== "scrypt" || !salt || !hash || !Number.isInteger(n) || n < 2 ** 14 || n > 2 ** 20) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), { N: n, r: 8, p: 1, maxmem: 128 * n * 8 * 2 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
