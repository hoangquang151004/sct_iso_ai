"use client";

import type { ChartData } from "chart.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import {
  ReportsKpiSnapshotBarChart,
} from "@/components/shared/charts";
import { useAuth } from "@/hooks/use-auth";
import {
  buildReportsExportCsv,
  downloadCsvToMachine,
} from "@/lib/reports-export";
import {
  type CsvExportScope,
  computeReportKpiRows,
  loadSnapshotsForCsvExport,
  snapshotCapaOntimePct,
  snapshotHaccpCompliancePct,
  snapshotPrpCompliancePct,
} from "@/lib/report-export-scope";
import {
  type KpiSnapshotDto,
  listKpiSnapshots,
  listReportLocations,
} from "@/api/reports-api";
import { buildKpiDrillQueryFromReports } from "@/lib/report-kpi-drill-period";
import { slugFromReportKpiLabel } from "@/lib/report-kpi-slugs";

function localIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localIsoMonth(d = new Date()): string {
  return localIsoDate(d).slice(0, 7);
}

export type ReportPeriodType = "daily" | "weekly" | "monthly" | "yearly";

function formatSnapshotAxisLabel(
  isoDate: string,
  periodType: string,
): string {
  const parts = isoDate.split("-");
  const y = parts[0] ?? "";
  const m = parts[1] ?? "";
  const d = parts[2] ?? "";
  if (periodType === "daily") {
    return `${d}/${m}`;
  }
  if (periodType === "weekly") {
    return d && m ? `${d}/${m}` : isoDate;
  }
  if (periodType === "yearly") {
    return y;
  }
  return `${Number(m)}/${String(y).slice(2)}`;
}

/** Thứ Hai của tuần ISO (năm tuần ISO `isoWeekYear`, số tuần `week` 1..53). */
function dateFromIsoWeek(isoWeekYear: number, week: number): Date {
  const jan4 = new Date(isoWeekYear, 0, 4);
  const dayOfWeek = jan4.getDay() === 0 ? 7 : jan4.getDay();
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - (dayOfWeek - 1));
  const out = new Date(mondayWeek1);
  out.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  return out;
}

/** Giá trị `yyyy-Www` cho `<input type="week" />` chứa ngày `d` (local). */
function dateToHtmlWeekValue(d: Date): string {
  const y = d.getFullYear();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  for (let wy = y - 1; wy <= y + 1; wy++) {
    for (let w = 1; w <= 53; w++) {
      const mon = dateFromIsoWeek(wy, w);
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      const t0 = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate()).getTime();
      const t1 = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate()).getTime();
      if (t >= t0 && t <= t1) {
        return `${wy}-W${String(w).padStart(2, "0")}`;
      }
    }
  }
  return `${y}-W01`;
}

/** `YYYY-MM-DD` thứ Hai của tuần từ giá trị week input. */
function mondayIsoFromHtmlWeekValue(weekVal: string): string | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekVal.trim());
  if (!m) return null;
  const isoY = Number.parseInt(m[1], 10);
  const w = Number.parseInt(m[2], 10);
  if (!Number.isFinite(isoY) || !Number.isFinite(w) || w < 1 || w > 53) return null;
  return localIsoDate(dateFromIsoWeek(isoY, w));
}

