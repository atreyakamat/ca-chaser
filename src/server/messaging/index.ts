import "server-only";
import { env } from "../env";

export type Channel = "whatsapp" | "email";
export type Outgoing = { channel: Channel; to: string; subject: string; text: string };
export type SendResult = { status: "sent" | "mock" | "failed"; detail?: string };

async function sendEmail(message: Outgoing): Promise<SendResult> {
  const e = env();
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { status: "sent" };
    return { status: "failed", detail: `Email provider returned ${response.status}` };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message.slice(0, 200) : "Email could not be sent" };
  }
}

/** True when this deployment can actually deliver on the channel (always true in mock mode). */
export function canDeliver(channel: Channel): boolean {
  return env().MESSAGING_MODE === "mock" || channel === "email";
}

/**
 * Delivers one message. In mock mode nothing leaves the server: the caller records the message
 * so it shows up in the activity log. WhatsApp delivery is added with the Meta Cloud API.
 */
export async function send(message: Outgoing): Promise<SendResult> {
  if (env().MESSAGING_MODE === "mock") return { status: "mock", detail: "Test mode: not sent" };
  if (message.channel === "email") return sendEmail(message);
  return { status: "failed", detail: "WhatsApp sending is not connected yet" };
}
