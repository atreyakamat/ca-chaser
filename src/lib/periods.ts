import { addDays, addMonths, startOfMonth, withDay, type DateString } from "./dates";

/**
 * A period is the month whose documents are being collected, stored as its first day.
 * Documents for month M are requested on `requestDay` and due on `dueDay` of month M+1.
 */
export type Schedule = {
  requestDay: number;
  dueDay: number;
  /** Days before the due date on which a follow-up goes out. */
  offsets: readonly number[];
};

/** Follow-ups after the due date, in days past due. */
export const OVERDUE_OFFSETS = [2, 5] as const;

export type ReminderKind = "request" | "followup" | "overdue";

export function validateSchedule(s: Schedule): string | null {
  const dayOk = (d: number) => Number.isInteger(d) && d >= 1 && d <= 28;
  if (!dayOk(s.requestDay) || !dayOk(s.dueDay)) return "Days must be between 1 and 28.";
  if (s.dueDay <= s.requestDay) return "The due day must be after the request day.";
  if (s.offsets.length > 6) return "Use at most 6 follow-ups.";
  if (s.offsets.some((o) => !Number.isInteger(o) || o < 0 || o > 27)) return "Follow-up days must be whole numbers from 0 to 27.";
  return null;
}

export function periodDates(month: DateString, s: Schedule): { month: DateString; requestDate: DateString; dueDate: DateString } {
  const start = startOfMonth(month);
  const next = addMonths(start, 1);
  return { month: start, requestDate: withDay(next, s.requestDay), dueDate: withDay(next, s.dueDay) };
}

/** The most recent period whose request date has arrived. */
export function activePeriodMonth(today: DateString, s: Schedule): DateString {
  const previous = addMonths(today, -1);
  return periodDates(previous, s).requestDate <= today ? previous : addMonths(today, -2);
}

/** Every date a scheduled message goes out for a period, in order. */
export function reminderSchedule(month: DateString, s: Schedule): { date: DateString; kind: ReminderKind }[] {
  const { requestDate, dueDate } = periodDates(month, s);
  const byDate = new Map<DateString, ReminderKind>([[requestDate, "request"]]);
  for (const offset of s.offsets) {
    const date = addDays(dueDate, -offset);
    if (date > requestDate && date <= dueDate && !byDate.has(date)) byDate.set(date, "followup");
  }
  for (const offset of OVERDUE_OFFSETS) byDate.set(addDays(dueDate, offset), "overdue");
  return [...byDate].map(([date, kind]) => ({ date, kind })).sort((a, b) => a.date.localeCompare(b.date));
}

/** What, if anything, is scheduled to go out today for a period. */
export function scheduledKind(today: DateString, month: DateString, s: Schedule): ReminderKind | null {
  return reminderSchedule(month, s).find((r) => r.date === today)?.kind ?? null;
}
