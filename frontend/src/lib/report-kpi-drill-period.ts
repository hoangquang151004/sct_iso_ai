export type ReportDrillPeriodType =
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

const ALLOWED: readonly ReportDrillPeriodType[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

export function buildKpiDrillQueryFromReports(
  periodType: ReportDrillPeriodType,
  cursorDay: string,
  cursorWeek: string,
  cursorMonth: string,
  cursorYear: number,
): string {
  const cursor =
    periodType === "daily"
      ? cursorDay
      : periodType === "weekly"
        ? cursorWeek
        : periodType === "monthly"
          ? cursorMonth
          : String(cursorYear);
  return new URLSearchParams({
    period_type: periodType,
    cursor,
  }).toString();
}

export function parseKpiDrillSnapshotParams(
  periodTypeRaw: string | undefined,
  cursorRaw: string | undefined,
): { periodType: ReportDrillPeriodType; cursor: string } | null {
  const pt = (periodTypeRaw ?? "").trim().toLowerCase();
  const cursor = (cursorRaw ?? "").trim();
  if (!pt || !cursor) return null;
  if (!(ALLOWED as readonly string[]).includes(pt)) return null;
  return { periodType: pt as ReportDrillPeriodType, cursor };
}

export function formatKpiDrillPeriodLabel(
  periodType: ReportDrillPeriodType,
  cursor: string,
): string {
  if (periodType === "daily") return `Ngày ${cursor}`;
  if (periodType === "weekly") return `Tuần ${cursor}`;
  if (periodType === "monthly") return `Tháng ${cursor}`;
  return `Năm ${cursor}`;
}
