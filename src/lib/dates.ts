/** Calendar dates are plain "YYYY-MM-DD" strings so they never shift across time zones. */
export type DateString = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toUtc(date: DateString): Date {
  if (!DATE_RE.test(date)) throw new RangeError(`Invalid date: ${date}`);
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) throw new RangeError(`Invalid date: ${date}`);
  return utc;
}

function fromUtc(date: Date): DateString {
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): DateString {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(date: DateString, days: number): DateString {
  const utc = toUtc(date);
  utc.setUTCDate(utc.getUTCDate() + days);
  return fromUtc(utc);
}

/** First day of the month `months` away from the month containing `date`. */
export function addMonths(date: DateString, months: number): DateString {
  const utc = toUtc(date);
  return fromUtc(new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + months, 1)));
}

export function startOfMonth(date: DateString): DateString {
  return addMonths(date, 0);
}

export function withDay(monthStart: DateString, day: number): DateString {
  const utc = toUtc(monthStart);
  return fromUtc(new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth(), day)));
}

/** "October 2026" */
export function formatMonth(date: DateString): string {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(toUtc(date));
}

/** "10 Nov" */
export function formatDay(date: DateString): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(toUtc(date));
}

/** "10 Nov, 4:05 pm" in the given time zone. */
export function formatDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }).format(value);
}

export function isDateString(value: unknown): value is DateString {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  try {
    toUtc(value);
    return true;
  } catch {
    return false;
  }
}
