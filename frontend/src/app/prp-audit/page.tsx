"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import { prpService } from "@/services";
import { capaService, NonConformity } from "@/services/capa-service";
import { Location, PRPAudit, PRPChecklistTemplate, PRPProgram } from "@/types";
import { auditMonths } from "@/lib/mock-data";

import { useToast, useAuth } from "@/hooks";

const getNCStatusBadge = (nc: any) => {
  // Ưu tiên hiển thị trạng thái từ CAPA nếu NC này đã được tạo CAPA
  const displayStatus = nc.capa_status || nc.status;

  switch (displayStatus) {
    case "WAITING":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse"></span>
          Đang chờ duyệt
        </span>
      );
    case "OPEN":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5"></span>
          Đã duyệt (Mở)
        </span>
      );
    case "IN_PROGRESS":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1.5"></span>
          Đang xử lý
        </span>
      );
    case "VERIFYING":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1.5"></span>
          Đang thẩm tra
        </span>
      );
    case "CLOSED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
          Đã hoàn thành
        </span>
      );
    case "REJECTED":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>
          Bị bác bỏ
        </span>
      );
    default:
      return <span className="text-slate-400 text-xs">{displayStatus}</span>;
  }
};

/** NC/CAPA coi là đã đóng: ẩn khỏi danh sách open (đồng bộ status NC với CAPA đã CLOSED). */
const isOpenPRPNc = (nc: NonConformity) =>
  nc.status !== "CLOSED" && nc.capa_status !== "CLOSED";

