"use client";

import { useState, useEffect } from "react";
import AppShell from "@/components/layout/app-shell";
import { haccpSidebarButtons, currentUser, getUserDisplayName } from "@/lib/mock-data";
import { useUsers, User } from "@/lib/hooks/use-users";
import { 
  useHaccpPlans, 
  useProcessSteps, 
  useCCPs, 
  useHazards,
  useAllCCPLogs,
  useDeviations,
  useDeviationStats,
  handleDeviation,
  useAllProcessStepsWithHazards,
  useAllCCPs,
  useHaccpPlanVersions,
  createNewVersion,
  ProcessStepWithPlan,
  DeviationFilters,
  HandleDeviationPayload,
  HaccpPlanVersion
} from "@/lib/hooks/use-haccp";
import { CCPMonitoringLog, HazardAnalysis, CCP } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";
import HaccpWizard from "@/components/haccp-wizard";
import Modal from "@/components/ui/modal";

export default function HaccpCompliancePage() {
  const [activeTab, setActiveTab] = useState(haccpSidebarButtons[0]?.id ?? "process-flow");
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPlanId, setWizardPlanId] = useState<string | null>(null);
  
  // States for Flow Modal
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [flowModalPlanId, setFlowModalPlanId] = useState<string | null>(null);

  // States for Hazard Detail Modal
  const [isHazardModalOpen, setIsHazardModalOpen] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState<HazardAnalysis | null>(null);
  const [selectedStepInfo, setSelectedStepInfo] = useState<{stepName: string; planName: string} | null>(null);

  // States for CCP Detail Modal
  const [isCCPModalOpen, setIsCCPModalOpen] = useState(false);
  const [selectedCCP, setSelectedCCP] = useState<CCP | null>(null);

  // State for CCP search
  const [ccpSearchTerm, setCcpSearchTerm] = useState("");

  // State for Hazard search
  const [hazardSearchTerm, setHazardSearchTerm] = useState("");

  // States for Version Management
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [selectedPlanForVersion, setSelectedPlanForVersion] = useState<{id: string; version: string; name: string; scope?: string; product_id?: string} | null>(null);
  const [isVersionsViewModalOpen, setIsVersionsViewModalOpen] = useState(false);
  const [viewVersionsPlanId, setViewVersionsPlanId] = useState<string | null>(null);

  const { plans, loading: plansLoading, refetch: refetchPlans } = useHaccpPlans();

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [flowSearchTerm, setFlowSearchTerm] = useState("");

  const filteredPlans = plans.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPlansForFlow = plans.filter(p => 
    p.name.toLowerCase().includes(flowSearchTerm.toLowerCase()) ||
    (p.scope && p.scope.toLowerCase().includes(flowSearchTerm.toLowerCase()))
  );

  useEffect(() => {
    if (!selectedPlanId && plans && plans.length > 0) {
      setSelectedPlanId(plans[0].id);
    }
  }, [selectedPlanId, plans]);

  const { steps, loading: stepsLoading } = useProcessSteps(selectedPlanId);
  const { ccps, loading: ccpsLoading } = useCCPs(selectedPlanId);
  
  // Hook for all CCPs (for the CCPs tab showing all plans)
  const { allCcps, loading: allCcpsLoading, refetch: refetchAllCcps } = useAllCCPs();

  // Hook for users (for monitoring logs form)
  const { users, loading: usersLoading } = useUsers({ is_active: true });

  // New hooks for all features
  const { logs: allLogs, loading: logsLoading, refetch: refetchLogs } = useAllCCPLogs(selectedPlanId);
  
  // Deviation management state
  const [deviationFilters, setDeviationFilters] = useState<DeviationFilters>({});
  const { deviations, loading: deviationsLoading, refetch: refetchDeviations } = useDeviations(null, deviationFilters);
  const { stats: deviationStats, loading: deviationStatsLoading, refetch: refetchDeviationStats } = useDeviationStats(null);
  const [selectedDeviation, setSelectedDeviation] = useState<CCPMonitoringLog | null>(null);
  const [isHandleDeviationModalOpen, setIsHandleDeviationModalOpen] = useState(false);
  
  // Hook lấy tất cả công đoạn và mối nguy từ tất cả kế hoạch cho phân tích đầy đủ
  const { allStepsWithHazards, loading: allHazardsFullLoading } = useAllProcessStepsWithHazards();

  // We are currently picking the first step to fetch hazards as a demo
  const firstStepId = steps && steps.length > 0 ? steps[0].id : null;
  const { hazards: firstStepHazards, loading: hazardsLoading } = useHazards(firstStepId);

  // Fetch all hazards for all steps
  const [allHazards, setAllHazards] = useState<Record<string, any[]>>({});
  const [allHazardsLoading, setAllHazardsLoading] = useState(false);

  useEffect(() => {
    const fetchAllHazards = async () => {
      if (!steps || steps.length === 0) return;
      setAllHazardsLoading(true);
      const hazardsMap: Record<string, any[]> = {};
      for (const step of steps) {
        try {
          const data = await apiFetch<any[]>(`/haccp/steps/${step.id}/hazards`);
          hazardsMap[step.id] = data;
        } catch {
          hazardsMap[step.id] = [];
        }
      }
      setAllHazards(hazardsMap);
      setAllHazardsLoading(false);
    };
    fetchAllHazards();
  }, [steps]);

  const hazardColor = (hazardType: string) => {
    if (hazardType === "BIOLOGICAL") return "bg-orange-500";
    if (hazardType === "CHEMICAL") return "bg-emerald-500";
    if (hazardType === "PHYSICAL") return "bg-blue-500";
    return "bg-teal-500";
  };

  const hazardNameVN = (t: string) => {
    if (t === "BIOLOGICAL") return "Sinh học";
    if (t === "CHEMICAL") return "Hóa học";
    if (t === "PHYSICAL") return "Vật lý";
    return t;
  };

  // Refresh plans when Wizard finishes successfully to fetch new data
  const handleWizardSuccess = () => {
    refetchPlans();
    setIsWizardOpen(false);
    setWizardPlanId(null);
  };

  // Handle plan approval - Không cần phân quyền, ai cũng có thể duyệt
  const handleApprovePlan = async (planId: string) => {
    if (!confirm("Phê duyệt kế hoạch này?\n\nSau khi phê duyệt, kế hoạch sẽ chuyển sang trạng thái ACTIVE.")) return;
    
    try {
      await apiFetch(`/haccp/plans/${planId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}) // Không cần gửi approved_by
      });
      alert("Đã phê duyệt kế hoạch thành công!");
      refetchPlans();
    } catch (err: any) {
      alert("Lỗi khi phê duyệt: " + err.message);
    }
  };

  // Handle plan deletion with warning for ACTIVE plans
  const handleDeletePlan = async (plan: any) => {
    const isActive = plan.status === 'ACTIVE';
    const warningMessage = isActive 
      ? `⚠️ CẢNH BÁO: Bạn đang xóa kế hoạch đang ACTIVE!\n\n` +
        `Kế hoạch: "${plan.name}" (v${plan.version})\n\n` +
        `Hậu quả:\n` +
        `- Mọi dữ liệu (quy trình, CCP, mối nguy) sẽ bị xóa vĩnh viễn\n` +
        `- Lịch sử giám sát CCP sẽ bị mất\n` +
        `- Các lô sản phẩm liên quan sẽ không có liên kết HACCP\n\n` +
        `Bạn có chắc chắn muốn xóa?`
      : `Bạn có chắc chắn muốn xóa kế hoạch "${plan.name}"?\n\nMọi dữ liệu (quy trình, CCP) sẽ bị xóa vĩnh viễn.`;
    
    if (!confirm(warningMessage)) return;
    if (isActive && !confirm(`XÁC NHẬN LẦN 2: Kế hoạch ACTIVE sẽ bị xóa hoàn toàn.\nTiếp tục?`)) return;
    
    try {
      await apiFetch(`/haccp/plans/${plan.id}`, { method: 'DELETE' });
      alert(`Đã xóa kế hoạch "${plan.name}" thành công!`);
      refetchPlans();
    } catch (err: any) {
      alert("Lỗi khi xóa: " + err.message);
    }
  };

  // Helper to get step name by ID
  const getStepName = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    return step?.name || "Không xác định";
  };

  // Helper to get CCP info by ID
  const getCCPInfo = (ccpId: string): CCP | undefined => {
    return ccps.find(c => c.id === ccpId);
  };

  // ============================================================================
  // MONITORING LOG FORM STATE & HANDLERS
  // ============================================================================
  const [showLogForm, setShowLogForm] = useState(false);
  const [logFormData, setLogFormData] = useState({
    ccp_id: "",
    batch_number: "",
    shift: "Ca 1",
    measured_value: "",
    unit: "°C",
    is_within_limit: true,
    deviation_note: "",
    recorded_by: "",
    deviation_severity: undefined as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined
  });

  const handleCreateLog = async () => {
    if (!logFormData.ccp_id || !logFormData.measured_value || !logFormData.recorded_by) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc (CCP, Giá trị đo, Người ghi nhận)");
      return;
    }
    try {
      // Convert measured_value to number before sending
      const payload = {
        ...logFormData,
        measured_value: logFormData.measured_value ? parseFloat(logFormData.measured_value) : undefined,
        recorded_at: new Date().toISOString()
      };
      // Remove empty/undefined fields
      if (!payload.measured_value && payload.measured_value !== 0) delete payload.measured_value;
      if (!payload.deviation_severity) delete payload.deviation_severity;
      
      await apiFetch(`/haccp/ccps/${logFormData.ccp_id}/logs`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      alert("Đã tạo nhật ký giám sát thành công!");
      setShowLogForm(false);
      setLogFormData({
        ccp_id: "",
        batch_number: "",
        shift: "Ca 1",
        measured_value: "",
        unit: "°C",
        is_within_limit: true,
        deviation_note: "",
        recorded_by: "",
        deviation_severity: undefined
      });
      refetchLogs();
    } catch (err: any) {
      alert("Lỗi khi tạo nhật ký: " + err.message);
    }
  };

  return (
    <AppShell activePath="/haccp-compliance">
      <div className="overflow-hidden rounded-xl bg-white shadow">
        <div className="border-t border-cyan-600 bg-[#1e8b9b] px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="w-40 shrink-0 text-2xl font-bold">HACCP</h1>
              <div className="border-l border-teal-500 pl-6 border-r pr-6 flex flex-col justify-center">
                <h2 className="text-xl font-semibold">Tuân thủ HACCP</h2>
                {/* <p className="mt-1 text-xs text-teal-100">
                  {selectedPlanId ? plans?.find(p => p.id === selectedPlanId)?.name : "Chọn kế hoạch..."}
                </p> */}
              </div>
              {/* <div className="pl-6 flex items-center">
                <select
                  className="bg-[#126b78] text-white border-0 rounded px-4 py-2 text-sm outline-none"
                  value={selectedPlanId || ""}
                  onChange={e => setSelectedPlanId(e.target.value)}
                >
                  <option value="" disabled>-- Chọn kế hoạch HACCP --</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (v{p.version})</option>
                  ))}
                </select>
              </div> */}
            </div>

            <button
              onClick={() => { setWizardPlanId(null); setIsWizardOpen(true); }}
              className="bg-white text-[#1e8b9b] px-4 py-2 rounded font-semibold text-sm hover:bg-slate-100 shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 shadow-white/20"
            >
              + Tạo Quy Trình HACCP
            </button>
          </div>
        </div>

        <div className="flex h-[calc(100vh-180px)]">
          <aside 
            className="w-48 border-r border-slate-200 bg-white pt-4 shadow-sm overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#06b6d4 #f1f5f9' }}
          >
            {haccpSidebarButtons.map((button) => {
              const isActive = button.id === activeTab;
              return (
                <button
                  key={button.id}
                  type="button"
                  onClick={() => setActiveTab(button.id)}
                  aria-pressed={isActive}
                  className={`flex w-full items-center gap-3 px-6 py-3 text-left text-sm font-medium ${isActive
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

          <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#06b6d4 #f1f5f9' }}>
            {activeTab === "plans-list" ? (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <h3 className="text-lg font-bold text-slate-800">Danh sách Kế hoạch HACCP</h3>

                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                      <input
                        type="text"
                        placeholder="Tìm theo tên..."
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <select
                      className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                    >
                      <option value="ALL">Tất cả trạng thái</option>
                      <option value="DRAFT">Nháp (DRAFT)</option>
                      <option value="ACTIVE">Hoạt động (ACTIVE)</option>
                      <option value="ARCHIVED">Lưu kho (ARCHIVED)</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-[#eef6fa] text-cyan-900 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold rounded-tl-lg">Tên Kế hoạch</th>
                        <th className="px-4 py-3 font-semibold">Phiên bản</th>
                        <th className="px-4 py-3 font-semibold">Phạm vi</th>
                        <th className="px-4 py-3 font-semibold">Trạng thái</th>
                        <th className="px-4 py-3 font-semibold">Ngày tạo</th>
                        <th className="px-4 py-3 font-semibold text-right rounded-tr-lg">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {plansLoading ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Đang tải...</td></tr>
                      ) : filteredPlans.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          {searchTerm || statusFilter !== 'ALL' ? "Không tìm thấy kết quả phù hợp." : "Chưa có kế hoạch nào. Hãy bấm '+ Tạo Quy Trình HACCP' ở trên."}
                        </td></tr>
                      ) : (
                        filteredPlans.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-cyan-800">{p.name}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs">v{p.version}</span>
                                <button
                                  onClick={() => {
                                    setViewVersionsPlanId(p.id);
                                    setIsVersionsViewModalOpen(true);
                                  }}
                                  className="text-[10px] text-slate-400 hover:text-cyan-600"
                                  title="Xem lịch sử version"
                                >
                                  📋
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3 truncate max-w-[150px]">{p.scope || "N/A"}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${p.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                                p.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-600' :
                                  'bg-amber-100 text-amber-700'
                                }`}>
                                {p.status || 'DRAFT'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs">{new Date(p.created_at).toLocaleDateString("vi-VN")}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                {p.status === 'DRAFT' && (
                                  <button
                                    onClick={() => handleApprovePlan(p.id)}
                                    className="text-xs text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded transition-colors font-medium border border-emerald-100"
                                  >
                                    Phê duyệt
                                  </button>
                                )}
                                <button
                                  onClick={() => { 
                                    setFlowModalPlanId(p.id); 
                                    setIsFlowModalOpen(true); 
                                  }}
                                  className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors font-medium border border-blue-100"
                                >
                                  Xem luồng
                                </button>
                                {p.status === 'ACTIVE' ? (
                                  <button
                                    onClick={() => { 
                                      try {
                                        console.log('[BUTTON] Opening version modal for plan:', p);
                                        const planData = {
                                          id: p.id, 
                                          version: p.version, 
                                          name: p.name,
                                          scope: p.scope,
                                          product_id: p.product_id
                                        };
                                        console.log('[BUTTON] Setting selectedPlanForVersion:', planData);
                                        setSelectedPlanForVersion(planData); 
                                        setIsVersionModalOpen(true);
                                        console.log('[BUTTON] Modal should be open now');
                                      } catch (err) {
                                        console.error('[BUTTON] Error opening modal:', err);
                                        alert('Lỗi khi mở modal: ' + (err as Error).message);
                                      }
                                    }}
                                    className="text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded transition-colors font-medium border border-purple-100"
                                    title="Tạo version mới để chỉnh sửa"
                                  >
                                    📝 Cập nhật 
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { setWizardPlanId(p.id); setIsWizardOpen(true); }}
                                    className="text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded transition-colors font-medium border border-purple-100"
                                  >
                                    Sửa Quy trình
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeletePlan(p)}
                                  className={`text-xs px-3 py-1.5 rounded transition-colors font-medium border ${p.status === 'ACTIVE' ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200' : 'text-red-600 bg-red-50 hover:bg-red-100 border-red-100'}`}
                                >
                                  {p.status === 'ACTIVE' ? 'Xóa' : 'Xóa'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : !selectedPlanId ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                {plansLoading ? "Đang tải dữ liệu..." : "Vui lòng tạo hoặc chọn một kế hoạch HACCP"}
              </div>
            ) : (
              <div className="space-y-8">
                {/* PROCESS FLOW TAB - Grid layout with fixed height */}
                {activeTab === "process-flow" && (
                  <div className="space-y-4 h-[calc(100vh-200px)] flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-800">Sơ đồ Quy trình Sản xuất</h3>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                          <input
                            type="text"
                            placeholder="Tìm kế hoạch..."
                            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 w-48"
                            value={flowSearchTerm}
                            onChange={e => setFlowSearchTerm(e.target.value)}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{filteredPlansForFlow.length} kế hoạch</span>
                      </div>
                    </div>
                    {plans.length === 0 ? (
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 text-center text-slate-400">
                        Chưa có kế hoạch HACCP nào. Hãy tạo kế hoạch mới.
                      </div>
                    ) : filteredPlansForFlow.length === 0 ? (
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 text-center text-slate-400">
                        Không tìm thấy kế hoạch phù hợp.
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
                          {filteredPlansForFlow.map((plan) => (
                            <div 
                              key={plan.id} 
                              className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-slate-800 text-sm truncate" title={plan.name}>{plan.name}</h4>
                                  <p className="text-xs text-slate-500">v{plan.version} | {plan.scope || "N/A"}</p>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ml-2 ${plan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : plan.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {plan.status || 'DRAFT'}
                                </span>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-2 mb-2 h-24 overflow-hidden">
                                <ProcessFlowDisplay planId={plan.id} compact />
                              </div>
                              <button 
                                onClick={() => { setFlowModalPlanId(plan.id); setIsFlowModalOpen(true); }}
                                className="w-full text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors font-medium border border-blue-100"
                              >
                                Xem chi tiết
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* HAZARDS TAB - Compact Analysis */}
                {activeTab === "hazards" && (
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-200px)]">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-base font-bold text-slate-800">Phân tích Mối nguy</h3>
                        <p className="text-[10px] text-slate-500">Tất cả mối nguy từ các quy trình HACCP</p>
                      </div>
                      <div className="flex gap-2 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span>Sinh học</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Hóa học</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Vật lý</span>
                      </div>
                    </div>
                    {/* Search Bar for Hazards */}
                    <div className="mb-4 relative">
                      <input
                        type="text"
                        placeholder="Tìm kiếm mối nguy theo tên, loại, hoặc quy trình..."
                        value={hazardSearchTerm}
                        onChange={(e) => setHazardSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 pl-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {hazardSearchTerm && (
                        <button
                          onClick={() => setHazardSearchTerm("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {allHazardsFullLoading ? (
                      <div className="text-center py-12 text-slate-400 flex-1">
                        <div className="w-10 h-10 border-2 border-cyan-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm">Đang tải dữ liệu...</p>
                      </div>
                    ) : allStepsWithHazards.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex-1">
                        <span className="text-3xl mb-2 block">📊</span>
                        <p className="text-sm font-medium">Chưa có dữ liệu phân tích mối nguy</p>
                        <p className="text-xs text-slate-400 mt-1">Tạo kế hoạch HACCP và thêm công đoạn để bắt đầu</p>
                      </div>
                    ) : (
                      <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                        {(() => {
                          // Lọc steps và hazards theo từ khóa
                          const filteredSteps = hazardSearchTerm
                            ? allStepsWithHazards.filter(step =>
                                step.hazards?.some(h =>
                                  h.hazard_name.toLowerCase().includes(hazardSearchTerm.toLowerCase()) ||
                                  h.hazard_type.toLowerCase().includes(hazardSearchTerm.toLowerCase()) ||
                                  (h.description && h.description.toLowerCase().includes(hazardSearchTerm.toLowerCase())) ||
                                  step.plan_name.toLowerCase().includes(hazardSearchTerm.toLowerCase()) ||
                                  step.name.toLowerCase().includes(hazardSearchTerm.toLowerCase())
                                )
                              )
                            : allStepsWithHazards;

                          const groupedByPlan = filteredSteps.reduce((acc, step) => {
                            const planId = step.plan_id;
                            if (!acc[planId]) {
                              acc[planId] = { planName: step.plan_name, steps: [] };
                            }
                            acc[planId].steps.push(step);
                            return acc;
                          }, {} as Record<string, { planName: string; steps: ProcessStepWithPlan[] }>);

                          return Object.entries(groupedByPlan).map(([planId, planData]) => {
                            const totalHazards = planData.steps.reduce((sum, s) => sum + (s.hazards?.length || 0), 0);
                            const hasSignificant = planData.steps.some(s => s.hazards?.some(h => h.is_significant || h.risk_score >= 12));
                            const significantCount = planData.steps.reduce((sum, s) => sum + (s.hazards?.filter(h => h.is_significant || h.risk_score >= 12).length || 0), 0);

                            return (
                              <div key={planId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                                {/* Header Kế hoạch - Modern Design */}
                                <div className={`px-4 py-3 border-b flex justify-between items-center ${hasSignificant ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' : 'bg-gradient-to-r from-cyan-50 to-sky-50 border-slate-200'}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center text-sm">
                                      {hasSignificant ? '⚠️' : '📋'}
                                    </span>
                                    <div>
                                      <span className="font-semibold text-slate-800 block leading-tight">{planData.planName}</span>
                                      <span className="text-[10px] text-slate-500">{planData.steps.length} công đoạn • {totalHazards} mối nguy</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {hasSignificant && (
                                      <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                        {significantCount} mối nguy đáng kể
                                      </span>
                                    )}
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-medium ${hasSignificant ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                      {totalHazards} mối nguy
                                    </span>
                                  </div>
                                </div>

                                {/* Bảng mối nguy - Table Header */}
                                <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 grid grid-cols-12 gap-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                  <div className="col-span-1 text-center">STT</div>
                                  <div className="col-span-5">Tên mối nguy</div>
                                  <div className="col-span-2 text-center">Loại</div>
                                  <div className="col-span-2 text-center">Rủi ro</div>
                                  <div className="col-span-2 text-center">Thông tin</div>
                                </div>

                                {/* Bảng mối nguy - Data Rows */}
                                <div className="divide-y divide-slate-100">
                                  {planData.steps.map((step, idx) => {
                                    const hazards = step.hazards || [];
                                    if (hazards.length === 0) return null;
                                    return (
                                      <div key={`step-group-${step.id}`} className="contents">
                                        {hazards.map((h, hIdx) => (
                                          <div
                                            key={`${step.id}-${h.id}`}
                                            className={`px-4 py-3 grid grid-cols-12 gap-3 items-center cursor-pointer transition-all duration-200 hover:bg-slate-50 group ${h.is_significant || h.risk_score >= 12 ? 'bg-red-50/40 hover:bg-red-50/60' : ''}`}
                                            onClick={() => {
                                              setSelectedHazard(h);
                                              setSelectedStepInfo({ stepName: step.name, planName: planData.planName });
                                              setIsHazardModalOpen(true);
                                            }}
                                          >
                                            {/* STT & CCP Badge */}
                                            <div className="col-span-1 flex flex-col items-center justify-center">
                                              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-100 to-sky-100 text-cyan-700 flex items-center justify-center text-[10px] font-bold shadow-sm">
                                                {idx + 1}
                                              </span>
                                              {step.is_ccp && (
                                                <span className="mt-1 px-1.5 py-0.5 bg-orange-500 text-white rounded text-[8px] font-bold">
                                                  CCP
                                                </span>
                                              )}
                                            </div>

                                            {/* Tên mối nguy + Mô tả + Tên công đoạn */}
                                            <div className="col-span-5 min-w-0">
                                              <p className="text-sm font-semibold text-slate-800 group-hover:text-cyan-700 transition-colors truncate">
                                                {h.hazard_name}
                                              </p>
                                              <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                                  📍 {step.name}
                                                </span>
                                                {h.description && (
                                                  <span className="text-[11px] text-slate-500 truncate leading-relaxed">
                                                    {h.description}
                                                  </span>
                                                )}
                                              </div>
                                            </div>

                                            {/* Loại mối nguy với badge đẹp */}
                                            <div className="col-span-2 flex justify-center">
                                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${
                                                h.hazard_type === 'BIOLOGICAL' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                h.hazard_type === 'CHEMICAL' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                'bg-blue-50 border-blue-200 text-blue-700'
                                              }`}>
                                                {hazardNameVN(h.hazard_type)}
                                              </span>
                                            </div>

                                            {/* Risk Score - Badge to và đẹp */}
                                            <div className="col-span-2 flex flex-col items-center justify-center">
                                              <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
                                                h.risk_score >= 12 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                                                h.risk_score >= 8 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                                                'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white'
                                              }`}>
                                                {h.risk_score}
                                              </span>
                                              <span className="text-[9px] text-slate-400 mt-1">L{h.likelihood} × S{h.severity}</span>
                                            </div>

                                            {/* Icons chỉ báo */}
                                            <div className="col-span-2 flex items-center justify-center gap-2">
                                              {h.is_significant && (
                                                <span className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-600" title="Mối nguy đáng kể">
                                                  ⚠️
                                                </span>
                                              )}
                                              {h.control_measure && (
                                                <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600" title="Có biện pháp kiểm soát">
                                                  🛡️
                                                </span>
                                              )}
                                              {h.ai_suggestion && (
                                                <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600" title="Có đề xuất AI">
                                                  🤖
                                                </span>
                                              )}
                                              <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Click xem chi tiết">
                                                →
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Hazard Detail Modal */}
                <Modal
                  isOpen={isHazardModalOpen}
                  onClose={() => setIsHazardModalOpen(false)}
                  title="Chi tiết Phân tích Mối nguy"
                >
                  {selectedHazard && selectedStepInfo && (
                    <div className="space-y-5 px-2">
                      {/* Breadcrumb Header */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 pb-3 border-b border-slate-100">
                        <span className="px-2 py-1 bg-slate-100 rounded text-slate-600 font-medium">{selectedStepInfo.planName}</span>
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="px-2 py-1 bg-cyan-50 rounded text-cyan-700 font-medium">{selectedStepInfo.stepName}</span>
                      </div>

                      {/* Hazard Header with Icon */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                          selectedHazard.hazard_type === 'BIOLOGICAL' ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600' :
                          selectedHazard.hazard_type === 'CHEMICAL' ? 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-600' :
                          'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600'
                        }`}>
                          <span className="text-2xl">
                            {selectedHazard.hazard_type === 'BIOLOGICAL' ? '🦠' :
                             selectedHazard.hazard_type === 'CHEMICAL' ? '⚗️' : '⚙️'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xl font-bold text-slate-800 leading-tight">{selectedHazard.hazard_name}</h4>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                              selectedHazard.hazard_type === 'BIOLOGICAL' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                              selectedHazard.hazard_type === 'CHEMICAL' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              'bg-blue-50 border-blue-200 text-blue-700'
                            }`}>
                              {selectedHazard.hazard_type === 'BIOLOGICAL' ? 'Mối nguy Sinh học' :
                               selectedHazard.hazard_type === 'CHEMICAL' ? 'Mối nguy Hóa học' : 'Mối nguy Vật lý'}
                            </span>
                            {selectedHazard.is_significant && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-100 border border-red-200 text-red-700 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                Đáng kể
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Risk Score Section - Big & Visual */}
                      <div className={`p-4 rounded-xl border ${
                        selectedHazard.risk_score >= 12 ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200' :
                        selectedHazard.risk_score >= 8 ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200' :
                        'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                              selectedHazard.risk_score >= 12 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                              selectedHazard.risk_score >= 8 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                              'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white'
                            }`}>
                              <span className="text-2xl font-bold">{selectedHazard.risk_score}</span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Điểm rủi ro</p>
                              <p className={`text-sm font-semibold mt-0.5 ${
                                selectedHazard.risk_score >= 12 ? 'text-red-700' :
                                selectedHazard.risk_score >= 8 ? 'text-amber-700' : 'text-emerald-700'
                              }`}>
                                {selectedHazard.risk_score >= 12 ? 'Nguy hiểm cao' :
                                 selectedHazard.risk_score >= 8 ? 'Nguy hiểm trung bình' : 'Nguy hiểm thấp'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-4 text-center">
                            <div>
                              <p className="text-2xl font-bold text-slate-800">{selectedHazard.likelihood}</p>
                              <p className="text-[10px] text-slate-500 uppercase mt-1">Khả năng xảy ra</p>
                            </div>
                            <div className="w-px bg-slate-300"></div>
                            <div>
                              <p className="text-2xl font-bold text-slate-800">{selectedHazard.severity}</p>
                              <p className="text-[10px] text-slate-500 uppercase mt-1">Mức độ nghiêm trọng</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Description Card */}
                      {selectedHazard.description && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-lg bg-slate-200 flex items-center justify-center">
                              <span className="text-xs">📝</span>
                            </div>
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Mô tả chi tiết</p>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{selectedHazard.description}</p>
                        </div>
                      )}

                      {/* Two Column Layout for Control & AI */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Control Measure */}
                        {selectedHazard.control_measure && (
                          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-lg bg-emerald-200 flex items-center justify-center">
                                <span className="text-xs">🛡️</span>
                              </div>
                              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Biện pháp kiểm soát</p>
                            </div>
                            <p className="text-sm text-emerald-900 leading-relaxed">{selectedHazard.control_measure}</p>
                          </div>
                        )}

                        {/* AI Suggestion */}
                        {selectedHazard.ai_suggestion && (
                          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-6 h-6 rounded-lg bg-blue-200 flex items-center justify-center">
                                <span className="text-xs">🤖</span>
                              </div>
                              <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Đề xuất AI</p>
                            </div>
                            <p className="text-sm text-blue-900 leading-relaxed">{selectedHazard.ai_suggestion}</p>
                          </div>
                        )}
                      </div>

                      {/* Footer Info */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Tạo ngày: {new Date(selectedHazard.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                        {selectedHazard.is_significant && (
                          <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                            Cần kiểm soát khẩn cấp
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Modal>

                {/* CCPS TAB */}
                {activeTab === "ccps" && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-200px)]">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800">Danh sách Điểm Kiểm soát Tới hạn (CCP)</h3>
                      <span className="text-xs text-slate-500">{allCcps.length} CCP từ tất cả quy trình</span>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-4 relative">
                      <input
                        type="text"
                        placeholder="Tìm kiếm CCP theo tên, mã, hoặc quy trình..."
                        value={ccpSearchTerm}
                        onChange={(e) => setCcpSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 pl-10 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {ccpSearchTerm && (
                        <button
                          onClick={() => setCcpSearchTerm("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {allCcpsLoading ? (
                      <div className="text-center py-12 text-slate-400 flex-1">
                        <div className="w-10 h-10 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm">Đang tải CCP từ tất cả quy trình...</p>
                      </div>
                    ) : allCcps.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex-1">
                        <span className="text-3xl mb-2 block">🎯</span>
                        <p className="text-sm font-medium">Chưa có CCP nào được xác định</p>
                        <p className="text-xs text-slate-400 mt-1">Thêm CCP từ các mối nguy đáng kể</p>
                      </div>
                    ) : (
                      <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                        {(() => {
                          // Lọc CCP theo từ khóa tìm kiếm
                          const filteredCcps = ccpSearchTerm
                            ? allCcps.filter(ccp =>
                                ccp.name.toLowerCase().includes(ccpSearchTerm.toLowerCase()) ||
                                ccp.ccp_code.toLowerCase().includes(ccpSearchTerm.toLowerCase()) ||
                                ccp.critical_limit.toLowerCase().includes(ccpSearchTerm.toLowerCase()) ||
                                (ccp.monitoring_method && ccp.monitoring_method.toLowerCase().includes(ccpSearchTerm.toLowerCase()))
                              )
                            : allCcps;

                          // Tạo map plan_id -> plan_name
                          const planMap = new Map(plans.map(p => [p.id, p.name]));
                          // Tạo map step_id -> step_name
                          const stepMap = new Map(steps.map(s => [s.id, s.name]));

                          // Nhóm CCP theo haccp_plan_id
                          const groupedByPlan = filteredCcps.reduce((acc, ccp) => {
                            const planId = ccp.haccp_plan_id || 'unknown';
                            const planName = planMap.get(planId) || 'Không xác định quy trình';
                            if (!acc[planId]) {
                              acc[planId] = { planName, ccps: [] };
                            }
                            acc[planId].ccps.push(ccp);
                            return acc;
                          }, {} as Record<string, { planName: string; ccps: typeof ccps }>);

                          return Object.entries(groupedByPlan).map(([planId, planData]) => (
                            <div key={planId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                              {/* Header Quy trình */}
                              <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-200">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
                                    {planData.ccps.length}
                                  </span>
                                  <span className="font-semibold text-slate-800">{planData.planName}</span>
                                  <span className="text-xs text-slate-500">• {planData.ccps.length} CCP</span>
                                </div>
                              </div>

                              {/* Danh sách CCP trong quy trình */}
                              <div className="divide-y divide-slate-100">
                                {planData.ccps.map((ccp) => (
                                  <div
                                    key={ccp.id}
                                    className="p-4 cursor-pointer hover:bg-slate-50 transition-colors group"
                                    onClick={() => {
                                      setSelectedCCP(ccp);
                                      setIsCCPModalOpen(true);
                                    }}
                                  >
                                    {/* CCP Header */}
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <span className="px-2.5 py-1 bg-orange-500 text-white text-xs font-bold rounded-md">
                                          {ccp.ccp_code}
                                        </span>
                                        <div>
                                          <span className="font-semibold text-slate-800 group-hover:text-orange-700 transition-colors block">
                                            {ccp.name}
                                          </span>
                                          {ccp.step_id && (
                                            <span className="text-[10px] text-slate-400">
                                              📍 {stepMap.get(ccp.step_id) || 'Không xác định công đoạn'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="text-[10px] text-slate-400">
                                        {new Date(ccp.created_at).toLocaleDateString('vi-VN')}
                                      </span>
                                    </div>

                                    {/* Critical Limit Preview */}
                                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100 mb-3">
                                      <span className="text-red-500 text-xs">🚨</span>
                                      <span className="text-xs text-red-700 font-medium truncate">
                                        {ccp.critical_limit}
                                      </span>
                                    </div>

                                    {/* Quick Info Grid */}
                                    <div className="grid grid-cols-4 gap-2 text-[10px]">
                                      {ccp.monitoring_method && (
                                        <div className="flex items-center gap-1 text-slate-600">
                                          <span>📋</span>
                                          <span className="truncate">{ccp.monitoring_method}</span>
                                        </div>
                                      )}
                                      {ccp.monitoring_frequency && (
                                        <div className="flex items-center gap-1 text-slate-600">
                                          <span>⏱️</span>
                                          <span className="truncate">{ccp.monitoring_frequency}</span>
                                        </div>
                                      )}
                                      {ccp.monitoring_device && (
                                        <div className="flex items-center gap-1 text-slate-600">
                                          <span>🔧</span>
                                          <span className="truncate">{ccp.monitoring_device}</span>
                                        </div>
                                      )}
                                      {ccp.responsible_user && (
                                        <div className="flex items-center gap-1 text-slate-600">
                                          <span>👤</span>
                                          <span className="truncate font-mono text-[9px]">{ccp.responsible_user.slice(0, 8)}...</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Indicator Icons */}
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                      <div className="flex gap-1">
                                        {ccp.corrective_action && (
                                          <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center text-amber-600 text-xs" title="Có hành động khắc phục">
                                            🔧
                                          </span>
                                        )}
                                        {ccp.verification_procedure && (
                                          <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center text-blue-600 text-xs" title="Có quy trình xác minh">
                                            ✅
                                          </span>
                                        )}
                                        {ccp.ai_suggestion && (
                                          <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center text-purple-600 text-xs" title="Có đề xuất AI">
                                            🤖
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        Xem chi tiết →
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* CCP Detail Modal */}
                <Modal
                  isOpen={isCCPModalOpen}
                  onClose={() => setIsCCPModalOpen(false)}
                  title="Chi tiết CCP - Điểm Kiểm soát Tới hạn"
                >
                  {selectedCCP && (
                    <div className="space-y-4 px-2">
                      {/* Header - CCP Code & Name */}
                      <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                        <span className="px-3 py-1 bg-orange-500 text-white text-sm font-bold rounded shrink-0">
                          {selectedCCP.ccp_code}
                        </span>
                        <div>
                          <h4 className="text-lg font-bold text-slate-800">{selectedCCP.name}</h4>
                          <p className="text-xs text-slate-500">
                            Tạo ngày: {new Date(selectedCCP.created_at).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                      </div>

                      {/* Critical Limit - Most Important */}
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-2">🚨 Giới hạn tới hạn (Critical Limit)</p>
                        <p className="text-base font-semibold text-red-900">{selectedCCP.critical_limit}</p>
                      </div>

                      {/* Monitoring Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedCCP.monitoring_method && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">📋 Phương pháp giám sát</p>
                            <p className="text-sm text-slate-700">{selectedCCP.monitoring_method}</p>
                          </div>
                        )}
                        {selectedCCP.monitoring_frequency && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">⏱️ Tần suất</p>
                            <p className="text-sm text-slate-700">{selectedCCP.monitoring_frequency}</p>
                          </div>
                        )}
                        {selectedCCP.monitoring_device && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">🔧 Thiết bị</p>
                            <p className="text-sm text-slate-700">{selectedCCP.monitoring_device}</p>
                          </div>
                        )}
                        {selectedCCP.responsible_user && (
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">👤 Người chịu trách nhiệm</p>
                            <p className="text-sm text-slate-700 font-mono">{selectedCCP.responsible_user}</p>
                          </div>
                        )}
                      </div>

                      {/* Corrective Action */}
                      {selectedCCP.corrective_action && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-xs font-bold text-amber-700 uppercase mb-2">🔧 Hành động khắc phục khi vượt giới hạn</p>
                          <p className="text-sm text-amber-900">{selectedCCP.corrective_action}</p>
                        </div>
                      )}

                      {/* Verification Procedure */}
                      {selectedCCP.verification_procedure && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs font-bold text-blue-700 uppercase mb-2">✅ Quy trình xác minh</p>
                          <p className="text-sm text-blue-900">{selectedCCP.verification_procedure}</p>
                        </div>
                      )}

                      {/* AI Suggestion */}
                      {selectedCCP.ai_suggestion && (
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-xs font-bold text-purple-700 uppercase mb-2">🤖 Đề xuất AI</p>
                          <p className="text-sm text-purple-900">{selectedCCP.ai_suggestion}</p>
                        </div>
                      )}
                    </div>
                  )}
                </Modal>

                {/* MONITORING PLAN TAB */}
                {activeTab === "monitoring" && (
                  <MonitoringPlanEditor 
                    plans={plans} 
                    onCreateLog={(ccpId) => {
                      setLogFormData(prev => ({ ...prev, ccp_id: ccpId }));
                      setActiveTab("monitoring-logs");
                      setShowLogForm(true);
                    }}
                  />
                )}

                {/* MONITORING LOGS TAB */}
                {activeTab === "monitoring-logs" && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-slate-800">Nhật ký Giám sát CCP</h3>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-500">{allLogs.length} bản ghi</span>
                        <button
                          onClick={() => setShowLogForm(!showLogForm)}
                          className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-cyan-700 transition-colors"
                        >
                          {showLogForm ? 'Đóng form' : '+ Ghi nhật ký'}
                        </button>
                      </div>
                    </div>

                    {/* Form tạo nhật ký */}
                    {showLogForm && (
                      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-bold text-slate-700 mb-4">Tạo nhật ký giám sát mới</h4>
                        
                        {/* Hiển thị thông tin kế hoạch giám sát khi chọn CCP */}
                        {logFormData.ccp_id && (() => {
                          const selectedCcp = allCcps.find(c => c.id === logFormData.ccp_id);
                          if (!selectedCcp) return null;
                          return (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <h5 className="text-xs font-bold text-blue-800 mb-2">📋 Thông tin Kế hoạch Giám sát</h5>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                <div>
                                  <span className="text-blue-600 font-medium">Giới hạn tới hạn:</span>
                                  <p className="text-blue-900 font-semibold">{selectedCcp.critical_limit || "Chưa thiết lập"}</p>
                                </div>
                                <div>
                                  <span className="text-blue-600 font-medium">Phương pháp:</span>
                                  <p className="text-blue-900">{selectedCcp.monitoring_method || "-"}</p>
                                </div>
                                <div>
                                  <span className="text-blue-600 font-medium">Tần suất:</span>
                                  <p className="text-blue-900">{selectedCcp.monitoring_frequency || "-"}</p>
                                </div>
                                <div>
                                  <span className="text-blue-600 font-medium">Người phụ trách:</span>
                                  <p className="text-blue-900">{selectedCcp.responsible_user ? getUserDisplayName(selectedCcp.responsible_user) : "-"}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">CCP *</label>
                            <select
                              value={logFormData.ccp_id}
                              onChange={(e) => setLogFormData({...logFormData, ccp_id: e.target.value})}
                              className="w-full text-sm p-2 rounded border border-slate-300"
                            >
                              <option value="">-- Chọn CCP --</option>
                              {allCcpsLoading ? (
                                <option value="">Đang tải...</option>
                              ) : (
                                allCcps.map((ccp) => (
                                  <option key={ccp.id} value={ccp.id}>{ccp.ccp_code} - {ccp.name}</option>
                                ))
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Lô sản xuất</label>
                            <input
                              type="text"
                              value={logFormData.batch_number}
                              onChange={(e) => setLogFormData({...logFormData, batch_number: e.target.value})}
                              placeholder="VD: LOT-2024-001"
                              className="w-full text-sm p-2 rounded border border-slate-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Ca làm việc</label>
                            <select
                              value={logFormData.shift}
                              onChange={(e) => setLogFormData({...logFormData, shift: e.target.value})}
                              className="w-full text-sm p-2 rounded border border-slate-300"
                            >
                              <option value="Ca 1">Ca 1 (6h-14h)</option>
                              <option value="Ca 2">Ca 2 (14h-22h)</option>
                              <option value="Ca 3">Ca 3 (22h-6h)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Giá trị đo *</label>
                            <input
                              type="text"
                              value={logFormData.measured_value}
                              onChange={(e) => setLogFormData({...logFormData, measured_value: e.target.value})}
                              placeholder="VD: 72.5"
                              className="w-full text-sm p-2 rounded border border-slate-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Đơn vị</label>
                            <select
                              value={logFormData.unit}
                              onChange={(e) => setLogFormData({...logFormData, unit: e.target.value})}
                              className="w-full text-sm p-2 rounded border border-slate-300"
                            >
                              <option value="°C">°C (Nhiệt độ)</option>
                              <option value="%">% (Độ ẩm/pH)</option>
                              <option value="ppm">ppm (Hóa chất)</option>
                              <option value="ph">pH</option>
                              <option value="phút">phút (Thời gian)</option>
                              <option value="giây">giây</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Kết quả</label>
                            <select
                              value={logFormData.is_within_limit.toString()}
                              onChange={(e) => setLogFormData({...logFormData, is_within_limit: e.target.value === 'true'})}
                              className="w-full text-sm p-2 rounded border border-slate-300"
                            >
                              <option value="true">✅ Đạt (Trong giới hạn)</option>
                              <option value="false">❌ Không đạt (Vượt giới hạn)</option>
                            </select>
                          </div>
                          {!logFormData.is_within_limit && (
                            <div className="md:col-span-3">
                              <label className="block text-xs font-medium text-slate-600 mb-1">Ghi chú độ lệch *</label>
                              <textarea
                                value={logFormData.deviation_note}
                                onChange={(e) => setLogFormData({...logFormData, deviation_note: e.target.value})}
                                placeholder="Mô tả chi tiết độ lệch và hành động khắc phục..."
                                className="w-full text-sm p-2 rounded border border-slate-300 h-20"
                              />
                            </div>
                          )}
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Người ghi nhận *</label>
                            <select
                              value={logFormData.recorded_by}
                              onChange={(e) => setLogFormData({...logFormData, recorded_by: e.target.value})}
                              className="w-full text-sm p-2 rounded border border-slate-300"
                            >
                              <option value="">-- Chọn người ghi nhận --</option>
                              {usersLoading ? (
                                <option value="">Đang tải...</option>
                              ) : (
                                users.filter((u: User) => u.is_active).map((user: User) => (
                                  <option key={user.id} value={user.id}>{user.full_name} ({user.department})</option>
                                ))
                              )}
                            </select>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            onClick={() => setShowLogForm(false)}
                            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          >
                            Hủy
                          </button>
                          <button
                            onClick={handleCreateLog}
                            className="px-4 py-2 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors"
                          >
                            Lưu nhật ký
                          </button>
                        </div>
                      </div>
                    )}

                    {logsLoading ? (
                      <div className="text-center py-8 text-slate-400">Đang tải nhật ký...</div>
                    ) : allLogs.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">Chưa có nhật ký giám sát nào</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                          <thead className="bg-[#eef6fa] text-cyan-900 border-b border-slate-200">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Thời gian</th>
                              <th className="px-4 py-3 font-semibold">CCP</th>
                              <th className="px-4 py-3 font-semibold">Lô sản xuất</th>
                              <th className="px-4 py-3 font-semibold">Giá trị đo</th>
                              <th className="px-4 py-3 font-semibold">Trạng thái</th>
                              <th className="px-4 py-3 font-semibold">Ghi chú độ lệch</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {allLogs.map((log) => {
                              const ccp = getCCPInfo(log.ccp_id);
                              return (
                                <tr key={log.id} className={`hover:bg-slate-50 transition-colors ${!log.is_within_limit ? 'bg-red-50' : ''}`}>
                                  <td className="px-4 py-3 text-xs">{new Date(log.recorded_at).toLocaleString("vi-VN")}</td>
                                  <td className="px-4 py-3 font-medium">{ccp?.ccp_code || "N/A"}</td>
                                  <td className="px-4 py-3">{log.batch_number || "-"}</td>
                                  <td className="px-4 py-3 font-mono">{log.measured_value} {log.unit}</td>
                                  <td className="px-4 py-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${log.is_within_limit ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                      {log.is_within_limit ? 'Đạt' : 'Vượt CL'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-xs text-red-600">{log.deviation_note || "-"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* DEVIATIONS TAB - Organization wide */}
                {activeTab === "deviations" && (
                  <DeviationManagementPanel
                    deviations={deviations}
                    deviationsLoading={deviationsLoading}
                    deviationStats={deviationStats}
                    deviationStatsLoading={deviationStatsLoading}
                    filters={deviationFilters}
                    onFiltersChange={setDeviationFilters}
                    onRefresh={() => { refetchDeviations(); refetchDeviationStats(); }}
                    onHandleDeviation={(dev) => { setSelectedDeviation(dev); setIsHandleDeviationModalOpen(true); }}
                    getCCPInfo={getCCPInfo}
                    getUserDisplayName={getUserDisplayName}
                  />
                )}

              </div>
            )}
          </div>
        </div>
      </div>
      <HaccpWizard
        isOpen={isWizardOpen}
        onClose={() => { setIsWizardOpen(false); setWizardPlanId(null); }}
        onSuccess={handleWizardSuccess}
        planId={wizardPlanId}
      />

      {/* Flow Modal */}
      <Modal 
        isOpen={isFlowModalOpen} 
        onClose={() => { setIsFlowModalOpen(false); setFlowModalPlanId(null); }}
        title="Sơ đồ quy trình sản xuất"
        maxWidth="4xl"
      >
        <div className="p-6 bg-slate-50 min-h-[400px]">
          <ProcessFlowDisplay planId={flowModalPlanId} />
        </div>
      </Modal>

      {/* Handle Deviation Modal */}
      <HandleDeviationModal
        isOpen={isHandleDeviationModalOpen}
        onClose={() => { setIsHandleDeviationModalOpen(false); setSelectedDeviation(null); }}
        deviation={selectedDeviation}
        users={users}
        onSuccess={() => { refetchDeviations(); refetchDeviationStats(); setIsHandleDeviationModalOpen(false); setSelectedDeviation(null); }}
      />

      {/* Create New Version Modal */}
      <CreateVersionModal
        isOpen={isVersionModalOpen}
        onClose={() => { setIsVersionModalOpen(false); setSelectedPlanForVersion(null); }}
        plan={selectedPlanForVersion}
        onSuccess={() => { refetchPlans(); }}
      />

      {/* View Versions History Modal */}
      <ViewVersionsModal
        isOpen={isVersionsViewModalOpen}
        onClose={() => { setIsVersionsViewModalOpen(false); setViewVersionsPlanId(null); }}
        planId={viewVersionsPlanId}
      />
    </AppShell>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ProcessFlowDisplay({ planId, compact = false }: { planId: string | null, compact?: boolean }) {
  const { steps, loading } = useProcessSteps(planId);

  if (loading) return <div className="p-4 text-center text-slate-500 text-xs">Đang tải...</div>;
  if (!steps || steps.length === 0) return <div className="p-4 text-center text-slate-400 italic text-xs">Chưa có công đoạn</div>;

  if (compact) {
    return (
      <div className="space-y-2">
        {steps.slice(0, 3).map((step, index) => (
          <div key={step.id} className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center text-[10px] font-bold">
              {index + 1}
            </span>
            <span className={`truncate ${step.is_ccp ? 'font-bold text-orange-600' : 'text-slate-600'}`}>
              {step.name}
            </span>
            {step.is_ccp && <span className="text-[8px] bg-orange-500 text-white px-1 rounded">CCP</span>}
          </div>
        ))}
        {steps.length > 3 && (
          <p className="text-[10px] text-slate-400 pl-7">+{steps.length - 3} công đoạn khác...</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {["RECEIVING", "PROCESSING", "PACKAGING", "STORAGE"].map(typeKey => {
        const typeSteps = steps.filter(s => s.step_type === typeKey);
        if (typeSteps.length === 0) return null;
        const tName = ({ "RECEIVING": "Tiếp nhận", "PROCESSING": "Chế biến", "PACKAGING": "Đóng gói", "STORAGE": "Lưu kho" } as any)[typeKey];
        return (
          <div key={typeKey} className="border border-slate-200/60 rounded-xl p-5 bg-white shadow-sm ring-1 ring-slate-200/50">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-5 tracking-widest border-b border-slate-100 pb-2">{tName}</h4>
            <div className="flex flex-wrap items-center gap-y-8 text-sm">
              {typeSteps.map((stage, index) => (
                <div key={stage.id} className="flex items-center">
                  <div className="relative group">
                    <div className={`rounded-2xl border px-6 py-3.5 shadow-md font-bold transition-all ${
                      stage.is_ccp 
                        ? 'border-orange-300 bg-orange-50 text-orange-900 ring-4 ring-orange-100/50 scale-105' 
                        : 'border-blue-100 bg-white text-slate-700 hover:border-blue-300'
                    }`}>
                      {stage.name}
                    </div>
                    {stage.is_ccp && (
                      <span className="absolute -top-3 -right-3 rounded-full bg-orange-600 px-2.5 py-1 text-[9px] font-black text-white shadow-lg border-2 border-white uppercase tracking-tighter">
                        CCP
                      </span>
                    )}
                  </div>
                  {index < typeSteps.length - 1 && (
                    <div className="mx-6 flex items-center">
                      <span className="text-slate-300 text-lg font-light">──▶</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonitoringPlanEditor({ plans, onCreateLog }: { plans: any[]; onCreateLog?: (ccpId: string) => void }) {
  const { allCcps: ccps, loading: ccpsLoading, refetch } = useAllCCPs();
  const { users, loading: usersLoading } = useUsers({ is_active: true });
  const [selectedCcpId, setSelectedCcpId] = useState<string | null>(null);
  const [editableCcp, setEditableCcp] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Load editable CCP when selected
  useEffect(() => {
    if (selectedCcpId && ccps) {
      const ccp = ccps.find(c => c.id === selectedCcpId);
      if (ccp) {
        setEditableCcp({ ...ccp });
        setSaveError(null);
      }
    } else {
      setEditableCcp(null);
    }
  }, [selectedCcpId, ccps]);

  const handleInputChange = (field: string, value: string) => {
    setEditableCcp((prev: any) => ({ ...prev, [field]: value }));
    setSaveError(null);
  };

  const validateForm = () => {
    const errors: string[] = [];
    if (!editableCcp.critical_limit?.trim()) errors.push("Giới hạn tới hạn");
    if (!editableCcp.monitoring_method?.trim()) errors.push("Phương pháp giám sát");
    if (!editableCcp.monitoring_frequency?.trim()) errors.push("Tần suất giám sát");
    if (!editableCcp.responsible_user?.trim()) errors.push("Người phụ trách");
    return errors;
  };

  const handleSave = async () => {
    if (!editableCcp) return;
    
    const errors = validateForm();
    if (errors.length > 0) {
      setSaveError(`Thiếu thông tin bắt buộc: ${errors.join(", ")}`);
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const payload = {
        critical_limit: editableCcp.critical_limit?.trim(),
        monitoring_method: editableCcp.monitoring_method?.trim(),
        monitoring_frequency: editableCcp.monitoring_frequency?.trim(),
        monitoring_device: editableCcp.monitoring_device?.trim() || null,
        responsible_user: editableCcp.responsible_user,
        corrective_action: editableCcp.corrective_action?.trim() || null,
        verification_procedure: editableCcp.verification_procedure?.trim() || null,
      };
      
      console.log("[MonitoringPlan] Saving:", payload);
      
      const response = await apiFetch(`/haccp/ccps/${editableCcp.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      
      console.log("[MonitoringPlan] Saved:", response);
      
      // Refresh data
      await refetch();
      
      // Show success and return to list
      alert("✅ Đã lưu kế hoạch giám sát thành công!");
      setSelectedCcpId(null);
    } catch (err: any) {
      console.error("[MonitoringPlan] Save failed:", err);
      setSaveError(err.message || "Lỗi khi lưu. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  if (ccpsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-500 text-sm">Đang tải danh sách CCP...</p>
        </div>
      </div>
    );
  }
  
  if (!ccps || ccps.length === 0) {
    return (
      <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-12 text-center">
        <div className="text-4xl mb-3">📋</div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Chưa có CCP nào</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Bạn cần tạo CCP trong phần "Sơ đồ Quy trình" trước khi lập kế hoạch giám sát.
        </p>
      </div>
    );
  }

  // LIST VIEW
  if (!selectedCcpId) {
    const filteredCcps = searchTerm
      ? ccps.filter(ccp =>
          ccp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ccp.ccp_code.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : ccps;
    
    const planMap = new Map(plans.map(p => [p.id, p.name]));
    const groupedByPlan = filteredCcps.reduce((acc, ccp) => {
      const planId = ccp.haccp_plan_id || 'unknown';
      const planName = planMap.get(planId) || 'Không xác định';
      if (!acc[planId]) acc[planId] = { planName, ccps: [] };
      acc[planId].ccps.push(ccp);
      return acc;
    }, {} as Record<string, { planName: string; ccps: typeof ccps }>);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Kế hoạch Giám sát CCP</h3>
            <p className="text-xs text-slate-500">Chọn CCP để thiết lập hoặc chỉnh sửa kế hoạch giám sát</p>
          </div>
          <span className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full text-xs font-medium">
            {ccps.length} CCP
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm CCP theo tên hoặc mã..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* CCP List by Plan */}
        <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
          {Object.entries(groupedByPlan).map(([planId, planData]) => (
            <div key={planId} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                <span className="font-medium text-sm text-slate-700">{planData.planName}</span>
                <span className="text-xs text-slate-500 ml-2">({planData.ccps.length} CCP)</span>
              </div>
              <div className="divide-y divide-slate-100">
                {planData.ccps.map((ccp) => {
                  const isComplete = ccp.critical_limit && ccp.monitoring_method && 
                                     ccp.monitoring_frequency && ccp.responsible_user;
                  
                  return (
                    <div 
                      key={ccp.id}
                      onClick={() => setSelectedCcpId(ccp.id)}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">
                          {ccp.ccp_code}
                        </span>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{ccp.name}</p>
                          <p className="text-xs text-slate-500">
                            CL: {ccp.critical_limit || "Chưa thiết lập"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isComplete ? (
                          <>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                              ✅ Hoàn thiện
                            </span>
                            {onCreateLog && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCreateLog(ccp.id);
                                }}
                                className="text-xs bg-cyan-600 text-white px-3 py-1 rounded hover:bg-cyan-700 transition-colors"
                              >
                                📝 Ghi nhật ký
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                            ⚠️ Chưa đầy đủ
                          </span>
                        )}
                        <span className="text-slate-400">→</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // EDITOR VIEW
  if (!editableCcp) return null;

  const planName = plans.find(p => p.id === editableCcp.haccp_plan_id)?.name || "Không xác định";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setSelectedCcpId(null)}
            className="text-slate-500 hover:text-slate-700 text-sm"
          >
            ← Quay lại
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-bold">
                {editableCcp.ccp_code}
              </span>
              <span className="font-bold text-slate-800">{editableCcp.name}</span>
            </div>
            <span className="text-xs text-slate-500">📋 {planName}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCcpId(null)}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Đang lưu..." : "💾 Lưu kế hoạch"}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {saveError && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {saveError}
        </div>
      )}

      {/* Form */}
      <div className="p-4 space-y-6">
        {/* Critical Limit */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Giới hạn tới hạn (Critical Limit) <span className="text-red-500">*</span>
          </label>
          <textarea
            value={editableCcp.critical_limit || ""}
            onChange={(e) => handleInputChange('critical_limit', e.target.value)}
            placeholder="VD: Nhiệt độ >= 72°C trong 15 giây"
            className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none h-20"
          />
        </div>

        {/* Monitoring Info - 2 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Phương pháp giám sát <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editableCcp.monitoring_method || ""}
              onChange={(e) => handleInputChange('monitoring_method', e.target.value)}
              placeholder="VD: Kiểm tra nhiệt kế"
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tần suất <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editableCcp.monitoring_frequency || ""}
              onChange={(e) => handleInputChange('monitoring_frequency', e.target.value)}
              placeholder="VD: Mỗi giờ / Mỗi lô"
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Thiết bị giám sát
            </label>
            <input
              type="text"
              value={editableCcp.monitoring_device || ""}
              onChange={(e) => handleInputChange('monitoring_device', e.target.value)}
              placeholder="VD: Nhiệt kế điện tử T-200"
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Người phụ trách <span className="text-red-500">*</span>
            </label>
            <select
              value={editableCcp.responsible_user || ""}
              onChange={(e) => handleInputChange('responsible_user', e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white"
            >
              <option value="">-- Chọn người phụ trách --</option>
              {usersLoading ? (
                <option value="">Đang tải...</option>
              ) : (
                users.filter((u: User) => u.is_active).map((user: User) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Corrective Action & Verification */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hành động khắc phục
            </label>
            <textarea
              value={editableCcp.corrective_action || ""}
              onChange={(e) => handleInputChange('corrective_action', e.target.value)}
              placeholder="Mô tả hành động khi CL bị vi phạm..."
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none h-24"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Quy trình thẩm tra
            </label>
            <textarea
              value={editableCcp.verification_procedure || ""}
              onChange={(e) => handleInputChange('verification_procedure', e.target.value)}
              placeholder="Cách xác nhận hệ thống hoạt động tốt..."
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none h-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DEVIATION MANAGEMENT COMPONENTS
// ============================================================================
interface DeviationManagementPanelProps {
  deviations: CCPMonitoringLog[];
  deviationsLoading: boolean;
  deviationStats: { by_status: Record<string, number>; by_severity: Record<string, number>; total: number; pending: number } | null;
  deviationStatsLoading: boolean;
  filters: DeviationFilters;
  onFiltersChange: (filters: DeviationFilters) => void;
  onRefresh: () => void;
  onHandleDeviation: (dev: CCPMonitoringLog) => void;
  getCCPInfo: (ccpId: string) => CCP | undefined;
  getUserDisplayName: (userId: string) => string;
}

function DeviationManagementPanel({
  deviations,
  deviationsLoading,
  deviationStats,
  deviationStatsLoading,
  filters,
  onFiltersChange,
  onRefresh,
  onHandleDeviation,
  getCCPInfo,
  getUserDisplayName
}: DeviationManagementPanelProps) {
  const severityConfig = {
    CRITICAL: { label: 'Nghiêm trọng', color: 'bg-red-600 text-white' },
    HIGH: { label: 'Cao', color: 'bg-orange-500 text-white' },
    MEDIUM: { label: 'Trung bình', color: 'bg-yellow-500 text-black' },
    LOW: { label: 'Thấp', color: 'bg-blue-400 text-white' }
  };

  const statusConfig = {
    NEW: { label: 'Mới', color: 'bg-red-100 text-red-700 border-red-200' },
    INVESTIGATING: { label: 'Đang điều tra', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    CORRECTIVE_ACTION: { label: 'Hành động khắc phục', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    RESOLVED: { label: 'Đã giải quyết', color: 'bg-green-100 text-green-700 border-green-200' },
    CLOSED: { label: 'Đã đóng', color: 'bg-slate-100 text-slate-600 border-slate-200' }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100">
      {/* Header with stats */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Quản lý Độ lệch CCP</h3>
          <p className="text-sm text-slate-500">Theo dõi và xử lý các độ lệch trong quá trình giám sát</p>
        </div>
        <button
          onClick={onRefresh}
          className="text-sm bg-cyan-50 text-cyan-600 px-3 py-2 rounded-lg hover:bg-cyan-100 transition-colors"
        >
          🔄 Làm mới
        </button>
      </div>

      {/* Stats Cards */}
      {deviationStats && !deviationStatsLoading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-slate-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-slate-700">{deviationStats.total}</p>
            <p className="text-xs text-slate-500">Tổng độ lệch</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600">{deviationStats.by_status.NEW || 0}</p>
            <p className="text-xs text-slate-500">Mới</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-600">{deviationStats.by_status.INVESTIGATING || 0}</p>
            <p className="text-xs text-slate-500">Đang điều tra</p>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{deviationStats.by_status.CORRECTIVE_ACTION || 0}</p>
            <p className="text-xs text-slate-500">Khắc phục</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">{deviationStats.by_status.RESOLVED || 0}</p>
            <p className="text-xs text-slate-500">Đã giải quyết</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 p-3 bg-slate-50 rounded-lg">
        <select
          value={filters.status || ''}
          onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as any || undefined })}
          className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white"
        >
          <option value="">-- Tất cả trạng thái --</option>
          <option value="NEW">Mới</option>
          <option value="INVESTIGATING">Đang điều tra</option>
          <option value="CORRECTIVE_ACTION">Hành động khắc phục</option>
          <option value="RESOLVED">Đã giải quyết</option>
          <option value="CLOSED">Đã đóng</option>
        </select>
        <select
          value={filters.severity || ''}
          onChange={(e) => onFiltersChange({ ...filters, severity: e.target.value as any || undefined })}
          className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white"
        >
          <option value="">-- Tất cả mức độ --</option>
          <option value="CRITICAL">Nghiêm trọng</option>
          <option value="HIGH">Cao</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="LOW">Thấp</option>
        </select>
        {(filters.status || filters.severity) && (
          <button
            onClick={() => onFiltersChange({})}
            className="text-sm text-slate-500 hover:text-slate-700 px-2"
          >
            Xóa bộ lọc ✕
          </button>
        )}
      </div>

      {/* Deviations List */}
      {deviationsLoading ? (
        <div className="text-center py-8 text-slate-400">Đang tải...</div>
      ) : deviations.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg">
          <p className="text-4xl mb-2">✅</p>
          <p>Không có độ lệch nào</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-slate-500">{deviations.length} độ lệch</span>
            {deviations.length > 5 && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <span>↓ Cuộn để xem thêm</span>
              </span>
            )}
          </div>
          <div 
            className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-cyan-500 scrollbar-track-slate-100 hover:scrollbar-thumb-cyan-600 border border-slate-100 rounded-lg p-2"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#06b6d4 #f1f5f9'
            }}
          >
              {deviations.map((dev) => {
              const ccp = getCCPInfo(dev.ccp_id);
              const severity = dev.deviation_severity as keyof typeof severityConfig || 'MEDIUM';
              const status = (dev.deviation_status as keyof typeof statusConfig) || 'NEW';
              const severityStyle = severityConfig[severity] || severityConfig.MEDIUM;
              const statusStyle = statusConfig[status] || statusConfig.NEW;

              return (
                <div key={dev.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${severityStyle.color}`}>
                          {severityStyle.label}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded border ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(dev.recorded_at).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      
                      <h4 className="font-bold text-slate-800">
                        Độ lệch tại CCP: {ccp?.ccp_code || "N/A"} - {ccp?.name || "Không xác định"}
                      </h4>
                      
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
                        <span>📦 Lô: {dev.batch_number || "N/A"}</span>
                        <span>🕐 Ca: {dev.shift || "N/A"}</span>
                        <span>📊 Giá trị: {dev.measured_value} {dev.unit}</span>
                        <span>👤 Ghi nhận: {getUserDisplayName(dev.recorded_by)}</span>
                      </div>

                      {dev.deviation_note && (
                        <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                          📝 {dev.deviation_note}
                        </p>
                      )}

                      {dev.corrective_action && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium text-slate-700">Hành động khắc phục:</span>
                          <p className="text-slate-600 bg-blue-50 p-2 rounded mt-1">{dev.corrective_action}</p>
                        </div>
                      )}

                      {dev.resolution_note && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium text-slate-700">Ghi chú giải quyết:</span>
                          <p className="text-slate-600 bg-green-50 p-2 rounded mt-1">{dev.resolution_note}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex md:flex-col gap-2">
                      <button
                        onClick={() => onHandleDeviation(dev)}
                        className="text-sm bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors"
                      >
                        ⚙️ Xử lý
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function hazardColor(type: string): string {
  switch (type) {
    case "BIOLOGICAL": return "bg-orange-500";
    case "CHEMICAL": return "bg-emerald-500";
    case "PHYSICAL": return "bg-blue-500";
    default: return "bg-slate-400";
  }
}

function hazardNameVN(type: string): string {
  switch (type) {
    case "BIOLOGICAL": return "Sinh học";
    case "CHEMICAL": return "Hóa học";
    case "PHYSICAL": return "Vật lý";
    default: return type;
  }
}

// ============================================================================
// HANDLE DEVIATION MODAL COMPONENT
// ============================================================================
interface HandleDeviationModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviation: CCPMonitoringLog | null;
  users: User[];
  onSuccess: () => void;
}

function HandleDeviationModal({ isOpen, onClose, deviation, users, onSuccess }: HandleDeviationModalProps) {
  const [formData, setFormData] = useState<{
    deviation_status: 'NEW' | 'INVESTIGATING' | 'CORRECTIVE_ACTION' | 'RESOLVED' | 'CLOSED';
    deviation_severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    corrective_action: string;
    root_cause: string;
    resolution_note: string;
    handled_by: string;
  }>({
    deviation_status: 'NEW',
    deviation_severity: 'MEDIUM',
    corrective_action: '',
    root_cause: '',
    resolution_note: '',
    handled_by: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when deviation changes
  useEffect(() => {
    if (deviation) {
      setFormData({
        deviation_status: deviation.deviation_status || 'NEW',
        deviation_severity: deviation.deviation_severity || 'MEDIUM',
        corrective_action: deviation.corrective_action || '',
        root_cause: deviation.root_cause || '',
        resolution_note: deviation.resolution_note || '',
        handled_by: deviation.handled_by || ''
      });
    }
  }, [deviation]);

  const handleSubmit = async () => {
    if (!deviation) return;
    setIsSubmitting(true);
    try {
      await handleDeviation(deviation.id, {
        deviation_status: formData.deviation_status as HandleDeviationPayload['deviation_status'],
        deviation_severity: formData.deviation_severity as HandleDeviationPayload['deviation_severity'],
        corrective_action: formData.corrective_action || undefined,
        root_cause: formData.root_cause || undefined,
        resolution_note: formData.resolution_note || undefined,
        handled_by: formData.handled_by || undefined
      });
      alert('✅ Đã cập nhật xử lý độ lệch thành công!');
      onSuccess();
    } catch (err: any) {
      alert('❌ Lỗi khi cập nhật: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions = [
    { value: 'NEW', label: '🆕 Mới' },
    { value: 'INVESTIGATING', label: '🔍 Đang điều tra' },
    { value: 'CORRECTIVE_ACTION', label: '🔧 Hành động khắc phục' },
    { value: 'RESOLVED', label: '✅ Đã giải quyết' },
    { value: 'CLOSED', label: '📋 Đã đóng' }
  ];

  const severityOptions = [
    { value: 'CRITICAL', label: '🔴 Nghiêm trọng' },
    { value: 'HIGH', label: '🟠 Cao' },
    { value: 'MEDIUM', label: '🟡 Trung bình' },
    { value: 'LOW', label: '🔵 Thấp' }
  ];

  if (!deviation) return null;

  const ccp = deviation.ccp_id; // We'll need to fetch CCP info separately or pass it

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Xử lý độ lệch - CCP ${deviation.ccp_id.slice(0, 8)}`}
      maxWidth="2xl"
    >
      <div className="p-6 space-y-4">
        {/* Deviation Info */}
        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
          <p className="text-sm text-red-800 font-medium">📝 Mô tả độ lệch:</p>
          <p className="text-sm text-red-700">{deviation.deviation_note || "Không có mô tả"}</p>
          <div className="flex gap-4 mt-2 text-xs text-slate-600">
            <span>📦 Lô: {deviation.batch_number || "N/A"}</span>
            <span>🕐 Ca: {deviation.shift || "N/A"}</span>
            <span>📊 Giá trị: {deviation.measured_value} {deviation.unit}</span>
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái xử lý *</label>
          <select
            value={formData.deviation_status}
            onChange={(e) => setFormData({ ...formData, deviation_status: e.target.value as typeof formData.deviation_status })}
            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mức độ nghiêm trọng</label>
          <select
            value={formData.deviation_severity}
            onChange={(e) => setFormData({ ...formData, deviation_severity: e.target.value as typeof formData.deviation_severity })}
            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
          >
            {severityOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Root Cause */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nguyên nhân gốc rễ</label>
          <textarea
            value={formData.root_cause}
            onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
            placeholder="Phân tích nguyên nhân gốc rễ của độ lệch..."
            className="w-full p-2 border border-slate-200 rounded-lg text-sm h-20 resize-none"
          />
        </div>

        {/* Corrective Action */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hành động khắc phục</label>
          <textarea
            value={formData.corrective_action}
            onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value })}
            placeholder="Các hành động đã thực hiện để khắc phục độ lệch..."
            className="w-full p-2 border border-slate-200 rounded-lg text-sm h-20 resize-none"
          />
        </div>

        {/* Resolution Note */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú giải quyết</label>
          <textarea
            value={formData.resolution_note}
            onChange={(e) => setFormData({ ...formData, resolution_note: e.target.value })}
            placeholder="Ghi chú khi độ lệch đã được giải quyết..."
            className="w-full p-2 border border-slate-200 rounded-lg text-sm h-20 resize-none"
          />
        </div>

        {/* Handled By */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Người xử lý</label>
          <select
            value={formData.handled_by}
            onChange={(e) => setFormData({ ...formData, handled_by: e.target.value })}
            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
          >
            <option value="">-- Chọn người xử lý --</option>
            {users.filter(u => u.is_active).map(user => (
              <option key={user.id} value={user.id}>{user.full_name} ({user.department})</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Đang lưu...' : '💾 Lưu xử lý'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// CREATE NEW VERSION MODAL
// ============================================================================
interface CreateVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: {id: string; version: string; name: string; scope?: string; product_id?: string} | null;
  onSuccess: () => void;
}

function CreateVersionModal({ isOpen, onClose, plan, onSuccess }: CreateVersionModalProps) {
  const [newVersion, setNewVersion] = useState('');
  const [planName, setPlanName] = useState('');
  const [planScope, setPlanScope] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen && plan) {
      console.log('[MODAL] Initializing with plan:', plan);
      setError(null);
      setIsSubmitting(false);
      
      // Auto-generate next version
      const currentVersion = plan.version;
      const parts = currentVersion.split('.');
      if (parts.length === 2) {
        const major = parseInt(parts[0], 10);
        const minor = parseInt(parts[1], 10);
        if (!isNaN(major) && !isNaN(minor)) {
          setNewVersion(`${major}.${minor + 1}`);
        } else {
          setNewVersion(`${currentVersion}.1`);
        }
      } else {
        setNewVersion(`${currentVersion}.1`);
      }
      
      setPlanName(plan.name || '');
      setPlanScope(plan.scope || '');
    }
  }, [isOpen, plan]);

  const handleSubmit = async () => {
    if (!plan) return;
    
    // Validate version format
    const versionRegex = /^\d+\.\d+$/;
    if (!versionRegex.test(newVersion)) {
      setError('Version phải có định dạng x.y (ví dụ: 2.0, 1.1)');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      // Chỉ gửi nếu có thay đổi thực sự (không phải chuỗi rỗng)
      const payload: any = {
        new_version: newVersion,
        updated_by: currentUser.id
      };
      
      // Chỉ gửi name nếu khác và không rỗng
      if (planName && planName !== plan.name) {
        payload.name = planName;
      }
      
      // Chỉ gửi scope nếu khác và không rỗng  
      if (planScope !== undefined && planScope !== plan.scope) {
        payload.scope = planScope || null;  // Cho phép xóa scope
      }
      
      console.log('Creating new version with payload:', payload);
      
      const result = await createNewVersion(plan.id, payload);
      console.log('Version created successfully:', result);
      
      alert(`✅ Đã tạo version ${newVersion} thành công! Kế hoạch đã chuyển sang trạng thái DRAFT để chỉnh sửa.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating version:', err);
      const errorMsg = err.message || err.response?.data?.detail || 'Lỗi khi tạo version mới';
      setError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!plan) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Tạo version mới - ${plan.name}`} maxWidth="md">
      <div className="space-y-4 p-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <p className="font-medium">⚠️ Lưu ý:</p>
          <p>Version hiện tại ({plan.version}) sẽ được lưu trữ. Kế hoạch sẽ chuyển sang trạng thái DRAFT để bạn chỉnh sửa.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Version mới <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={newVersion}
            onChange={(e) => setNewVersion(e.target.value)}
            placeholder="Ví dụ: 2.0, 1.1"
            className="w-full p-2 border border-slate-200 rounded-lg text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">Định dạng: x.y (ví dụ: 2.0, 1.1)</p>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-700 mb-3">📝 Thông tin kế hoạch (tùy chọn chỉnh sửa)</p>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tên kế hoạch
              </label>
              <input
                type="text"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Tên kế hoạch HACCP"
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phạm vi áp dụng
              </label>
              <textarea
                value={planScope}
                onChange={(e) => setPlanScope(e.target.value)}
                placeholder="Mô tả phạm vi áp dụng của kế hoạch..."
                rows={3}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Đang tạo...' : '📝 Cập nhập'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================================
// VIEW VERSIONS HISTORY MODAL
// ============================================================================
interface ViewVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string | null;
}

function ViewVersionsModal({ isOpen, onClose, planId }: ViewVersionsModalProps) {
  const { versions, loading } = useHaccpPlanVersions(planId);
  const [selectedVersion, setSelectedVersion] = useState<HaccpPlanVersion | null>(null);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Lịch sử phiên bản" maxWidth="3xl">
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-slate-400">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-slate-300 border-t-cyan-600 rounded-full mb-2"></div>
              <p>Đang tải...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-4xl mb-2">📋</p>
              <p>Chưa có lịch sử version nào</p>
              <p className="text-xs mt-2 text-slate-400">Các version cũ sẽ được lưu khi tạo version mới</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg text-xs text-slate-600 font-medium">
                <span className="w-24">Version</span>
                <span className="flex-1">Thông tin kế hoạch</span>
                <span className="w-32">Ngày tạo</span>
                <span className="w-20">Thao tác</span>
              </div>
              
              {versions.map((v, index) => (
                <div 
                  key={v.id} 
                  className={`border rounded-lg p-4 ${index === 0 ? 'border-cyan-300 bg-cyan-50/50' : 'border-slate-200 bg-white'} hover:shadow-md transition-all`}
                >
                  <div className="flex items-start gap-3">
                    {/* Version Badge */}
                    <div className="flex flex-col items-center w-24 shrink-0">
                      <span className="font-mono text-lg font-bold text-cyan-700">v{v.version}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded mt-1 ${v.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {v.status}
                      </span>
                      {index === 0 && <span className="text-[10px] bg-cyan-600 text-white px-2 py-0.5 rounded mt-1">Mới nhất</span>}
                    </div>
                    
                    {/* Plan Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{v.name}</p>
                      <div className="mt-2 space-y-1">
                        {v.scope && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-slate-400 shrink-0">📋 Phạm vi:</span>
                            <p className="text-xs text-slate-600 line-clamp-2" title={v.scope}>{v.scope}</p>
                          </div>
                        )}
                        {v.product_id && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 shrink-0">📦 Product ID:</span>
                            <span className="text-xs font-mono text-slate-600">{v.product_id}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 shrink-0">👤 Người tạo:</span>
                          <span className="text-xs text-slate-600">{v.created_by ? getUserDisplayName(v.created_by) : 'Hệ thống'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 shrink-0">🆔 Version ID:</span>
                          <span className="text-xs font-mono text-slate-500">{v.id}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Date */}
                    <div className="w-32 shrink-0 text-right">
                      <span className="text-xs text-slate-500">
                        {new Date(v.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(v.created_at).toLocaleTimeString('vi-VN')}
                      </p>
                    </div>
                    
                    {/* Action */}
                    <div className="w-20 shrink-0">
                      <button
                        onClick={() => setSelectedVersion(v)}
                        className="w-full text-xs bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-2 py-1.5 rounded transition-colors"
                      >
                        🔍 Chi tiết
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Version Detail Modal */}
      <Modal 
        isOpen={!!selectedVersion} 
        onClose={() => setSelectedVersion(null)} 
        title={selectedVersion ? `Chi tiết version ${selectedVersion.version}` : ''} 
        maxWidth="2xl"
      >
        {selectedVersion && (
          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span className="text-cyan-600">📋</span> Thông tin cơ bản
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Tên kế hoạch:</span>
                  <p className="font-medium text-slate-800">{selectedVersion.name}</p>
                </div>
                <div>
                  <span className="text-slate-500">Version:</span>
                  <p className="font-mono font-medium text-cyan-700">{selectedVersion.version}</p>
                </div>
                <div>
                  <span className="text-slate-500">Trạng thái:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${selectedVersion.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                    {selectedVersion.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Ngày tạo:</span>
                  <p className="text-slate-800">{new Date(selectedVersion.created_at).toLocaleString('vi-VN')}</p>
                </div>
              </div>
            </div>

            {/* Scope */}
            {selectedVersion.scope && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                  <span className="text-cyan-600">📝</span> Phạm vi áp dụng
                </h3>
                <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap">
                  {selectedVersion.scope}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <span className="text-cyan-600">📊</span> Thông tin kỹ thuật
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex">
                  <span className="text-slate-500 w-32">Version ID:</span>
                  <span className="font-mono text-slate-600">{selectedVersion.id}</span>
                </div>
                <div className="flex">
                  <span className="text-slate-500 w-32">Plan ID:</span>
                  <span className="font-mono text-slate-600">{selectedVersion.plan_id}</span>
                </div>
                {selectedVersion.product_id && (
                  <div className="flex">
                    <span className="text-slate-500 w-32">Product ID:</span>
                    <span className="font-mono text-slate-600">{selectedVersion.product_id}</span>
                  </div>
                )}
                {selectedVersion.created_by && (
                  <div className="flex">
                    <span className="text-slate-500 w-32">Người tạo:</span>
                    <span className="text-slate-600">{getUserDisplayName(selectedVersion.created_by)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Note */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <span className="font-medium">ℹ️ Lưu ý:</span> Version này đã được lưu trữ. Để xem quy trình chi tiết (các bước, mối nguy, CCP) của version này, cần khôi phục version hoặc so sánh với version hiện tại.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
