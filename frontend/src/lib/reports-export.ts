import type { KpiSnapshotDto } from "@/api/reports-api";

type KpiRow = { label: string; value: number | string; unit: string };

type ScheduleRow = { name: string; format: string; frequency: string };

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * Nội dung CSV báo cáo KPI + lịch sử snapshot (+ lịch tham chiếu nếu có).
 */
export function buildReportsExportCsv(params: {
  kpiRows: KpiRow[];
  latestSnapshotDate: string | null;
  snapshots: KpiSnapshotDto[];
  schedule: ScheduleRow[];
  /** Ví dụ: "Theo tháng 2025-03" */
  exportLabel?: string;
  /** Tên khu vực chọn khi xuất, hoặc "Tất cả khu vực" */
  exportRegionNote?: string;
  /** Kỳ xem lại (rolling), ví dụ "120 ngày gần nhất" */
  exportPeriodNote?: string;
  /** Tiêu đề khối bảng chi tiết */
  snapshotSectionTitle?: string;
  /** Cột đầu của bảng chi tiết (mặc định: Ngày/kỳ snapshot) */
  snapshotDateColumnLabel?: string;
}): string {
  const lines: string[] = [];
  lines.push(csvLine(["Báo cáo KPI tổng hợp"]));
  lines.push(csvLine(["Xuất (ISO)", new Date().toISOString()]));
  if (params.exportLabel) {
    lines.push(csvLine(["Phạm vi xuất", params.exportLabel]));
  }
  if (params.exportRegionNote) {
    lines.push(csvLine(["Khu vực (đối chiếu PRP / ghi chú xuất)", params.exportRegionNote]));
  }
  if (params.exportPeriodNote) {
    lines.push(csvLine(["Kỳ xem lại (ghi trên file)", params.exportPeriodNote]));
  }
  if (params.latestSnapshotDate) {
    lines.push(csvLine(["Kỳ dữ liệu mới nhất (trong phạm vi)", params.latestSnapshotDate]));
  }
  lines.push("");
  lines.push(csvLine(["KPI hiện tại (theo phạm vi xuất)"]));
  lines.push(csvLine(["Chỉ số", "Giá trị"]));
  for (const k of params.kpiRows) {
    lines.push(csvLine([k.label, `${k.value}${k.unit}`]));
  }
  lines.push("");
  const detailTitle =
    params.snapshotSectionTitle ?? "Chi tiết snapshot";
  lines.push(csvLine([detailTitle]));
  const dateCol = params.snapshotDateColumnLabel ?? "Ngày/kỳ snapshot";
  lines.push(
    csvLine([
      dateCol,
      "Loại kỳ",
      "Tổng tài liệu",
      "Tuân thủ PRP %",
      "Số lệch HACCP",
      "CAPA mở",
    ]),
  );
  for (const s of params.snapshots) {
    lines.push(
      csvLine([
        s.snapshot_date,
        s.period_type,
        s.doc_total ?? "",
        s.prp_audit_compliance_rate ?? "",
        s.haccp_deviation_count ?? "",
        s.capa_open_count ?? "",
      ]),
    );
  }
  if (params.schedule.length > 0) {
    lines.push("");
    lines.push(csvLine(["Lịch xuất báo cáo (tham chiếu)"]));
    lines.push(csvLine(["Báo cáo", "Định dạng", "Tần suất"]));
    for (const r of params.schedule) {
      lines.push(csvLine([r.name, r.format, r.frequency]));
    }
  }
  return lines.join("\r\n");
}

export function downloadCsvToMachine(filename: string, csvBody: string): void {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvBody], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
