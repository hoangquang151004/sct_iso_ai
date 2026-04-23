"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import { prpService } from "@/services";
import { capaService, NonConformity } from "@/services/capa-service";
import { Location, PRPAudit, PRPChecklistTemplate, PRPProgram } from "@/types";
import { auditMonths } from "@/lib/mock-data";

import { useToast, useAuth } from "@/hooks";

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
  const [selectedMonth, setSelectedMonth] = useState<string>(""); 
  const [loading, setLoading] = useState(true);

  // States for Modals
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showAuditForm, setShowAuditForm] = useState(false);
  const [showProgramManager, setShowProgramManager] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showUpcomingModal, setShowUpcomingModal] = useState(false);
  const [showNCTracking, setShowNCTracking] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const [locs, ads, progs] = await Promise.all([
          prpService.listLocations(),
          prpService.listAudits(),
          prpService.listPrograms(),
        ]);
        setLocations(locs);
        setAudits(ads);
        setPrograms(progs);

        // Fetch upcoming schedules and NCs if orgId is available
        if (orgId) {
          const [upcomings, ncs] = await Promise.all([
            prpService.getUpcomingSchedules(orgId),
            capaService.listNCs(orgId, "OPEN", "PRP")
          ]);
          setUpcomingSchedules(upcomings);
          setOpenNCs(ncs);
        }
      } catch (error) {
        console.error("Failed to fetch PRP data:", error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [orgId]);

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
      const ncs = await capaService.listNCs(orgId, "OPEN", "PRP");
      setOpenNCs(ncs);
    }
  };

  const handleFilterChange = async (zoneId: string, monthValue?: string) => {
    const zId = zoneId !== undefined ? zoneId : selectedZone;
    const mVal = monthValue !== undefined ? monthValue : selectedMonth;
    
    setSelectedZone(zId);
    setSelectedMonth(mVal);
    setLoading(true);
    
    try {
      let auditDate = undefined;
      if (mVal) {
        auditDate = `${mVal}-01`;
      }
      
      const ads = await prpService.listAudits({ 
        area_id: zId || undefined,
        audit_date: auditDate 
      });
      setAudits(ads);
    } catch (error) {
      console.error("Failed to filter audits:", error);
    } finally {
      setLoading(false);
    }
  };

  const currentScore = audits[0]?.compliance_rate || 0;

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

      <div className="mb-6 flex gap-4">
        <select
          value={selectedZone}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700"
        >
          <option value="">Tất cả khu vực</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        <div className="relative">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => handleFilterChange(selectedZone, e.target.value)}
            className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e8b9b]"
          />
          {selectedMonth && (
            <button 
              onClick={() => handleFilterChange(selectedZone, "")}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Xóa bộ lọc thời gian"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e8b9b]"></div>
        </div>
      ) : (
        <div className="flex gap-6 items-stretch">
          <section className="w-64 space-y-6 flex flex-col">
            <div className="rounded-xl bg-white p-6 shadow flex flex-col flex-1">
              <h2 className="mb-4 font-bold text-slate-800 uppercase text-xs tracking-wider text-slate-400">Hiệu suất chung</h2>
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-5xl font-black text-[#1e8b9b] mb-1">
                  {audits.length > 0 
                    ? Math.round(audits.reduce((acc, a) => acc + a.compliance_rate, 0) / audits.length) 
                    : 0}%
                </div>
                <p className="text-xs text-slate-500 font-medium">Tỉ lệ tuân thủ trung bình</p>
                <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#1e8b9b] rounded-full" 
                    style={{ width: `${audits.length > 0 ? audits.reduce((acc, a) => acc + a.compliance_rate, 0) / audits.length : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 font-bold text-slate-800 uppercase text-xs tracking-wider text-slate-400">NC Tồn đọng</h2>
              <div className="flex items-baseline gap-2">
                <div className="text-4xl font-black text-rose-500">{openNCs.length}</div>
                <div className="text-xs font-bold text-rose-300 uppercase">Điểm lỗi</div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 italic">Cần xử lý CAPA ngay</p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow">
              <h2 className="mb-4 font-bold text-slate-800 uppercase text-xs tracking-wider text-slate-400">Rủi ro cao nhất</h2>
              <div className="text-sm font-bold text-slate-700 truncate" title={audits.sort((a,b) => a.compliance_rate - b.compliance_rate)[0]?.area?.name || "N/A"}>
                {audits.sort((a,b) => a.compliance_rate - b.compliance_rate)[0]?.area?.name || "Chưa có dữ liệu"}
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
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-blue-50/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ngày</th>
                    <th className="px-4 py-3 font-medium">Khu vực</th>
                    <th className="px-4 py-3 text-center font-medium">Tỉ lệ tuân thủ</th>
                    <th className="px-4 py-3 font-medium">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                        Không có dữ liệu đánh giá cho bộ lọc này.
                      </td>
                    </tr>
                  ) : (
                    audits.map((audit) => (
                      <tr 
                        key={audit.id} 
                        onClick={() => setSelectedAuditId(audit.id)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          {new Date(audit.audit_date).toLocaleDateString("vi-VN")}
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
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center justify-center bg-white border border-sky-100 rounded-lg w-12 h-12 shadow-sm shrink-0">
                          <span className="text-[8px] uppercase font-bold text-sky-500 leading-none">T{new Date(s.start_time).getMonth() + 1}</span>
                          <span className="text-lg font-bold text-slate-700 leading-none mt-0.5">{new Date(s.start_time).getDate()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-700 text-xs truncate group-hover:text-sky-600 transition-colors" title={s.title}>
                            {s.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(s.start_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Widget 2: Điểm NC đang mở */}
            <section className="flex-1 rounded-xl bg-white p-6 shadow flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  Điểm NC đang mở
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
                    <div key={nc.id} className="group p-3 border border-rose-50 rounded-xl bg-rose-50/30 hover:bg-white hover:shadow-sm transition-all border-l-4 border-l-rose-500">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-700 text-xs truncate group-hover:text-rose-600 transition-colors" title={nc.title}>
                          {nc.title}
                        </h3>
                        <div className="mt-1 flex items-center justify-between text-[10px] font-medium">
                          <span className="text-slate-400">{new Date(nc.detected_at).toLocaleDateString("vi-VN")}</span>
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded uppercase text-[8px] font-bold">{nc.severity}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      )}

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
          onClose={() => setShowAuditForm(false)}
          onSuccess={() => {
            setShowAuditForm(false);
            prpService.listAudits().then(setAudits);
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
        />
      )}

      {showUpcomingModal && (
        <UpcomingSchedulesModal onClose={() => setShowUpcomingModal(false)} />
      )}

      {showNCTracking && (
        <NCTrackingModal onClose={() => setShowNCTracking(false)} />
      )}
    </AppShell>
  );
}

function NCTrackingModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { principal } = useAuth();
  const orgId = principal?.org_id;
  const [ncs, setNcs] = useState<NonConformity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNC, setSelectedNC] = useState<NonConformity | null>(null);

  const fetchNCs = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      // Chỉ lấy lỗi từ nguồn PRP
      const data = await capaService.listNCs(orgId, "OPEN", "PRP");
      setNcs(data);
    } catch (error) {
      console.error("Failed to fetch NCs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNCs();
  }, [orgId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-rose-600 text-white">
          <div>
            <h2 className="text-xl font-bold">Theo dõi điểm Không tuân thủ (NC) - PRP</h2>
            <p className="text-xs text-rose-100 mt-1">Danh sách lỗi phát sinh từ Đánh giá PRP</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div className="p-6 flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-10">Đang tải danh sách lỗi...</div>
          ) : ncs.length === 0 ? (
            <div className="text-center py-20 text-slate-400 border-2 border-dashed rounded-xl">
              Hiện tại không có điểm lỗi PRP nào cần xử lý.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-bold text-slate-600">Ngày phát hiện</th>
                  <th className="px-4 py-3 font-bold text-slate-600">Nội dung lỗi</th>
                  <th className="px-4 py-3 font-bold text-slate-600 text-center">Mức độ</th>
                  <th className="px-4 py-3 font-bold text-slate-600 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ncs.map((nc) => (
                  <tr key={nc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 text-slate-500 w-32">
                      {new Date(nc.detected_at).toLocaleDateString("vi-VN")}
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
                    <td className="px-4 py-4 text-right w-32">
                      <button
                        onClick={() => setSelectedNC(nc)}
                        className="px-3 py-1 bg-rose-500 text-white rounded font-bold text-xs hover:bg-rose-600 transition"
                      >
                        Gửi CAPA
                      </button>
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

      {selectedNC && (
        <CAPAFormModal 
          nc={selectedNC} 
          onClose={() => setSelectedNC(null)} 
          onSuccess={() => {
            setSelectedNC(null);
            fetchNCs();
          }}
        />
      )}
    </div>
  );
}

function CAPAFormModal({ nc, onClose, onSuccess }: { nc: NonConformity, onClose: () => void, onSuccess: () => void }) {
  const toast = useToast();
  const { principal } = useAuth();
  
  const [title, setTitle] = useState(`Khắc phục: ${nc.title}`);
  const [rootCause, setRootCause] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!principal?.org_id) return;
    try {
      setLoading(true);
      // 1. Tạo CAPA
      await capaService.createCAPA({
        org_id: principal.org_id,
        nc_id: nc.id,
        title,
        root_cause: rootCause,
        due_date: dueDate || undefined,
        status: "OPEN"
      });

      // 2. Cập nhật NC sang trạng thái đang xử lý (In-progress/Capa-linked)
      // Trong logic demo này, chúng ta giả định NC sẽ được ẩn hoặc đổi trạng thái
      await capaService.updateNC(nc.id, { status: "IN_PROGRESS" });

      toast.success("Đã gửi yêu cầu CAPA thành công!");
      onSuccess();
    } catch (error) {
      console.error("Failed to create CAPA:", error);
      toast.error("Lỗi khi gửi CAPA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b flex justify-between items-center bg-slate-800 text-white">
          <h2 className="text-lg font-bold">Khởi tạo hành động CAPA</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-rose-400">Đang xử lý lỗi:</p>
            <p className="text-sm font-bold text-slate-700">{nc.title}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Tiêu đề CAPA</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm focus:ring-slate-800"
              placeholder="VD: Khắc phục lỗi vệ sinh khu vực đóng gói"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Phân tích nguyên nhân gốc rễ (Root Cause)</label>
            <textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm focus:ring-slate-800"
              placeholder="Nhập phân tích nguyên nhân..."
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Hạn hoàn thành</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm focus:ring-slate-800"
            />
          </div>

          <div className="pt-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !title || !dueDate}
              className="flex-[2] py-3 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 disabled:opacity-50 transition shadow-lg"
            >
              {loading ? "Đang gửi..." : "Gửi yêu cầu CAPA"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpcomingSchedulesModal({ onClose }: { onClose: () => void }) {
  const { principal } = useAuth();
  const orgId = principal?.org_id;
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    prpService.getUpcomingSchedules(orgId)
      .then(setSchedules)
      .catch(err => console.error("Failed to load upcoming schedules:", err))
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-sky-600 text-white">
          <h2 className="text-xl font-bold">Lịch công việc PRP sắp tới</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div className="p-6 flex-1 overflow-auto">
          {loading ? (
            <div className="text-center py-10 text-slate-400 font-medium italic">Đang tải lịch công việc...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-20 text-slate-400 border-2 border-dashed rounded-xl">
              Chưa có lịch làm việc nào được lên kế hoạch.
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((s) => (
                <div key={s.id} className="flex gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all group">
                  <div className="flex flex-col items-center justify-center bg-white border border-sky-100 rounded-lg px-4 py-2 min-w-[100px] shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-sky-500">Tháng {new Date(s.start_time).getMonth() + 1}</span>
                    <span className="text-2xl font-bold text-slate-700">{new Date(s.start_time).getDate()}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Năm {new Date(s.start_time).getFullYear()}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 group-hover:text-sky-600 transition-colors">{s.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(s.start_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {/* Khu vực thường có trong title, nếu muốn tách riêng cần parse description */}
                        Lịch trình hệ thống
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-bold">Dự kiến</span>
                  </div>
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
function AuditDetailModal({ auditId, onClose }: { auditId: string; onClose: () => void }) {
  const [audit, setAudit] = useState<PRPAudit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    prpService.getAuditById(auditId)
      .then(setAudit)
      .finally(() => setLoading(false));
  }, [auditId]);

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-xl shadow-xl">Đang tải chi tiết...</div>
    </div>
  );

  if (!audit) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Chi tiết Đánh giá PRP</h2>
            <div className="flex flex-col">
              <p className="text-sm font-medium text-[#1e8b9b]">
                Chương trình: {audit.prp_program ? audit.prp_program.name : "Đang tải..."}
              </p>
              <p className="text-xs text-slate-500">
                Khu vực: {audit.area?.name}
              </p>
              <p className="text-xs text-slate-500">
                Ngày: {new Date(audit.audit_date).toLocaleDateString("vi-VN")}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-600 font-bold uppercase mb-1">Tỉ lệ tuân thủ</p>
              <p className="text-2xl font-bold text-emerald-700">{audit.compliance_rate}%</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-600 font-bold uppercase mb-1">Kết quả chung</p>
              <p className="text-2xl font-bold text-blue-700">{audit.overall_result}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-600 font-bold uppercase mb-1">Tổng số hạng mục</p>
              <p className="text-2xl font-bold text-slate-700">{audit.details?.length || 0}</p>
            </div>
          </div>

          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-bold">Hạng mục kiểm tra</th>
                <th className="px-4 py-3 text-center font-bold">Kết quả</th>
                <th className="px-4 py-3 font-bold">Ghi chú / Quan sát</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audit.details?.map((detail) => (
                <tr key={detail.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-4">
                    <p className="font-medium text-slate-800">{detail.checklist?.question_text}</p>
                    <p className="text-xs text-slate-400">ID: {detail.checklist_id}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      detail.result === "PASS" ? "bg-emerald-100 text-emerald-700" : 
                      detail.result === "FAIL" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {detail.result}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-500 italic">
                    {detail.observation || "Không có ghi chú"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-slate-800 text-white rounded-lg font-medium">Đóng</button>
        </div>
      </div>
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

function AuditFormModal({ locations, programs, onClose, onSuccess }: any) {
  const toast = useToast();
  const { principal } = useAuth();
  const orgId = principal?.org_id;

  const [selectedLocation, setSelectedLocation] = useState(locations[0]?.id || "");
  const [selectedProgram, setSelectedProgram] = useState(programs[0]?.id || "");
  const [templates, setTemplates] = useState<PRPChecklistTemplate[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
    }
  }, [selectedLocation, selectedProgram]);

  const handleSubmit = async () => {
    if (!orgId) {
      toast.error("Không tìm thấy thông tin tổ chức.");
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
          observation: obs
        };
      });
      
      const complianceRate = scoreableCount > 0 ? (passCount / scoreableCount) * 100 : 0;

      await prpService.createFullAudit({
        audit_data: {
          org_id: orgId,
          prp_program_id: selectedProgram,
          area_id: selectedLocation,
          audit_date: auditDate,
          compliance_rate: complianceRate,
          overall_result: complianceRate >= 80 ? "PASSED" : "FAILED",
        },
        details: details,
      });

      toast.success("Báo cáo đánh giá đã được gửi!");
      onSuccess();
    } catch (error) {
      console.error("Failed to submit audit:", error);
      toast.error("Lỗi khi gửi báo cáo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b flex justify-between items-center bg-[#1e8b9b] text-white">
          <h2 className="text-xl font-bold">Bắt đầu Đánh giá tuân thủ</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-6 flex-1 overflow-auto space-y-6">
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <label className="block text-xs uppercase font-bold text-slate-400 mb-1">1. Chọn Chương trình</label>
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:ring-[#1e8b9b] text-sm font-medium"
              >
                {programs.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase font-bold text-slate-400 mb-1">2. Chọn Khu vực</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:ring-[#1e8b9b] text-sm font-medium"
              >
                {locations.map((loc: any) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-8">
            {loading ? (
              <div className="text-center py-20">
                <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-[#1e8b9b] rounded-full mb-2"></div>
                <p className="text-slate-400">Đang tải danh sách kiểm tra...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-20 text-slate-400 border-2 border-dashed rounded-xl italic">
                Không tìm thấy câu hỏi nào cho cấu hình đã chọn.
              </div>
            ) : (
              templates.map((t) => (
                <div key={t.id} className="border-b border-slate-100 pb-6 last:border-0">
                  <div className="flex justify-between items-start mb-4">
                    <p className="font-semibold text-slate-800 flex-1 mr-4">{t.question_text}</p>
                    {t.answer_type === "NUMBER" && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">Mục tiêu: ≥ {t.target_value}</span>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    {t.answer_type === "BOOLEAN" ? (
                      <div className="flex gap-4">
                        <button
                          onClick={() => setResults({ ...results, [t.id]: "PASS" })}
                          className={`flex-1 py-2 rounded-lg border font-bold transition-all ${
                            results[t.id] === "PASS" ? "bg-emerald-500 border-emerald-500 text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:border-emerald-200"
                          }`}
                        >
                          ✓ Đạt
                        </button>
                        <button
                          onClick={() => setResults({ ...results, [t.id]: "FAIL" })}
                          className={`flex-1 py-2 rounded-lg border font-bold transition-all ${
                            results[t.id] === "FAIL" ? "bg-red-500 border-red-500 text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:border-red-200"
                          }`}
                        >
                          × Không đạt
                        </button>
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={results[t.id]}
                        onChange={(e) => setResults({ ...results, [t.id]: e.target.value })}
                        className="w-full rounded-lg border-slate-200 shadow-sm focus:ring-[#1e8b9b] focus:border-[#1e8b9b]"
                        placeholder="Nhập giá trị thực tế..."
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Ghi chú / Quan sát</label>
                    <textarea
                      value={observations[t.id]}
                      onChange={(e) => setObservations({ ...observations, [t.id]: e.target.value })}
                      className="w-full rounded-lg border-slate-200 shadow-sm text-sm focus:ring-[#1e8b9b] focus:border-[#1e8b9b]"
                      placeholder="Ghi rõ tình trạng thực tế..."
                      rows={2}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 border-t flex justify-end gap-3 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800 transition">Hủy</button>
          <button
            onClick={handleSubmit}
            disabled={loading || templates.length === 0}
            className="px-8 py-2 bg-[#1e8b9b] text-white rounded-lg font-bold hover:bg-[#166a77] disabled:opacity-50 transition shadow-lg"
          >
            Nộp Báo cáo
          </button>
        </div>
      </div>
    </div>
  );
}
