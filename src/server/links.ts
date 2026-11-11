import "server-only";
import { signLinkToken, verifyLinkToken } from "@/lib/link-token";
import { env } from "./env";

export function uploadUrl(linkId: string): string {
  return `${env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/u/${signLinkToken(linkId, env().SESSION_SECRET)}`;
}

export function linkIdFromToken(token: string): string | null {
  return verifyLinkToken(token, env().SESSION_SECRET);
}
