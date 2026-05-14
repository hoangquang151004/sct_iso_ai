"use client";

import type { ChartData } from "chart.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import {
  InternalAuditChart,
} from "@/components/shared/charts";
import { useAuth } from "@/hooks/use-auth";
import { internalAuditChartData } from "@/lib/mock-data";
import {
  buildReportsExportCsv,
  downloadCsvToMachine,
} from "@/lib/reports-export";
import {
  type CsvExportScope,
  computeReportKpiRows,
  loadSnapshotsForCsvExport,
} from "@/lib/report-export-scope";
import {
  type InternalAuditSummaryDto,
  type KpiSnapshotDto,
  getInternalAuditSummary,
  listKpiSnapshots,
  listReportLocations,
} from "@/api/reports-api";
import { slugFromReportKpiLabel } from "@/lib/report-kpi-slugs";

function signalPanelClass(level: string): string {
  if (level === "danger") {
    return "border-rose-200 bg-rose-50 text-rose-950";
  }
  if (level === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-slate-200 bg-slate-50 text-slate-800";
}

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
export default function ReportsPage() {
  const { principal } = useAuth();
  const [periodType, setPeriodType] = useState<ReportPeriodType>("monthly");
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
  const [internalLocationId, setInternalLocationId] = useState("");
  const [internalPeriodDays, setInternalPeriodDays] = useState(120);
  const [internalSummary, setInternalSummary] =
    useState<InternalAuditSummaryDto | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

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
    let cancelled = false;
    (async () => {
      const envOrg = process.env.NEXT_PUBLIC_ORG_ID?.trim() ?? "";
      const orgId = envOrg || principal?.org_id || "";
      if (!orgId) {
        if (!cancelled) {
          setInternalSummary(null);
          setInternalError(null);
        }
        return;
      }
      setInternalLoading(true);
      setInternalError(null);
      try {
        const data = await getInternalAuditSummary(
          orgId,
          internalLocationId || undefined,
          internalPeriodDays,
        );
        if (!cancelled) setInternalSummary(data);
      } catch (e) {
        if (!cancelled) {
          setInternalSummary(null);
          setInternalError(
            e instanceof Error ? e.message : "Không tải được tóm tắt đánh giá nội bộ",
          );
        }
      } finally {
        if (!cancelled) setInternalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [principal?.org_id, internalLocationId, internalPeriodDays]);

  const sortedAsc = useMemo(
    () =>
      [...snapshots].sort((a, b) =>
        a.snapshot_date.localeCompare(b.snapshot_date),
      ),
    [snapshots],
  );

  const reportsKPIs = useMemo(
    () => computeReportKpiRows(sortedAsc),
    [sortedAsc],
  );

  const auditChartData = useMemo(():
    | ChartData<"bar", (number | null)[], string>
    | undefined => {
    if (sortedAsc.length === 0) return undefined;
    return {
      labels: sortedAsc.map((s) =>
        formatSnapshotAxisLabel(s.snapshot_date, s.period_type ?? periodType),
      ),
      datasets: [
        {
          label: internalAuditChartData.datasets[0].label,
          data: sortedAsc.map((s) => s.haccp_deviation_count ?? 0),
          backgroundColor: "#06b6d4",
          borderRadius: 6,
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
                href={`/reports/kpi/${slug}?periodDays=${internalPeriodDays}`}
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
              setExportPeriodDays(internalPeriodDays);
              setExportModalOpen(true);
            }}
            className="mt-5 w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-cyan-600/25 transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Chọn phạm vi rồi xuất
          </button>
        </div>
      </div>

      <div className="mt-4">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Báo cáo đánh giá nội bộ
          </h2>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex min-w-[200px] flex-col gap-1 text-sm font-medium text-slate-700">
              Khu vực
              <select
                value={internalLocationId}
                onChange={(e) => setInternalLocationId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Tất cả khu vực</option>
                {reportLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[160px] flex-col gap-1 text-sm font-medium text-slate-700">
              Kỳ xem lại
              <select
                value={internalPeriodDays}
                onChange={(e) => setInternalPeriodDays(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value={30}>30 ngày</option>
                <option value={90}>90 ngày</option>
                <option value={120}>120 ngày</option>
                <option value={180}>180 ngày</option>
                <option value={365}>365 ngày</option>
              </select>
            </label>
          </div>

          {internalError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {internalError}
            </p>
          ) : null}

          {internalLoading ? (
            <p className="mt-3 text-sm text-slate-500">Đang tải tóm tắt theo khu vực…</p>
          ) : internalSummary ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">
                  {internalSummary.location_name}
                </span>
                <span className="mx-2 text-slate-300">|</span>
                <span>{internalSummary.period_days} ngày gần nhất</span>
                <span className="mx-2 text-slate-300">|</span>
                <span>PRP: {internalSummary.prp_audit_count} phiên</span>
                <span className="mx-2 text-slate-300">|</span>
                <span>
                  TB tuân thủ PRP:{" "}
                  {internalSummary.prp_avg_compliance != null
                    ? `${internalSummary.prp_avg_compliance}%`
                    : "—"}
                </span>
                <span className="mx-2 text-slate-300">|</span>
                <span>NC mở (toàn TC): {internalSummary.open_nc_org_count}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span>Lệch CCP (toàn TC): {internalSummary.haccp_deviation_org_count}</span>
              </div>
              <ul className="space-y-2">
                {internalSummary.signals.map((s, idx) => (
                  <li
                    key={`${s.level}-${idx}`}
                    className={`rounded-lg border px-3 py-2.5 text-sm leading-snug ${signalPanelClass(s.level)}`}
                  >
                    {s.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 rounded-lg bg-slate-50 p-3">
            <InternalAuditChart
              chartData={
                auditChartData ??
                (!loading
                  ? {
                      labels: ["—"],
                      datasets: [
                        {
                          label: internalAuditChartData.datasets[0].label,
                          data: [0],
                          backgroundColor: "#06b6d4",
                          borderRadius: 6,
                        },
                      ],
                    }
                  : undefined)
              }
            />
          </div>
        </section>
      </div>

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