export default function PrpAuditPage() {
  const toast = useToast();
  const { principal } = useAuth();
  const orgId = principal?.org_id || "";
  
  const [locations, setLocations] = useState<Location[]>([]);
  const [audits, setAudits] = useState<PRPAudit[]>([]);
  const [upcomingSchedules, setUpcomingSchedules] = useState<any[]>([]);
  const [openNCs, setOpenNCs] = useState<NonConformity[]>([]);
  const [programs, setPrograms] = useState<PRPProgram[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); 
  const [filterType, setFilterType] = useState<"day" | "month" | "year">("day");
  
  // Helper states for Month/Year selection UI (matching HACCP)
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedYear, setSelectedYear] = useState<string>("");
  
  const [loading, setLoading] = useState(true);

  // States for Modals
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [showProgramManager, setShowProgramManager] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [showNCTracking, setShowNCTracking] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const [kpis, setKpis] = useState<any>(null);

  useEffect(() => {
    async function init() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [locs, ads, progs] = await Promise.all([
          prpService.listLocations(),
          prpService.listAudits({ audit_date: today }),
          prpService.listPrograms(),
        ]);
        setLocations(locs);
        setAudits(ads);
        setPrograms(progs);

        // Fetch upcoming schedules, NCs and KPIs if orgId is available
        if (orgId) {
          const [upcomings, ncs, kpiData] = await Promise.all([
            prpService.getUpcomingSchedules(orgId),
            capaService.listNCs(orgId, "", "PRP"), // Lấy tất cả để lọc ở FE hoặc hiện hết trừ CLOSED
            capaService.getKPIs(orgId)
          ]);
          setUpcomingSchedules(upcomings);
          // Chỉ lấy OPEN, IN_PROGRESS, VERIFYING (ẩn CLOSED)
          setOpenNCs(ncs.filter(isOpenPRPNc));
          setKpis(kpiData);
        }
      } catch (error) {
        console.error("Failed to fetch PRP data:", error);
        toast.error("Không thể tải dữ liệu PRP. Vui lòng thử lại sau.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [orgId]);

  // Logic tính tỉ lệ thực tế
  const closureRate = kpis?.total > 0
    ? Math.round((kpis.closed / kpis.total) * 1000) / 10
    : 0;
  const refreshPrograms = async () => {
    const progs = await prpService.listPrograms();
    setPrograms(progs);
  };

  const refreshUpcoming = async () => {
    if (orgId) {
      const upcomings = await prpService.getUpcomingSchedules(orgId);
      setUpcomingSchedules(upcomings);
    }
  };

  const refreshNCs = async () => {
    if (orgId) {
      const ncs = await capaService.listNCs(orgId, "", "PRP");
      setOpenNCs(ncs.filter(isOpenPRPNc));
    }
  };

  const handleFilterChange = async (zoneId: string, dateValue?: string, type?: "day" | "month" | "year") => {
    const zId = zoneId !== undefined ? zoneId : selectedZone;
    const dVal = dateValue !== undefined ? dateValue : selectedDate;
    const fType = type !== undefined ? type : filterType;
    
    setSelectedZone(zId);
    setSelectedDate(dVal);
    setFilterType(fType);
    setLoading(true);
    
    try {
      const params: any = { area_id: zId || undefined };
      
      if (dVal) {
        if (fType === "day") {
          params.audit_date = dVal;
        } else if (fType === "month") {
          const [year, month] = dVal.split("-");
          params.month = parseInt(month);
          params.year = parseInt(year);
        } else if (fType === "year") {
          params.year = parseInt(dVal);
        }
      }
      
      const ads = await prpService.listAudits(params);
      setAudits(ads);
    } catch (error) {
      console.error("Failed to filter audits:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentScore = audits[0]?.compliance_rate || 0;

  const sortedAuditsByDate = [...audits].sort((a, b) => 
    new Date(b.audit_date).getTime() - new Date(a.audit_date).getTime()
  );

  const highestRiskAudit = [...audits].sort((a, b) => (a.compliance_rate || 0) - (b.compliance_rate || 0))[0];

  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, index) => String(thisYear - index));
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return { value: month, label: `Tháng ${index + 1}` };
  });

  return (
    <AppShell activePath="/prp-audit">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Đánh giá PRP</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowProgramManager(true)}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium transition"
          >
            📋 Quản lý Chương trình
          </button>
          <button
            onClick={() => setShowFormBuilder(true)}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium transition"
          >
            ⚙️ Thiết kế Form
          </button>
          <button
            onClick={() => setShowAuditForm(true)}
            className="px-4 py-2 bg-[#1e8b9b] text-white rounded-lg hover:bg-[#166a77] text-sm font-medium transition"
          >
            + Bắt đầu Đánh giá
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium transition shadow-sm"
          >
            📅 Lập lịch Đánh giá
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Khu vực</label>
          <select
            value={selectedZone}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700 focus:ring-2 focus:ring-[#1e8b9b] outline-none min-w-[180px] shadow-sm"
          >
            <option value="">Tất cả khu vực</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lọc theo thời gian</label>
          <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-200">
            {[
              { value: "day", label: "Ngày" },
              { value: "month", label: "Tháng" },
              { value: "year", label: "Năm" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  if (opt.value === "day") {
                    handleFilterChange(selectedZone, new Date().toISOString().split('T')[0], "day");
                  } else if (opt.value === "month") {
                    handleFilterChange(selectedZone, `${thisYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`, "month");
                    setSelectedMonth(String(new Date().getMonth() + 1).padStart(2, "0"));
                    setSelectedMonthYear(String(thisYear));
                  } else if (opt.value === "year") {
                    handleFilterChange(selectedZone, String(thisYear), "year");
                    setSelectedYear(String(thisYear));
                  }
                }}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                  filterType === opt.value ? "bg-white text-[#1e8b9b] shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filterType === "day" && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chọn ngày</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleFilterChange(selectedZone, e.target.value, "day")}
              className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e8b9b] shadow-sm"
            />
          </div>
        )}

        {filterType === "month" && (
          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tháng</label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const newMonth = e.target.value;
                  setSelectedMonth(newMonth);
                  handleFilterChange(selectedZone, `${selectedMonthYear}-${newMonth}`, "month");
                }}
                className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700 focus:ring-2 focus:ring-[#1e8b9b] outline-none min-w-[120px] shadow-sm"
              >
                <option value="">Tất cả các tháng</option>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Năm</label>
              <select
                value={selectedMonthYear}
                onChange={(e) => {
                  setSelectedMonthYear(e.target.value);
                  if (selectedMonth) handleFilterChange(selectedZone, `${e.target.value}-${selectedMonth}`, "month");
                }}
                className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700 focus:ring-2 focus:ring-[#1e8b9b] outline-none min-w-[100px] shadow-sm"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {filterType === "year" && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Năm</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                handleFilterChange(selectedZone, e.target.value, "year");
              }}
              className="rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-700 focus:ring-2 focus:ring-[#1e8b9b] outline-none min-w-[120px] shadow-sm"
            >
              <option value="">Tất cả các năm</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-6 items-stretch">
          <section className="w-64 space-y-6 flex flex-col">
            <div className="rounded-xl bg-white p-6 shadow flex flex-col flex-1">
              <h2 className="mb-4 font-bold text-slate-800 uppercase text-xs tracking-wider text-slate-400">Hiệu suất chung</h2>
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-5xl font-black text-[#1e8b9b] mb-1">
                  {audits.length > 0 
                    ? Math.round((audits.reduce((acc, a) => acc + (a.compliance_rate ?? 0), 0) / audits.length) * 10) / 10 
                    : 0}%
                </div>
                <p className="text-xs text-slate-500 font-medium">Tỉ lệ tuân thủ trung bình</p>
                <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#1e8b9b] rounded-full" 
                    style={{ width: `${audits.length > 0 ? audits.reduce((acc, a) => acc + (a.compliance_rate ?? 0), 0) / audits.length : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 font-bold text-slate-800 uppercase text-xs tracking-wider text-slate-400">Tỉ lệ khắc phục</h2>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-emerald-500">{closureRate}%</div>
                <div className="text-xs font-bold text-emerald-300 uppercase">Hoàn thành</div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 italic">Dựa trên các hành động CAPA</p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 font-bold text-slate-800 uppercase text-xs tracking-wider text-slate-400">Rủi ro cao nhất</h2>
              <div className="text-sm font-bold text-slate-700 truncate" title={highestRiskAudit?.area?.name || "N/A"}>
                {highestRiskAudit?.area?.name || "Chưa có dữ liệu"}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-[10px] text-slate-400 font-medium">Điểm thấp nhất hệ thống</span>
              </div>
            </div>
          </section>

          <section className="flex-[2] rounded-xl bg-white p-6 shadow overflow-hidden flex flex-col">
            <h2 className="mb-4 text-lg font-bold text-slate-800 px-2">
              Lịch sử đánh giá
            </h2>
            <div className="overflow-auto flex-1 max-h-[600px]">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-blue-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-medium bg-blue-50">Ngày</th>
                    <th className="px-4 py-3 font-medium bg-blue-50">Khu vực</th>
                    <th className="px-4 py-3 text-center font-medium bg-blue-50">Tỉ lệ tuân thủ</th>
                    <th className="px-4 py-3 font-medium bg-blue-50">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedAuditsByDate.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                        Không có dữ liệu đánh giá cho bộ lọc này.
                      </td>
                    </tr>
                  ) : (
                    sortedAuditsByDate.map((audit) => (
                      <tr 
                        key={audit.id} 
                        onClick={() => setSelectedAuditId(audit.id)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          {new Date(audit.audit_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium">{audit.area?.name}</td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600">
                          {audit.compliance_rate}%
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            audit.overall_result === "PASSED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}>
                            {audit.overall_result}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="w-80 space-y-6 flex flex-col">
            {/* Widget 1: Kế hoạch sắp tới */}
            <section className="flex-1 rounded-xl bg-white p-6 shadow flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  Kế hoạch sắp tới
                </h2>
                <button 
                  onClick={() => setShowUpcomingModal(true)}
                  className="text-[10px] font-bold text-sky-600 hover:text-sky-700 uppercase"
                >
                  Xem tất cả
                </button>
              </div>
              
              <div className="flex-1 space-y-4 overflow-auto pr-1">
                {upcomingSchedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 border-2 border-dashed rounded-xl border-slate-50">
                    <div className="text-3xl mb-2">📅</div>
                    <p className="text-xs text-slate-400 font-medium">Chưa có lịch làm việc.</p>
                  </div>
                ) : (
                  upcomingSchedules.slice(0, 4).map((s) => (
                    <div key={s.id} className="group p-3 border border-slate-50 rounded-xl bg-slate-50/50 hover:bg-white hover:shadow-sm transition-all">
                      <div className="flex gap-3 items-center">
                        <div className="flex flex-col items-center justify-center bg-white border border-sky-100 rounded-lg w-12 h-12 shadow-sm shrink-0">
                          <span className="text-[8px] uppercase font-bold text-sky-500 leading-none">T{new Date(s.start_time).getMonth() + 1}</span>
                          <span className="text-lg font-bold text-slate-700 leading-none mt-0.5">{new Date(s.start_time).getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-700 text-xs truncate group-hover:text-sky-600 transition-colors" title={s.title}>
                            {s.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium">
                            <div className="flex items-center gap-1 text-slate-400">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {new Date(s.start_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                            </div>
                            {s.status === "OVERDUE" && (
                              <span className="text-rose-500 font-bold ml-auto">[Quá hạn]</span>
                            )}
                          </div>
                        </div>
                        {s.status === "SCHEDULED" && (
                          <button
                            onClick={() => {
                              setSelectedScheduleId(s.id);
                              setShowAuditForm(true);
                            }}
                            className="p-1.5 bg-sky-100 text-sky-600 rounded-lg hover:bg-sky-600 hover:text-white transition opacity-0 group-hover:opacity-100"
                            title="Thực hiện đánh giá"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Widget 2: Tiến độ xử lý lỗi (NC) */}
            <section className="flex-1 rounded-xl bg-white p-6 shadow flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  Tiến độ xử lý lỗi (NC)
                </h2>
                <button 
                  onClick={() => setShowNCTracking(true)}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 uppercase"
                >
                  Xem tất cả
                </button>
              </div>
              
              <div className="flex-1 space-y-4 overflow-auto pr-1">
                {openNCs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4 border-2 border-dashed rounded-xl border-slate-50">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-xs text-slate-400 font-medium">Không có lỗi NC tồn đọng.</p>
                  </div>
                ) : (
                  openNCs.slice(0, 4).map((nc) => (
                    <div key={nc.id} className={`group p-3 border rounded-xl hover:shadow-sm transition-all border-l-4 ${
                      (nc.capa_status || nc.status) === "OPEN" ? "bg-rose-50/30 border-rose-100 border-l-rose-500" :
                      (nc.capa_status || nc.status) === "IN_PROGRESS" ? "bg-blue-50/30 border-blue-100 border-l-blue-500" :
                      "bg-amber-50/30 border-amber-100 border-l-amber-500"
                    }`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h3 className="font-bold text-slate-700 text-xs truncate group-hover:text-rose-600 transition-colors" title={nc.title}>
                            {nc.title}
                          </h3>
                          <div className="shrink-0">
                            {getNCStatusBadge(nc)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-medium">
                          <span className="text-slate-400">{new Date(nc.detected_at).toLocaleDateString()}</span>
                          <span className="text-slate-400 uppercase text-[8px] font-bold">Lần {openNCs.indexOf(nc) + 1}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>

      {/* Modals */}
      {showProgramManager && (
        <ProgramManagerModal
          programs={programs}
          onClose={() => setShowProgramManager(false)}
          onSuccess={() => {
            refreshPrograms();
          }}
        />
      )}

      {showFormBuilder && (
        <FormBuilderModal
          locations={locations}
          programs={programs}
          onClose={() => setShowFormBuilder(false)}
        />
      )}

      {showAuditForm && (
        <AuditFormModal
          locations={locations}
          programs={programs}
          initialScheduleId={selectedScheduleId}
          onClose={() => {
            setShowAuditForm(false);
            setSelectedScheduleId(null);
          }}
          onSuccess={() => {
            setShowAuditForm(false);
            setSelectedScheduleId(null);
            handleFilterChange(selectedZone);
            refreshUpcoming();
          }}
        />
      )}

      {showScheduleModal && (
        <ScheduleModal
          locations={locations}
          programs={programs}
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            setShowScheduleModal(false);
            refreshUpcoming();
            toast.success("Đã thiết lập lịch đánh giá thành công.");
          }}
        />
      )}

      {selectedAuditId && (
        <AuditDetailModal
          auditId={selectedAuditId}
          onClose={() => setSelectedAuditId(null)}
          onSuccess={() => {
            refreshNCs();
            // Cập nhật lại KPI tỉ lệ khắc phục
            if (orgId) {
              capaService.getKPIs(orgId).then(setKpis);
            }
          }}
        />
      )}

      {showUpcomingModal && (
        <ScheduleManagementModal 
          onClose={() => setShowUpcomingModal(false)} 
          onStartAudit={(id) => {
            setSelectedScheduleId(id);
            setShowUpcomingModal(false);
            setShowAuditForm(true);
          }}
        />
      )}

      {showNCTracking && (
        <NCTrackingModal onClose={() => setShowNCTracking(false)} />
      )}
    </AppShell>
  );
}

function NCTrackingModal({ onClose }: { onClose: () => void }) {
  const { principal } = useAuth();
  const orgId = principal?.org_id;
  const [ncs, setNcs] = useState<NonConformity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(""); // "" = All

  const fetchNCs = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      // Lấy lỗi từ nguồn PRP với bộ lọc trạng thái
      const data = await capaService.listNCs(orgId, statusFilter, "PRP");
      setNcs(data);
    } catch (error) {
      console.error("Failed to fetch NCs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNCs();
  }, [orgId, statusFilter]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-rose-600 text-white">
          <div>
            <h2 className="text-xl font-bold">Theo dõi điểm Không tuân thủ (NC) - PRP</h2>
            <p className="text-xs text-rose-100 mt-1">Theo dõi tiến độ khắc phục các lỗi phát sinh</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="bg-slate-50 border-b p-2 flex gap-1">
          {[
            { label: "Tất cả", value: "" },
            { label: "Mới (Chờ duyệt)", value: "WAITING" },
            { label: "Đã duyệt", value: "OPEN" },
            { label: "Đang xử lý", value: "IN_PROGRESS,VERIFYING" },
            { label: "Hoàn thành", value: "CLOSED" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                statusFilter === tab.value 
                  ? "bg-white text-rose-600 shadow-sm border border-rose-100" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-10 text-slate-400">Đang tải danh sách lỗi...</div>
          ) : ncs.length === 0 ? (
            <div className="text-center py-20 text-slate-400 border-2 border-dashed rounded-xl m-6">
              Không tìm thấy điểm lỗi nào trong danh mục này.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0 z-20 shadow-md">
                <tr>
                  <th className="pl-6 pr-4 py-3 font-bold text-slate-600 bg-slate-50">Ngày phát hiện</th>
                  <th className="px-4 py-3 font-bold text-slate-600 bg-slate-50">Nội dung lỗi</th>
                  <th className="px-4 py-3 font-bold text-slate-600 text-center bg-slate-50">Mức độ</th>
                  <th className="pl-4 pr-6 py-3 font-bold text-slate-600 text-right bg-slate-50">Tiến độ xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ncs.map((nc) => (
                  <tr key={nc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="pl-6 pr-4 py-4 text-slate-500 w-32">
                      {new Date(nc.detected_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-800">
                      {nc.title}
                    </td>
                    <td className="px-4 py-4 text-center w-24">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        nc.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {nc.severity}
                      </span>
                    </td>
                    <td className="pl-4 pr-6 py-4 text-right w-40">
                      {getNCStatusBadge(nc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-8 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function ScheduleManagementModal({ onClose, onStartAudit }: { onClose: () => void, onStartAudit: (id: string) => void }) {
  const { principal } = useAuth();
  const orgId = principal?.org_id;
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(""); // "" = All, "SCHEDULED", "COMPLETED", "OVERDUE"

  const fetchSchedules = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const data = await prpService.listSchedules(orgId, filter || undefined);
      setSchedules(data);
    } catch (error) {
      console.error("Failed to load schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [orgId, filter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Đúng hạn</span>;
      case "OVERDUE":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">Quá hạn</span>;
      case "SCHEDULED":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">Sắp tới</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-slate-800 text-white">
          <div>
            <h2 className="text-xl font-bold">Quản lý Lịch đánh giá PRP</h2>
            <p className="text-xs text-slate-300 mt-1">Theo dõi tiến độ thực hiện kế hoạch kiểm tra</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div className="bg-slate-50 border-b p-2 flex gap-1">
          {[
            { label: "Tất cả", value: "" },
            { label: "Sắp tới", value: "SCHEDULED" },
            { label: "Quá hạn", value: "OVERDUE" },
            { label: "Đúng hạn", value: "COMPLETED" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filter === tab.value 
                  ? "bg-white text-slate-800 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-10 text-slate-400">Đang tải lịch trình...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-20 text-slate-400 border-2 border-dashed rounded-xl">
              Không tìm thấy lịch trình nào phù hợp.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => (
                <div key={s.id} className="flex gap-4 p-4 border border-slate-100 rounded-xl bg-white hover:shadow-md transition-all group items-center">
                  <div className={`flex flex-col items-center justify-center border rounded-lg px-4 py-2 min-w-[90px] shadow-sm ${
                    s.status === "OVERDUE" ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-100"
                  }`}>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Ngày</span>
                    <span className={`text-2xl font-black ${s.status === "OVERDUE" ? "text-rose-600" : "text-slate-700"}`}>
                      {new Date(s.start_time).getDate()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">T{new Date(s.start_time).getMonth() + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(s.status)}
                      <span className="text-[10px] text-slate-400 font-bold">{new Date(s.start_time).getFullYear()}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 group-hover:text-[#1e8b9b] transition-colors truncate">
                      {s.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                  {s.status === "SCHEDULED" && (
                    <button
                      onClick={() => onStartAudit(s.id)}
                      className="px-4 py-2 bg-[#1e8b9b] text-white rounded-lg text-xs font-bold hover:bg-[#166a77] transition shadow-sm shrink-0"
                    >
                      ✓ Thực hiện
                    </button>
                  )}
                  {s.status === "OVERDUE" && (
                    <span className="px-3 py-2 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-bold italic border border-slate-200">
                      Đã quá hạn
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-8 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition">Đóng</button>
        </div>
      </div>
    </div>
  );
}

function ScheduleModal({ locations, programs, onClose, onSuccess }: any) {
  const toast = useToast();
  const { principal } = useAuth();
  const orgId = principal?.org_id;

  const [selectedLocation, setSelectedLocation] = useState(locations[0]?.id || "");
  const [selectedProgram, setSelectedProgram] = useState(programs[0]?.id || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState("ONCE");
  const [dayOfWeek, setDayOfWeek] = useState(0); // Thứ 2
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!orgId) {
      toast.error("Không tìm thấy thông tin tổ chức. Vui lòng đăng nhập lại.");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        org_id: orgId,
        prp_program_id: selectedProgram,
        location_id: selectedLocation,
        start_date: startDate,
        end_date: endDate || null,
        frequency,
        day_of_week: frequency === "WEEKLY" ? dayOfWeek : null,
        day_of_month: frequency === "MONTHLY" ? dayOfMonth : null,
      };

      const result = await prpService.createSchedule(payload);
      toast.success(result.message);
      onSuccess();
    } catch (error) {
      console.error("Failed to create schedule:", error);
      toast.error("Lỗi khi tạo lịch đánh giá.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-amber-500 text-white">
          <h2 className="text-xl font-bold">Lập lịch Đánh giá PRP</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Chương trình</label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
              >
                {programs.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Khu vực</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
              >
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Tần suất</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
              >
                <option value="ONCE">Một lần</option>
                <option value="DAILY">Hàng ngày</option>
                <option value="WEEKLY">Hàng tuần</option>
                <option value="MONTHLY">Hàng tháng</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Ngày bắt đầu</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
              />
            </div>
          </div>

          {frequency !== "ONCE" && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Kết thúc vào</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
                />
              </div>
              
              {frequency === "WEEKLY" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lặp lại vào thứ</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                    className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
                  >
                    <option value={0}>Thứ 2</option>
                    <option value={1}>Thứ 3</option>
                    <option value={2}>Thứ 4</option>
                    <option value={3}>Thứ 5</option>
                    <option value={4}>Thứ 6</option>
                    <option value={5}>Thứ 7</option>
                    <option value={6}>Chủ nhật</option>
                  </select>
                </div>
              )}

              {frequency === "MONTHLY" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Ngày trong tháng</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                    className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          )}

          <div className="pt-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || (frequency !== "ONCE" && !endDate)}
              className="flex-[2] py-3 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50 transition shadow-lg"
            >
              {loading ? "Đang xử lý..." : "Thiết lập lịch"}
            </button>
          </div>
          
          {frequency !== "ONCE" && !endDate && (
            <p className="text-[10px] text-red-500 italic text-center">* Cần chọn ngày kết thúc để tạo lịch định kỳ.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Modal components
function AuditDetailModal({
  auditId,
  onClose,
  onSuccess,
}: {
  auditId: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const toast = useToast();
  const { principal } = useAuth();
  const [audit, setAudit] = useState<PRPAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingNCs, setExistingNCs] = useState<string[]>([]);
  const [selectedDetailForCAPA, setSelectedDetailForCAPA] = useState<any>(null);
  const [managerReason, setManagerReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchAuditAndChecks() {
      try {
        setLoading(true);
        const data = await prpService.getAuditById(auditId);
        setAudit(data);
        
        // Kiểm tra xem những detail nào đã được tạo NC
        if (data?.details) {
          const detailIds = data.details.map((d: any) => d.id);
          const ncs = await capaService.checkExistingNCs(detailIds);
          setExistingNCs(ncs);
        }
      } catch (error) {
        console.error("Failed to load audit detail:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAuditAndChecks();
  }, [auditId]);

  const handleCreateNCRequest = async () => {
    if (!principal?.org_id || !selectedDetailForCAPA) return;
    try {
      setSubmitting(true);
      await prpService.createNC({
        org_id: principal.org_id,
        source: "PRP",
        source_ref_id: selectedDetailForCAPA.id,
        title: managerReason, // Tiêu đề là nội dung phân tích của Quản lý
        description: selectedDetailForCAPA.checklist?.question_text, // Mô tả là câu hỏi kiểm tra gốc
        severity: "MEDIUM"
      });
      
      setExistingNCs([...existingNCs, selectedDetailForCAPA.id]);
      toast.success("Đã gửi yêu cầu CAPA sang bộ phận xử lý!");
      setSelectedDetailForCAPA(null);
      setManagerReason("");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create NC:", error);
      toast.error("Lỗi khi tạo yêu cầu CAPA.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-xl shadow-xl">Đang tải chi tiết...</div>
    </div>
  );

  if (!audit) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-slate-800 text-white">
          <div>
            <h2 className="text-xl font-bold">Chi tiết Đánh giá PRP</h2>
            <p className="text-xs text-slate-300">
              Khu vực: {audit.area?.name} | Ngày: {new Date(audit.audit_date).toLocaleDateString()}
            </p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 sticky top-0 z-20 shadow-sm">
              <tr>
                <th className="px-4 py-3 font-bold bg-slate-100">Hạng mục kiểm tra</th>
                <th className="px-4 py-3 text-center font-bold bg-slate-100">Kết quả</th>
                <th className="px-4 py-3 font-bold bg-slate-100">Auditor Quan sát</th>
                <th className="px-4 py-3 text-right font-bold bg-slate-100">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.details?.map((detail: any) => (
                <tr key={detail.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-4 max-w-xs font-medium">
                    {detail.checklist?.question_text}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
                      detail.result === "PASS" ? "bg-emerald-100 text-emerald-700" : 
                      detail.result === "FAIL" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {detail.result}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-500 italic text-xs">
                    {detail.observation || "---"}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {detail.result === "FAIL" && (
                      existingNCs.includes(detail.id) ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">✓ Đã yêu cầu CAPA</span>
                      ) : (
                        <button 
                          onClick={() => setSelectedDetailForCAPA(detail)}
                          className="px-3 py-1 bg-rose-500 text-white rounded text-[10px] font-bold hover:bg-rose-600 transition shadow-sm"
                        >
                          ⚠️ Tạo yêu cầu CAPA
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-8 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 transition">Đóng</button>
        </div>
      </div>

      {/* Mini-modal for Manager Reason */}
      {selectedDetailForCAPA && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b bg-rose-600 text-white rounded-t-2xl">
              <h3 className="font-bold">Khởi tạo Yêu cầu CAPA</h3>
              <p className="text-[10px] opacity-80 mt-1">Phân tích lỗi & Gửi yêu cầu xử lý sang module CAPA</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400">Lỗi ghi nhận:</p>
                <p className="text-sm font-bold text-slate-700">{selectedDetailForCAPA.checklist?.question_text}</p>
                <p className="text-xs text-slate-500 mt-2 italic">"{selectedDetailForCAPA.observation || "Không có mô tả chi tiết từ Auditor"}"</p>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 uppercase">Phân tích của Quản lý (Lý do)</label>
                <textarea 
                  value={managerReason}
                  onChange={(e) => setManagerReason(e.target.value)}
                  className="w-full rounded-xl border-slate-200 text-sm focus:ring-rose-500 focus:border-rose-500"
                  placeholder="Tại sao lỗi này xảy ra? Cần xử lý gì gấp không?..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => { setSelectedDetailForCAPA(null); setManagerReason(""); }}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition"
                >
                  Hủy
                </button>
                <button 
                  onClick={handleCreateNCRequest}
                  disabled={submitting || !managerReason}
                  className="flex-[2] py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 disabled:opacity-50 transition shadow-lg"
                >
                  {submitting ? "Đang gửi..." : "Xác nhận & Gửi yêu cầu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// Modal components
function ProgramManagerModal({ programs, onClose, onSuccess }: any) {
  const toast = useToast();
  const { principal } = useAuth();
  const orgId = principal?.org_id;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("GHP/SSOP");
  const [loading, setLoading] = useState(false);

  const selectProgram = (p: any) => {
    setSelectedId(p.id);
    setName(p.name);
    setCode(p.code || "");
    setCategory(p.category || "GHP/SSOP");
  };

  const resetForm = () => {
    setSelectedId(null);
    setName("");
    setCode("");
    setCategory("GHP/SSOP");
  };

  const handleSave = async () => {
    if (!orgId) {
      toast.error("Không tìm thấy thông tin tổ chức.");
      return;
    }
    try {
      setLoading(true);
      const payload = { name, code, category, org_id: orgId };
      
      if (selectedId) {
        // Cập nhật dùng service
        await prpService.updateProgram(selectedId, payload);
        toast.success("Đã cập nhật chương trình!");
      } else {
        // Tạo mới dùng service
        await prpService.createProgram({ ...payload, is_active: true });
        toast.success("Đã tạo chương trình mới!");
      }
      onSuccess();
      resetForm();
    } catch (error) {
      console.error("Failed to save program:", error);
      toast.error("Lỗi khi lưu chương trình.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">
            {selectedId ? "Chỉnh sửa Chương trình" : "Quản lý Chương trình PRP"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Tên chương trình (GHP, SSOP...)</label>
            <input 
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border-slate-300 focus:ring-[#1e8b9b]" placeholder="Ví dụ: Vệ sinh cá nhân"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Mã (Code)</label>
              <input 
                value={code} onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border-slate-300 focus:ring-[#1e8b9b]" placeholder="SSOP-01"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Phân loại</label>
              <select 
                value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border-slate-300 focus:ring-[#1e8b9b]"
              >
                <option value="GHP/SSOP">GHP/SSOP</option>
                <option value="GMP">GMP</option>
                <option value="Pest Control">Pest Control</option>
                <option value="Maintenance & Calibration">Maintenance & Calibration</option>
                <option value="Personnel Hygiene & Training">Personnel Hygiene & Training</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleSave} disabled={!name || loading}
              className="flex-1 py-3 bg-[#1e8b9b] text-white rounded-lg font-bold hover:bg-[#166a77] disabled:opacity-50"
            >
              {loading ? "Đang lưu..." : selectedId ? "Cập nhật thay đổi" : "+ Thêm chương trình mới"}
            </button>
            {selectedId && (
              <button 
                onClick={resetForm}
                className="px-4 py-3 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200"
              >
                Hủy sửa
              </button>
            )}
          </div>

          <div className="mt-6 border-t pt-4">
            <label className="text-xs uppercase font-bold text-slate-400 mb-2 block">Danh sách hiện có (Nhấn để sửa)</label>
            <div className="max-h-60 overflow-auto space-y-2 pr-1">
              {programs.map((p: any) => (
                <div 
                  key={p.id} 
                  onClick={() => selectProgram(p)}
                  className={`p-3 rounded-lg flex justify-between items-center cursor-pointer transition ${
                    selectedId === p.id ? "bg-blue-50 border border-blue-200 shadow-sm" : "bg-slate-50 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <div>
                    <p className="font-bold text-slate-700 text-sm">{p.name}</p>
                    <p className="text-[10px] text-slate-400">{p.code || "No Code"}</p>
                  </div>
                  <span className="text-[10px] bg-white border px-2 py-0.5 rounded font-bold text-slate-500">{p.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormBuilderModal({ locations, programs, onClose }: any) {
  const toast = useToast();
  const [selectedLocation, setSelectedLocation] = useState(locations[0]?.id || "");
  const [selectedProgram, setSelectedProgram] = useState(programs[0]?.id || "");
  const [questions, setQuestions] = useState<Partial<PRPChecklistTemplate>[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    if (selectedLocation) {
      setLoading(true);
      // Lấy cả những câu đã ẩn để có thể khôi phục
      prpService.getTemplatesByLocation(selectedLocation, false)
        .then((qs) => {
          setQuestions(qs.filter(q => q.prp_program_id === selectedProgram));
        })
        .finally(() => setLoading(false));
    }
  }, [selectedLocation, selectedProgram]);

  const activeQuestions = questions.filter(q => q.is_active !== false);
  const archivedQuestions = questions.filter(q => q.is_active === false);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: "",
        answer_type: "BOOLEAN",
        prp_program_id: selectedProgram,
        location_id: selectedLocation,
        order_index: questions.length,
        is_active: true,
      },
    ]);
  };

  const toggleActive = (idx: number) => {
    const newQs = [...questions];
    newQs[idx].is_active = !newQs[idx].is_active;
    setQuestions(newQs);
  };

  const removeQuestion = async (idx: number) => {
    const q = questions[idx];
    if (q.id) {
      try {
        await prpService.deleteTemplate(q.id);
        // Nếu xóa thành công (tức là chưa có lịch sử)
        const newQs = [...questions];
        newQs.splice(idx, 1);
        setQuestions(newQs);
        toast.success("Đã xóa vĩnh viễn câu hỏi mẫu thành công.");
      } catch (error: any) {
        // Nếu API trả về lỗi (thường là 409 do có lịch sử)
        if (error.status === 409) {
          toast.warning("Câu hỏi này đã có báo cáo sử dụng thực tế. Để bảo vệ tính toàn vẹn của dữ liệu cũ, bạn KHÔNG THỂ xóa vĩnh viễn. Vui lòng sử dụng chức năng 'Ẩn' (bỏ tích Dùng) để câu hỏi không hiện trong các form mới.");
        } else {
          console.error("Failed to delete template:", error);
          toast.error("Lỗi hệ thống khi thực hiện xóa.");
        }
      }
    } else {
      // Câu hỏi chưa lưu thì xóa thẳng khỏi state
      const newQs = [...questions];
      newQs.splice(idx, 1);
      setQuestions(newQs);
    }
  };

  const saveForm = async () => {
    try {
      setLoading(true);
      if (!selectedProgram) {
        toast.warning("Cần chọn một chương trình để lưu.");
        return;
      }

      await Promise.all(
        questions.map((q) => {
          const payload = {
            ...q,
            location_id: selectedLocation,
            prp_program_id: selectedProgram,
          };
          if (q.id) {
            return prpService.updateTemplate(q.id, payload);
          } else {
            return prpService.createTemplate(payload);
          }
        })
      );
      toast.success("Đã lưu thiết kế Form!");
      onClose();
    } catch (error) {
      console.error("Failed to save form:", error);
      toast.error("Lỗi khi lưu thiết kế form.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">Thiết kế Checklist PRP</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
        </div>
        
        <div className="p-6 flex-1 overflow-auto space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">1. Chọn Chương trình</label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full rounded-lg border-slate-300 focus:ring-[#1e8b9b]"
              >
                {programs.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">2. Chọn Khu vực</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full rounded-lg border-slate-300 focus:ring-[#1e8b9b]"
              >
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <h3 className="font-bold text-slate-800">Câu hỏi đang sử dụng</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className={`px-4 py-2 rounded-lg border transition text-sm font-bold ${
                  showArchive ? "bg-amber-50 border-amber-200 text-amber-600" : "bg-slate-50 border-slate-200 text-slate-600"
                }`}
              >
                {showArchive ? "Đóng kho lưu trữ" : "📂 Xem câu hỏi đã ẩn"}
              </button>
              <button
                onClick={addQuestion}
                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition text-sm font-bold"
              >
                + Thêm câu hỏi
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-10 text-slate-400">Đang tải...</div>
            ) : activeQuestions.length === 0 ? (
              <div className="text-center py-10 text-slate-400 border-2 border-dashed rounded-xl">
                Chưa có câu hỏi nào đang dùng.
              </div>
            ) : (
              activeQuestions.map((q) => {
                const idx = questions.findIndex(item => item === q);
                return (
                  <div key={idx} className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <label className="text-[9px] uppercase font-bold text-slate-400">Dùng</label>
                        <input 
                          type="checkbox" 
                          checked={q.is_active} 
                          onChange={() => toggleActive(idx)}
                          className="w-5 h-5 rounded text-[#1e8b9b] focus:ring-[#1e8b9b]"
                        />
                      </div>
                      <div className="flex-1 flex gap-3">
                        <input
                          placeholder="Nội dung câu hỏi..."
                          value={q.question_text}
                          onChange={(e) => {
                            const newQs = [...questions];
                            newQs[idx].question_text = e.target.value;
                            setQuestions(newQs);
                          }}
                          className="flex-1 rounded-lg border-slate-300 text-sm"
                        />
                        <select
                          value={q.answer_type}
                          onChange={(e: any) => {
                            const newQs = [...questions];
                            newQs[idx].answer_type = e.target.value;
                            setQuestions(newQs);
                          }}
                          className="w-32 rounded-lg border-slate-300 text-sm"
                        >
                          <option value="BOOLEAN">Yes/No</option>
                          <option value="NUMBER">Số liệu</option>
                        </select>
                        {q.answer_type === "NUMBER" && (
                          <input
                            type="number"
                            placeholder="Mục tiêu"
                            value={q.target_value || ""}
                            onChange={(e) => {
                              const newQs = [...questions];
                              newQs[idx].target_value = parseFloat(e.target.value);
                              setQuestions(newQs);
                            }}
                            className="w-24 rounded-lg border-slate-300 text-sm"
                          />
                        )}
                        <button
                          onClick={() => removeQuestion(idx)}
                          className="p-2 text-red-400 hover:text-red-600 transition-colors"
                          title="Xóa câu hỏi"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {showArchive && (
              <div className="mt-8 pt-6 border-t border-dashed border-slate-300 animate-in fade-in slide-in-from-top-4">
                <h3 className="font-bold text-slate-500 mb-4 flex items-center gap-2">
                  📂 Kho lưu trữ (Các câu hỏi đã ẩn)
                </h3>
                <div className="space-y-3">
                  {archivedQuestions.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm italic">Kho lưu trữ trống.</div>
                  ) : (
                    archivedQuestions.map((q) => {
                      const idx = questions.findIndex(item => item === q);
                      return (
                        <div key={idx} className="p-3 border border-slate-200 rounded-lg bg-slate-100/50 opacity-70 flex items-center justify-between">
                          <span className="text-sm text-slate-600 italic line-through">{q.question_text || "(Trống)"}</span>
                          <button
                            onClick={() => toggleActive(idx)}
                            className="px-3 py-1 bg-white text-emerald-600 rounded border border-emerald-200 text-xs font-bold hover:bg-emerald-50 transition"
                          >
                            ↩ Khôi phục
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium">Hủy</button>
          <button
            onClick={saveForm}
            disabled={loading || questions.length === 0}
            className="px-8 py-2 bg-[#1e8b9b] text-white rounded-lg font-bold hover:bg-[#166a77] disabled:opacity-50 transition"
          >
            Lưu thiết kế
          </button>
        </div>
      </div>
    </div>
  );
}

function AuditFormModal({ locations, programs, onClose, onSuccess, initialScheduleId }: any) {
  const toast = useToast();
  const { principal } = useAuth();
  const orgId = principal?.org_id;

  const [upcomingSchedules, setUpcomingSchedules] = useState<any[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(initialScheduleId || "");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  
  // Thêm bộ lọc cho danh sách lịch trình
  const [filterProgram, setFilterProgram] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  const [templates, setTemplates] = useState<PRPChecklistTemplate[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Fetch upcoming schedules for the dropdown
  useEffect(() => {
    if (orgId) {
      prpService.getUpcomingSchedules(orgId).then(setUpcomingSchedules);
    }
  }, [orgId]);

  // Lọc danh sách lịch trình dựa trên bộ lọc và CHỈ LẤY LỊCH TRÌNH CHƯA QUÁ HẠN
  const filteredSchedules = upcomingSchedules
    .filter(s => s.status === "SCHEDULED") // Chỉ lấy lịch còn hạn
    .filter(s => {
      if (!s.description) return true;
      try {
        const desc = JSON.parse(s.description);
        const matchProg = !filterProgram || desc.prp_program_id === filterProgram;
        const matchLoc = !filterLocation || desc.location_id === filterLocation;
        return matchProg && matchLoc;
      } catch (e) {
        return true;
      }
    });

  // Handle schedule selection
  useEffect(() => {
    if (selectedScheduleId && upcomingSchedules.length > 0) {
      const schedule = upcomingSchedules.find(s => s.id === selectedScheduleId);
      if (schedule && schedule.description) {
        try {
          const desc = JSON.parse(schedule.description);
          if (desc.location_id) setSelectedLocation(desc.location_id);
          if (desc.prp_program_id) setSelectedProgram(desc.prp_program_id);
        } catch (e) {
          console.error("Failed to parse schedule description", e);
        }
      }
    } else {
      setSelectedLocation("");
      setSelectedProgram("");
    }
  }, [selectedScheduleId, upcomingSchedules]);

  useEffect(() => {
    if (selectedLocation && selectedProgram) {
      setLoading(true);
      prpService.getTemplatesByLocation(selectedLocation)
        .then((ts) => {
          // Chỉ lấy các câu hỏi thuộc Chương trình được chọn và đang Hoạt động
          const filtered = ts.filter(t => t.prp_program_id === selectedProgram && t.is_active !== false);
          setTemplates(filtered);
          const initialResults: Record<string, string> = {};
          const initialObs: Record<string, string> = {};
          filtered.forEach((t) => {
            initialResults[t.id] = t.answer_type === "BOOLEAN" ? "PASS" : "";
            initialObs[t.id] = "";
          });
          setResults(initialResults);
          setObservations(initialObs);
        })
        .finally(() => setLoading(false));
    } else {
      setTemplates([]);
    }
  }, [selectedLocation, selectedProgram]);

  const handleSubmit = async () => {
    if (!orgId) {
      toast.error("Không tìm thấy thông tin tổ chức.");
      return;
    }
    if (!selectedScheduleId) {
      toast.warning("Vui lòng chọn một lịch trình để thực hiện đánh giá.");
      return;
    }
    try {
      setLoading(true);
      const auditDate = new Date().toISOString().split("T")[0];

      let scoreableCount = 0;
      let passCount = 0;

      const details = templates.map((t) => {
        const val = results[t.id];
        const obs = observations[t.id];
        let isPass = false;

        if (t.answer_type === "BOOLEAN") {
          scoreableCount++;
          if (val === "PASS") {
            passCount++;
            isPass = true;
          }
        } else if (t.answer_type === "NUMBER") {
          scoreableCount++;
          const numVal = parseFloat(val);
          if (!isNaN(numVal) && t.target_value !== undefined && numVal >= t.target_value) {
            passCount++;
            isPass = true;
          }
        }

        return {
          checklist_id: t.id,
          result: val,
          score: isPass ? 100 : 0,
          observation: obs,
          create_nc: false 
        };
      });

      const complianceRate = scoreableCount > 0 ? (passCount / scoreableCount) * 100 : 0;

      await prpService.createFullAudit({
        audit_data: {
          org_id: orgId,
          prp_program_id: selectedProgram,
          area_id: selectedLocation,
          calendar_event_id: selectedScheduleId,
          audit_date: auditDate,
          compliance_rate: complianceRate,
          overall_result: complianceRate >= 80 ? "PASSED" : "FAILED",
        },
        details: details,
      });

      toast.success("Báo cáo đánh giá đã được gửi thành công!");
      onSuccess();
    } catch (error) {
      console.error("Failed to submit audit:", error);
      toast.error("Lỗi khi gửi báo cáo.");
    } finally {
      setLoading(false);
    }
  };

  const selectedProgramName = programs.find((p: any) => p.id === selectedProgram)?.name;
  const selectedLocationName = locations.find((l: any) => l.id === selectedLocation)?.name;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-[#1e8b9b] text-white">
          <h2 className="text-xl font-bold">Thực hiện Đánh giá theo Lịch</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-6 flex-1 overflow-auto space-y-6">
          <div className="p-5 bg-sky-50 rounded-2xl border border-sky-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs uppercase font-black text-sky-600 tracking-widest">1. Chọn Lịch trình Đánh giá</label>
              <div className="flex gap-2">
                <select
                  value={filterProgram}
                  onChange={(e) => setFilterProgram(e.target.value)}
                  className="text-[10px] py-1 px-2 rounded-md border-sky-200 focus:ring-sky-500 bg-white"
                >
                  <option value="">Chương trình</option>
                  {programs.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="text-[10px] py-1 px-2 rounded-md border-sky-200 focus:ring-sky-500 bg-white"
                >
                  <option value="">Khu vực</option>
                  {locations.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="w-full rounded-xl border-sky-200 shadow-sm focus:ring-[#1e8b9b] focus:border-[#1e8b9b] text-sm font-bold bg-white p-3"
            >
              <option value="">-- Vui lòng chọn lịch đánh giá --</option>
              {filteredSchedules.map((s) => (
                <option key={s.id} value={s.id}>
                  [{new Date(s.start_time).toLocaleDateString()}] {s.title}
                </option>
              ))}
            </select>
            {filteredSchedules.length === 0 && upcomingSchedules.length > 0 && (
              <p className="text-[10px] text-amber-600 mt-2 font-bold italic">
                ⚠️ Không tìm thấy lịch phù hợp với bộ lọc hiện tại.
              </p>
            )}
            {upcomingSchedules.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-2 font-bold italic">
                ⚠️ Không có lịch trình nào sắp tới. Vui lòng lập lịch trước.
              </p>
            )}
          </div>

          {selectedScheduleId ? (
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Chương trình</label>
                <div className="text-sm font-black text-slate-700 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                  {selectedProgramName || "N/A"}
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] uppercase font-bold text-slate-400">Khu vực</label>
                <div className="text-sm font-black text-slate-700 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                  {selectedLocationName || "N/A"}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl border-slate-100 bg-slate-50/30">
              <div className="text-4xl mb-4 opacity-20">📋</div>
              <p className="text-sm text-slate-400 font-medium">Vui lòng chọn lịch trình để hiển thị nội dung đánh giá</p>
            </div>
          )}

          {selectedScheduleId && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {loading ? (
                <div className="text-center py-10">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[#1e8b9b] rounded-full mb-2"></div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Đang tải câu hỏi...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 text-amber-500 bg-amber-50 rounded-xl border border-amber-100 italic text-sm">
                  Không tìm thấy bộ câu hỏi nào được thiết lập cho Chương trình và Khu vực này.
                </div>
              ) : (
                templates.map((t) => (
                  <div key={t.id} className="border-b border-slate-100 pb-6 last:border-0 group">
                    <div className="flex justify-between items-start mb-4">
                      <p className="font-bold text-slate-800 flex-1 mr-4 group-hover:text-[#1e8b9b] transition-colors">{t.question_text}</p>
                      {t.answer_type === "NUMBER" && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-black">Mục tiêu: ≥ {t.target_value}</span>
                      )}
                    </div>

                    <div className="mb-4">
                      {t.answer_type === "BOOLEAN" ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => setResults({ ...results, [t.id]: "PASS" })}
                            className={`flex-1 py-2.5 rounded-xl border-2 font-black text-xs transition-all ${
                              results[t.id] === "PASS" ? "bg-emerald-500 border-emerald-500 text-white shadow-lg scale-[1.02]" : "bg-white border-slate-100 text-slate-400 hover:border-emerald-200"
                            }`}
                          >
                            ✓ ĐẠT
                          </button>
                          <button
                            onClick={() => setResults({ ...results, [t.id]: "FAIL" })}
                            className={`flex-1 py-2.5 rounded-xl border-2 font-black text-xs transition-all ${
                              results[t.id] === "FAIL" ? "bg-red-500 border-red-500 text-white shadow-lg scale-[1.02]" : "bg-white border-slate-100 text-slate-400 hover:border-red-200"
                            }`}
                          >
                            × KHÔNG ĐẠT
                          </button>
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={results[t.id]}
                          onChange={(e) => setResults({ ...results, [t.id]: e.target.value })}
                          className="w-full rounded-xl border-slate-200 shadow-sm focus:ring-[#1e8b9b] focus:border-[#1e8b9b] font-bold"
                          placeholder="Nhập giá trị thực tế..."
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-black text-slate-400 mb-1 block tracking-wider">Ghi chú / Quan sát</label>
                      <textarea
                        value={observations[t.id]}
                        onChange={(e) => setObservations({ ...observations, [t.id]: e.target.value })}
                        className="w-full rounded-xl border-slate-100 bg-slate-50/50 shadow-sm text-sm focus:ring-[#1e8b9b] focus:border-[#1e8b9b] focus:bg-white transition-all"
                        placeholder="Mô tả chi tiết tình trạng quan sát được..."
                        rows={2}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-6 py-2 text-slate-500 font-bold hover:text-slate-800 transition">Hủy bỏ</button>
          <button
            onClick={handleSubmit}
            disabled={loading || templates.length === 0 || !selectedScheduleId}
            className="px-10 py-2 bg-[#1e8b9b] text-white rounded-xl font-black hover:bg-[#166a77] disabled:opacity-30 disabled:grayscale transition shadow-lg uppercase text-xs tracking-widest"
          >
            Nộp Báo cáo
          </button>
        </div>
      </div>
    </div>
  );
}
