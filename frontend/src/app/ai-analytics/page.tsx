"use client";

import { useState } from "react";

import AppShell from "@/components/app-shell";
import { AnomalyDetectionChart } from "@/components/charts";
import {
  aiAnalyticsIoTReadings,
  aiAnalyticsSidebarButtons,
  thresholdAlerts,
} from "@/lib/mock-data";

export default function AiAnalyticsPage() {
  const [activeTab, setActiveTab] = useState(
    aiAnalyticsSidebarButtons[0]?.id ?? "ai",
  );

  return (
    <AppShell activePath="/ai-analytics">
      <div className="grid gap-4 xl:grid-cols-4">
        <aside className="rounded-xl bg-white p-4 shadow-sm">
          {aiAnalyticsSidebarButtons.map((button) => {
            const isActive = button.id === activeTab;

            return (
              <button
                key={button.id}
                type="button"
                onClick={() => setActiveTab(button.id)}
                aria-pressed={isActive}
                className={`mb-2 block w-full rounded-lg px-3 py-2 text-left font-semibold ${
                  isActive
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {button.label}
              </button>
            );
          })}
        </aside>

        <section className="rounded-xl bg-white p-5 shadow-sm xl:col-span-2">
          {activeTab === "ai" ? (
            <>
              <h1 className="text-3xl font-bold text-slate-800">
                Phát hiện bất thường
              </h1>
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <AnomalyDetectionChart />
              </div>
              <div className="mt-5 rounded-lg border border-slate-200 p-4">
                <h2 className="text-2xl font-bold text-slate-800">
                  Cảnh báo ngưỡng
                </h2>
                <ul className="mt-2 space-y-2 text-slate-700">
                  {thresholdAlerts.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-slate-800">
                Tích hợp IoT
              </h1>
              <div className="mt-4 rounded-lg border border-slate-200 p-4">
                <h2 className="text-xl font-bold text-slate-800">
                  Chỉ số cảm biến
                </h2>
                <div className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    Nhiệt độ {aiAnalyticsIoTReadings.temperature} °C
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    Độ ẩm {aiAnalyticsIoTReadings.humidity} %
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    pH {aiAnalyticsIoTReadings.pH}
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-2">
                    Áp suất {aiAnalyticsIoTReadings.pressure} bar
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-slate-200 p-4">
                <h2 className="text-2xl font-bold text-slate-800">
                  Cảnh báo ngưỡng
                </h2>
                <ul className="mt-2 space-y-2 text-slate-700">
                  {thresholdAlerts.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4">
          {activeTab === "ai" ? (
            <>
              <div className="rounded-xl bg-cyan-600 p-5 text-white shadow-sm">
                <p>Nhiệt độ {aiAnalyticsIoTReadings.temperature} °C</p>
                <p className="mt-2">
                  Độ ẩm {aiAnalyticsIoTReadings.humidity} %
                </p>
                <p className="mt-2">pH {aiAnalyticsIoTReadings.pH}</p>
                <p className="mt-2">
                  Áp suất {aiAnalyticsIoTReadings.pressure} bar
                </p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm">
                <h3 className="text-xl font-bold text-slate-800">
                  Tích hợp IoT
                </h3>
                <p className="mt-2 text-slate-700">
                  Nhiệt độ {aiAnalyticsIoTReadings.temperature} °C
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="text-xl font-bold text-slate-800">
                Cảnh báo ngưỡng
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {thresholdAlerts.map((alert) => (
                  <li key={alert}>{alert}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
