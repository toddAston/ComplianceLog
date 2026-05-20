import { describe, expect, it } from "vitest";
import { computeDraftSubmissionWindow } from "./draftSubmissionWindow";

describe("computeDraftSubmissionWindow", () => {
  it("returns null when applicationDate is missing or malformed", () => {
    const now = new Date(2026, 4, 20);
    expect(computeDraftSubmissionWindow("", now)).toBeNull();
    expect(computeDraftSubmissionWindow(undefined, now)).toBeNull();
    expect(computeDraftSubmissionWindow(null, now)).toBeNull();
    expect(computeDraftSubmissionWindow("not-a-date", now)).toBeNull();
    expect(computeDraftSubmissionWindow("2026/05/20", now)).toBeNull();
  });

  it("reports 3 days left when today is the application date", () => {
    const now = new Date(2026, 4, 20); // May 20, 2026 local
    const w = computeDraftSubmissionWindow("2026-05-20", now);
    expect(w).not.toBeNull();
    expect(w!.daysLeft).toBe(3);
    expect(w!.status).toBe("ok");
    expect(w!.severity).toBe("info");
    expect(w!.label).toBe("3 days left to submit");
  });

  it("reports 2 days left as ok (still has time)", () => {
    const now = new Date(2026, 4, 21);
    const w = computeDraftSubmissionWindow("2026-05-20", now);
    expect(w!.daysLeft).toBe(2);
    expect(w!.status).toBe("ok");
  });

  it("reports due_soon with singular day when only 1 day remains", () => {
    const now = new Date(2026, 4, 22); // 2 days after app date
    const w = computeDraftSubmissionWindow("2026-05-20", now);
    expect(w!.daysLeft).toBe(1);
    expect(w!.status).toBe("due_soon");
    expect(w!.severity).toBe("warning");
    expect(w!.label).toBe("1 day left to submit");
  });

  it("reports due_today when the 3-day window closes today", () => {
    const now = new Date(2026, 4, 23); // exactly 3 days after app date
    const w = computeDraftSubmissionWindow("2026-05-20", now);
    expect(w!.daysLeft).toBe(0);
    expect(w!.status).toBe("due_today");
    expect(w!.severity).toBe("warning");
    expect(w!.label).toBe("Submit today");
  });

  it("reports overdue with singular day when 1 day late", () => {
    const now = new Date(2026, 4, 24);
    const w = computeDraftSubmissionWindow("2026-05-20", now);
    expect(w!.daysLeft).toBe(-1);
    expect(w!.status).toBe("overdue");
    expect(w!.severity).toBe("error");
    expect(w!.label).toBe("Late — overdue by 1 day");
  });

  it("reports overdue with plural days when multiple days late", () => {
    const now = new Date(2026, 4, 30);
    const w = computeDraftSubmissionWindow("2026-05-20", now);
    expect(w!.daysLeft).toBe(-7);
    expect(w!.status).toBe("overdue");
    expect(w!.label).toBe("Late — overdue by 7 days");
  });

  it("handles application dates in the past with leap-year math", () => {
    // 2024 was a leap year — Feb 29 exists. Confirm normalization works.
    const now = new Date(2024, 2, 3); // March 3
    const w = computeDraftSubmissionWindow("2024-02-29", now);
    expect(w!.daysLeft).toBe(0);
    expect(w!.status).toBe("due_today");
  });

  it("ignores time-of-day on the now Date — only the calendar day matters", () => {
    const earlyMorning = new Date(2026, 4, 23, 0, 0, 1);
    const lateNight = new Date(2026, 4, 23, 23, 59, 59);
    const a = computeDraftSubmissionWindow("2026-05-20", earlyMorning);
    const b = computeDraftSubmissionWindow("2026-05-20", lateNight);
    expect(a!.daysLeft).toBe(0);
    expect(b!.daysLeft).toBe(0);
  });
});
