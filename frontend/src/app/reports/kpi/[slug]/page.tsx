import { Suspense } from "react";
import {
  parseKpiDrillSnapshotParams,
} from "@/lib/report-kpi-drill-period";
import KpiDrillClient from "./kpi-drill-client";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    periodDays?: string;
    period_type?: string;
    cursor?: string;
  }>;
};

export default async function ReportKpiDrillPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const snapshot = parseKpiDrillSnapshotParams(sp.period_type, sp.cursor);

  const rawPd = sp.periodDays;
  const n = rawPd != null ? Number.parseInt(String(rawPd), 10) : 120;
  const rollingPeriodDays =
    Number.isFinite(n) && n >= 1 && n <= 730 ? n : 120;

  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Đang tải…</p>}>
      <KpiDrillClient
        slug={slug}
        snapshot={snapshot}
        initialRollingPeriodDays={rollingPeriodDays}
      />
    </Suspense>
  );
}
