"use client";

import { useState } from "react";

import AppShell from "@/components/layout/app-shell";
import { HazardAnalysisChart } from "@/components/shared/charts";
import {
  ccps,
  haccpBreadcrumb,
  haccpSidebarButtons,
  monitoringRecords,
  processFlow,
} from "@/lib/mock-data";

export default function HaccpCompliancePage() {
  const [activeTab, setActiveTab] = useState(
    haccpSidebarButtons[0]?.id ?? "process-flow",
  );
  const hazardColor = (hazardType: string) => {
    if (hazardType === "Sinh học") {
      return "bg-orange-500";
    }
    if (hazardType === "Hóa học") {
      return "bg-emerald-500";
    }
    if (hazardType === "Vật lý") {
      return "bg-blue-500";
    }
    return "bg-teal-500";
  };

  return (
    <AppShell activePath="/haccp-compliance">
      <div className="overflow-hidden rounded-xl bg-white shadow">
        <div className="border-t border-cyan-600 bg-[#1e8b9b] px-6 py-4 text-white">
          <div className="flex items-center">
            <h1 className="w-40 shrink-0 text-2xl font-bold">HACCP</h1>
            <div className="border-l border-teal-500 pl-6">
              <h2 className="text-xl font-semibold">Tuân thủ HACCP</h2>
              <p className="mt-1 text-xs text-teal-100">{haccpBreadcrumb}</p>
            </div>
          </div>
        </div>

        <div className="flex">
          <aside className="w-48 border-r border-slate-200 bg-white pt-4 shadow-sm">
            {haccpSidebarButtons.map((button) => {
              const isActive = button.id === activeTab;

              return (
                <button
                  key={button.id}
                  type="button"
                  onClick={() => setActiveTab(button.id)}
                  aria-pressed={isActive}
                  className={`flex w-full items-center gap-3 px-6 py-3 text-left text-sm font-medium ${
                    isActive
                      ? "bg-[#1e8b9b] text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-500/70" />
                  {button.label}
                </button>
              );
            })}
          </aside>

          <div className="flex-1 bg-white p-6">
            <div className="flex gap-8">
              <div className="flex-1 space-y-8">
                {activeTab === "process-flow" && (
                  <div>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">
                      Sơ đồ quy trình
                    </h3>
                    <div className="flex items-center space-x-2 text-sm">
                      {processFlow.map((stage, index) => (
                        <div key={stage.name} className="flex items-center">
                          <span className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-blue-800">
                            {stage.name}
                          </span>
                          {index < processFlow.length - 1 ? (
                            <span className="mx-2 text-slate-400">&#8594;</span>
                          ) : (
                            <span className="relative ml-2">
                              <span className="absolute -bottom-4 -right-2 rounded bg-orange-400 px-2 py-0.5 text-[10px] font-bold text-white">
                                CCP1
                              </span>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "ccps" && (
                  <div>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">
                      CCP & Giới hạn tới hạn
                    </h3>
                    <div className="overflow-hidden rounded-lg border border-slate-100">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-teal-50/60">
                          <tr>
                            <th className="px-3 py-2 font-medium">CCP</th>
                            <th className="px-3 py-2 font-medium">Công đoạn</th>
                            <th className="px-3 py-2 font-medium">Mối nguy</th>
                            <th className="px-3 py-2 font-medium">
                              Giới hạn tới hạn
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ccps.map((ccp, index) => (
                            <tr key={`${ccp.id}-${index}`}>
                              <td className="px-3 py-3">{ccp.id}</td>
                              <td className="px-3 py-3">{ccp.processStage}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center">
                                  <span
                                    className={`mr-2 h-3 w-3 rounded-full ${hazardColor(ccp.hazardType)}`}
                                  />
                                  {ccp.hazardType}
                                </div>
                              </td>
                              <td className="px-3 py-3">{ccp.criticalLimit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === "monitoring" && (
                  <div>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">
                      Kế hoạch giám sát
                    </h3>
                    <div className="overflow-hidden rounded-lg border border-slate-100">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-teal-50/60">
                          <tr>
                            <th className="px-3 py-2 font-medium">Mã lô</th>
                            <th className="px-3 py-2 font-medium">Ngày</th>
                            <th className="px-3 py-2 font-medium">Giờ</th>
                            <th className="px-3 py-2 font-medium text-right">
                              Thanh trùng
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {monitoringRecords.map((record) => (
                            <tr key={record.lotId}>
                              <td className="px-3 py-3">{record.lotId}</td>
                              <td className="px-3 py-3">{record.date}</td>
                              <td className="px-3 py-3">{record.time}</td>
                              <td className="px-3 py-3 text-right">
                                {record.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-72 space-y-8">
                <div>
                  <h3 className="mb-4 text-lg font-bold text-slate-800">
                    Phân tích mối nguy
                  </h3>
                  <div className="rounded-lg border border-slate-100 p-3">
                    <HazardAnalysisChart />
                  </div>
                </div>

                <div className="mt-12">
                  <h3 className="mb-4 text-lg font-bold text-slate-800">
                    Giám sát theo lô
                  </h3>
                  <div className="overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-teal-50/60">
                        <tr>
                          <th className="px-2 py-2 font-medium">Mã lô</th>
                          <th className="px-2 py-2 font-medium">Ngày</th>
                          <th className="px-2 py-2 font-medium">Giờ</th>
                          <th className="px-2 py-2 font-medium">Thanh trùng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {monitoringRecords.map((record) => (
                          <tr key={`right-${record.lotId}`}>
                            <td className="px-2 py-2">{record.lotId}</td>
                            <td className="px-2 py-2">{record.date}</td>
                            <td className="px-2 py-2">{record.time}</td>
                            <td className="px-2 py-2">{record.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
