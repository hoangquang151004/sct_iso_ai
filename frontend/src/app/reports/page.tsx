"use client";

import type { ChartData } from "chart.js";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import {
  InternalAuditChart,
  OeeQualityYieldChart,
  ReportSparklineChart,
} from "@/components/shared/charts";
import { useAuth } from "@/hooks/use-auth";
import {
  internalAuditChartData,
  oeeQualityYieldChartData,
  exportSchedule,
} from "@/lib/mock-data";
import {
  buildReportsExportCsv,
  downloadCsvToMachine,
} from "@/lib/reports-export";
import {
  type KpiSnapshotDto,
  listKpiSnapshots,
} from "@/api/reports-api";

type ReportKpiRow = {
  label: string;
  value: number | string;
  unit: string;
};

/** Tỷ lệ KPI từ API đang ở thang 0–100 (giống prp_audit_compliance_rate). */
function roundRatePct(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
}
/** Tháng gần nhất (từ cuối timeline) thỏa điều kiện — tránh tháng hiện tại chưa có log làm mất KPI. */
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

/**
 * Tuân thủ HACCP dạng %: ưu tiên haccp_ccp_monitored_rate; nếu API chưa có thì ước từ số lệch.
 * (Chỉ gọi với snapshot đã có tín hiệu HACCP — xem lastSnapshotWhereDesc.)
 */

  function haccpCompliancePercent(s: KpiSnapshotDto): number {
  const r = s.haccp_ccp_monitored_rate;
  if (r != null && !Number.isNaN(Number(r))) {
    return roundRatePct(Number(r));
  }
  const dev = s.haccp_deviation_count ?? 0;
  return roundRatePct(100 - Math.min(100, dev * 8));
}

/**
  CAPA đúng hạn: ưu tiên capa_ontime_closure_rate; nếu null thì chỉ ước khi còn CAPA mở hoặc quá hạn.
 * open=0 & overdue=0 & rate=null → không đủ dữ liệu (tránh hiển thị 100% khi chưa có CAPA).
*/
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

  const sortedAsc = useMemo(
    () =>
      [...snapshots].sort((a, b) =>
        a.snapshot_date.localeCompare(b.snapshot_date),
      ),
    [snapshots],
  );

  const latest = useMemo(
    () =>
      sortedAsc.length > 0 ? sortedAsc[sortedAsc.length - 1]! : null,
    [sortedAsc],
  );

  const reportsKPIs: ReportKpiRow[] = useMemo(() => {
    if (sortedAsc.length === 0) {
      return [
        { label: "Tuân thủ PRP", value: "—", unit: "" },
        { label: "Tuân thủ HACCP", value: "—", unit: "" },
        { label: "CAPA đúng hạn", value: "—", unit: "" },
      ];
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
    return [
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
  }, [sortedAsc]);

  const sparklineValues = useMemo(
    () =>
      sortedAsc.length > 0
        ? sortedAsc.map((s) => Number(s.prp_audit_compliance_rate ?? 0))
        : undefined,
    [sortedAsc],
  );

  const oeeChartData = useMemo(():
    | ChartData<"bar", (number | null)[], string>
    | undefined => {
    if (!latest || sortedAsc.length === 0) return undefined;
    const maxDoc = Math.max(
      ...sortedAsc.map((s) => s.doc_total ?? 0),
      1,
    );
    const prp = Math.min(100, Math.round(latest.prp_audit_compliance_rate ?? 0));
    const docBar = Math.min(
      100,
      Math.round(((latest.doc_total ?? 0) / maxDoc) * 100),
    );
    return {
      labels: [...oeeQualityYieldChartData.labels],
      datasets: [
        {
          ...oeeQualityYieldChartData.datasets[0],
          data: [prp, docBar],
        },
      ],
    };
  }, [latest, sortedAsc]);

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

  const handleExportReport = useCallback(() => {
    setExporting(true);
    try {
      const csv = buildReportsExportCsv({
        kpiRows: reportsKPIs,
        latestSnapshotDate: latest?.snapshot_date ?? null,
        snapshots: sortedAsc,
        schedule: exportSchedule,
      });
      const day = new Date().toISOString().slice(0, 10);
      downloadCsvToMachine(`bao-cao-kpi-${periodType}-${day}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }, [reportsKPIs, latest, sortedAsc, periodType]);

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
        <span className="ml-auto text-xs text-slate-500">
          Dữ liệu mới trên các trang trên sẽ phản ánh khi bạn mở lại báo cáo.
        </span>
      </div>
      {loadError ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {loadError}
        </div>
      ) : null}
      {loading ? (
        <p className="mb-4 text-sm text-slate-500">Đang tải KPI…</p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        {reportsKPIs.map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-5xl font-extrabold">
              {kpi.value}
              {kpi.unit}
            </p>
          </div>
        ))}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="rounded bg-slate-100 p-3">
            <ReportSparklineChart
              values={
                !loading && sortedAsc.length === 0
                  ? [0]
                  : sparklineValues
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">OEE & Tỷ lệ đạt chất lượng</h2>
          <div className="mt-4 rounded bg-slate-50 p-3">
            <OeeQualityYieldChart
              chartData={
                oeeChartData ??
                (!loading
                  ? {
                      labels: [...oeeQualityYieldChartData.labels],
                      datasets: [
                        {
                          ...oeeQualityYieldChartData.datasets[0],
                          data: [0, 0],
                        },
                      ],
                    }
                  : undefined)
              }
            />
          </div>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-bold">Báo cáo đánh giá nội bộ</h2>
          <div className="mt-4 rounded bg-slate-50 p-3">
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

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-bold">Lịch xuất báo cáo</h2>
          <table className="mt-4 w-full text-left text-sm text-slate-700">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2">Báo cáo</th>
                <th className="py-2">Định dạng</th>
                <th className="py-2">Tần suất</th>
              </tr>
            </thead>
            <tbody>
              {exportSchedule.map((report) => (
                <tr key={report.name} className="border-b border-slate-100">
                  <td className="py-2 font-semibold text-slate-800">
                    {report.name}
                  </td>
                  <td className="py-2">{report.format}</td>
                  <td className="py-2 text-emerald-600">{report.frequency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <p className="mt-4 text-xs text-slate-500">
            Tải file CSV về máy (mở được bằng Excel), gồm KPI hiện tại, lịch sử
            snapshot và lịch xuất tham chiếu.
          </p>
          <button
            type="button"
            disabled={loading || exporting}
            onClick={handleExportReport}
            className="mt-6 w-full rounded-lg bg-cyan-600 px-4 py-3 text-lg font-semibold text-white shadow-lg shadow-cyan-600/20 transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? "Đang chuẩn bị…" : "Xuất báo cáo"}
          </button>
        </section>
      </div>
    </AppShell>
  );
}
