"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/app-shell";
import { haccpSidebarButtons, currentUser, getUserDisplayName } from "@/lib/mock-data";
import { useUsers, User } from "@/api/hooks/use-users";
import { useAuth, useToast } from "@/hooks";
import { prpService } from "@/services";
import { Location } from "@/types";
import { capaService } from "@/services/capa-service";
import {
  useHaccpPlans,
  useProcessSteps,
  useCCPs,
  useDeviations,
  useDeviationStats,
  handleDeviation,
  requestDeviationCapaNc,
  useAllProcessStepsWithHazards,
  useAllCCPs,
  useHazards,
  createNewVersion,
  useHaccpSchedules,
  useUpcomingHaccpSchedules,
  createHaccpSchedule,
  deleteHaccpSchedule,
  HaccpSchedule,
  formatHaccpScheduleWindow,
  ProcessStepWithPlan,
  DeviationFilters,
  HandleDeviationPayload,
} from "@/api/hooks/use-haccp";
import { CCPMonitoringLog, HazardAnalysis, CCP, ProcessStep, HaccpPlan } from "@/lib/types";
import { apiFetch } from "@/api/api-client";
import HaccpWizard from "@/components/haccp-wizard";
import Modal from "@/components/ui/modal";
import AssessmentPanel from "./_components/assessment-panel";
import HaccpPlansListPanel from "./_components/haccp-plans-list-panel";

function getDateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function isDateInRange(value: string | undefined, from: string, to: string) {
  if (!from && !to) return true;
  const date = getDateOnly(value);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function isMonitoringPlanComplete(ccp: CCP) {
  return Boolean(
    ccp.critical_limit?.trim() &&
      ccp.monitoring_method?.trim() &&
      ccp.responsible_user?.trim(),
  );
}

export default function HaccpCompliancePage() {
  const { principal } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState(haccpSidebarButtons[0]?.id ?? "process-flow");
  const loadDeviationsData = true;
  const loadAllCcpsData = true;
  const loadFullHazardAnalysis = true;
  const loadUsersForForms = true;

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardPlanId, setWizardPlanId] = useState<string | null>(null);

  // States for Flow Modal
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [flowModalPlanId, setFlowModalPlanId] = useState<string | null>(null);

  // States for Hazard Detail Modal
  const [isHazardModalOpen, setIsHazardModalOpen] = useState(false);
  const [selectedHazard, setSelectedHazard] = useState<HazardAnalysis | null>(null);
  const [selectedHazardContext, setSelectedHazardContext] = useState<{
    planId: string;
    stepId: string;
  } | null>(null);
  const [selectedStepInfo, setSelectedStepInfo] = useState<{ stepName: string; planName: string } | null>(null);

  // States for CCP Detail Modal
  const [isCCPModalOpen, setIsCCPModalOpen] = useState(false);
  const [selectedCCP, setSelectedCCP] = useState<CCP | null>(null);

  // State for CCP search
  const [ccpSearchTerm, setCcpSearchTerm] = useState("");

  // State for Hazard search
  const [hazardSearchTerm, setHazardSearchTerm] = useState("");

  // States for Version Management
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [selectedPlanForVersion, setSelectedPlanForVersion] = useState<{ id: string; version: string; name: string; scope?: string; product_id?: string } | null>(null);

  // States for Step Detail Modal
  const [isStepDetailOpen, setIsStepDetailOpen] = useState(false);
  const [selectedStepDetail, setSelectedStepDetail] = useState<ProcessStep | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);

  // Scheduling states
  const { upcomingSchedules, loading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingHaccpSchedules();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  /** Khi mở từ danh sách kế hoạch: preset quy trình trong form lập lịch */
  const [scheduleModalInitialPlanId, setScheduleModalInitialPlanId] = useState<string | null>(null);
  const [showScheduleManagementModal, setShowScheduleManagementModal] = useState(false);

  const openScheduleModal = useCallback((planId?: string | null) => {
    setScheduleModalInitialPlanId(planId ?? null);
    setShowScheduleModal(true);
  }, []);

  const handleStepClick = (step: ProcessStep) => {
    setSelectedStepDetail(step);
    setIsStepDetailOpen(true);
  };

  const { plans, loading: plansLoading, refetch: refetchPlans } = useHaccpPlans();

  // Load locations
  useEffect(() => {
    const loadLocs = async () => {
      setLocationsLoading(true);
      try {
        const locs = await prpService.listLocations();
        setLocations(locs.filter(l => l.is_active));
      } catch (err) {
        console.error("Failed to load locations:", err);
      } finally {
        setLocationsLoading(false);
      }
    };
    loadLocs();
  }, []);

  const [showHiddenHaccpPlans, setShowHiddenHaccpPlans] = useState(false);

  const plansForComplianceUi = useMemo(
    () => (showHiddenHaccpPlans ? plans : plans.filter((p) => p.status !== "ARCHIVED")),
    [plans, showHiddenHaccpPlans],
  );
  const compliancePlanIdSet = useMemo(
    () => new Set(plansForComplianceUi.map((p) => p.id)),
    [plansForComplianceUi],
  );

  const archivedPlansOnly = useMemo(
    () => plans.filter((p) => p.status === "ARCHIVED"),
    [plans],
  );

  const [isHiddenPlansListModalOpen, setIsHiddenPlansListModalOpen] = useState(false);
  const [hiddenPlansSearch, setHiddenPlansSearch] = useState("");

  const filteredArchivedPlansForModal = useMemo(() => {
    const q = hiddenPlansSearch.trim().toLowerCase();
    return archivedPlansOnly.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.scope || "").toLowerCase().includes(q) ||
        p.version.toLowerCase().includes(q)
      );
    });
  }, [archivedPlansOnly, hiddenPlansSearch]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planCreatedFrom, setPlanCreatedFrom] = useState("");
  const [planCreatedTo, setPlanCreatedTo] = useState("");
  const [planDateFilterMode, setPlanDateFilterMode] = useState<"day" | "month" | "year">("day");
  const [selectedPlanDate, setSelectedPlanDate] = useState("");
  const [selectedPlanMonth, setSelectedPlanMonth] = useState("");
  const [selectedPlanMonthYear, setSelectedPlanMonthYear] = useState(String(new Date().getFullYear()));
  const [selectedPlanYear, setSelectedPlanYear] = useState("");
  const [flowSearchTerm, setFlowSearchTerm] = useState("");
  const [flowStatusFilter, setFlowStatusFilter] = useState("ALL");
  const [hazardPlanFilter, setHazardPlanFilter] = useState("ALL");
  const [hazardTypeFilter, setHazardTypeFilter] = useState("ALL");
  const [hazardRiskFilter, setHazardRiskFilter] = useState("ALL");
  const [hazardCriticalLimitFilter, setHazardCriticalLimitFilter] = useState("ALL");
  const [ccpPlanFilter, setCcpPlanFilter] = useState("ALL");
  const [ccpSetupFilter, setCcpSetupFilter] = useState("ALL");

  const currentYear = new Date().getFullYear();
  const planYearOptions = Array.from({ length: 8 }, (_, index) => String(currentYear - index));
  const planMonthOptions = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return { value: month, label: `Tháng ${index + 1}` };
  });

  const clearPlanCreatedDateFilter = () => {
    setSelectedPlanDate("");
    setSelectedPlanMonth("");
    setSelectedPlanMonthYear(String(new Date().getFullYear()));
    setSelectedPlanYear("");
    setPlanCreatedFrom("");
    setPlanCreatedTo("");
  };

  const setPlanCreatedDayFilter = (value: string) => {
    setSelectedPlanDate(value);
    setSelectedPlanMonth("");
    setSelectedPlanMonthYear(String(new Date().getFullYear()));
    setSelectedPlanYear("");
    setPlanCreatedFrom(value);
    setPlanCreatedTo(value);
  };

  const setPlanCreatedMonthFilter = (monthValue: string, yearValue = selectedPlanMonthYear) => {
    setSelectedPlanDate("");
    setSelectedPlanMonth(monthValue);
    setSelectedPlanMonthYear(yearValue);
    setSelectedPlanYear("");
    if (!monthValue || !yearValue) {
      setPlanCreatedFrom("");
      setPlanCreatedTo("");
      return;
    }
    const lastDay = new Date(Number(yearValue), Number(monthValue), 0).getDate();
    setPlanCreatedFrom(`${yearValue}-${monthValue}-01`);
    setPlanCreatedTo(`${yearValue}-${monthValue}-${String(lastDay).padStart(2, "0")}`);
  };

  const setPlanCreatedYearFilter = (value: string) => {
    setSelectedPlanDate("");
    setSelectedPlanMonth("");
    setSelectedPlanMonthYear(String(new Date().getFullYear()));
    setSelectedPlanYear(value);
    setPlanCreatedFrom(value ? `${value}-01-01` : "");
    setPlanCreatedTo(value ? `${value}-12-31` : "");
  };

  const filteredPlans = plans.filter(p => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      (p.scope || "").toLowerCase().includes(query) ||
      p.version.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    const matchesCreatedDate = isDateInRange(p.created_at, planCreatedFrom, planCreatedTo);
    const matchesArchiveList =
      showHiddenHaccpPlans || p.status !== "ARCHIVED" || statusFilter === "ARCHIVED";
    return matchesSearch && matchesStatus && matchesCreatedDate && matchesArchiveList;
  });

  const filteredPlansForFlow = plans.filter(p => {
    const query = flowSearchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      p.name.toLowerCase().includes(query) ||
      (p.scope || "").toLowerCase().includes(query) ||
      p.version.toLowerCase().includes(query);
    const matchesStatus = flowStatusFilter === "ALL" || p.status === flowStatusFilter;
    const matchesArchiveFlow =
      showHiddenHaccpPlans || p.status !== "ARCHIVED" || flowStatusFilter === "ARCHIVED";
    return matchesSearch && matchesStatus && matchesArchiveFlow;
  });

  const selectedPlanIdResolved = useMemo(() => {
    const visibleIds = plansForComplianceUi.map((p) => p.id);
    return visibleIds[0] ?? null;
  }, [plansForComplianceUi]);

  const { steps, loading: stepsLoading } = useProcessSteps(selectedPlanIdResolved);
  const { ccps, loading: ccpsLoading } = useCCPs(selectedPlanIdResolved);

  // Hook for all CCPs (for the CCPs tab showing all plans)
  const { allCcps, loading: allCcpsLoading, refetch: refetchAllCcps } = useAllCCPs(loadAllCcpsData);

  const ccpsForComplianceUi = useMemo(
    () => allCcps.filter((c) => compliancePlanIdSet.has(c.haccp_plan_id)),
    [allCcps, compliancePlanIdSet],
  );

  // Hook for users (for monitoring plan forms)
  const { users, loading: usersLoading } = useUsers({ is_active: true }, loadUsersForForms);

  // New hooks for all features
  const allCcpMap = useMemo(() => new Map(allCcps.map((ccp) => [ccp.id, ccp])), [allCcps]);

  /** Mối nguy → CCP + giới hạn tới hạn: ưu tiên hazard_id, fallback một CCP không gắn hazard trên cùng bước. */
  const getHazardCriticalLimitStatus = useMemo(() => {
    return (hazardId: string, stepId: string, planId: string) => {
      const byHazard = allCcps.find((c) => c.hazard_id === hazardId);
      if (byHazard) {
        return {
          ccp: byHazard,
          hasLinkedCcp: true,
          hasCriticalLimit: !!byHazard.critical_limit?.trim(),
        };
      }
      const stepOnly = allCcps.filter(
        (c) =>
          c.haccp_plan_id === planId &&
          c.step_id === stepId &&
          !c.hazard_id,
      );
      if (stepOnly.length === 1) {
        const c = stepOnly[0];
        return { ccp: c, hasLinkedCcp: true, hasCriticalLimit: !!c.critical_limit?.trim() };
      }
      return { ccp: undefined, hasLinkedCcp: false, hasCriticalLimit: false };
    };
  }, [allCcps]);

  const hazardPlanFilterSafe = useMemo(() => {
    if (hazardPlanFilter === "ALL") return "ALL";
    return compliancePlanIdSet.has(hazardPlanFilter) ? hazardPlanFilter : "ALL";
  }, [hazardPlanFilter, compliancePlanIdSet]);

  const ccpPlanFilterSafe = useMemo(() => {
    if (ccpPlanFilter === "ALL") return "ALL";
    return compliancePlanIdSet.has(ccpPlanFilter) ? ccpPlanFilter : "ALL";
  }, [ccpPlanFilter, compliancePlanIdSet]);

  const filteredAllCcps = useMemo(() => {
    const query = ccpSearchTerm.trim().toLowerCase();
    return ccpsForComplianceUi.filter((ccp) => {
      const matchesSearch =
        !query ||
        ccp.name.toLowerCase().includes(query) ||
        ccp.ccp_code.toLowerCase().includes(query) ||
        (ccp.critical_limit || "").toLowerCase().includes(query) ||
        (ccp.monitoring_method || "").toLowerCase().includes(query);
      const matchesPlan = ccpPlanFilterSafe === "ALL" || ccp.haccp_plan_id === ccpPlanFilterSafe;
      const setupComplete = isMonitoringPlanComplete(ccp);
      const matchesSetup =
        ccpSetupFilter === "ALL" ||
        (ccpSetupFilter === "complete" && setupComplete) ||
        (ccpSetupFilter === "incomplete" && !setupComplete);
      return matchesSearch && matchesPlan && matchesSetup;
    });
  }, [ccpsForComplianceUi, ccpPlanFilterSafe, ccpSearchTerm, ccpSetupFilter]);

  // Deviation management state (API lấy org từ JWT — chỉ gọi khi đã có principal)
  const [deviationFilters, setDeviationFilters] = useState<DeviationFilters>({});
  const deviationFiltersForApi = useMemo(() => {
    const pid = deviationFilters.plan_id;
    if (pid && !compliancePlanIdSet.has(pid)) {
      return { ...deviationFilters, plan_id: undefined, ccp_id: undefined };
    }
    return deviationFilters;
  }, [deviationFilters, compliancePlanIdSet]);
  const deviationsEnabled = loadDeviationsData && !!principal?.org_id;
  const { deviations, loading: deviationsLoading, refetch: refetchDeviations } = useDeviations(
    deviationFiltersForApi,
    deviationsEnabled,
  );
  const deviationsForComplianceUi = useMemo(() => {
    return deviations.filter((dev) => {
      const ccp = allCcpMap.get(dev.ccp_id);
      const pid = ccp?.haccp_plan_id;
      if (!pid) return true;
      return compliancePlanIdSet.has(pid);
    });
  }, [deviations, allCcpMap, compliancePlanIdSet]);
  const { stats: deviationStats, loading: deviationStatsLoading, refetch: refetchDeviationStats } =
    useDeviationStats(deviationFiltersForApi, deviationsEnabled);
  const [selectedDeviation, setSelectedDeviation] = useState<CCPMonitoringLog | null>(null);
  const [isHandleDeviationModalOpen, setIsHandleDeviationModalOpen] = useState(false);

  // Hook lấy tất cả công đoạn và mối nguy từ tất cả kế hoạch cho phân tích đầy đủ
  const { allStepsWithHazards, loading: allHazardsFullLoading, refetch: refetchAllStepsWithHazards } =
    useAllProcessStepsWithHazards(loadFullHazardAnalysis);

  const ccpsByPlan = useMemo(() => {
    const map: Record<string, CCP[]> = {};
    for (const ccp of ccpsForComplianceUi) {
      if (!map[ccp.haccp_plan_id]) map[ccp.haccp_plan_id] = [];
      map[ccp.haccp_plan_id].push(ccp);
    }
    return map;
  }, [ccpsForComplianceUi]);

  /** Tạo phiếu đánh giá chỉ khi có ≥1 CCP và mọi CCP đều có đủ trường bắt buộc của kế hoạch giám sát. */
  const monitoringReadyForAssessmentByPlanId = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const plan of plansForComplianceUi) {
      const list = ccpsByPlan[plan.id] ?? [];
      m[plan.id] = list.length > 0 && list.every(isMonitoringPlanComplete);
    }
    return m;
  }, [plansForComplianceUi, ccpsByPlan]);

  const allStepsWithHazardsForUi = useMemo(
    () => allStepsWithHazards.filter((s) => compliancePlanIdSet.has(s.plan_id)),
    [allStepsWithHazards, compliancePlanIdSet],
  );

  const stepsByPlan = useMemo(() => {
    const map: Record<string, ProcessStepWithPlan[]> = {};
    for (const step of allStepsWithHazardsForUi) {
      const pid = step.plan_id;
      if (!map[pid]) map[pid] = [];
      map[pid].push(step);
    }
    for (const pid of Object.keys(map)) {
      map[pid].sort((a, b) => a.step_order - b.step_order);
    }
    return map;
  }, [allStepsWithHazardsForUi]);

  const hazardsMissingCriticalLimitCount = useMemo(() => {
    let n = 0;
    for (const step of allStepsWithHazardsForUi) {
      if (hazardPlanFilterSafe !== "ALL" && step.plan_id !== hazardPlanFilterSafe) continue;
      for (const h of step.hazards || []) {
        const st = getHazardCriticalLimitStatus(h.id, step.id, step.plan_id);
        if (!st.hasCriticalLimit) n += 1;
      }
    }
    return n;
  }, [allStepsWithHazardsForUi, hazardPlanFilterSafe, getHazardCriticalLimitStatus]);

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
    void refetchAllCcps();
    void refetchAllStepsWithHazards();
    setIsWizardOpen(false);
    setWizardPlanId(null);
  };

  // Handle plan approval - Không cần phân quyền, ai cũng có thể duyệt
  const handleApprovePlan = async (planId: string) => {
    const planSteps = allStepsWithHazardsForUi.filter((s) => s.plan_id === planId);
    let missingCritical = 0;
    for (const step of planSteps) {
      for (const h of step.hazards || []) {
        if (!getHazardCriticalLimitStatus(h.id, step.id, planId).hasCriticalLimit) {
          missingCritical += 1;
        }
      }
    }
    if (missingCritical > 0) {
      alert(
        `Chưa thể phê duyệt: còn ${missingCritical} mối nguy trong phân tích mối nguy chưa có giới hạn tới hạn (CCP) hợp lệ. Hãy mở «Sửa Quy trình», gắn CCP với từng mối nguy (hoặc một CCP cho bước) và nhập giới hạn tới hạn đầy đủ.`,
      );
      setWizardPlanId(planId);
      setIsWizardOpen(true);
      return;
    }

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

  // Ẩn quy trình: giữ dữ liệu, đặt trạng thái ARCHIVED (không gọi DELETE)
  const handleHidePlan = async (plan: HaccpPlan) => {
    if (
      !confirm(
        `Ẩn quy trình "${plan.name}"?\n\nQuy trình sẽ không còn hiển thị ở các mục HACCP cho đến khi bạn bật "Hiện quy trình đã ẩn" hoặc khôi phục. Dữ liệu CCP và mối nguy được giữ nguyên.`,
      )
    )
      return;

    try {
      await apiFetch(`/haccp/plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
      alert(`Đã ẩn quy trình "${plan.name}".`);
      refetchPlans();
      setHazardPlanFilter((f) => (f === plan.id ? "ALL" : f));
      setCcpPlanFilter((f) => (f === plan.id ? "ALL" : f));
      setDeviationFilters((prev) =>
        prev.plan_id === plan.id ? { ...prev, plan_id: undefined, ccp_id: undefined } : prev,
      );
    } catch (err: any) {
      alert("Lỗi khi ẩn quy trình: " + err.message);
    }
  };

  const handleRestorePlan = async (
    plan: HaccpPlan,
    opts?: { onAfterRestore?: () => void },
  ) => {
    if (!confirm(`Hiển thị lại quy trình "${plan.name}" vào danh sách làm việc?`)) return;

    const nextStatus: "ACTIVE" | "DRAFT" =
      plan.approved_at && plan.approved_by ? "ACTIVE" : "DRAFT";

    try {
      await apiFetch(`/haccp/plans/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      alert(`Đã hiển thị lại quy trình "${plan.name}" (${nextStatus}).`);
      refetchPlans();
      opts?.onAfterRestore?.();
    } catch (err: any) {
      alert("Lỗi khi khôi phục: " + err.message);
    }
  };

  // Helper to get CCP info by ID
  const getCCPInfo = (ccpId: string): CCP | undefined => {
    return allCcpMap.get(ccpId) || ccps.find(c => c.id === ccpId);
  };

  const [pendingAssessmentAfterMonitoringSavePlanId, setPendingAssessmentAfterMonitoringSavePlanId] =
    useState<string | null>(null);
  const consumePendingAssessmentCreate = useCallback(() => {
    setPendingAssessmentAfterMonitoringSavePlanId(null);
  }, []);

  return (
    <AppShell activePath="/haccp-compliance">
      <div className="min-w-0 overflow-hidden rounded-xl bg-white shadow">
        <div className="border-t border-cyan-600 bg-[#1e8b9b] px-4 py-4 text-white sm:px-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="shrink-0 text-2xl font-bold sm:w-40">HACCP</h1>
              <div className="flex min-w-0 flex-col justify-center border-l border-r border-teal-500 px-4 sm:pl-6 sm:pr-6">
                <h2 className="text-lg font-semibold sm:text-xl">Tuân thủ HACCP</h2>
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

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 sm:gap-4">
              <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-white/95 select-none">
                <input
                  type="checkbox"
                  checked={showHiddenHaccpPlans}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setShowHiddenHaccpPlans(v);
                    if (!v) {
                      const archivedPlanIds = new Set(
                        plans.filter((p) => p.status === "ARCHIVED").map((p) => p.id),
                      );
                      setHazardPlanFilter((f) => (f !== "ALL" && archivedPlanIds.has(f) ? "ALL" : f));
                      setCcpPlanFilter((f) => (f !== "ALL" && archivedPlanIds.has(f) ? "ALL" : f));
                      setDeviationFilters((prev) =>
                        prev.plan_id && archivedPlanIds.has(prev.plan_id)
                          ? { ...prev, plan_id: undefined, ccp_id: undefined }
                          : prev,
                      );
                    }
                  }}
                  className="h-4 w-4 rounded border-white/50 text-[#1e8b9b] focus:ring-2 focus:ring-white/40"
                />
                Hiện quy trình đã ẩn
              </label>
              <button
                type="button"
                onClick={() => {
                  setHiddenPlansSearch("");
                  setIsHiddenPlansListModalOpen(true);
                }}
                className="whitespace-nowrap rounded-lg border border-white/45 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Danh sách đã ẩn
                {archivedPlansOnly.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
                    {archivedPlansOnly.length}
                  </span>
                ) : null}
              </button>
              <button
                onClick={() => openScheduleModal(null)}
                className="whitespace-nowrap bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-200 transition-transform hover:-translate-y-0.5 hover:bg-amber-600 active:translate-y-0 rounded"
              >
                📅 Lập lịch kiểm tra
              </button>
              <button
                onClick={() => { setWizardPlanId(null); setIsWizardOpen(true); }}
                className="whitespace-nowrap bg-white px-4 py-2 text-sm font-semibold text-[#1e8b9b] shadow-sm shadow-white/20 transition-transform hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-0 rounded"
              >
                + Tạo Quy Trình HACCP
              </button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(100vh-180px)] min-h-0 min-w-0">
          <aside
            className="w-48 shrink-0 border-r border-slate-200 bg-white pt-4 shadow-sm overflow-y-auto"
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

          <div className="flex min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#06b6d4 #f1f5f9' }}>
            {activeTab === "plans-list" ? (
              <HaccpPlansListPanel
                plans={plans}
                filteredPlans={filteredPlans}
                plansLoading={plansLoading}
                archivedCount={archivedPlansOnly.length}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                planDateFilterMode={planDateFilterMode}
                onPlanDateFilterModeChange={setPlanDateFilterMode}
                selectedPlanDate={selectedPlanDate}
                selectedPlanMonth={selectedPlanMonth}
                selectedPlanMonthYear={selectedPlanMonthYear}
                selectedPlanYear={selectedPlanYear}
                planCreatedFrom={planCreatedFrom}
                planCreatedTo={planCreatedTo}
                planMonthOptions={planMonthOptions}
                planYearOptions={planYearOptions}
                onClearDateFilters={clearPlanCreatedDateFilter}
                onPlanCreatedDayFilter={setPlanCreatedDayFilter}
                onPlanCreatedMonthFilter={setPlanCreatedMonthFilter}
                onPlanCreatedYearFilter={setPlanCreatedYearFilter}
                onOpenHiddenPlansModal={() => {
                  setHiddenPlansSearch("");
                  setIsHiddenPlansListModalOpen(true);
                }}
                onApprovePlan={handleApprovePlan}
                onRestorePlan={handleRestorePlan}
                onHidePlan={handleHidePlan}
                onOpenFlow={(planId) => {
                  setFlowModalPlanId(planId);
                  setIsFlowModalOpen(true);
                }}
                onOpenSchedule={openScheduleModal}
                onEditWizard={(planId) => {
                  setWizardPlanId(planId);
                  setIsWizardOpen(true);
                }}
                onVersionCreate={(p) => {
                  try {
                    setSelectedPlanForVersion({
                      id: p.id,
                      version: p.version,
                      name: p.name,
                      scope: p.scope,
                      product_id: p.product_id,
                    });
                    setIsVersionModalOpen(true);
                  } catch (err) {
                    alert("Lỗi khi mở modal: " + (err as Error).message);
                  }
                }}
              />
            ) : !selectedPlanIdResolved ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                {plansLoading ? "Đang tải dữ liệu..." : "Vui lòng tạo hoặc chọn một kế hoạch HACCP"}
              </div>
            ) : (
              <div className="min-w-0 space-y-8">
                {/* PROCESS FLOW TAB - Grid layout with fixed height */}
                {activeTab === "process-flow" && (
                  <div className="flex min-h-0 min-w-0 flex-col space-y-4 h-[calc(100vh-200px)]">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <h3 className="min-w-0 text-lg font-bold text-slate-800">Sơ đồ Quy trình Sản xuất</h3>
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        <div className="relative min-w-[10rem] max-w-xs flex-1 sm:flex-none sm:max-w-none">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                          <input
                            type="text"
                            placeholder="Tìm kế hoạch..."
                            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 sm:w-48"
                            value={flowSearchTerm}
                            onChange={e => setFlowSearchTerm(e.target.value)}
                          />
                        </div>
                        <select
                          value={flowStatusFilter}
                          onChange={(e) => setFlowStatusFilter(e.target.value)}
                          className="shrink-0 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                        >
                          <option value="ALL">Tất cả trạng thái</option>
                          <option value="DRAFT">Nháp</option>
                          <option value="ACTIVE">Hoạt động</option>
                          <option value="ARCHIVED">Đã ẩn</option>
                        </select>
                        {(flowSearchTerm || flowStatusFilter !== "ALL") && (
                          <button
                            type="button"
                            onClick={() => {
                              setFlowSearchTerm("");
                              setFlowStatusFilter("ALL");
                            }}
                            className="text-xs text-slate-500 hover:text-slate-800"
                          >
                            Xóa lọc
                          </button>
                        )}
                        <span className="text-xs text-slate-500">{filteredPlansForFlow.length} kế hoạch</span>
                      </div>
                    </div>
                    {plansForComplianceUi.length === 0 ? (
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 text-center text-slate-400">
                        {plans.length === 0
                          ? "Chưa có kế hoạch HACCP nào. Hãy tạo kế hoạch mới."
                          : "Không có quy trình đang hiển thị. Các quy trình đã ẩn được lọc ra — bật «Hiện quy trình đã ẩn» ở thanh trên hoặc khôi phục từ tab Danh sách kế hoạch."}
                      </div>
                    ) : filteredPlansForFlow.length === 0 ? (
                      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 text-center text-slate-400">
                        Không tìm thấy kế hoạch phù hợp.
                      </div>
                    ) : (
                      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-2 -mr-2">
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
                                  {plan.status === "ARCHIVED" ? "Đã ẩn" : (plan.status || "DRAFT")}
                                </span>
                              </div>
                              <div className="bg-slate-50 rounded-lg p-2 mb-2 h-24 overflow-hidden">
                                <ProcessFlowDisplay planId={plan.id} compact onStepClick={handleStepClick} />
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
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-200px)] min-w-0">
                    <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-800">Phân tích Mối nguy</h3>
                        <p className="text-[10px] text-slate-500">Tất cả mối nguy từ các quy trình HACCP — mỗi mối nguy cần có giới hạn tới hạn (CCP) đã thiết lập.</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 text-[10px]">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span>Sinh học</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Hóa học</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Vật lý</span>
                      </div>
                    </div>
                    {hazardsMissingCriticalLimitCount > 0 && (
                      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <span className="font-semibold">Cần hoàn thiện: </span>
                        Có{" "}
                        <span className="font-bold">{hazardsMissingCriticalLimitCount}</span> mối nguy
                        {hazardPlanFilterSafe === "ALL" ? "" : " (theo kế hoạch đang lọc)"} chưa có{" "}
                        <span className="font-medium">giới hạn tới hạn</span> hợp lệ. Thiết lập CCP và nhập giới hạn
                        trong trình soạn quy trình HACCP (gắn CCP với mối nguy hoặc một CCP cho bước công đoạn).
                      </div>
                    )}
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
                    <div className="mb-4 flex flex-wrap gap-2 items-center">
                      <select
                        value={hazardPlanFilterSafe}
                        onChange={(e) => setHazardPlanFilter(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="ALL">Tất cả kế hoạch</option>
                        {plansForComplianceUi.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={hazardTypeFilter}
                        onChange={(e) => setHazardTypeFilter(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="ALL">Tất cả loại mối nguy</option>
                        <option value="BIOLOGICAL">Sinh học</option>
                        <option value="CHEMICAL">Hóa học</option>
                        <option value="PHYSICAL">Vật lý</option>
                      </select>
                      <select
                        value={hazardRiskFilter}
                        onChange={(e) => setHazardRiskFilter(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="ALL">Tất cả mức rủi ro</option>
                        <option value="significant">Mối nguy đáng kể</option>
                        <option value="high">Rủi ro cao (&gt;= 12)</option>
                        <option value="medium">Rủi ro trung bình (8-11)</option>
                        <option value="low">Rủi ro thấp (&lt; 8)</option>
                      </select>
                      <select
                        value={hazardCriticalLimitFilter}
                        onChange={(e) => setHazardCriticalLimitFilter(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="ALL">Giới hạn tới hạn: tất cả</option>
                        <option value="missing">Chưa thiết lập GL</option>
                        <option value="ok">Đã có GL</option>
                      </select>
                      {(hazardSearchTerm || hazardPlanFilter !== "ALL" || hazardTypeFilter !== "ALL" || hazardRiskFilter !== "ALL" || hazardCriticalLimitFilter !== "ALL") && (
                        <button
                          type="button"
                          onClick={() => {
                            setHazardSearchTerm("");
                            setHazardPlanFilter("ALL");
                            setHazardTypeFilter("ALL");
                            setHazardRiskFilter("ALL");
                            setHazardCriticalLimitFilter("ALL");
                          }}
                          className="text-sm text-slate-500 hover:text-slate-800 px-2 py-2"
                        >
                          Xóa lọc
                        </button>
                      )}
                    </div>

                    {allHazardsFullLoading ? (
                      <div className="text-center py-12 text-slate-400 flex-1">
                        <div className="w-10 h-10 border-2 border-cyan-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-sm">Đang tải dữ liệu...</p>
                      </div>
                    ) : allStepsWithHazardsForUi.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 flex-1">
                        <span className="text-3xl mb-2 block">📊</span>
                        <p className="text-sm font-medium">Chưa có dữ liệu phân tích mối nguy</p>
                        <p className="text-xs text-slate-400 mt-1">Tạo kế hoạch HACCP và thêm công đoạn để bắt đầu</p>
                      </div>
                    ) : (
                      <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                        {(() => {
                          const query = hazardSearchTerm.trim().toLowerCase();
                          const filteredSteps = allStepsWithHazardsForUi
                            .filter((step) => hazardPlanFilterSafe === "ALL" || step.plan_id === hazardPlanFilterSafe)
                            .map((step) => ({
                              ...step,
                              hazards: (step.hazards || []).filter((h) => {
                                const cl = getHazardCriticalLimitStatus(h.id, step.id, step.plan_id);
                                const matchesCl =
                                  hazardCriticalLimitFilter === "ALL" ||
                                  (hazardCriticalLimitFilter === "missing" && !cl.hasCriticalLimit) ||
                                  (hazardCriticalLimitFilter === "ok" && cl.hasCriticalLimit);
                                const matchesSearch =
                                  !query ||
                                  h.hazard_name.toLowerCase().includes(query) ||
                                  h.hazard_type.toLowerCase().includes(query) ||
                                  (h.description || "").toLowerCase().includes(query) ||
                                  step.plan_name.toLowerCase().includes(query) ||
                                  step.name.toLowerCase().includes(query);
                                const matchesType = hazardTypeFilter === "ALL" || h.hazard_type === hazardTypeFilter;
                                const matchesRisk =
                                  hazardRiskFilter === "ALL" ||
                                  (hazardRiskFilter === "significant" && h.is_significant) ||
                                  (hazardRiskFilter === "high" && h.risk_score >= 12) ||
                                  (hazardRiskFilter === "medium" && h.risk_score >= 8 && h.risk_score < 12) ||
                                  (hazardRiskFilter === "low" && h.risk_score < 8);
                                return matchesSearch && matchesType && matchesRisk && matchesCl;
                              }),
                            }))
                            .filter((step) => (step.hazards || []).length > 0);

                          const groupedByPlan = filteredSteps.reduce((acc, step) => {
                            const planId = step.plan_id;
                            if (!acc[planId]) {
                              acc[planId] = { planName: step.plan_name, steps: [] };
                            }
                            acc[planId].steps.push(step);
                            return acc;
                          }, {} as Record<string, { planName: string; steps: ProcessStepWithPlan[] }>);

                          if (Object.keys(groupedByPlan).length === 0) {
                            return (
                              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                Không tìm thấy mối nguy phù hợp với bộ lọc.
                              </div>
                            );
                          }

                          return Object.entries(groupedByPlan).map(([planId, planData]) => {
                            const totalHazards = planData.steps.reduce((sum, s) => sum + (s.hazards?.length || 0), 0);
                            const hasSignificant = planData.steps.some(s => s.hazards?.some(h => h.is_significant || h.risk_score >= 12));
                            const significantCount = planData.steps.reduce((sum, s) => sum + (s.hazards?.filter(h => h.is_significant || h.risk_score >= 12).length || 0), 0);
                            const missingClCount = planData.steps.reduce(
                              (sum, s) =>
                                sum +
                                (s.hazards || []).filter(
                                  (h) => !getHazardCriticalLimitStatus(h.id, s.id, planId).hasCriticalLimit,
                                ).length,
                              0,
                            );

                            return (
                              <div key={planId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                                {/* Header Kế hoạch - Modern Design */}
                                <div className={`flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3 ${hasSignificant ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' : 'bg-gradient-to-r from-cyan-50 to-sky-50 border-slate-200'}`}>
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm">
                                      {hasSignificant ? '⚠️' : '📋'}
                                    </span>
                                    <div className="min-w-0">
                                      <span className="block font-semibold leading-tight text-slate-800">{planData.planName}</span>
                                      <span className="text-[10px] text-slate-500">{planData.steps.length} công đoạn • {totalHazards} mối nguy</span>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                    {missingClCount > 0 && (
                                      <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-900">
                                        {missingClCount} chưa GL
                                      </span>
                                    )}
                                    {hasSignificant && (
                                      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-medium text-red-700">
                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></span>
                                        {significantCount} mối nguy đáng kể
                                      </span>
                                    )}
                                    <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${hasSignificant ? 'bg-orange-100 text-orange-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                      {totalHazards} mối nguy
                                    </span>
                                  </div>
                                </div>

                                {/* Bảng mối nguy - Table Header */}
                                <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 grid grid-cols-12 gap-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                  <div className="col-span-1 text-center">STT</div>
                                  <div className="col-span-4">Tên mối nguy</div>
                                  <div className="col-span-2 text-center">Loại</div>
                                  <div className="col-span-2 text-center">Rủi ro</div>
                                  <div className="col-span-3 text-center">Giới hạn tới hạn (CCP)</div>
                                </div>

                                {/* Bảng mối nguy - Data Rows */}
                                <div className="divide-y divide-slate-100">
                                  {planData.steps.map((step, idx) => {
                                    const hazards = step.hazards || [];
                                    if (hazards.length === 0) return null;
                                    return (
                                      <div key={`step-group-${step.id}`} className="contents">
                                        {hazards.map((h) => {
                                          const clStatus = getHazardCriticalLimitStatus(h.id, step.id, step.plan_id);
                                          return (
                                            <div
                                              key={`${step.id}-${h.id}`}
                                              className={`px-4 py-3 grid grid-cols-12 gap-3 items-center cursor-pointer transition-all duration-200 hover:bg-slate-50 group ${!clStatus.hasCriticalLimit ? "border-l-4 border-amber-400 bg-amber-50/30" : ""} ${h.is_significant || h.risk_score >= 12 ? 'bg-red-50/40 hover:bg-red-50/60' : ''}`}
                                              onClick={() => {
                                                setSelectedHazard(h);
                                                setSelectedHazardContext({ planId: step.plan_id, stepId: step.id });
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
                                              <div className="col-span-4 min-w-0">
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
                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${h.hazard_type === 'BIOLOGICAL' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                                                  h.hazard_type === 'CHEMICAL' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                    'bg-blue-50 border-blue-200 text-blue-700'
                                                  }`}>
                                                  {hazardNameVN(h.hazard_type)}
                                                </span>
                                              </div>

                                              {/* Risk Score - Badge to và đẹp */}
                                              <div className="col-span-2 flex flex-col items-center justify-center">
                                                <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${h.risk_score >= 12 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                                                  h.risk_score >= 8 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                                                    'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white'
                                                  }`}>
                                                  {h.risk_score}
                                                </span>
                                                <span className="text-[9px] text-slate-400 mt-1">L{h.likelihood} × S{h.severity}</span>
                                              </div>

                                              {/* Giới hạn tới hạn + thiết lập */}
                                              <div className="col-span-3 flex flex-col gap-1.5 min-w-0 justify-center">
                                                {clStatus.hasCriticalLimit && clStatus.ccp ? (
                                                  <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-1.5">
                                                    <p className="text-[9px] font-semibold uppercase text-emerald-800">GL ({clStatus.ccp.ccp_code})</p>
                                                    <p className="text-xs text-slate-800 line-clamp-2" title={clStatus.ccp.critical_limit}>
                                                      {clStatus.ccp.critical_limit}
                                                    </p>
                                                  </div>
                                                ) : (
                                                  <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                                                    <p className="text-[10px] font-semibold text-amber-900">
                                                      {!clStatus.hasLinkedCcp
                                                        ? "Chưa gắn CCP với mối nguy"
                                                        : "CCP chưa có giới hạn tới hạn"}
                                                    </p>
                                                    <button
                                                      type="button"
                                                      className="mt-1 text-left text-[10px] font-medium text-cyan-700 underline hover:text-cyan-900"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setWizardPlanId(step.plan_id);
                                                        setIsWizardOpen(true);
                                                      }}
                                                    >
                                                      Mở sửa quy trình để thiết lập
                                                    </button>
                                                  </div>
                                                )}
                                                <div className="flex flex-wrap items-center gap-1">
                                                  {h.is_significant && (
                                                    <span className="rounded bg-red-100 px-1 py-0.5 text-[8px] font-bold text-red-700" title="Mối nguy đáng kể">
                                                      Đáng kể
                                                    </span>
                                                  )}
                                                  {h.control_measure && (
                                                    <span className="text-[9px] text-emerald-600" title="Có biện pháp kiểm soát">
                                                      🛡️
                                                    </span>
                                                  )}
                                                  {h.ai_suggestion && (
                                                    <span className="text-[9px] text-blue-600" title="Có đề xuất AI">
                                                      🤖
                                                    </span>
                                                  )}
                                                  <span className="ml-auto text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                                                    Xem chi tiết →
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
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
                  onClose={() => {
                    setIsHazardModalOpen(false);
                    setSelectedHazardContext(null);
                  }}
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
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${selectedHazard.hazard_type === 'BIOLOGICAL' ? 'bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600' :
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
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${selectedHazard.hazard_type === 'BIOLOGICAL' ? 'bg-orange-50 border-orange-200 text-orange-700' :
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
                      <div className={`p-4 rounded-xl border ${selectedHazard.risk_score >= 12 ? 'bg-gradient-to-r from-red-50 to-red-100 border-red-200' :
                        selectedHazard.risk_score >= 8 ? 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200' :
                          'bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200'
                        }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${selectedHazard.risk_score >= 12 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                              selectedHazard.risk_score >= 8 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white' :
                                'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white'
                              }`}>
                              <span className="text-2xl font-bold">{selectedHazard.risk_score}</span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Điểm rủi ro</p>
                              <p className={`text-sm font-semibold mt-0.5 ${selectedHazard.risk_score >= 12 ? 'text-red-700' :
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

                      {selectedHazard && (() => {
                        const stepId = selectedHazardContext?.stepId ?? selectedHazard.step_id;
                        const planId =
                          selectedHazardContext?.planId ??
                          allStepsWithHazardsForUi.find((s) => s.id === stepId)?.plan_id ??
                          "";
                        if (!planId) return null;
                        const st = getHazardCriticalLimitStatus(selectedHazard.id, stepId, planId);
                        return (
                          <div
                            className={`rounded-xl border p-4 ${st.hasCriticalLimit ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
                          >
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-2">
                              Giới hạn tới hạn (CCP)
                            </p>
                            {st.hasCriticalLimit && st.ccp ? (
                              <div className="space-y-2">
                                <p className="text-sm text-slate-800">
                                  <span className="font-semibold text-emerald-800">{st.ccp.ccp_code}</span>
                                  {" — "}
                                  {st.ccp.name}
                                </p>
                                <p className="text-sm text-slate-700 leading-relaxed border-t border-emerald-200/60 pt-2">
                                  {st.ccp.critical_limit}
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-sm text-amber-950">
                                  {!st.hasLinkedCcp
                                    ? "Mối nguy này chưa được gắn với CCP (hoặc chưa có đúng một CCP cho bước công đoạn). Cần thiết lập để có giới hạn tới hạn."
                                    : "CCP đã gắn nhưng chưa nhập giới hạn tới hạn (critical limit)."}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWizardPlanId(planId);
                                    setIsWizardOpen(true);
                                    setIsHazardModalOpen(false);
                                    setSelectedHazardContext(null);
                                  }}
                                  className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
                                >
                                  Mở sửa quy trình HACCP
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

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
                  <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-200px)] min-w-0">
                    <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                      <h3 className="min-w-0 text-lg font-bold text-slate-800">Danh sách Điểm Kiểm soát Tới hạn (CCP)</h3>
                      <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                        {filteredAllCcps.length}/{ccpsForComplianceUi.length} CCP từ quy trình đang hiển thị
                      </span>
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

                    <div className="mb-4 flex flex-wrap gap-2 items-center">
                      <select
                        value={ccpPlanFilterSafe}
                        onChange={(e) => setCcpPlanFilter(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="ALL">Tất cả kế hoạch</option>
                        {plansForComplianceUi.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ccpSetupFilter}
                        onChange={(e) => setCcpSetupFilter(e.target.value)}
                        className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="ALL">Tất cả kế hoạch giám sát</option>
                        <option value="complete">Đã đủ thông tin</option>
                        <option value="incomplete">Chưa đủ thông tin</option>
                      </select>
                      {(ccpSearchTerm || ccpPlanFilter !== "ALL" || ccpSetupFilter !== "ALL") && (
                        <button
                          type="button"
                          onClick={() => {
                            setCcpSearchTerm("");
                            setCcpPlanFilter("ALL");
                            setCcpSetupFilter("ALL");
                          }}
                          className="text-sm text-slate-500 hover:text-slate-800 px-2 py-2"
                        >
                          Xóa lọc
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
                          const filteredCcps = filteredAllCcps;

                          if (filteredCcps.length === 0) {
                            return (
                              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                Không tìm thấy CCP phù hợp với bộ lọc.
                              </div>
                            );
                          }

                          // Tạo map plan_id -> plan_name
                          const planMap = new Map(plansForComplianceUi.map(p => [p.id, p.name]));
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
                                        <div className="flex flex-col items-center">
                                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-bold rounded-t-md border-x border-t border-slate-200 w-full text-center">
                                            {planData.planName.split(' ').map(w => w[0]).join('').toUpperCase()}
                                          </span>
                                          <span className="px-2.5 py-1 bg-orange-500 text-white text-xs font-bold rounded-b-md shadow-sm min-w-[60px] text-center">
                                            {ccp.ccp_code}
                                          </span>
                                        </div>
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
                                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                                      {ccp.monitoring_method && (
                                        <div className="flex items-center gap-1 text-slate-600">
                                          <span>📋</span>
                                          <span className="truncate">{ccp.monitoring_method}</span>
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
                    plans={plansForComplianceUi}
                    allCcps={ccpsForComplianceUi}
                    allCcpsLoading={allCcpsLoading}
                    refetchAllCcps={refetchAllCcps}
                    users={users}
                    usersLoading={usersLoading}
                    onMonitoringPlanSaved={async (planId) => {
                      await refetchAllCcps();
                      setPendingAssessmentAfterMonitoringSavePlanId(planId);
                      setActiveTab("assessments");
                    }}
                  />
                )}

                {/* DEVIATIONS TAB - Organization wide */}
                {activeTab === "deviations" && (
                  <DeviationManagementPanel
                    plans={plansForComplianceUi}
                    allCcps={ccpsForComplianceUi}
                    deviations={deviationsForComplianceUi}
                    deviationsLoading={deviationsLoading}
                    deviationStats={deviationStats}
                    deviationStatsLoading={deviationStatsLoading}
                    filters={deviationFiltersForApi}
                    onFiltersChange={setDeviationFilters}
                    onRefresh={() => { refetchDeviations(); refetchDeviationStats(); }}
                    onHandleDeviation={(dev) => { setSelectedDeviation(dev); setIsHandleDeviationModalOpen(true); }}
                    getCCPInfo={getCCPInfo}
                    getUserDisplayName={getUserDisplayName}
                  />
                )}

                {/* ASSESSMENTS TAB - Phiếu đánh giá HACCP */}
                {activeTab === "assessments" && (
                  <AssessmentPanel
                    plans={plansForComplianceUi}
                    ccpsMap={ccpsByPlan}
                    stepsMap={stepsByPlan}
                    monitoringReadyByPlanId={monitoringReadyForAssessmentByPlanId}
                    pendingCreateFromPlanId={pendingAssessmentAfterMonitoringSavePlanId}
                    onConsumePendingCreate={consumePendingAssessmentCreate}
                    onAssessmentSubmitted={() => {
                      void refetchDeviations();
                      void refetchDeviationStats();
                      void refetchUpcoming();
                    }}
                    onNavigateToDeviations={() => setActiveTab("deviations")}
                  />
                )}

              </div>
            )}
          </div>

          <aside className="hidden w-80 shrink-0 min-w-0 border-l border-slate-200 bg-white p-6 shadow-sm overflow-y-auto lg:block" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e8b9b #f1f5f9' }}>
            <div className="mb-6 flex min-w-0 items-center justify-between gap-3">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-bold text-slate-800">
                <span className="shrink-0 text-amber-500">📅</span>
                <span className="min-w-0 truncate">Lịch sắp tới</span>
              </h2>
              <button
                onClick={() => setShowScheduleManagementModal(true)}
                className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-cyan-600 hover:text-cyan-700"
              >
                Quản lý
              </button>
            </div>

            <div className="space-y-4">
              {upcomingLoading ? (
                <div className="py-10 text-center text-slate-400 text-sm">Đang tải lịch...</div>
              ) : upcomingSchedules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center p-4 border-2 border-dashed rounded-2xl border-slate-50 bg-slate-50/30">
                  <div className="text-3xl mb-3">📅</div>
                  <p className="text-xs text-slate-400 font-medium">Chưa có lịch đánh giá.</p>
                  <button
                    onClick={() => openScheduleModal(null)}
                    className="mt-3 text-[10px] font-bold text-amber-600 hover:underline uppercase"
                  >
                    + Lập lịch ngay
                  </button>
                </div>
              ) : (
                upcomingSchedules.slice(0, 5).map((s: HaccpSchedule) => (
                  <div key={s.id} className="group p-4 border border-slate-50 rounded-2xl bg-white hover:border-amber-100 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-xl w-14 h-14 shadow-sm shrink-0 group-hover:bg-amber-50 group-hover:border-amber-100 transition-colors">
                        <span className="text-[9px] uppercase font-bold text-slate-400 leading-none group-hover:text-amber-600">Th {new Date(s.start_time).getMonth() + 1}</span>
                        <span className="text-xl font-bold text-slate-700 leading-none mt-1">{new Date(s.start_time).getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-700 text-sm truncate group-hover:text-amber-600 transition-colors" title={s.title}>
                          {s.title}
                        </h3>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatHaccpScheduleWindow(s as HaccpSchedule)}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="truncate">HACCP Plan</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
      <HaccpWizard
        isOpen={isWizardOpen}
        onClose={() => { setIsWizardOpen(false); setWizardPlanId(null); }}
        onSuccess={handleWizardSuccess}
        planId={wizardPlanId}
      />

      {/* Danh sách quy trình đã ẩn — chọn để hiển thị lại */}
      <Modal
        isOpen={isHiddenPlansListModalOpen}
        onClose={() => {
          setIsHiddenPlansListModalOpen(false);
          setHiddenPlansSearch("");
        }}
        title="Quy trình đã ẩn"
        maxWidth="3xl"
      >
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-600">
            Các quy trình dưới đây đang ẩn khỏi màn hình làm việc. Chọn &quot;Hiển thị lại&quot; để đưa về trạng thái
            hoạt động (ACTIVE nếu đã từng phê duyệt, hoặc DRAFT).
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="search"
              value={hiddenPlansSearch}
              onChange={(e) => setHiddenPlansSearch(e.target.value)}
              placeholder="Tìm theo tên, phạm vi, phiên bản…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>
          {plansLoading ? (
            <p className="py-8 text-center text-slate-400">Đang tải…</p>
          ) : archivedPlansOnly.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
              Chưa có quy trình nào đang ẩn.
            </p>
          ) : filteredArchivedPlansForModal.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Không khớp tìm kiếm.</p>
          ) : (
            <div className="max-h-[min(420px,55vh)] overflow-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="sticky top-0 bg-[#eef6fa] text-cyan-900">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Tên</th>
                    <th className="px-3 py-2 font-semibold">Phiên bản</th>
                    <th className="px-3 py-2 font-semibold">Phạm vi</th>
                    <th className="px-3 py-2 font-semibold">Ngày tạo</th>
                    <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredArchivedPlansForModal.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-cyan-800">{p.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">v{p.version}</td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-xs">{p.scope || "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {new Date(p.created_at).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              void handleRestorePlan(p, {
                                onAfterRestore: () => {
                                  setIsHiddenPlansListModalOpen(false);
                                  setHiddenPlansSearch("");
                                },
                              })
                            }
                            className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                          >
                            Hiển thị lại
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsHiddenPlansListModalOpen(false);
                              setFlowModalPlanId(p.id);
                              setIsFlowModalOpen(true);
                            }}
                            className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Xem luồng
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Flow Modal */}
      <Modal
        isOpen={isFlowModalOpen}
        onClose={() => { setIsFlowModalOpen(false); setFlowModalPlanId(null); }}
        title="Sơ đồ quy trình sản xuất"
        maxWidth="4xl"
      >
        <div className="p-6 bg-slate-50 min-h-[400px]">
          <ProcessFlowDisplay planId={flowModalPlanId} onStepClick={handleStepClick} />
        </div>
      </Modal>

      {/* Handle Deviation Modal */}
      <HandleDeviationModal
        isOpen={isHandleDeviationModalOpen}
        onClose={() => { setIsHandleDeviationModalOpen(false); setSelectedDeviation(null); }}
        deviation={selectedDeviation}
        users={users}
        onRefresh={() => { refetchDeviations(); refetchDeviationStats(); }}
        onSuccess={() => { refetchDeviations(); refetchDeviationStats(); setIsHandleDeviationModalOpen(false); setSelectedDeviation(null); }}
      />

      {/* Create New Version Modal */}
      <CreateVersionModal
        isOpen={isVersionModalOpen}
        onClose={() => { setIsVersionModalOpen(false); setSelectedPlanForVersion(null); }}
        plan={selectedPlanForVersion}
        onSuccess={() => { refetchPlans(); }}
        locations={locations}
        locationsLoading={locationsLoading}
      />

      {/* Step Detail Modal */}
      <StepDetailModal
        isOpen={isStepDetailOpen}
        onClose={() => setIsStepDetailOpen(false)}
        step={selectedStepDetail}
        allCcps={allCcps}
      />

      {showScheduleModal && (
        <HaccpScheduleModal
          locations={locations}
          plans={plans.filter(p => p.status === 'ACTIVE')}
          initialPlanId={scheduleModalInitialPlanId}
          onClose={() => {
            setShowScheduleModal(false);
            setScheduleModalInitialPlanId(null);
          }}
          onSuccess={async () => {
            setShowScheduleModal(false);
            setScheduleModalInitialPlanId(null);
            await refetchUpcoming();
          }}
        />
      )}

      {showScheduleManagementModal && (
        <HaccpScheduleManagementModal
          onClose={() => setShowScheduleManagementModal(false)}
          onSchedulesChanged={() => void refetchUpcoming()}
        />
      )}
    </AppShell>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ProcessFlowDisplay({ planId, compact = false, onStepClick }: { planId: string | null, compact?: boolean, onStepClick?: (step: ProcessStep) => void }) {
  const { steps, loading } = useProcessSteps(planId);

  if (loading) return <div className="p-4 text-center text-slate-500 text-xs">Đang tải...</div>;
  if (!steps || steps.length === 0) return <div className="p-4 text-center text-slate-400 italic text-xs">Chưa có công đoạn</div>;

  if (compact) {
    return (
      <div className="space-y-2">
        {steps.slice(0, 3).map((step, index) => (
          <div key={step.id} className={`flex items-center gap-2 text-xs ${onStepClick ? 'cursor-pointer hover:bg-white/60 px-1 rounded transition-colors' : ''}`} onClick={() => onStepClick?.(step)}>
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
    <div className="bg-slate-50/30 p-8 rounded-3xl border border-slate-200/60 shadow-inner">
      <div className="flex flex-wrap items-center gap-x-0 gap-y-10">
        {steps.sort((a, b) => (a.step_order || 0) - (b.step_order || 0)).map((stage, index) => {
          const typeName = ({ "RECEIVING": "Tiếp nhận", "PROCESSING": "Chế biến", "PACKAGING": "Đóng gói", "STORAGE": "Lưu kho" } as any)[stage.step_type || "PROCESSING"];

          return (
            <div key={stage.id} className="flex items-center">
              {/* Step Node */}
              <div
                className={`relative flex flex-col items-center group ${onStepClick ? 'cursor-pointer' : ''}`}
                onClick={() => onStepClick?.(stage)}
              >
                <span className="absolute -top-6 text-[9px] font-bold text-slate-400 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                  {typeName}
                </span>
                <div className={`relative rounded-2xl px-6 py-4 shadow-sm font-bold transition-all border-2 ${stage.is_ccp
                  ? 'border-orange-400 bg-white text-orange-900 ring-4 ring-orange-100/50 scale-105 z-10'
                  : 'border-white bg-white text-slate-700 hover:border-cyan-200 hover:shadow-md'
                  }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${stage.is_ccp ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {index + 1}
                    </span>
                    <span className="whitespace-nowrap">{stage.name}</span>
                  </div>

                  {stage.is_ccp && (
                    <span className="absolute -top-3 -right-2 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 px-2 py-0.5 text-[8px] font-black text-white shadow-md border border-white uppercase">
                      CCP
                    </span>
                  )}
                </div>
              </div>

              {/* Connector Arrow */}
              {index < steps.length - 1 && (
                <div className="w-12 flex items-center justify-center -mx-1">
                  <div className="h-[2px] flex-1 bg-gradient-to-r from-slate-200 to-slate-300 relative">
                    <div className="absolute right-[-2px] top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-slate-300 rotate-45" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonitoringPlanEditor({
  plans,
  onMonitoringPlanSaved,
  allCcps: ccps,
  allCcpsLoading: ccpsLoading,
  refetchAllCcps: refetch,
  users,
  usersLoading,
}: {
  plans: any[];
  onMonitoringPlanSaved?: (planId: string) => void;
  allCcps: CCP[];
  allCcpsLoading: boolean;
  refetchAllCcps: () => void | Promise<void>;
  users: User[];
  usersLoading: boolean;
}) {
  const [selectedCcpId, setSelectedCcpId] = useState<string | null>(null);
  const [editableCcp, setEditableCcp] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [setupFilter, setSetupFilter] = useState("ALL");

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
        monitoring_frequency: null,
        monitoring_device: editableCcp.monitoring_device?.trim() || null,
        responsible_user: editableCcp.responsible_user,
        corrective_action: editableCcp.corrective_action?.trim() || null,
        verification_procedure: editableCcp.verification_procedure?.trim() || null,
      };

      await apiFetch(`/haccp/ccps/${editableCcp.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      await refetch();

      if (onMonitoringPlanSaved && editableCcp.haccp_plan_id) {
        onMonitoringPlanSaved(String(editableCcp.haccp_plan_id));
      }

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
    const query = searchTerm.trim().toLowerCase();
    const filteredCcps = ccps.filter((ccp) => {
      const matchesSearch =
        !query ||
        ccp.name.toLowerCase().includes(query) ||
        ccp.ccp_code.toLowerCase().includes(query) ||
        (ccp.critical_limit || "").toLowerCase().includes(query) ||
        (ccp.monitoring_method || "").toLowerCase().includes(query);
      const matchesPlan = planFilter === "ALL" || ccp.haccp_plan_id === planFilter;
      const complete = isMonitoringPlanComplete(ccp);
      const matchesSetup =
        setupFilter === "ALL" ||
        (setupFilter === "complete" && complete) ||
        (setupFilter === "incomplete" && !complete);
      return matchesSearch && matchesPlan && matchesSetup;
    });

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
            {filteredCcps.length}/{ccps.length} CCP
          </span>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[220px]">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Tìm CCP</label>
            <input
              type="text"
              placeholder="Tìm theo tên, mã, giới hạn, phương pháp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <svg className="absolute left-3 bottom-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Kế hoạch</label>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[200px]"
            >
              <option value="ALL">Tất cả kế hoạch</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Tình trạng</label>
            <select
              value={setupFilter}
              onChange={(e) => setSetupFilter(e.target.value)}
              className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[170px]"
            >
              <option value="ALL">Tất cả</option>
              <option value="complete">Hoàn thiện</option>
              <option value="incomplete">Chưa đầy đủ</option>
            </select>
          </div>
          {(searchTerm || planFilter !== "ALL" || setupFilter !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setPlanFilter("ALL");
                setSetupFilter("ALL");
              }}
              className="text-sm text-slate-500 hover:text-slate-800 px-2 py-2"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {/* CCP List by Plan */}
        <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
          {filteredCcps.length === 0 ? (
            <div className="bg-white rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-400">
              Không tìm thấy CCP phù hợp với bộ lọc.
            </div>
          ) : Object.entries(groupedByPlan).map(([planId, planData]) => (
            <div key={planId} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                <span className="font-medium text-sm text-slate-700">{planData.planName}</span>
                <span className="text-xs text-slate-500 ml-2">({planData.ccps.length} CCP)</span>
              </div>
              <div className="divide-y divide-slate-100">
                {planData.ccps.map((ccp) => {
                  const isComplete = isMonitoringPlanComplete(ccp);

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
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                            ✅ Hoàn thiện
                          </span>
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

        {/* Phương pháp giám sát */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Phương pháp giám sát <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={editableCcp.monitoring_method || ""}
            onChange={(e) => handleInputChange("monitoring_method", e.target.value)}
            placeholder="VD: Kiểm tra nhiệt kế"
            className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
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
  plans: HaccpPlan[];
  allCcps: CCP[];
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
  plans,
  allCcps,
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
  const { principal } = useAuth();
  const toast = useToast();
  const [logIdsWithCapaNc, setLogIdsWithCapaNc] = useState<string[]>([]);
  const [requestingCapaFor, setRequestingCapaFor] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(filters.search || "");
  const [dateFilterMode, setDateFilterMode] = useState<"day" | "month" | "year">("day");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedMonthYear, setSelectedMonthYear] = useState(String(new Date().getFullYear()));
  const [selectedYear, setSelectedYear] = useState("");

  useEffect(() => {
    setSearchDraft(filters.search || "");
  }, [filters.search]);

  const clearDateFilter = () => {
    setSelectedDate("");
    setSelectedMonth("");
    setSelectedMonthYear(String(new Date().getFullYear()));
    setSelectedYear("");
    onFiltersChange({
      ...filters,
      recorded_from: undefined,
      recorded_to: undefined,
    });
  };

  const setDayFilter = (value: string) => {
    setSelectedDate(value);
    setSelectedMonth("");
    setSelectedMonthYear(String(new Date().getFullYear()));
    setSelectedYear("");
    onFiltersChange({
      ...filters,
      recorded_from: value || undefined,
      recorded_to: value || undefined,
    });
  };

  const setMonthFilter = (monthValue: string, yearValue = selectedMonthYear) => {
    setSelectedDate("");
    setSelectedMonth(monthValue);
    setSelectedMonthYear(yearValue);
    setSelectedYear("");
    if (!monthValue || !yearValue) {
      onFiltersChange({ ...filters, recorded_from: undefined, recorded_to: undefined });
      return;
    }
    const monthDate = `${yearValue}-${monthValue}`;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const lastDay = new Date(year, month, 0).getDate();
    onFiltersChange({
      ...filters,
      recorded_from: `${monthDate}-01`,
      recorded_to: `${monthDate}-${String(lastDay).padStart(2, "0")}`,
    });
  };

  const setYearFilter = (value: string) => {
    setSelectedDate("");
    setSelectedMonth("");
    setSelectedMonthYear(String(new Date().getFullYear()));
    setSelectedYear(value);
    onFiltersChange({
      ...filters,
      recorded_from: value ? `${value}-01-01` : undefined,
      recorded_to: value ? `${value}-12-31` : undefined,
    });
  };

  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 8 }, (_, index) => String(thisYear - index));
  const monthOptions = Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return { value: month, label: `Tháng ${index + 1}` };
  });

  const ccpOptions = useMemo(() => {
    if (!filters.plan_id) return allCcps;
    return allCcps.filter((c) => c.haccp_plan_id === filters.plan_id);
  }, [allCcps, filters.plan_id]);

  const hasPanelFilters = !!(
    filters.status ||
    filters.severity ||
    filters.plan_id ||
    filters.ccp_id ||
    filters.search ||
    filters.has_capa_nc ||
    filters.recorded_from ||
    filters.recorded_to
  );

  useEffect(() => {
    if (deviations.length === 0) {
      setLogIdsWithCapaNc([]);
      return;
    }
    if (filters.has_capa_nc === "yes") {
      setLogIdsWithCapaNc(deviations.map((d) => d.id));
      return;
    }
    if (filters.has_capa_nc === "no") {
      setLogIdsWithCapaNc([]);
      return;
    }
    if (!principal?.org_id) {
      setLogIdsWithCapaNc([]);
      return;
    }
    const ids = deviations.map((d) => d.id);
    let cancelled = false;
    capaService
      .checkExistingNCs(ids)
      .then((existing) => {
        if (!cancelled) setLogIdsWithCapaNc(existing);
      })
      .catch(() => {
        if (!cancelled) setLogIdsWithCapaNc([]);
      });
    return () => {
      cancelled = true;
    };
  }, [deviations, filters.has_capa_nc, principal?.org_id]);

  const sendCapaRequest = async (logId: string) => {
    if (!principal?.org_id) {
      toast.error("Chưa xác định tổ chức. Vui lòng đăng nhập lại.");
      return;
    }
    setRequestingCapaFor(logId);
    try {
      const res = await requestDeviationCapaNc(logId);
      setLogIdsWithCapaNc((prev) => (prev.includes(logId) ? prev : [...prev, logId]));
      toast.success(
        res.created
          ? "Đã gửi yêu cầu sang CAPA. Trạng thái hiện tại: đang đợi duyệt."
          : "Đã có yêu cầu CAPA (NC). Trạng thái đã đồng bộ.",
      );
      onRefresh();
    } catch (e) {
      toast.error((e as Error).message || "Lỗi khi gửi yêu cầu CAPA.");
    } finally {
      setRequestingCapaFor(null);
    }
  };

  const severityConfig = {
    CRITICAL: { label: 'Nghiêm trọng', color: 'bg-red-600 text-white' },
    HIGH: { label: 'Cao', color: 'bg-orange-500 text-white' },
    MEDIUM: { label: 'Trung bình', color: 'bg-yellow-500 text-black' },
    LOW: { label: 'Thấp', color: 'bg-blue-400 text-white' }
  };

  const statusConfig: Record<
    string,
    { label: string; color: string }
  > = {
    NEW: { label: "Mới", color: "bg-slate-100 text-slate-700 border-slate-200" },
    PENDING_CAPA: { label: "Đang đợi duyệt", color: "bg-amber-100 text-amber-900 border-amber-300" },
    CAPA_OPEN: { label: "Đã duyệt", color: "bg-rose-100 text-rose-800 border-rose-200" },
    CAPA_IN_PROGRESS: { label: "CAPA đang xử lý", color: "bg-sky-100 text-sky-900 border-sky-200" },
    CAPA_CLOSED: { label: "CAPA đóng", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    CAPA_REJECTED: { label: "Từ chối", color: "bg-red-100 text-red-800 border-red-200" },
    INVESTIGATING: { label: "Đang điều tra", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
    CORRECTIVE_ACTION: { label: "Khắc phục", color: "bg-blue-100 text-blue-700 border-blue-200" },
    RESOLVED: { label: "Đã giải quyết", color: "bg-green-100 text-green-700 border-green-200" },
    CLOSED: { label: "Đã đóng", color: "bg-slate-100 text-slate-600 border-slate-200" },
  };

  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
      {/* Header with stats */}
      <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-slate-800">Quản lý Độ lệch CCP</h3>
          <p className="text-sm text-slate-500">Theo dõi và xử lý các độ lệch trong quá trình giám sát</p>
          <p className="mt-1 text-xs text-slate-400">
            Gửi yêu cầu sang{" "}
            <Link href="/capa-management" className="font-medium text-cyan-600 hover:underline">
              Quản lý CAPA
            </Link>{" "}
            để bộ phận khởi tạo hành động khắc phục (NC → CAPA).
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="shrink-0 whitespace-nowrap rounded-lg bg-cyan-50 px-3 py-2 text-sm text-cyan-600 transition-colors hover:bg-cyan-100"
        >
          🔄 Làm mới
        </button>
      </div>

      {/* Stats Cards */}
      {deviationStats && !deviationStatsLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <div className="bg-slate-50 p-3 rounded-lg text-center">
              <p className="text-2xl font-bold text-slate-700">{deviationStats.total}</p>
              <p className="text-xs text-slate-500">Tổng độ lệch</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg text-center">
              <p className="text-2xl font-bold text-slate-600">{deviationStats.pending}</p>
              <p className="text-xs text-slate-500">Đang cần xử lý</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg text-center">
              <p className="text-2xl font-bold text-amber-800">{deviationStats.by_status.PENDING_CAPA || 0}</p>
              <p className="text-xs text-amber-800/80">Đang đợi duyệt</p>
            </div>
            <div className="bg-sky-50 p-3 rounded-lg text-center">
              <p className="text-2xl font-bold text-sky-800">
                {(deviationStats.by_status.CAPA_OPEN || 0) +
                  (deviationStats.by_status.CAPA_IN_PROGRESS || 0)}
              </p>
              <p className="text-xs text-sky-700">Đã duyệt / đang xử lý</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg text-center">
              <p className="text-2xl font-bold text-emerald-700">{deviationStats.by_status.CAPA_CLOSED || 0}</p>
              <p className="text-xs text-emerald-700/90">CAPA đã đóng</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">
            Trạng thái độ lệch đồng bộ với CAPA: <strong>PENDING_CAPA</strong> = đã gửi yêu cầu, đang đợi duyệt;
            <strong> CAPA_OPEN</strong> = đã duyệt / đã khởi tạo CAPA; <strong>CAPA_IN_PROGRESS</strong> = đang xử lý trên bảng CAPA;
            <strong> CAPA_CLOSED</strong> = CAPA hoàn tất. Có thể chỉnh thêm trạng thái nội bộ (điều tra, khắc phục) trong
            &quot;Xử lý&quot;.
          </p>
        </>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-4 p-3 bg-slate-50 rounded-lg">
        {/* <div className="flex flex-wrap gap-3 items-end">
          <select
            value={filters.status || ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, status: (e.target.value as DeviationFilters["status"]) || undefined })
            }
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[160px]"
          >
            <option value="">-- Trạng thái xử lý --</option>
            <option value="NEW">Mới</option>
            <option value="PENDING_CAPA">Đang đợi duyệt</option>
            <option value="CAPA_OPEN">Đã duyệt</option>
            <option value="CAPA_IN_PROGRESS">CAPA đang thực hiện</option>
            <option value="CAPA_CLOSED">CAPA đã đóng</option>
            <option value="CAPA_REJECTED">Từ chối</option>
            <option value="INVESTIGATING">Đang điều tra (nội bộ)</option>
            <option value="CORRECTIVE_ACTION">Khắc phục (nội bộ)</option>
            <option value="RESOLVED">Đã giải quyết</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
          {/* <select
            value={filters.severity || ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, severity: (e.target.value as DeviationFilters["severity"]) || undefined })
            }
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[150px]"
          >
            <option value="">-- Mức độ --</option>
            <option value="CRITICAL">Nghiêm trọng</option>
            <option value="HIGH">Cao</option>
            <option value="MEDIUM">Trung bình</option>
            <option value="LOW">Thấp</option>
          </select> */}
        {/* <select
            value={filters.has_capa_nc || ""}
            onChange={(e) => {
              const v = e.target.value;
              onFiltersChange({
                ...filters,
                has_capa_nc: v === "yes" ? "yes" : v === "no" ? "no" : undefined,
              });
            }}
            className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[180px]"
          >
            <option value="">-- NC / CAPA --</option>
            <option value="no">Chưa gửi CAPA (NC)</option>
            <option value="yes">Đã gửi CAPA (có NC)</option>
          </select>
        </div> */ }
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Lọc theo thời gian</label>
            <div className="flex rounded-lg border border-slate-200 bg-white p-1">
              {[
                { value: "day", label: "Ngày" },
                { value: "month", label: "Tháng" },
                { value: "year", label: "Năm" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setDateFilterMode(opt.value as "day" | "month" | "year");
                    clearDateFilter();
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${dateFilterMode === opt.value
                      ? "bg-cyan-600 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {dateFilterMode === "day" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase">Chọn ngày</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setDayFilter(e.target.value)}
                className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white"
              />
            </div>
          )}

          {dateFilterMode === "month" && (
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Chọn tháng</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setMonthFilter(e.target.value, selectedMonthYear)}
                  className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[130px]"
                >
                  <option value="">Chọn tháng</option>
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Năm</label>
                <select
                  value={selectedMonthYear}
                  onChange={(e) => setMonthFilter(selectedMonth, e.target.value)}
                  className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[110px]"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {dateFilterMode === "year" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-slate-500 uppercase">Chọn năm</label>
              <select
                value={selectedYear}
                onChange={(e) => setYearFilter(e.target.value)}
                className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[120px]"
              >
                <option value="">Tất cả năm</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(filters.recorded_from || filters.recorded_to) && (
            <button
              type="button"
              onClick={clearDateFilter}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-2"
            >
              Xóa thời gian
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Kế hoạch HACCP</label>
            <select
              value={filters.plan_id || ""}
              onChange={(e) => {
                const v = e.target.value || undefined;
                onFiltersChange({
                  ...filters,
                  plan_id: v,
                  ccp_id: undefined,
                });
              }}
              className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[200px]"
            >
              <option value="">Tất cả kế hoạch</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.version})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">CCP</label>
            <select
              value={filters.ccp_id || ""}
              onChange={(e) => onFiltersChange({ ...filters, ccp_id: e.target.value || undefined })}
              className="text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white min-w-[200px]"
            >
              <option value="">Tất cả CCP</option>
              {ccpOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ccp_code} — {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Tìm (lô, ghi chú, CCP)</label>
            <div className="flex gap-2">
              <input
                type="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onFiltersChange({ ...filters, search: searchDraft.trim() || undefined });
                  }
                }}
                placeholder="Nhập và bấm Tìm hoặc Enter..."
                className="flex-1 text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white"
              />
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, search: searchDraft.trim() || undefined })}
                className="text-sm px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 shrink-0"
              >
                Tìm
              </button>
            </div>
          </div>
          {hasPanelFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchDraft("");
                setSelectedDate("");
                setSelectedMonth("");
                setSelectedMonthYear(String(new Date().getFullYear()));
                setSelectedYear("");
                onFiltersChange({});
              }}
              className="text-sm text-slate-500 hover:text-slate-800 px-2 py-2 shrink-0"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
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
              const hasCapaRequest = logIdsWithCapaNc.includes(dev.id);
              const isWaitingApproval = status === "PENDING_CAPA" || (hasCapaRequest && status === "NEW");
              const isApproved = status === "CAPA_OPEN";
              const isCapaInProgress = status === "CAPA_IN_PROGRESS";
              const isCapaClosed = status === "CAPA_CLOSED";
              const isCapaRejected = status === "CAPA_REJECTED";

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
                        <span>👤 Ghi nhận: {dev.recorded_by ? getUserDisplayName(dev.recorded_by) : "—"}</span>
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

                    <div className="flex md:flex-col gap-2 shrink-0">
                      {isWaitingApproval ? (
                        <span className="text-center text-[10px] font-bold text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                          ⏳ Đang đợi duyệt
                        </span>
                      ) : isApproved ? (
                        <span className="text-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                          ✓ Đã duyệt
                        </span>
                      ) : isCapaInProgress ? (
                        <span className="text-center text-[10px] font-bold text-sky-800 bg-sky-50 px-3 py-2 rounded-lg border border-sky-100">
                          ⚙️ Đang xử lý CAPA
                        </span>
                      ) : isCapaClosed ? (
                        <span className="text-center text-[10px] font-bold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                          ✓ CAPA đã đóng
                        </span>
                      ) : isCapaRejected ? (
                        <span className="text-center text-[10px] font-bold text-red-800 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                          ✕ Từ chối
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void sendCapaRequest(dev.id)}
                          disabled={requestingCapaFor === dev.id}
                          className="text-sm bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
                        >
                          {requestingCapaFor === dev.id ? "Đang gửi..." : "⚠️ Gửi CAPA"}
                        </button>
                      )}
                      <Link
                        href="/capa-management"
                        className="text-center text-xs text-cyan-700 bg-cyan-50 px-3 py-2 rounded-lg border border-cyan-100 hover:bg-cyan-100"
                      >
                        Mở CAPA
                      </Link>
                      {/* <button
                        type="button"
                        onClick={() => onHandleDeviation(dev)}
                        className="text-sm bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors"
                      >
                        ⚙️ Xử lý
                      </button> */}
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
  /** Làm mới danh sách/thống kê không đóng modal (sau gửi CAPA). */
  onRefresh?: () => void;
  onSuccess: () => void;
}

function HandleDeviationModal({ isOpen, onClose, deviation, users, onRefresh, onSuccess }: HandleDeviationModalProps) {
  const toast = useToast();
  const { principal } = useAuth();
  const [hasCapaNc, setHasCapaNc] = useState(false);
  const [capaNcBusy, setCapaNcBusy] = useState(false);

  const [formData, setFormData] = useState<{
    deviation_status:
    | "NEW"
    | "PENDING_CAPA"
    | "CAPA_OPEN"
    | "CAPA_IN_PROGRESS"
    | "CAPA_CLOSED"
    | "CAPA_REJECTED"
    | "INVESTIGATING"
    | "CORRECTIVE_ACTION"
    | "RESOLVED"
    | "CLOSED";
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

  useEffect(() => {
    if (!deviation?.id || !principal?.org_id) {
      setHasCapaNc(false);
      return;
    }
    let cancelled = false;
    capaService
      .checkExistingNCs([deviation.id])
      .then((ids) => {
        if (!cancelled) setHasCapaNc(ids.includes(deviation.id));
      })
      .catch(() => {
        if (!cancelled) setHasCapaNc(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviation?.id, principal?.org_id]);

  const sendCapaFromModal = async () => {
    if (!deviation) return;
    setCapaNcBusy(true);
    try {
      const res = await requestDeviationCapaNc(deviation.id);
      setHasCapaNc(true);
      onRefresh?.();
      toast.success(
        res.created
          ? "Đã gửi yêu cầu sang CAPA. Trạng thái độ lệch: đang đợi duyệt."
          : "Đã có yêu cầu CAPA (NC). Trạng thái đã đồng bộ.",
      );
    } catch (e) {
      toast.error((e as Error).message || "Lỗi khi gửi yêu cầu CAPA.");
    } finally {
      setCapaNcBusy(false);
    }
  };

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
    { value: "NEW", label: "🆕 Mới (chưa vào CAPA)" },
    { value: "PENDING_CAPA", label: "⏳ Đang đợi duyệt" },
    { value: "CAPA_OPEN", label: "✅ Đã duyệt" },
    { value: "CAPA_IN_PROGRESS", label: "⚙️ CAPA đang thực hiện" },
    { value: "CAPA_CLOSED", label: "✔️ CAPA đã đóng" },
    { value: "CAPA_REJECTED", label: "✕ Từ chối" },
    { value: "INVESTIGATING", label: "🔍 Đang điều tra (nội bộ)" },
    { value: "CORRECTIVE_ACTION", label: "🔧 Khắc phục (nội bộ)" },
    { value: "RESOLVED", label: "✅ Đã giải quyết" },
    { value: "CLOSED", label: "📋 Đã đóng" },
  ];

  const severityOptions = [
    { value: 'CRITICAL', label: '🔴 Nghiêm trọng' },
    { value: 'HIGH', label: '🟠 Cao' },
    { value: 'MEDIUM', label: '🟡 Trung bình' },
    { value: 'LOW', label: '🔵 Thấp' }
  ];

  if (!isOpen || !deviation) return null;

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

        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 space-y-2">
          <p className="text-sm font-semibold text-amber-900">Gửi sang module CAPA</p>
          <p className="text-xs text-amber-800/90">
            Tạo yêu cầu không phù hợp (NC) nguồn HACCP để đội CAPA khởi tạo hành động xử lý.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            {hasCapaNc ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-1 rounded border border-emerald-100">
                ✓ Đã có yêu cầu CAPA
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void sendCapaFromModal()}
                disabled={capaNcBusy}
                className="text-xs font-bold bg-rose-600 text-white px-3 py-1.5 rounded-md hover:bg-rose-700 disabled:opacity-50"
              >
                {capaNcBusy ? "Đang gửi..." : "⚠️ Gửi yêu cầu CAPA"}
              </button>
            )}
            <Link
              href="/capa-management"
              className="text-xs font-medium text-cyan-700 hover:underline"
            >
              Mở Quản lý CAPA →
            </Link>
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
  plan: { id: string; version: string; name: string; scope?: string; product_id?: string } | null;
  onSuccess: () => void;
}

function CreateVersionModal({ isOpen, onClose, plan, onSuccess, locations, locationsLoading }: CreateVersionModalProps & { locations: Location[], locationsLoading: boolean }) {
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
              <select
                value={planScope}
                onChange={(e) => setPlanScope(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                disabled={locationsLoading}
              >
                <option value="">{locationsLoading ? "-- Đang tải danh sách khu vực... --" : "-- Chọn phạm vi áp dụng --"}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
                {/* Fallback option if current scope is not in locations */}
                {planScope && !locations.some(l => l.name === planScope) && (
                  <option value={planScope}>{planScope}</option>
                )}
              </select>
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
// STEP DETAIL MODAL
// ============================================================================
function StepDetailModal({
  isOpen,
  onClose,
  step,
  allCcps,
}: {
  isOpen: boolean;
  onClose: () => void;
  step: ProcessStep | null;
  allCcps: CCP[];
}) {
  const { hazards, loading: hazardsLoading } = useHazards(step?.id ?? null);
  const ccp = useMemo(() => allCcps.find(c => c.step_id === step?.id) ?? null, [allCcps, step]);

  if (!step) return null;

  const stepTypeLabel: Record<string, string> = {
    RECEIVING: "Tiếp nhận",
    PROCESSING: "Chế biến",
    PACKAGING: "Đóng gói",
    STORAGE: "Lưu kho",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết công đoạn: ${step.name}`} maxWidth="3xl">
      <div className="space-y-5 pb-2">
        {/* ── Basic info ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Thông tin cơ bản</h4>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Thứ tự:</span>
              <span className="font-semibold text-slate-700">Bước {step.step_order}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Loại công đoạn:</span>
              <span className="font-semibold text-slate-700">{stepTypeLabel[step.step_type ?? ""] || step.step_type || "—"}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-slate-500">Phân loại:</span>
              {step.is_ccp ? (
                <span className="px-2 py-0.5 rounded-lg bg-orange-100 text-orange-700 text-[10px] font-bold uppercase">CCP – Kiểm soát tới hạn</span>
              ) : (
                <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">Công đoạn thường</span>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Mô tả</h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              {step.description || <span className="italic text-slate-400">Chưa có mô tả chi tiết.</span>}
            </p>
          </div>
        </div>

        {/* ── CCP detail ── */}
        {ccp && (
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 border border-orange-200 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-xl bg-orange-500 text-white text-xs font-black shadow-sm">{ccp.ccp_code}</span>
              <h4 className="font-bold text-orange-900">Điểm kiểm soát tới hạn (CCP)</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase text-orange-400 mb-1">Giới hạn tới hạn (CL)</p>
                <p className="bg-white rounded-xl p-3 border border-orange-100 font-medium text-orange-900">{ccp.critical_limit || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-orange-400 mb-1">Phương pháp giám sát</p>
                <p className="bg-white rounded-xl p-3 border border-orange-100 text-orange-800">{ccp.monitoring_method || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-orange-400 mb-1">Người chịu trách nhiệm</p>
                <p className="text-orange-800 font-medium">{ccp.responsible_user || "—"}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Hazard analysis ── */}
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-bold text-slate-800 text-sm">Phân tích mối nguy</h4>
            <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{hazards.length} mối nguy</span>
          </div>
          {hazardsLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Đang tải...</div>
          ) : hazards.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm italic">Chưa có phân tích mối nguy cho công đoạn này.</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/60 text-[11px] uppercase text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 font-bold">Mối nguy</th>
                  <th className="px-4 py-2 font-bold">Loại</th>
                  <th className="px-4 py-2 font-bold">Điểm rủi ro</th>
                  <th className="px-4 py-2 font-bold">Biện pháp kiểm soát</th>
                  <th className="px-4 py-2 font-bold text-center">Đáng kể?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {hazards.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">{h.hazard_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-bold ${h.hazard_type === "BIOLOGICAL" ? "bg-orange-500" :
                        h.hazard_type === "CHEMICAL" ? "bg-emerald-500" : "bg-blue-500"
                        }`}>
                        {h.hazard_type === "BIOLOGICAL" ? "Sinh học" : h.hazard_type === "CHEMICAL" ? "Hóa học" : "Vật lý"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${h.risk_score >= 12 ? "text-red-600" : h.risk_score >= 6 ? "text-amber-600" : "text-slate-500"}`}>
                        {h.risk_score ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{h.control_measure || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {h.is_significant
                        ? <span className="text-red-500 font-bold">CÓ</span>
                        : <span className="text-slate-300">Không</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================================
// HELPER COMPONENTS FOR SCHEDULING
// =============================================================================

interface HaccpScheduleModalProps {
  locations: Location[];
  plans: HaccpPlan[];
  /** Chọn sẵn quy trình (ví dụ từ tab Danh sách kế hoạch); null = mặc định kế hoạch đầu danh sách */
  initialPlanId?: string | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

function HaccpScheduleModal({ locations, plans, initialPlanId = null, onClose, onSuccess }: HaccpScheduleModalProps) {
  const toast = useToast();
  const { principal } = useAuth();
  const orgId = principal?.org_id;

  const resolvedInitialPlanId = useMemo(() => {
    if (initialPlanId && plans.some((p) => p.id === initialPlanId)) return initialPlanId;
    return plans[0]?.id ?? "";
  }, [initialPlanId, plans]);

  const [selectedLocation, setSelectedLocation] = useState(locations[0]?.id || "");
  const [selectedPlan, setSelectedPlan] = useState(resolvedInitialPlanId);

  useEffect(() => {
    setSelectedPlan(resolvedInitialPlanId);
  }, [resolvedInitialPlanId]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  /** Giờ bắt đầu / kết thúc khung kiểm tra (VN, HH:MM) */
  const [assessmentTimeLocal, setAssessmentTimeLocal] = useState("09:00");
  const [assessmentEndTimeLocal, setAssessmentEndTimeLocal] = useState("11:00");
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState("ONCE");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!orgId) {
      toast.error("Không tìm thấy thông tin tổ chức.");
      return;
    }
    if (!selectedPlan) {
      toast.error("Vui lòng chọn kế hoạch HACCP.");
      return;
    }
    if (assessmentEndTimeLocal <= assessmentTimeLocal) {
      toast.error("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }
    try {
      setLoading(true);
      const payload = {
        org_id: orgId,
        haccp_plan_id: selectedPlan,
        location_id: selectedLocation,
        start_date: startDate,
        assessment_time_local: assessmentTimeLocal,
        assessment_end_time_local: assessmentEndTimeLocal,
        end_date: endDate || null,
        frequency,
        day_of_week: frequency === "WEEKLY" ? dayOfWeek : null,
        day_of_month: frequency === "MONTHLY" ? dayOfMonth : null,
        title: title || undefined,
        description: description || undefined,
      };

      const result = await createHaccpSchedule(payload);
      if (!result.count) {
        toast.error(
          "Không tạo được sự kiện lịch. Kiểm tra ngày bắt đầu, ngày kết thúc và tần suất (lặp lại cần có ngày kết thúc).",
        );
        return;
      }
      toast.success(result.message || `Đã lập ${result.count} sự kiện lịch.`);
      await Promise.resolve(onSuccess());
    } catch (error) {
      console.error("Failed to create schedule:", error);
      toast.error("Lỗi khi tạo lịch đánh giá.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-amber-500 text-white">
          <h2 className="text-xl font-bold">Lập lịch Đánh giá HACCP</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Tiêu đề (Tùy chọn)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Đánh giá định kỳ tháng 5"
              className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Kế hoạch HACCP</label>
              <select
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
              >
                <option value="">-- Chọn kế hoạch --</option>
                {plans.map((p: HaccpPlan) => (
                  <option key={p.id} value={p.id}>{p.name} (v{p.version})</option>
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
                <option value="">-- Chọn khu vực --</option>
                {locations.map((loc: Location) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Ngày bắt đầu</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Giờ bắt đầu (VN)</label>
              <input
                type="time"
                step={60}
                value={assessmentTimeLocal}
                onChange={(e) => setAssessmentTimeLocal(e.target.value)}
                className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1 max-w-xs">
            <label className="text-xs font-bold text-slate-500 uppercase">Giờ kết thúc (VN)</label>
            <input
              type="time"
              step={60}
              value={assessmentEndTimeLocal}
              onChange={(e) => setAssessmentEndTimeLocal(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
            />
            <p className="text-[10px] text-slate-400 leading-snug">
              Múi Asia/Ho_Chi_Minh. Có thể tạo phiếu trước; điền và gửi từ giờ bắt đầu. Gửi trong khung → hoàn thành, sau giờ kết thúc → quá hạn.
            </p>
          </div>

          <div className="space-y-1 max-w-md">
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

          {frequency !== "ONCE" && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Ngày kết thúc</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
                />
              </div>

              {frequency === "WEEKLY" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Thứ trong tuần</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(Number(e.target.value))}
                    className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
                  >
                    <option value={0}>Thứ Hai</option>
                    <option value={1}>Thứ Ba</option>
                    <option value={2}>Thứ Tư</option>
                    <option value={3}>Thứ Năm</option>
                    <option value={4}>Thứ Sáu</option>
                    <option value={5}>Thứ Bảy</option>
                    <option value={6}>Chủ Nhật</option>
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
                    onChange={(e) => setDayOfMonth(Number(e.target.value))}
                    className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Ghi chú</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-slate-300 text-sm focus:ring-amber-500"
              placeholder="Nhập ghi chú cho đợt đánh giá..."
            />
          </div>
        </div>

        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-amber-500 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all disabled:opacity-50"
          >
            {loading ? "Đang xử lý..." : "Lưu lịch trình"}
          </button>
        </div>
      </div>
    </div>
  );
}

function scheduleNotesFromDescription(description: string | null): string {
  if (!description?.trim()) return "Không có ghi chú";
  try {
    const j = JSON.parse(description) as { notes?: string };
    if (j && typeof j === "object" && j.notes != null && String(j.notes).trim()) return String(j.notes);
  } catch {
    /* ignore */
  }
  return description.length > 240 ? `${description.slice(0, 240)}…` : description;
}

function HaccpScheduleManagementModal({
  onClose,
  onSchedulesChanged,
}: {
  onClose: () => void;
  onSchedulesChanged?: () => void;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<string>("");
  const statusQuery = filter === "" ? null : filter;
  const { schedules, loading, refetch } = useHaccpSchedules(statusQuery);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (eventId: string, schedule?: HaccpSchedule) => {
    if (schedule?.can_delete === false) return;
    const batchHint = schedule?.schedule_batch_id
      ? " Sẽ xóa toàn bộ lịch cùng một lần lập (trừ lịch quá hạn hoặc đã hoàn thành)."
      : "";
    if (!window.confirm(`Xóa lịch đánh giá này?${batchHint} Hành động không hoàn tác.`)) return;
    setDeletingId(eventId);
    try {
      const result = await deleteHaccpSchedule(eventId);
      let msg =
        result.deleted_count > 1
          ? `Đã xóa ${result.deleted_count} lịch cùng loạt.`
          : "Đã xóa lịch.";
      if (result.skipped_locked_count > 0) {
        msg += ` Giữ lại ${result.skipped_locked_count} lịch quá hạn/đã hoàn thành.`;
      }
      toast.success(msg);
      await refetch();
      onSchedulesChanged?.();
    } catch (e) {
      console.error(e);
      const err = e as { message?: string };
      toast.error(err.message || "Không xóa được lịch. Thử lại sau.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[min(90vh,800px)] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b bg-slate-800 p-6 text-white">
          <div className="min-w-0 pr-4">
            <h2 className="text-xl font-bold">Quản lý Lịch đánh giá HACCP</h2>
            <p className="mt-1 text-xs text-slate-400">
              Sắp tới = trong khung hoặc chưa quá giờ kết thúc · Quá hạn = qua giờ kết thúc · Hoàn thành = đã gửi đúng hạn.
              Chỉ xóa được lịch «Sắp tới»; xóa một mục có thể xóa cả loạt lịch vừa lập.
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-2xl text-white/80 hover:text-white" aria-label="Đóng">
            &times;
          </button>
        </div>

        <div className="shrink-0 border-b bg-slate-50 p-4">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Tất cả", value: "" },
              { label: "Sắp tới", value: "SCHEDULED" },
              { label: "Quá hạn", value: "OVERDUE" },
              { label: "Hoàn thành", value: "COMPLETED" },
            ].map((opt) => (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => setFilter(opt.value)}
                disabled={loading}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all disabled:opacity-60 ${filter === opt.value
                    ? "bg-slate-800 text-white shadow-md"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-200"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto p-6"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#64748b #f1f5f9" }}
        >
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-slate-800" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <div className="mb-4 text-5xl">📅</div>
              <p className="text-sm">
                {filter === ""
                  ? "Chưa có lịch đánh giá nào được tạo."
                  : "Không có lịch trong nhóm này."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {schedules.map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-100 bg-white p-4 transition-all hover:shadow-md">
                  <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase ${s.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700"
                          : s.status === "OVERDUE"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                    >
                      {s.status === "COMPLETED"
                        ? "Hoàn thành"
                        : s.status === "OVERDUE"
                          ? "Quá hạn"
                          : "Sắp tới"}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-400">
                      {formatHaccpScheduleWindow(s)}
                    </span>
                  </div>
                  <h3 className="mb-1 font-bold text-slate-800">{s.title}</h3>
                  <p className="mb-3 line-clamp-3 text-xs text-slate-500">{scheduleNotesFromDescription(s.description)}</p>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-50 pt-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                        ?
                      </div>
                      <span className="truncate text-[10px] font-medium text-slate-400">Chưa phân công</span>
                    </div>
                    <button
                      type="button"
                      disabled={deletingId === s.id || s.can_delete === false}
                      title={
                        s.can_delete === false
                          ? "Không xóa lịch quá hạn hoặc đã hoàn thành"
                          : s.schedule_batch_id
                            ? "Xóa lịch này và các lịch cùng loạt (trừ quá hạn/hoàn thành)"
                            : undefined
                      }
                      onClick={() => void handleDelete(s.id, s)}
                      className="shrink-0 text-[10px] font-bold uppercase text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingId === s.id ? "Đang xóa…" : "Xóa lịch"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
