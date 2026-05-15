import AppShell from "@/components/layout/app-shell";
import { Ccp1TemperatureChart } from "@/components/shared/charts";
import {
  activeCapas,
  ccpStatusList,
  dashboardDetailedKPIs,
  detailedNCs,
  prpComplianceProgress,
  recentActivities,
  upcomingEvents,
} from "@/lib/mock-data";

export default function DashboardPage() {
  const currentDate = new Date().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <AppShell activePath="/dashboard">
      {/* Header Section */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Tổng quan hệ thống FSMS
          </h1>
          <p className="text-sm text-slate-500">
            Công ty Cổ phần Thực phẩm SCT | Ngày {currentDate}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
            </span>
            1 cảnh báo khẩn
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
            NVA
          </div>
        </div>
      </header>

      {/* Banner Cảnh báo khẩn */}
      <div className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-4">
          <div className="text-2xl text-red-600">⚠️</div>
          <div>
            <p className="font-bold text-red-800">Cảnh báo: Sai lệch nhiệt độ tại CCP-1</p>
            <p className="text-sm text-red-700">
              Mẻ hàng #L-2309 | Ca sáng | 14:30 | Đo được: 82.0°C (Ngưỡng: ≥ 88.0°C) | NC-2023-085 đã phát sinh.
            </p>
          </div>
        </div>
        <button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700">
          Xem xử lý
        </button>
      </div>

      {/* 4 Thẻ KPI */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {dashboardDetailedKPIs.map((kpi) => (
          <div key={kpi.label} className="relative rounded-xl bg-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xl">{kpi.icon}</span>
              <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold text-slate-800">{kpi.value}</span>
              {kpi.unit && <span className="text-lg font-bold text-slate-600">{kpi.unit}</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{kpi.detail}</p>
            <div className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider
              ${kpi.color === "emerald" ? "bg-emerald-100 text-emerald-700" : 
                kpi.color === "amber" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
              {kpi.status}
            </div>
          </div>
        ))}
      </div>

      {/* Khu vực 3 cột phía dưới */}
      <div className="grid grid-cols-12 gap-6">
        {/* Cột trái - 40% (span 5) */}
        <div className="col-span-5 flex flex-col gap-6">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Theo dõi nhiệt độ CCP-1</h2>
            <div className="rounded-lg bg-slate-50 p-2">
              <Ccp1TemperatureChart />
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Trạng thái CCP hiện tại</h2>
            <div className="space-y-3">
              {ccpStatusList.map((ccp) => (
                <div key={ccp.name} className="flex items-center justify-between rounded-lg border border-slate-50 bg-slate-50/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${ccp.color === "emerald" ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`}></div>
                    <span className="text-sm font-semibold text-slate-700">{ccp.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-600">{ccp.value}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase
                      ${ccp.color === "emerald" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {ccp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Cột giữa - (span 4) */}
        <div className="col-span-4 flex flex-col gap-6">
          {/* Khối 1 - Sự không phù hợp */}
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Sự không phù hợp (NC)</h2>
            <div className="space-y-4">
              {detailedNCs.map((nc) => (
                <div key={nc.code} className="flex gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white font-bold
                    ${nc.type === "Major" ? "bg-red-700" : "bg-amber-500"}`}>
                    {nc.type[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{nc.name}</p>
                    <p className="text-xs text-slate-500">{nc.code} | {nc.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Khối 2 - CAPA đang xử lý */}
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-800">CAPA đang xử lý</h2>
            <div className="space-y-3">
              {activeCapas.map((capa) => (
                <div key={capa.code} className="flex items-center justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <span className="text-sm font-medium text-slate-700">{capa.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase
                    ${capa.color === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {capa.deadline}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Khối 3 - Tuân thủ PRP */}
          <section className="rounded-xl bg-white p-5 shadow-sm text-slate-800">
            <h2 className="mb-4 text-lg font-bold">Tuân thủ PRP</h2>
            <div className="space-y-4">
              {prpComplianceProgress.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium">{item.label}</span>
                    <span className="font-bold">{item.value}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div 
                      className={`h-2 rounded-full ${item.color === "emerald" ? "bg-emerald-500" : "bg-amber-500"}`} 
                      style={{ width: `${item.value}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Cột phải - (span 3) */}
        <div className="col-span-3 flex flex-col gap-6">
          {/* Khối 1 - Sự kiện sắp tới */}
          <section className="rounded-xl bg-white p-5 shadow-sm text-slate-800">
            <h2 className="mb-4 text-lg font-bold">Sự kiện sắp tới</h2>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div key={event.title} className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                    <span className="text-lg font-bold leading-none">{event.day}</span>
                    <span className="text-[10px] uppercase">{event.month}</span>
                  </div>
                  <div className="overflow-hidden">
                    <p className="truncate text-sm font-bold">{event.title}</p>
                    <p className="truncate text-xs text-slate-500">{event.owner}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Khối 2 - Hoạt động gần đây */}
          <section className="rounded-xl bg-white p-5 shadow-sm text-slate-800">
            <h2 className="mb-4 text-lg font-bold text-slate-800">Hoạt động gần đây</h2>
            <div className="space-y-4">
              {recentActivities.map((act, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${act.color}`}>
                    {act.initials}
                  </div>
                  <div className="flex flex-1 justify-between gap-2 overflow-hidden">
                    <p className="text-xs leading-tight">
                      <span className="font-bold">{act.name}</span> {act.action}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
