import { listKpiSnapshots, type KpiSnapshotDto } from "@/api/reports-api";

export type CsvExportScope = "day" | "month" | "year";

function roundRatePct(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
}

/** % tuân thủ HACCP ước tính từ snapshot (cho biểu đồ / báo cáo). */
export function snapshotHaccpCompliancePct(s: KpiSnapshotDto): number | null {
  const r = s.haccp_ccp_monitored_rate;
  if (r != null && !Number.isNaN(Number(r))) {
    return roundRatePct(Number(r));
  }
  if (s.haccp_deviation_count == null) return null;
  const dev = s.haccp_deviation_count ?? 0;
  return roundRatePct(100 - Math.min(100, dev * 8));
}

/** % tuân thủ PRP từ snapshot. */
export function snapshotPrpCompliancePct(s: KpiSnapshotDto): number | null {
  const r = s.prp_audit_compliance_rate;
  if (r == null || Number.isNaN(Number(r))) return null;
  return roundRatePct(Number(r));
}

/** % CAPA đóng đúng hạn (từ snapshot). */
export function snapshotCapaOntimePct(s: KpiSnapshotDto): number | null {
  const r = s.capa_ontime_closure_rate;
  if (r == null || Number.isNaN(Number(r))) return null;
  return roundRatePct(Number(r));
}

function lastSnapshotWhereDesc(
  snaps: KpiSnapshotDto[],
  test: (s: KpiSnapshotDto) => boolean,
): KpiSnapshotDto | null {
  for (let i = snaps.length - 1; i >= 0; i--) {
    const s = snaps[i]!;
    if (test(s)) return s;
  }
  return null;
}

function haccpCompliancePercent(s: KpiSnapshotDto): number {
  const r = s.haccp_ccp_monitored_rate;
  if (r != null && !Number.isNaN(Number(r))) {
    return roundRatePct(Number(r));
  }
  const dev = s.haccp_deviation_count ?? 0;
  return roundRatePct(100 - Math.min(100, dev * 8));
}

function capaOntimePercent(latest: KpiSnapshotDto): number | string {
  const r = latest.capa_ontime_closure_rate;
  if (r != null && !Number.isNaN(Number(r))) {
    return roundRatePct(Number(r));
  }
  const open = latest.capa_open_count ?? 0;
  const overdue = latest.capa_overdue_count ?? 0;
  if (open === 0 && overdue === 0) {
    return "—";
  }
  return roundRatePct(100 - Math.min(100, open * 10));
}

export type ReportKpiRow = {
  label: string;
  value: number | string;
  unit: string;
};

/** Chỉ dùng để quyết định hiển thị thẻ KPI (không coi "—" là có dữ liệu). */
export function reportKpiRowHasValue(row: ReportKpiRow): boolean {
  if (typeof row.value === "number" && !Number.isNaN(row.value)) {
    return true;
  }
  const s = String(row.value).trim();
  if (!s) return false;
  if (s === "—" || s === "-" || s === "–") return false;
  return true;
}

/** KPI tóm tắt từ danh sách snapshot đã sắp xếp (cùng quy tắc với dashboard). */
export function computeReportKpiRows(sortedAsc: KpiSnapshotDto[]): ReportKpiRow[] {
  if (sortedAsc.length === 0) {
    return [];
  }
  const prpSnap = lastSnapshotWhereDesc(
    sortedAsc,
    (s) =>
      s.prp_audit_compliance_rate != null &&
      !Number.isNaN(Number(s.prp_audit_compliance_rate)),
  );
  const haccpSnap = lastSnapshotWhereDesc(
    sortedAsc,
    (s) =>
      (s.haccp_ccp_monitored_rate != null &&
        !Number.isNaN(Number(s.haccp_ccp_monitored_rate))) ||
      (s.haccp_deviation_count ?? 0) > 0,
  );
  const capaSnap = lastSnapshotWhereDesc(
    sortedAsc,
    (s) =>
      (s.capa_ontime_closure_rate != null &&
        !Number.isNaN(Number(s.capa_ontime_closure_rate))) ||
      (s.capa_open_count ?? 0) > 0 ||
      (s.capa_overdue_count ?? 0) > 0,
  );

  const prpVal =
    prpSnap != null
      ? roundRatePct(Number(prpSnap.prp_audit_compliance_rate))
      : "—";
  const haccpVal = haccpSnap != null ? haccpCompliancePercent(haccpSnap) : "—";
  const capaVal = capaSnap != null ? capaOntimePercent(capaSnap) : "—";
  const rows: ReportKpiRow[] = [
    {
      label: "Tuân thủ PRP",
      value: prpVal,
      unit: typeof prpVal === "number" ? "%" : "",
    },
    {
      label: "Tuân thủ HACCP",
      value: haccpVal,
      unit: typeof haccpVal === "number" ? "%" : "",
    },
    {
      label: "CAPA đúng hạn",
      value: capaVal,
      unit: typeof capaVal === "number" ? "%" : "",
    },
  ];
  return rows.filter(reportKpiRowHasValue);
}

