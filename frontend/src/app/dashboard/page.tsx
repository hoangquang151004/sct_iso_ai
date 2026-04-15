import AppShell from "@/components/app-shell";
import { DeviationByCcpChart, IncidentTrendsChart } from "@/components/charts";
import {
  dashboardAlerts,
  dashboardIoTReadings,
  dashboardKPIs,
  dashboardTasks,
} from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <AppShell activePath="/dashboard">
      <div className="grid gap-4 xl:grid-cols-4">
        {dashboardKPIs.map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{kpi.label}</p>
            <p className="mt-2 text-5xl font-extrabold text-slate-800">
              {kpi.value}
              {kpi.unit}
            </p>
          </div>
        ))}
        <div className="rounded-xl bg-cyan-600 p-5 text-white shadow-sm">
          <p className="font-semibold">Giám sát IoT</p>
          <p className="mt-3">Nhiệt độ {dashboardIoTReadings.temperature}°C</p>
          <p>Độ ẩm {dashboardIoTReadings.humidity}%</p>
          <p>pH {dashboardIoTReadings.pH}</p>
          <p>Áp suất {dashboardIoTReadings.pressure} bar</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">Xu hướng sự cố</h2>
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <IncidentTrendsChart />
          </div>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">
            Sai lệch theo CCP
          </h2>
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <DeviationByCcpChart />
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-bold text-slate-800">
            Công việc sắp tới
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {dashboardTasks.map((task, index) => (
              <li
                key={`${task.title}-${task.dueDate}`}
                className={`flex justify-between ${
                  index === dashboardTasks.length - 1
                    ? ""
                    : "border-b border-slate-100 pb-2"
                }`}
              >
                <span>{task.title}</span>
                <span>{task.dueDate}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800">Cảnh báo gần đây</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {dashboardAlerts.map((alert) => (
              <li key={alert.message}>{alert.message}</li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
