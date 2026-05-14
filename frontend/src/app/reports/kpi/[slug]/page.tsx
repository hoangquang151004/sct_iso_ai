import { Suspense } from "react";
import KpiDrillClient from "./kpi-drill-client";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ periodDays?: string }>;
};

export default async function ReportKpiDrillPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const raw = sp.periodDays;
  const n = raw != null ? Number.parseInt(String(raw), 10) : 120;
  const periodDays = Number.isFinite(n) && n >= 7 && n <= 730 ? n : 120;

  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Đang tải…</p>}>
      <KpiDrillClient slug={slug} initialPeriodDays={periodDays} />
    </Suspense>
  );
}
