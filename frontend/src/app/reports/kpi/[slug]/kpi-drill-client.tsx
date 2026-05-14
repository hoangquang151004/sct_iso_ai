"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { type KpiDrilldownDto, getKpiDrilldown } from "@/api/reports-api";
import {
  REPORT_KPI_SLUGS,
  type ReportKpiSlug,
  titleForKpiSlug,
} from "@/lib/report-kpi-slugs";

function rowSeverityClass(sev: string): string {
  if (sev === "danger") return "border-rose-200 bg-rose-50/80";
  if (sev === "warn") return "border-amber-200 bg-amber-50/70";
  return "border-slate-200 bg-white";
}

const MODULE_LINK: Record<ReportKpiSlug, string> = {
  prp: "/prp-audit",
  haccp: "/haccp-compliance",
  capa: "/capa-management",
};

/** Bật khi cần hiển thị gợi ý phân tích (ai_insights từ API). */
const SHOW_ANALYSIS_INSIGHTS = false;

export default function KpiDrillClient({
  slug,
  initialPeriodDays,
}: {
  slug: string;
  initialPeriodDays: number;
}) {
  const { principal } = useAuth();
  const validSlug = useMemo(
    () => REPORT_KPI_SLUGS.find((s) => s === slug) ?? null,
    [slug],
  );
  const [periodDays, setPeriodDays] = useState(initialPeriodDays);
  const [data, setData] = useState<KpiDrilldownDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPeriodDays(initialPeriodDays);
  }, [initialPeriodDays]);

  useEffect(() => {
    if (!validSlug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const envOrg = process.env.NEXT_PUBLIC_ORG_ID?.trim() ?? "";
        const orgId = envOrg || principal?.org_id || "";
        if (!orgId) throw new Error("Không xác định được tổ chức.");
        const res = await getKpiDrilldown(orgId, validSlug, periodDays);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setErr(e instanceof Error ? e.message : "Không tải được drill-down");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [principal?.org_id, validSlug, periodDays]);

  if (!validSlug) {
    return (
      <AppShell activePath="/reports">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">Đường dẫn KPI không hợp lệ.</p>
          <Link href="/reports" className="mt-3 inline-block text-cyan-700 underline">
            ← Quay lại báo cáo
          </Link>
        </div>
      </AppShell>
    );
  }

  const title = titleForKpiSlug(validSlug);
  const moduleHref = MODULE_LINK[validSlug];

  return (
    <AppShell activePath="/reports">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <Link href="/reports" className="font-medium text-cyan-700 hover:text-cyan-900">
          Báo cáo
        </Link>
        <span className="text-slate-300" aria-hidden>
          /
        </span>
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="text-slate-400">· chi tiết</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Phân rã theo <strong>khu vực</strong>, <strong>lô</strong> hoặc <strong>thiết bị</strong> (dữ liệu nguồn). Kỳ:{" "}
            <strong>{periodDays} ngày</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Kỳ
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value={30}>30 ngày</option>
              <option value={90}>90 ngày</option>
              <option value={120}>120 ngày</option>
              <option value={180}>180 ngày</option>
              <option value={365}>365 ngày</option>
            </select>
          </label>
          <Link
            href="/reports"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            ← Quay lại báo cáo
          </Link>
          <Link
            href={moduleHref}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700"
          >
            Mở module nguồn
          </Link>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-500">Đang tải chi tiết…</p> : null}
      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{err}</div>
      ) : null}

      {data && !loading ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{data.headline_label}</p>
            <p className="mt-1 text-4xl font-extrabold text-slate-900">{data.headline_value}</p>
            {data.is_low_signal ? (
              <p className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                Chỉ số cần chú ý
              </p>
            ) : null}
          </div>

          {SHOW_ANALYSIS_INSIGHTS && data.ai_insights.length > 0 ? (
            <section className="rounded-xl border border-cyan-100 bg-gradient-to-br from-cyan-50/80 to-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wide text-cyan-800">Gợi ý phân tích</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-800">
                {data.ai_insights.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.blocks.map((block) => (
            <section
              key={block.dimension}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-bold text-slate-900">{block.dimension}</h2>
              {block.rows.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Không có dữ liệu trong kỳ.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {block.rows.map((r) => (
                    <li
                      key={r.row_id}
                      className={`rounded-lg border px-3 py-2.5 text-sm ${rowSeverityClass(r.severity)}`}
                    >
                      <div className="font-semibold text-slate-900">{r.title}</div>
                      {r.subtitle ? (
                        <div className="mt-0.5 text-xs text-slate-600">{r.subtitle}</div>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-800">
                        <span>{r.metric_primary}</span>
                        {r.metric_secondary ? (
                          <span className="text-slate-500">{r.metric_secondary}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </AppShell>
  );
}
