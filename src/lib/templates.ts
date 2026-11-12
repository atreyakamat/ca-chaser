import type { ReminderKind } from "./periods";

export type MessageKind = ReminderKind | "nudge";

export type MessageInput = {
  kind: MessageKind;
  firmName: string;
  clientName: string;
  /** "October 2026" */
  monthLabel: string;
  /** "10 Nov" */
  dueLabel: string;
  pending: readonly string[];
  link: string;
};

/** The plain-text reminder a client receives, plus a subject line for email. */
export function buildMessage(m: MessageInput): { subject: string; text: string } {
  const list = m.pending.map((name) => `- ${name}`).join("\n");
  const intro: Record<MessageKind, string> = {
    request: `Hi ${m.clientName}, this is ${m.firmName}. Please share your ${m.monthLabel} documents for GST and TDS filing:`,
    followup: `Hi ${m.clientName}, a reminder from ${m.firmName}. We are still waiting for these ${m.monthLabel} documents:`,
    overdue: `Hi ${m.clientName}, your ${m.monthLabel} documents for ${m.firmName} are now overdue. We still need:`,
    nudge: `Hi ${m.clientName}, ${m.firmName} here. Could you send these ${m.monthLabel} documents today?`,
  };
  const due = m.kind === "overdue" ? `They were due on ${m.dueLabel}.` : `Please send them by ${m.dueLabel}.`;
  const subject: Record<MessageKind, string> = {
    request: `${m.firmName}: documents needed for ${m.monthLabel}`,
    followup: `Reminder: ${m.monthLabel} documents for ${m.firmName}`,
    overdue: `Overdue: ${m.monthLabel} documents for ${m.firmName}`,
    nudge: `Reminder: ${m.monthLabel} documents for ${m.firmName}`,
  };
  return {
    subject: subject[m.kind],
    text: `${intro[m.kind]}\n${list}\n\nUpload here, no login needed:\n${m.link}\n\n${due}`,
  };
}