function emptySnapshot(snapshotDate: string, periodType: string): KpiSnapshotDto {
  return {
    id: "",
    org_id: "",
    snapshot_date: snapshotDate,
    period_type: periodType,
    doc_total: null,
    doc_approved: null,
    doc_pending: null,
    doc_overdue_review: null,
    haccp_ccp_monitored_rate: null,
    haccp_deviation_count: null,
    prp_audit_compliance_rate: null,
    prp_nc_open_count: null,
    capa_ontime_closure_rate: null,
    capa_open_count: null,
    capa_overdue_count: null,
    alert_critical_count: null,
    alert_open_count: null,
    computed_at: null,
  };
}

/** Mọi ngày YYYY-MM-DD trong tháng (theo lịch). */
export function enumerateDaysInMonth(ym: string): string[] {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m || m < 1 || m > 12) return [];
  const last = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  const days: string[] = [];
  for (let d = 1; d <= last; d++) {
    days.push(`${y}-${mm}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

/** Ngày đầu tháng cho 12 tháng của năm (khớp snapshot monthly từ API). */
export function enumerateMonthStartsInYear(year: number): string[] {
  const y = String(year);
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
}

function sortByDate(a: KpiSnapshotDto, b: KpiSnapshotDto): number {
  return a.snapshot_date.localeCompare(b.snapshot_date);
}

export type CsvExportLoadResult = {
  rows: KpiSnapshotDto[];
  exportLabel: string;
  snapshotSectionTitle: string;
  filenameBase: string;
};

/**
 * Tải snapshot từ API và chuẩn hóa theo phạm vi xuất (một ngày / đủ ngày trong tháng / đủ tháng trong năm).
 */
export async function loadSnapshotsForCsvExport(
  orgId: string,
  scope: CsvExportScope,
  day: string,
  month: string,
  year: number,
): Promise<CsvExportLoadResult> {
  if (scope === "day") {
    const all = await listKpiSnapshots(orgId, "daily");
    const hit = all.filter((s) => s.snapshot_date === day);
    const rows = (hit.length ? hit : [emptySnapshot(day, "daily")]).sort(
      sortByDate,
    );
    return {
      rows,
      exportLabel: `Theo ngày ${day}`,
      snapshotSectionTitle: "Chi tiết ngày đã chọn",
      filenameBase: `bao-cao-kpi-ngay-${day}`,
    };
  }

  if (scope === "month") {
    const all = await listKpiSnapshots(orgId, "daily");
    const byDate = new Map(all.map((s) => [s.snapshot_date, s]));
    const days = enumerateDaysInMonth(month);
    const rows = days.map((d) => byDate.get(d) ?? emptySnapshot(d, "daily"));
    return {
      rows,
      exportLabel: `Theo tháng ${month}`,
      snapshotSectionTitle: "Chi tiết từng ngày trong tháng (đủ số ngày)",
      filenameBase: `bao-cao-kpi-thang-${month}`,
    };
  }

  const all = await listKpiSnapshots(orgId, "monthly");
  const byDate = new Map(all.map((s) => [s.snapshot_date, s]));
  const monthStarts = enumerateMonthStartsInYear(year);
  const rows = monthStarts.map(
    (d) => byDate.get(d) ?? emptySnapshot(d, "monthly"),
  );
  return {
    rows,
    exportLabel: `Theo năm ${year}`,
    snapshotSectionTitle: "Chi tiết từng tháng trong năm (12 tháng)",
    filenameBase: `bao-cao-kpi-nam-${year}`,
  };
}
