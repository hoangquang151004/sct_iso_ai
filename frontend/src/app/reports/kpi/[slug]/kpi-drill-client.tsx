"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/use-auth";
import {
  type KpiDrilldownDto,
  type KpiDrillRequest,
  getKpiDrilldown,
} from "@/api/reports-api";
import {
  REPORT_KPI_SLUGS,
  type ReportKpiSlug,
  titleForKpiSlug,
} from "@/lib/report-kpi-slugs";
import {
  formatKpiDrillPeriodLabel,
  type ReportDrillPeriodType,
} from "@/lib/report-kpi-drill-period";

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

function drillHeadlineHasData(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (t === "—" || t === "-" || t === "–") return false;
  return true;
}

type SnapshotProps = { periodType: ReportDrillPeriodType; cursor: string };

export default function KpiDrillClient({
  slug,
  snapshot,
  initialRollingPeriodDays,
}: {
  slug: string;
  snapshot: SnapshotProps | null;
  initialRollingPeriodDays: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { principal } = useAuth();
  const validSlug = useMemo(
    () => REPORT_KPI_SLUGS.find((s) => s === slug) ?? null,
    [slug],
  );
  const [rollingPeriodDays, setRollingPeriodDays] = useState(initialRollingPeriodDays);
  const [data, setData] = useState<KpiDrilldownDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRollingPeriodDays(initialRollingPeriodDays);
  }, [initialRollingPeriodDays]);

  const drillRequest: KpiDrillRequest = useMemo(
    () =>
      snapshot
        ? {
            mode: "snapshot" as const,
            periodType: snapshot.periodType,
            cursor: snapshot.cursor,
          }
        : { mode: "rolling" as const, periodDays: rollingPeriodDays },
    [snapshot?.periodType, snapshot?.cursor, rollingPeriodDays],
  );

  const periodDescription = useMemo(() => {
    if (snapshot) {
      return formatKpiDrillPeriodLabel(snapshot.periodType, snapshot.cursor);
    }
    return `${rollingPeriodDays} ngày gần nhất (tính đến hết hôm nay)`;
  }, [snapshot, rollingPeriodDays]);

  const rollingOptions = useMemo(() => {
    const base = [30, 60, 90, 120, 180, 365];
    const merged = new Set(base);
    if (rollingPeriodDays >= 1 && rollingPeriodDays <= 730) {
      merged.add(rollingPeriodDays);
    }
    return Array.from(merged).sort((a, b) => a - b);
  }, [rollingPeriodDays]);

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
        const res = await getKpiDrilldown(orgId, validSlug, drillRequest);
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
  }, [principal?.org_id, validSlug, drillRequest]);

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
            Phân rã theo <strong>khu vực</strong>, <strong>lô</strong> hoặc <strong>thiết bị</strong> (dữ liệu nguồn).{" "}
            <strong>Kỳ:</strong> {periodDescription}.
            {snapshot ? (
              <span className="block text-slate-500">
                Dữ liệu lọc theo đúng khoảng lịch này (cùng chu kỳ với trang báo cáo).
              </span>
            ) : (
              <span className="block text-slate-500">
                Chế độ cửa sổ trượt: có thể chỉnh số ngày bên cạnh hoặc mở từ thẻ KPI trên báo cáo để theo ngày/tuần/tháng/năm.
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {snapshot ? null : (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Kỳ (ngày)
              <select
                value={rollingPeriodDays}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRollingPeriodDays(v);
                  router.replace(`${pathname}?periodDays=${v}`);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {rollingOptions.map((d) => (
                  <option key={d} value={d}>
                    {d} ngày
                  </option>
                ))}
              </select>
            </label>
          )}
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
          {(() => {
            const hasHeadline = drillHeadlineHasData(data.headline_value);
            const blocksWithData = data.blocks.filter((b) => b.rows.length > 0);
            if (!hasHeadline && blocksWithData.length === 0) {
              return (
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-8 text-center shadow-sm">
                  <p className="font-medium text-slate-800">Không có dữ liệu trong kỳ đã chọn</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Không có chỉ số hay chi tiết nào trong phạm vi ngày / tuần / tháng / năm bạn đang xem.
                  </p>
                </div>
              );
            }
            return (
              <>
                {hasHeadline ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">{data.headline_label}</p>
                    <p className="mt-1 text-4xl font-extrabold text-slate-900">{data.headline_value}</p>
                    {data.is_low_signal ? (
                      <p className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
                        Chỉ số cần chú ý
                      </p>
                    ) : null}
                  </div>
                ) : null}

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

                {blocksWithData.map((block) => (
                  <section
                    key={block.dimension}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-lg font-bold text-slate-900">{block.dimension}</h2>
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
                  </section>
                ))}
              </>
            );
          })()}
        </div>
      ) : null}
    </AppShell>
  );
}