function filterSnapshotsByPeriod(
  rows: KpiSnapshotDto[],
  periodType: ReportPeriodType,
  cursorDay: string,
  cursorWeek: string,
  cursorMonth: string,
  cursorYear: number,
): KpiSnapshotDto[] {
  if (rows.length === 0) return [];
  if (periodType === "daily") {
    return rows.filter((s) => s.snapshot_date === cursorDay);
  }
  if (periodType === "weekly") {
    const monday = mondayIsoFromHtmlWeekValue(cursorWeek);
    if (!monday) return [];
    return rows.filter((s) => s.snapshot_date === monday);
  }
  if (periodType === "monthly") {
    return rows.filter((s) => s.snapshot_date.slice(0, 7) === cursorMonth);
  }
  if (periodType === "yearly") {
    return rows.filter((s) => s.snapshot_date.startsWith(`${cursorYear}-`));
  }
  return rows;
}
export default function ReportsPage() {
  const { principal } = useAuth();
  const [periodType, setPeriodType] = useState<ReportPeriodType>("monthly");
  /** Chỉ dùng khi chu kỳ = theo ngày. */
  const [reportCursorDay, setReportCursorDay] = useState(() => localIsoDate());
  /** Giá trị `yyyy-Www` từ `<input type="week" />` khi chu kỳ = theo tuần. */
  const [reportCursorWeek, setReportCursorWeek] = useState(() =>
    dateToHtmlWeekValue(new Date()),
  );
  const [reportCursorMonth, setReportCursorMonth] = useState(() => localIsoMonth());
  const [reportCursorYear, setReportCursorYear] = useState(() => new Date().getFullYear());
  const [snapshots, setSnapshots] = useState<KpiSnapshotDto[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<CsvExportScope>("month");
  const [exportDay, setExportDay] = useState(() => localIsoDate());
  const [exportMonth, setExportMonth] = useState(() => localIsoMonth());
  const [exportYear, setExportYear] = useState(() => new Date().getFullYear());
  const [exportModalError, setExportModalError] = useState<string | null>(null);
  const [exportLocationId, setExportLocationId] = useState("");
  const [exportPeriodDays, setExportPeriodDays] = useState(120);
  const [reportLocations, setReportLocations] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const envOrg = process.env.NEXT_PUBLIC_ORG_ID?.trim() ?? "";
        const orgId = envOrg || principal?.org_id || "";
        if (!orgId) {
          throw new Error("Không xác định được tổ chức hiện tại để tải báo cáo");
        }
        
        const rows = await listKpiSnapshots(orgId, periodType);
        if (!cancelled) setSnapshots(rows);
      } catch (e) {
        if (!cancelled) {
          setSnapshots([]);
          setLoadError(
            e instanceof Error ? e.message : "Không tải được KPI từ server",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [principal?.org_id, periodType]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const envOrg = process.env.NEXT_PUBLIC_ORG_ID?.trim() ?? "";
      const orgId = envOrg || principal?.org_id || "";
      if (!orgId) {
        if (!cancelled) setReportLocations([]);
        return;
      }
      try {
        const rows = await listReportLocations(orgId);
        if (!cancelled) {
          setReportLocations(rows.map((r) => ({ id: r.id, name: r.name })));
        }
      } catch {
        if (!cancelled) setReportLocations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [principal?.org_id]);

  useEffect(() => {
    const t = new Date();
    setReportCursorDay(localIsoDate(t));
    setReportCursorWeek(dateToHtmlWeekValue(t));
    setReportCursorMonth(localIsoMonth(t));
    setReportCursorYear(t.getFullYear());
  }, [periodType]);

  const displaySnapshots = useMemo(
    () =>
      filterSnapshotsByPeriod(
        snapshots,
        periodType,
        reportCursorDay,
        reportCursorWeek,
        reportCursorMonth,
        reportCursorYear,
      ),
    [
      snapshots,
      periodType,
      reportCursorDay,
      reportCursorWeek,
      reportCursorMonth,
      reportCursorYear,
    ],
  );

  const sortedAsc = useMemo(
    () =>
      [...displaySnapshots].sort((a, b) =>
        a.snapshot_date.localeCompare(b.snapshot_date),
      ),
    [displaySnapshots],
  );

  const periodFilterHint = useMemo(() => {
    if (periodType === "daily") {
      return `Ngày ${reportCursorDay}`;
    }
    if (periodType === "weekly") {
      const mon = mondayIsoFromHtmlWeekValue(reportCursorWeek);
      return mon ? `Tuần ${reportCursorWeek} (từ ${mon})` : `Tuần ${reportCursorWeek}`;
    }
    if (periodType === "monthly") {
      return `Tháng ${reportCursorMonth}`;
    }
    return `Năm ${reportCursorYear}`;
  }, [periodType, reportCursorDay, reportCursorWeek, reportCursorMonth, reportCursorYear]);

  const reportsKPIs = useMemo(
    () => computeReportKpiRows(sortedAsc),
    [sortedAsc],
  );

  const reportsOverviewChartData = useMemo(():
    | ChartData<"bar", (number | null)[], string>
    | undefined => {
    if (sortedAsc.length === 0) return undefined;
    return {
      labels: sortedAsc.map((s) =>
        formatSnapshotAxisLabel(s.snapshot_date, s.period_type ?? periodType),
      ),
      datasets: [
        {
          label: "CAPA quá hạn (số)",
          data: sortedAsc.map((s) => s.capa_overdue_count ?? 0),
          backgroundColor: "#e11d48",
          borderRadius: 4,
          yAxisID: "y",
        },
        {
          label: "CAPA đúng hạn (%)",
          data: sortedAsc.map((s) => snapshotCapaOntimePct(s)),
          backgroundColor: "#22c55e",
          borderRadius: 4,
          yAxisID: "y1",
        },
        {
          label: "Tuân thủ PRP (%)",
          data: sortedAsc.map((s) => snapshotPrpCompliancePct(s)),
          backgroundColor: "#6366f1",
          borderRadius: 4,
          yAxisID: "y1",
        },
        {
          label: "Tuân thủ HACCP (%)",
          data: sortedAsc.map((s) => snapshotHaccpCompliancePct(s)),
          backgroundColor: "#0ea5e9",
          borderRadius: 4,
          yAxisID: "y1",
        },
      ],
    };
  }, [sortedAsc, periodType]);

  const resolveOrgId = useCallback((): string | null => {
    const envOrg = process.env.NEXT_PUBLIC_ORG_ID?.trim() ?? "";
    return envOrg || principal?.org_id || null;
  }, [principal?.org_id]);

  const handleConfirmCsvExport = useCallback(async () => {
    const orgId = resolveOrgId();
    if (!orgId) {
      setExportModalError("Không xác định được tổ chức để xuất file.");
      return;
    }
    setExporting(true);
    setExportModalError(null);
    try {
      const {
        rows,
        exportLabel,
        snapshotSectionTitle,
        filenameBase,
      } = await loadSnapshotsForCsvExport(
        orgId,
        exportScope,
        exportDay,
        exportMonth,
        exportYear,
      );
      const sorted = [...rows].sort((a, b) =>
        a.snapshot_date.localeCompare(b.snapshot_date),
      );
      const kpiRows = computeReportKpiRows(sorted);
      const latestInScope =
        sorted.length > 0 ? sorted[sorted.length - 1]!.snapshot_date : null;
      const dateCol =
        exportScope === "year" ? "Tháng (kỳ)" : "Ngày";
      const exportRegionNote =
        exportLocationId.trim() === ""
          ? "Tất cả khu vực"
          : reportLocations.find((l) => l.id === exportLocationId)?.name ??
            exportLocationId;
      const exportPeriodNote = `${exportPeriodDays} ngày gần nhất`;
      const csv = buildReportsExportCsv({
        kpiRows,
        latestSnapshotDate: latestInScope,
        snapshots: sorted,
        schedule: [],
        exportLabel,
        exportRegionNote,
        exportPeriodNote,
        snapshotSectionTitle,
        snapshotDateColumnLabel: dateCol,
      });
      downloadCsvToMachine(`${filenameBase}.csv`, csv);
      setExportModalOpen(false);
    } catch (e) {
      setExportModalError(
        e instanceof Error ? e.message : "Không tải dữ liệu để xuất",
      );
    } finally {
      setExporting(false);
    }
  }, [
    resolveOrgId,
    exportScope,
    exportDay,
    exportMonth,
    exportYear,
    exportLocationId,
    exportPeriodDays,
    reportLocations,
  ]);

  return (
    <AppShell activePath="/reports">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <label className="flex items-center gap-2 font-medium text-slate-700">
          <span className="whitespace-nowrap">Chu kỳ:</span>
          <select
            value={periodType}
            onChange={(e) =>
              setPeriodType(e.target.value as ReportPeriodType)
            }
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-800 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="daily">Theo ngày</option>
            <option value="weekly">Theo tuần</option>
            <option value="monthly">Theo tháng</option>
            <option value="yearly">Theo năm</option>
          </select>
        </label>
        {periodType === "daily" ? (
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <span className="whitespace-nowrap">Ngày:</span>
            <input
              type="date"
              value={reportCursorDay}
              onChange={(e) => setReportCursorDay(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
        ) : null}
        {periodType === "weekly" ? (
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <span className="whitespace-nowrap">Tuần:</span>
            <input
              type="week"
              value={reportCursorWeek}
              onChange={(e) => {
                const v = e.target.value;
                if (v) setReportCursorWeek(v);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
        ) : null}
        {periodType === "monthly" ? (
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <span className="whitespace-nowrap">Tháng:</span>
            <input
              type="month"
              value={reportCursorMonth}
              onChange={(e) => setReportCursorMonth(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
        ) : null}
        {periodType === "yearly" ? (
          <label className="flex items-center gap-2 font-medium text-slate-700">
            <span className="whitespace-nowrap">Năm:</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={reportCursorYear}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n)) setReportCursorYear(n);
              }}
              className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
        ) : null}
        {!loading ? (
          <span className="text-xs text-slate-500">
            Đang xem: <span className="font-semibold text-slate-700">{periodFilterHint}</span>
            {snapshots.length === 0 ? (
              <span className="text-slate-600"> — chưa có snapshot KPI trong hệ thống</span>
            ) : displaySnapshots.length === 0 ? (
              <span className="text-amber-700"> — không có snapshot trong phạm vi này</span>
            ) : null}
          </span>
        ) : null}
        <span className="hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
        <span className="font-semibold text-slate-800">KPI tổng hợp từ:</span>
        <Link
          href="/prp-audit"
          className="text-cyan-600 underline decoration-cyan-600/30 underline-offset-2 hover:text-cyan-800"
        >
          Đánh giá PRP
        </Link>
        <span className="text-slate-300">|</span>
        <Link
          href="/haccp-compliance"
          className="text-cyan-600 underline decoration-cyan-600/30 underline-offset-2 hover:text-cyan-800"
        >
          Tuân thủ HACCP (CCP)
        </Link>
        <span className="text-slate-300">|</span>
        <Link
          href="/capa-management"
          className="text-cyan-600 underline decoration-cyan-600/30 underline-offset-2 hover:text-cyan-800"
        >
          CAPA
        </Link>
        <span className="text-slate-300">|</span>
        <Link
          href="/document-control"
          className="text-cyan-600 underline decoration-cyan-600/30 underline-offset-2 hover:text-cyan-800"
        >
          Tài liệu
        </Link>
      </div>
      {loadError ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {loadError}
        </div>
      ) : null}
      {loading ? (
        <p className="mb-4 text-sm text-slate-500">Đang tải KPI…</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!loading && reportsKPIs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-8 text-center shadow-sm sm:col-span-2 xl:col-span-3">
            <p className="font-medium text-slate-800">Không có dữ liệu KPI trong kỳ này</p>
            <p className="mt-2 text-sm text-slate-600">
              Không có snapshot trong phạm vi đang chọn, hoặc chưa có chỉ số nào đủ dữ liệu để hiển thị.
            </p>
          </div>
        ) : null}
        {reportsKPIs.map((kpi) => {
          const slug = slugFromReportKpiLabel(kpi.label);
          const inner = (
            <>
              <p className="text-sm text-slate-500">{kpi.label}</p>
              <p className="mt-2 text-5xl font-extrabold">
                {kpi.value}
                {kpi.unit}
              </p>
              {slug ? (
                <p className="mt-3 text-xs font-medium text-cyan-600">
                  Nhấp để xem chi tiết theo lô, khu vực, thiết bị →
                </p>
              ) : null}
            </>
          );
          const cardClass =
            "rounded-xl bg-white p-5 shadow-sm transition hover:border-cyan-200 hover:shadow-md";
          if (slug) {
            return (
              <Link
                key={kpi.label}
                href={`/reports/kpi/${slug}?${buildKpiDrillQueryFromReports(
                  periodType,
                  reportCursorDay,
                  reportCursorWeek,
                  reportCursorMonth,
                  reportCursorYear,
                )}`}
                className={`${cardClass} block cursor-pointer border border-transparent outline-none ring-cyan-500/0 focus-visible:border-cyan-400 focus-visible:ring-2`}
              >
                {inner}
              </Link>
            );
          }
          return (
            <div key={kpi.label} className={cardClass}>
              {inner}
            </div>
          );
        })}
        <div className="flex flex-col justify-between rounded-xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50/90 p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Xuất dữ liệu
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Xuất báo cáo CSV</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Theo <strong>ngày</strong> (một ngày), <strong>tháng</strong> (đủ ngày trong tháng), hoặc{" "}
              <strong>năm</strong> (12 tháng). KPI trong file khớp phạm vi bạn chọn.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setExportModalError(null);
              setExportLocationId("");
              setExportModalOpen(true);
            }}
            className="mt-5 w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-cyan-600/25 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Xuất Báo cáo
          </button>
        </div>
      </div>

      <section className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">
          Biểu đồ KPI theo kỳ snapshot
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Mỗi cột là một kỳ trong phạm vi bạn chọn ở trên: cột màu đỏ là{" "}
          <strong>số CAPA quá hạn</strong> (trục trái); ba chuỗi còn lại là{" "}
          <strong>% CAPA đóng đúng hạn</strong>, <strong>% tuân thủ PRP</strong> và{" "}
          <strong>% tuân thủ HACCP (CCP)</strong> — thể hiện mức &quot;đạt&quot; theo snapshot (trục phải 0–100%).
        </p>
        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <ReportsKpiSnapshotBarChart chartData={reportsOverviewChartData} />
        </div>
      </section>

      {exportModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2
              id="export-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              Xuất báo cáo CSV
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Chọn phạm vi thời gian, kỳ xem lại và khu vực ghi trên file. Snapshot KPI trong bảng
              vẫn là cấp tổ chức; khu vực và kỳ dùng đối chiếu với biên bản PRP / phạm vi đánh giá.
            </p>

            <fieldset className="mt-4 space-y-2 text-sm">
              <legend className="sr-only">Phạm vi xuất</legend>
              {(
                [
                  ["day", "Theo ngày — một ngày cụ thể"],
                  ["month", "Theo tháng — tất cả ngày trong tháng"],
                  ["year", "Theo năm — tất cả tháng trong năm"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-50/40"
                >
                  <input
                    type="radio"
                    name="csv-export-scope"
                    value={value}
                    checked={exportScope === value}
                    onChange={() => setExportScope(value)}
                    className="mt-0.5"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Khu vực
              <select
                value={exportLocationId}
                onChange={(e) => setExportLocationId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Tất cả khu vực</option>
                {reportLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Kỳ xem lại (ghi trên file)
              <select
                value={exportPeriodDays}
                onChange={(e) => setExportPeriodDays(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value={30}>30 ngày</option>
                <option value={90}>90 ngày</option>
                <option value={120}>120 ngày</option>
                <option value={180}>180 ngày</option>
                <option value={365}>365 ngày</option>
              </select>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              Khu vực và kỳ được ghi vào phần đầu file CSV (đối chiếu PRP / phạm vi đánh giá).
            </p>

            <div className="mt-4">
              {exportScope === "day" ? (
                <label className="block text-sm font-medium text-slate-700">
                  Ngày
                  <input
                    type="date"
                    value={exportDay}
                    onChange={(e) => setExportDay(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  />
                </label>
              ) : null}
              {exportScope === "month" ? (
                <label className="block text-sm font-medium text-slate-700">
                  Tháng
                  <input
                    type="month"
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  />
                </label>
              ) : null}
              {exportScope === "year" ? (
                <label className="block text-sm font-medium text-slate-700">
                  Năm
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={exportYear}
                    onChange={(e) =>
                      setExportYear(Number(e.target.value) || new Date().getFullYear())
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                  />
                </label>
              ) : null}
            </div>

            {exportModalError ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {exportModalError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={exporting}
                onClick={() => setExportModalOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={() => void handleConfirmCsvExport()}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? "Đang tải & xuất…" : "Xuất CSV"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
