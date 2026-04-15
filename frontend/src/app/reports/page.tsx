import AppShell from "@/components/app-shell";
import {
  InternalAuditChart,
  OeeQualityYieldChart,
  ReportSparklineChart,
} from "@/components/charts";
import { exportSchedule, reportsKPIs } from "@/lib/mock-data";

export default function ReportsPage() {
  return (
    <AppShell activePath="/reports">
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
            <ReportSparklineChart />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">OEE & Tỷ lệ đạt chất lượng</h2>
          <div className="mt-4 rounded bg-slate-50 p-3">
            <OeeQualityYieldChart />
          </div>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-bold">Báo cáo đánh giá nội bộ</h2>
          <div className="mt-4 rounded bg-slate-50 p-3">
            <InternalAuditChart />
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
          <button className="mt-10 w-full rounded-lg bg-cyan-600 px-4 py-3 text-lg font-semibold text-white">
            Xuất báo cáo
          </button>
        </section>
      </div>
    </AppShell>
  );
}
