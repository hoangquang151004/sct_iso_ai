"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import { ActionsBySourceChart } from "@/components/shared/charts";
import { capaService, NonConformity, CAPA } from "@/services/capa-service";
import { useAuth, useToast } from "@/hooks";

export default function CapaManagementPage() {
  const { principal } = useAuth();
  const orgId = principal?.org_id || "";
  const toast = useToast();

  const [kpis, setKpis] = useState<any>(null);
  const [ncs, setNcs] = useState<NonConformity[]>([]);
  const [capas, setCapas] = useState<CAPA[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNC, setSelectedNC] = useState<NonConformity | null>(null);
  const [selectedCAPA, setSelectedCAPA] = useState<CAPA | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [boardColumns, setBoardColumns] = useState<Record<string, CAPA[]>>({});
  const [sourceChartData, setSourceChartData] = useState<any>(null);

  const fetchData = async () => {
    if (!orgId) return;
    try {
      setLoading(true);
      const [kpiData, ncData, boardData] = await Promise.all([
        capaService.getKPIs(orgId),
        capaService.listNCs(orgId, "WAITING", sourceFilter || undefined),
        capaService.getBoard(orgId)
      ]);
      
      setKpis(kpiData);
      setNcs(ncData);
      setBoardColumns(boardData.columns || {});

      // Xử lý dữ liệu biểu đồ từ nguồn thực tế
      if (kpiData.source_distribution) {
        const labels = Object.keys(kpiData.source_distribution);
        const dataValues = Object.values(kpiData.source_distribution);
        
        setSourceChartData({
          labels,
          datasets: [
            {
              data: dataValues,
              backgroundColor: ["#fb923c", "#3b82f6", "#2dd4bf", "#a855f7", "#94a3b8"],
              borderWidth: 0,
            },
          ],
        });
      }
      
      // Vẫn giữ danh sách phẳng cho trường hợp cần thiết, nhưng Kanban sẽ dùng boardColumns
      const allCapas: CAPA[] = [];
      Object.values(boardData.columns || {}).forEach((columnCapas: any) => {
        allCapas.push(...columnCapas);
      });
      setCapas(allCapas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      
    } catch (error) {
      console.error("Failed to fetch CAPA data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [orgId, sourceFilter]);

  const statusClass = (status: string) => {
    switch (status) {
      case "OPEN": return "bg-rose-500";
      case "IN_PROGRESS": return "bg-blue-500";
      case "VERIFYING": return "bg-amber-500";
      case "CLOSED": return "bg-emerald-500";
      default: return "bg-slate-400";
    }
  };

  const statusText = (status: string) => {
    switch (status) {
      case "OPEN": return "Mở";
      case "IN_PROGRESS": return "Đang xử lý";
      case "VERIFYING": return "Đang xác minh";
      case "CLOSED": return "Đã đóng";
      default: return status;
    }
  };

  return (
    <AppShell activePath="/capa-management">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Quản lý CAPA</h1>
        <button 
          onClick={() => fetchData()}
          className="p-2 text-slate-400 hover:text-slate-600 transition"
          title="Làm mới dữ liệu"
        >
          <svg className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-6 shadow border-b-4 border-rose-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Đang mở (NC & CAPA)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{kpis?.open || 0}</span>
            <span className="text-sm font-medium text-slate-400">Yêu cầu</span>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow border-b-4 border-blue-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Đang thực hiện</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{kpis?.in_progress || 0}</span>
            <span className="text-sm font-medium text-slate-400">CAPA</span>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow border-b-4 border-emerald-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Đã hoàn thành</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-800">{kpis?.closed || 0}</span>
            <span className="text-sm font-medium text-slate-400">Tuyệt vời!</span>
          </div>
        </div>
        <div className="rounded-xl bg-white p-6 shadow border-b-4 border-amber-500">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quá hạn</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{kpis?.overdue || 0}</span>
            <span className="text-sm font-medium text-slate-400">Cần chú ý</span>
          </div>
        </div>
      </div>

      {/* Chart and NC Inbox Section */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 bg-white rounded-xl shadow p-6 flex flex-col items-center justify-center">
          <h2 className="text-lg font-bold text-slate-800 w-full mb-4">Tỷ lệ theo nguồn gốc</h2>
          <div className="w-full flex-1 min-h-[200px]">
            <ActionsBySourceChart chartData={sourceChartData} />
          </div>
        </div>
        
        <div className="col-span-1 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">Điểm NC chờ xử lý</h2>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full text-xs font-bold">{ncs.length}</span>
            </div>
            <select
              className="rounded-lg border-slate-300 text-sm focus:ring-slate-800 font-medium text-slate-600 shadow-sm px-3 py-1.5"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="">Tất cả nguồn</option>
              <option value="HACCP">HACCP</option>
              <option value="PRP">PRP</option>
            </select>
          </div>
          
          <div className="bg-white rounded-xl shadow overflow-hidden h-[300px] overflow-y-auto">
          {ncs.length === 0 ? (
            <div className="p-10 text-center text-slate-400 italic">
              Không có điểm lỗi NC nào đang chờ xử lý.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-6 py-3 font-bold uppercase text-[10px]">Ngày</th>
                  <th className="px-6 py-3 font-bold uppercase text-[10px]">Nguồn</th>
                  <th className="px-6 py-3 font-bold uppercase text-[10px]">Nội dung lỗi</th>
                  <th className="px-6 py-3 font-bold uppercase text-[10px] text-center">Mức độ</th>
                  <th className="px-6 py-3 font-bold uppercase text-[10px] text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ncs.map((nc) => (
                  <tr key={nc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-500">{new Date(nc.detected_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        nc.source === "PRP" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {nc.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{nc.title}</div>
                      {nc.description && (
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-2 italic" title={nc.description}>
                          {nc.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        nc.severity === "HIGH" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {nc.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedNC(nc)}
                        className="px-4 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition shadow-sm"
                      >
                        Khởi tạo CAPA
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
      </div>

      {/* Kanban Board Section */}
      <div className="mb-6 flex justify-between items-center">
        <h2 className="font-bold text-slate-800 text-lg">Bảng công việc</h2>
        <button className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm">
          Xuất báo cáo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start mb-8">
        {["OPEN", "IN_PROGRESS", "VERIFYING", "CLOSED"].map((colStatus) => {
          const colCapas = boardColumns[colStatus] || [];
          return (
            <div key={colStatus} className="bg-slate-100 rounded-xl p-3 flex flex-col gap-3 min-h-[300px]">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-bold text-sm text-slate-700">{statusText(colStatus)}</h3>
                <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">{colCapas.length}</span>
              </div>
              
              {colCapas.length === 0 ? (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg p-4">
                  <span className="text-xs font-medium text-slate-400 italic">Trống</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {colCapas.map((capa) => (
                    <div 
                      key={capa.id} 
                      onClick={() => setSelectedCAPA(capa)}
                      className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-slate-300 transition-all flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                          {capa.capa_code || "Mới"}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${statusClass(capa.status)}`} />
                      </div>
                      
                      <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">
                        {capa.title}
                      </p>
                      
                      <div className="flex justify-between items-center pt-3 border-t border-slate-50 mt-auto">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-[10px] font-medium">
                            {capa.due_date ? new Date(capa.due_date).toLocaleDateString() : "--/--"}
                          </span>
                        </div>
                        {capa.assigned_to ? (
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600" title={capa.assigned_to}>
                            {capa.assigned_to.charAt(0).toUpperCase()}
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400 border border-dashed border-slate-300">
                            +
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedNC && (
        <CAPAFormModal 
          nc={selectedNC} 
          onClose={() => setSelectedNC(null)} 
          onSuccess={() => {
            setSelectedNC(null);
            fetchData();
          }}
        />
      )}

      {selectedCAPA && (
        <CAPADetailModal
          capa={selectedCAPA}
          onClose={() => setSelectedCAPA(null)}
          onSuccess={() => {
            setSelectedCAPA(null);
            fetchData();
          }}
        />
      )}
    </AppShell>
  );
}

function CAPADetailModal({ capa, onClose, onSuccess }: { capa: CAPA, onClose: () => void, onSuccess: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(capa.status);

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setLoading(true);
      await capaService.updateCAPA(capa.id, { status: newStatus });
      toast.success(`Đã cập nhật trạng thái CAPA thành: ${newStatus}`);
      onSuccess();
    } catch (error) {
      console.error("Failed to update CAPA status:", error);
      toast.error("Lỗi khi cập nhật trạng thái.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-slate-800 text-white">
          <div>
            <h2 className="text-xl font-bold">{capa.capa_code || "Chi tiết CAPA"}</h2>
            <p className="text-xs text-slate-300">Khởi tạo ngày: {new Date(capa.created_at).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-8 space-y-6 flex-1 overflow-auto">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Tiêu đề hành động</label>
            <p className="text-lg font-bold text-slate-800">{capa.title}</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Trạng thái hiện tại</label>
              <span className={`${
                capa.status === "OPEN" ? "bg-rose-500" : 
                capa.status === "IN_PROGRESS" ? "bg-blue-500" : 
                capa.status === "VERIFYING" ? "bg-amber-500" : "bg-emerald-500"
              } rounded-full px-4 py-1 text-xs font-bold text-white shadow-sm`}>
                {capa.status}
              </span>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Hạn hoàn thành</label>
              <p className="font-bold text-slate-700">{capa.due_date ? new Date(capa.due_date).toLocaleDateString() : "Chưa thiết lập"}</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">Nguyên nhân gốc rễ (Từ Quản lý)</label>
            <p className="text-sm text-slate-600 italic leading-relaxed">
              {capa.root_cause || "Chưa có phân tích nguyên nhân."}
            </p>
          </div>

          {capa.status !== "CLOSED" && (
            <div className="pt-4 border-t space-y-4">
              <label className="text-xs font-bold text-slate-800 uppercase block">Cập nhật tiến độ xử lý</label>
              <div className="flex flex-wrap gap-3">
                {capa.status === "OPEN" && (
                  <button 
                    onClick={() => handleUpdateStatus("IN_PROGRESS")}
                    className="px-6 py-2 bg-blue-100 text-blue-700 rounded-lg font-bold text-sm hover:bg-blue-200 transition"
                  >
                    Bắt đầu thực hiện
                  </button>
                )}
                {capa.status === "IN_PROGRESS" && (
                  <button 
                    onClick={() => handleUpdateStatus("VERIFYING")}
                    className="px-6 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold text-sm hover:bg-amber-200 transition"
                  >
                    Gửi yêu cầu Thẩm tra
                  </button>
                )}
                {(capa.status === "VERIFYING" || capa.status === "IN_PROGRESS") && (
                  <button 
                    onClick={() => handleUpdateStatus("CLOSED")}
                    className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-bold text-sm hover:bg-emerald-600 transition shadow-md"
                  >
                    Đóng CAPA (Hoàn tất)
                  </button>
                )}
              </div>
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

// Re-using CAPAFormModal (Better moved to components/shared later)
function CAPAFormModal({ nc, onClose, onSuccess }: { nc: NonConformity, onClose: () => void, onSuccess: () => void }) {
  const toast = useToast();
  const { principal } = useAuth();
  
  const [title, setTitle] = useState("");
  const [rootCause, setRootCause] = useState(nc.title || ""); // Đã sửa: Lấy nội dung phân tích của Quản lý
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!principal?.org_id) return;
    try {
      setLoading(true);
      await capaService.createCAPA({
        org_id: principal.org_id,
        nc_id: nc.id,
        title,
        root_cause: rootCause,
        due_date: dueDate || undefined,
        status: "OPEN"
      });

      toast.success("Đã khởi tạo CAPA thành công!");
      onSuccess();
    } catch (error) {
      console.error("Failed to create CAPA:", error);
      toast.error("Lỗi khi tạo CAPA.");
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
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <p className="text-[10px] uppercase font-bold text-slate-400">Nguồn gốc (Câu hỏi kiểm tra):</p>
            <p className="text-xs font-medium text-slate-600 italic mt-1">{nc.description}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Tiêu đề hành động</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm focus:ring-slate-800"
              placeholder="VD: Thay thế thiết bị đo nhiệt độ hỏng"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Phân tích nguyên nhân (Từ Quản lý)</label>
            <textarea
              value={rootCause}
              readOnly
              className="w-full rounded-lg border-slate-100 bg-slate-50 text-slate-500 text-sm focus:ring-0 cursor-not-allowed"
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
              {loading ? "Đang xử lý..." : "Lưu & Bắt đầu xử lý"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
