/** Product identity. The name is a placeholder until the real one is chosen. */
export const site = {
  name: "DocChase",
  tagline: "Stop chasing clients for documents.",
  description:
    "Automatic WhatsApp reminders that collect GST and TDS documents from your clients every month, with one dashboard showing what's still pending.",
} as const;

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function contactEmail(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return value ? value : null;
}
