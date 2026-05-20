const MS_PER_DAY = 86_400_000;

export type DraftSubmissionWindowStatus =
  | "ok"
  | "due_soon"
  | "due_today"
  | "overdue";

export type DraftSubmissionWindow = {
  daysLeft: number;
  status: DraftSubmissionWindowStatus;
  label: string;
  severity: "info" | "warning" | "error";
};

export function computeDraftSubmissionWindow(
  applicationDate: string | undefined | null,
  now: Date
): DraftSubmissionWindow | null {
  if (!applicationDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(applicationDate);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const appUTC = Date.UTC(y, m - 1, d);
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineUTC = appUTC + 3 * MS_PER_DAY;
  const daysLeft = Math.floor((deadlineUTC - todayUTC) / MS_PER_DAY);

  if (daysLeft < 0) {
    const overdueBy = -daysLeft;
    return {
      daysLeft,
      status: "overdue",
      label: `Late — overdue by ${overdueBy} day${overdueBy === 1 ? "" : "s"}`,
      severity: "error",
    };
  }
  if (daysLeft === 0) {
    return {
      daysLeft,
      status: "due_today",
      label: "Submit today",
      severity: "warning",
    };
  }
  if (daysLeft === 1) {
    return {
      daysLeft,
      status: "due_soon",
      label: "1 day left to submit",
      severity: "warning",
    };
  }
  return {
    daysLeft,
    status: "ok",
    label: `${daysLeft} days left to submit`,
    severity: "info",
  };
}
