"use client";

import type { ChartData } from "chart.js";
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
} from "@/lib/reports-api";

type ReportKpiRow = {
  label: string;
  value: number | string;
  unit: string;
};

/** Tỷ lệ KPI từ API đang ở thang 0–100 (giống prp_audit_compliance_rate). */
function roundRatePct(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;
}

/**
 * Tuân thủ HACCP dạng %: ưu tiên haccp_ccp_monitored_rate; nếu API chưa có thì ước lượng từ số lệch
 * (chỉ để hiển thị — backend có thể thay bằng giá trị thật sau).
 */
function haccpCompliancePercent(latest: KpiSnapshotDto): number {
  const r = latest.haccp_ccp_monitored_rate;
  if (r != null && !Number.isNaN(Number(r))) {
    return roundRatePct(Number(r));
  }
  const dev = latest.haccp_deviation_count ?? 0;
  return roundRatePct(100 - Math.min(100, dev * 8));
}

/**
 * CAPA đúng hạn dạng %: ưu tiên capa_ontime_closure_rate; nếu null thì ước từ số CAPA mở.
 */
function capaOntimePercent(latest: KpiSnapshotDto): number {
  const r = latest.capa_ontime_closure_rate;
  if (r != null && !Number.isNaN(Number(r))) {
    return roundRatePct(Number(r));
  }
  const open = latest.capa_open_count ?? 0;
  return roundRatePct(100 - Math.min(100, open * 10));
}

export default function ReportsPage() {
  const { principal } = useAuth();
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
        const rows = await listKpiSnapshots(orgId, "monthly");
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
  }, [principal?.org_id]);

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
    if (!latest) {
      return [
        { label: "Tuân thủ PRP", value: "—", unit: "" },
        { label: "Tuân thủ HACCP", value: "—", unit: "" },
        { label: "CAPA đúng hạn", value: "—", unit: "" },
      ];
    }
    const prp = latest.prp_audit_compliance_rate ?? 0;
    const prpRounded = Math.round(prp * 10) / 10;
    return [
      { label: "Tuân thủ PRP", value: prpRounded, unit: "%" },
      {
        label: "Tuân thủ HACCP",
        value: haccpCompliancePercent(latest),
        unit: "%",
      },
      {
        label: "CAPA đúng hạn",
        value: capaOntimePercent(latest),
        unit: "%",
      },
    ];
  }, [latest]);

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
      labels: sortedAsc.map((s) => {
        const [y, m] = s.snapshot_date.split("-");
        return `${Number(m)}/${String(y).slice(2)}`;
      }),
      datasets: [
        {
          label: internalAuditChartData.datasets[0].label,
          data: sortedAsc.map((s) => s.haccp_deviation_count ?? 0),
          backgroundColor: "#06b6d4",
          borderRadius: 6,
        },
      ],
    };
  }, [sortedAsc]);

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
      downloadCsvToMachine(`bao-cao-kpi-${day}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }, [reportsKPIs, latest, sortedAsc]);

  return (
    <AppShell activePath="/reports">
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
