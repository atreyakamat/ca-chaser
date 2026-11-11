import { describe, expect, it } from "vitest";
import { addDays, addMonths, formatDay, formatMonth, isDateString, todayIn } from "@/lib/dates";
import { activePeriodMonth, periodDates, reminderSchedule, scheduledKind, validateSchedule } from "@/lib/periods";

const schedule = { requestDay: 1, dueDay: 10, offsets: [7, 3, 1] };

describe("dates", () => {
  it("finds today in the firm's time zone, not UTC", () => {
    // 20:00 UTC on 31 Oct is already 1 Nov in India.
    expect(todayIn("Asia/Kolkata", new Date("2026-10-31T20:00:00Z"))).toBe("2026-11-01");
    expect(todayIn("UTC", new Date("2026-10-31T20:00:00Z"))).toBe("2026-10-31");
  });

  it("adds days and months across year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
  });

  it("formats for Indian readers", () => {
    expect(formatMonth("2026-10-01")).toBe("October 2026");
    expect(formatDay("2026-11-10")).toBe("10 Nov");
  });

  it("rejects impossible dates", () => {
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("2026-2-3")).toBe(false);
    expect(isDateString("2026-02-28")).toBe(true);
    expect(() => addDays("2026-13-01", 1)).toThrow(RangeError);
  });
});

describe("periods", () => {
  it("requests and collects a month's documents in the following month", () => {
    expect(periodDates("2026-10-01", schedule)).toEqual({ month: "2026-10-01", requestDate: "2026-11-01", dueDate: "2026-11-10" });
    expect(periodDates("2026-12-20", schedule)).toEqual({ month: "2026-12-01", requestDate: "2027-01-01", dueDate: "2027-01-10" });
  });

  it("picks the newest period whose request date has arrived", () => {
    expect(activePeriodMonth("2026-11-01", schedule)).toBe("2026-10-01");
    expect(activePeriodMonth("2026-11-30", schedule)).toBe("2026-10-01");
    const late = { ...schedule, requestDay: 5, dueDay: 15 };
    expect(activePeriodMonth("2026-11-04", late)).toBe("2026-09-01");
    expect(activePeriodMonth("2026-11-05", late)).toBe("2026-10-01");
  });

  it("builds the reminder schedule in date order", () => {
    const dates = periodDates("2026-10-01", schedule);
    expect(reminderSchedule(dates, schedule.offsets)).toEqual([
      { date: "2026-11-01", kind: "request" },
      { date: "2026-11-03", kind: "followup" },
      { date: "2026-11-07", kind: "followup" },
      { date: "2026-11-09", kind: "followup" },
      { date: "2026-11-12", kind: "overdue" },
      { date: "2026-11-15", kind: "overdue" },
    ]);
  });

  it("drops follow-ups that would fall on or before the request date", () => {
    const dates = periodDates("2026-10-01", schedule);
    const kinds = reminderSchedule(dates, [20, 9, 0, 0]);
    expect(kinds.filter((k) => k.kind === "followup").map((k) => k.date)).toEqual(["2026-11-10"]);
  });

  it("says what is scheduled today", () => {
    const dates = periodDates("2026-10-01", schedule);
    expect(scheduledKind("2026-11-01", dates, schedule.offsets)).toBe("request");
    expect(scheduledKind("2026-11-02", dates, schedule.offsets)).toBeNull();
    expect(scheduledKind("2026-11-12", dates, schedule.offsets)).toBe("overdue");
  });

  it("validates schedules", () => {
    expect(validateSchedule(schedule)).toBeNull();
    expect(validateSchedule({ ...schedule, dueDay: 1 })).toMatch(/after/);
    expect(validateSchedule({ ...schedule, requestDay: 29 })).toMatch(/between 1 and 28/);
    expect(validateSchedule({ ...schedule, offsets: [1.5] })).toMatch(/whole numbers/);
    expect(validateSchedule({ ...schedule, offsets: [1, 2, 3, 4, 5, 6, 7] })).toMatch(/at most 6/);
  });
});
