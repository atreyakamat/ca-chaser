import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

export interface FileStorage {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

function assertKey(key: string) {
  if (!KEY_RE.test(key) || key.includes("..")) throw new Error("Invalid storage key");
}

/** Files on local disk. For development and tests only: serverless hosts don't keep a disk. */
function localStorage(root: string): FileStorage {
  const resolve = (key: string) => {
    assertKey(key);
    return path.join(root, key);
  };
  return {
    async put(key, bytes) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: "wx" });
    },
    async get(key) {
      return new Uint8Array(await readFile(resolve(key)));
    },
    async remove(key) {
      await rm(resolve(key), { force: true });
    },
  };
}

/** A private Supabase Storage bucket, reached with the service role key from the server only. */
function supabaseStorage(baseUrl: string, serviceKey: string, bucket: string): FileStorage {
  const url = (key: string) => {
    assertKey(key);
    return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${key}`;
  };
  const headers = { authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  const check = async (response: Response, action: string) => {
    if (!response.ok) throw new Error(`Storage ${action} failed with status ${response.status}`);
    return response;
  };
  return {
    async put(key, bytes, contentType) {
      await check(
        await fetch(url(key), { method: "POST", headers: { ...headers, "content-type": contentType, "x-upsert": "false" }, body: new Blob([bytes as BlobPart]) }),
        "upload",
      );
    },
    async get(key) {
      const response = await check(await fetch(url(key), { headers, cache: "no-store" }), "download");
      return new Uint8Array(await response.arrayBuffer());
    },
    async remove(key) {
      const response = await fetch(url(key), { method: "DELETE", headers });
      if (!response.ok && response.status !== 404) throw new Error(`Storage delete failed with status ${response.status}`);
    },
  };
}

export function storage(): FileStorage {
  const e = env();
  if (e.STORAGE_DRIVER === "supabase") return supabaseStorage(e.SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!, e.STORAGE_BUCKET);
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error("STORAGE_DRIVER=local can't be used on a serverless host. Set STORAGE_DRIVER=supabase.");
  }
  return localStorage(path.join(process.cwd(), ".data", "uploads"));
}
