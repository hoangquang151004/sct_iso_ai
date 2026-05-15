import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/api/api-client";
import { HaccpPlan, ProcessStep, CCP, HazardAnalysis, CCPMonitoringLog, HaccpVerification, HaccpAssessment, HaccpAssessmentItem } from "@/lib/types";

// ============================================================================
// HACCP PLAN HOOKS
// ============================================================================
export function useHaccpPlans() {
  const [plans, setPlans] = useState<HaccpPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch<HaccpPlan[]>("/haccp/plans");
      setPlans(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return { plans, loading, error, refetch: fetchPlans };
}

// ============================================================================
// PROCESS STEP HOOKS
// ============================================================================
export function useProcessSteps(planId: string | null) {
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSteps = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      const data = await apiFetch<ProcessStep[]>(`/haccp/plans/${planId}/steps`);
      setSteps(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  return { steps, loading, error, refetch: fetchSteps };
}

// ============================================================================
// HAZARD ANALYSIS HOOKS
// ============================================================================
export function useHazards(stepId: string | null) {
  const [hazards, setHazards] = useState<HazardAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchHazards = useCallback(async () => {
    if (!stepId) return;
    try {
      setLoading(true);
      const data = await apiFetch<HazardAnalysis[]>(`/haccp/steps/${stepId}/hazards`);
      setHazards(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [stepId]);

  useEffect(() => {
    fetchHazards();
  }, [fetchHazards]);

  return { hazards, loading, error, refetch: fetchHazards };
}

// ============================================================================
// CCP HOOKS
// ============================================================================
export function useCCPs(planId: string | null) {
  const [ccps, setCcps] = useState<CCP[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCcps = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      const data = await apiFetch<CCP[]>(`/haccp/plans/${planId}/ccps`);
      setCcps(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchCcps();
  }, [fetchCcps]);

  return { ccps, loading, error, refetch: fetchCcps };
}

// ============================================================================
// CCP LOGS HOOKS
// ============================================================================
export function useCCPLogs(ccpId: string | null) {
  const [logs, setLogs] = useState<CCPMonitoringLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!ccpId) return;
    try {
      setLoading(true);
      const data = await apiFetch<CCPMonitoringLog[]>(`/haccp/ccps/${ccpId}/logs`);
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [ccpId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}

// ============================================================================
// ALL CCP LOGS HOOK (Tổng hợp toàn bộ nhật ký)
// ============================================================================
export function useAllCCPLogs(planId: string | null, enabled: boolean = true) {
  const [logs, setLogs] = useState<CCPMonitoringLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllLogs = useCallback(async () => {
    try {
      setLoading(true);
      // Gọi endpoint tổng hợp /haccp/logs — hỗ trợ lọc theo plan hoặc lấy tất cả
      const url = planId
        ? `/haccp/logs?plan_id=${planId}&limit=500`
        : `/haccp/logs?limit=500`;
      const data = await apiFetch<CCPMonitoringLog[]>(url);
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (!enabled) {
      setLogs([]);
      setLoading(false);
      return;
    }
    void fetchAllLogs();
  }, [fetchAllLogs, enabled]);

  return { logs, loading, error, refetch: fetchAllLogs };
}

// ============================================================================
// DEVIATIONS HOOK
// ============================================================================
export type DeviationWorkflowStatus =
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

export interface DeviationFilters {
  status?: DeviationWorkflowStatus;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Lọc theo kế hoạch HACCP */
  plan_id?: string;
  /** Lọc theo CCP */
  ccp_id?: string;
  /** Tìm theo lô, ghi chú, tên/mã CCP */
  search?: string;
  /** Đã tạo NC gửi CAPA / chưa */
  has_capa_nc?: 'yes' | 'no';
  /** Lọc từ ngày ghi nhận (YYYY-MM-DD), theo recorded_at */
  recorded_from?: string;
  /** Lọc đến ngày ghi nhận (YYYY-MM-DD), bao gồm cả ngày */
  recorded_to?: string;
}

export function useDeviations(filters?: DeviationFilters, enabled: boolean = true) {
  const [deviations, setDeviations] = useState<CCPMonitoringLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDeviations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "500");
      params.set("_ts", String(Date.now()));
      if (filters?.status) {
        params.set("status", filters.status);
      }
      if (filters?.severity) {
        params.set("severity", filters.severity);
      }
      if (filters?.plan_id) {
        params.set("plan_id", filters.plan_id);
      }
      if (filters?.ccp_id) {
        params.set("ccp_id", filters.ccp_id);
      }
      if (filters?.search?.trim()) {
        params.set("search", filters.search.trim());
      }
      if (filters?.has_capa_nc === "yes") {
        params.set("has_capa_nc", "true");
      } else if (filters?.has_capa_nc === "no") {
        params.set("has_capa_nc", "false");
      }
      if (filters?.recorded_from?.trim()) {
        params.set("recorded_from", filters.recorded_from.trim());
      }
      if (filters?.recorded_to?.trim()) {
        params.set("recorded_to", filters.recorded_to.trim());
      }
      const data = await apiFetch<CCPMonitoringLog[]>(`/haccp/deviations?${params.toString()}`);
      setDeviations(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [
    filters?.status,
    filters?.severity,
    filters?.plan_id,
    filters?.ccp_id,
    filters?.search,
    filters?.has_capa_nc,
    filters?.recorded_from,
    filters?.recorded_to,
  ]);

  useEffect(() => {
    if (!enabled) {
      setDeviations([]);
      setLoading(false);
      return;
    }
    void fetchDeviations();
  }, [fetchDeviations, enabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const refetchWhenVisible = () => {
      if (document.visibilityState !== "hidden") {
        void fetchDeviations();
      }
    };

    window.addEventListener("focus", refetchWhenVisible);
    window.addEventListener("pageshow", refetchWhenVisible);
    document.addEventListener("visibilitychange", refetchWhenVisible);
    return () => {
      window.removeEventListener("focus", refetchWhenVisible);
      window.removeEventListener("pageshow", refetchWhenVisible);
      document.removeEventListener("visibilitychange", refetchWhenVisible);
    };
  }, [fetchDeviations, enabled]);

  return { deviations, loading, error, refetch: fetchDeviations };
}

// ============================================================================
// DEVIATION STATS HOOK
// ============================================================================
export interface DeviationStats {
  by_status: Record<string, number>;
  by_severity: Record<string, number>;
  total: number;
  pending: number;
}

export function useDeviationStats(filters?: DeviationFilters, enabled: boolean = true) {
  const [stats, setStats] = useState<DeviationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("_ts", String(Date.now()));
      if (filters?.recorded_from?.trim()) {
        params.set("recorded_from", filters.recorded_from.trim());
      }
      if (filters?.recorded_to?.trim()) {
        params.set("recorded_to", filters.recorded_to.trim());
      }
      const qs = params.toString();
      const data = await apiFetch<DeviationStats>(
        qs ? `/haccp/deviations/stats?${qs}` : "/haccp/deviations/stats",
      );
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters?.recorded_from, filters?.recorded_to]);

  useEffect(() => {
    if (!enabled) {
      setStats(null);
      setLoading(false);
      return;
    }
    void fetchStats();
  }, [fetchStats, enabled]);

  return { stats, loading, error, refetch: fetchStats };
}

// ============================================================================
// HANDLE DEVIATION HOOK (for mutation)
// ============================================================================
export interface HandleDeviationPayload {
  deviation_status: DeviationWorkflowStatus;
  deviation_severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  corrective_action?: string;
  root_cause?: string;
  resolution_note?: string;
  handled_by?: string;
}

export async function handleDeviation(logId: string, payload: HandleDeviationPayload): Promise<CCPMonitoringLog> {
  return apiFetch<CCPMonitoringLog>(`/haccp/deviations/${logId}/handle`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/** Gửi độ lệch CCP sang hàng đợi NC/CAPA (idempotent nếu NC đã tồn tại). */
export interface DeviationCapaNcResult {
  nc_id: string;
  created: boolean;
  title: string;
  status: string;
}

export async function requestDeviationCapaNc(logId: string): Promise<DeviationCapaNcResult> {
  return apiFetch<DeviationCapaNcResult>(`/haccp/deviations/${logId}/capa-nc`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ============================================================================
// HACCP PLAN VERSION HOOKS
// ============================================================================
export interface HaccpPlanVersion {
  id: string;
  plan_id: string;
  version: string;
  name: string;
  scope: string | null;
  product_id: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
}

export function useHaccpPlanVersions(planId: string | null) {
  const [versions, setVersions] = useState<HaccpPlanVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      const data = await apiFetch<HaccpPlanVersion[]>(`/haccp/plans/${planId}/versions`);
      setVersions(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return { versions, loading, error, refetch: fetchVersions };
}

export interface CreateNewVersionPayload {
  new_version: string;
  updated_by?: string;
  name?: string;
  scope?: string;
  product_id?: string;
}

export async function createNewVersion(planId: string, payload: CreateNewVersionPayload): Promise<HaccpPlan> {
  return apiFetch<HaccpPlan>(`/haccp/plans/${planId}/versions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ============================================================================
// HACCP VERIFICATIONS HOOK
// ============================================================================
export function useHaccpVerifications(planId: string | null) {
  const [verifications, setVerifications] = useState<HaccpVerification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchVerifications = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      const data = await apiFetch<HaccpVerification[]>(`/haccp/plans/${planId}/verifications`);
      setVerifications(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  return { verifications, loading, error, refetch: fetchVerifications };
}

// ============================================================================
// ALL PROCESS STEPS WITH HAZARDS HOOK - For comprehensive hazard analysis
// ============================================================================
export interface ProcessStepWithPlan extends ProcessStep {
  plan_id: string;
  plan_name: string;
  hazards?: HazardAnalysis[];
}

export function useAllProcessStepsWithHazards(enabled: boolean = true) {
  const [allStepsWithHazards, setAllStepsWithHazards] = useState<ProcessStepWithPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);

      const plans = await apiFetch<HaccpPlan[]>("/haccp/plans");

      const allStepsData: ProcessStepWithPlan[] = [];

      for (const plan of plans) {
        try {
          const steps = await apiFetch<ProcessStep[]>(`/haccp/plans/${plan.id}/steps`);

          const withHazards = await Promise.all(
            steps.map(async (step) => {
              try {
                const hazards = await apiFetch<HazardAnalysis[]>(`/haccp/steps/${step.id}/hazards`);
                return {
                  ...step,
                  plan_id: plan.id,
                  plan_name: plan.name,
                  hazards: hazards || [],
                } as ProcessStepWithPlan;
              } catch {
                return {
                  ...step,
                  plan_id: plan.id,
                  plan_name: plan.name,
                  hazards: [],
                } as ProcessStepWithPlan;
              }
            }),
          );
          allStepsData.push(...withHazards);
        } catch {
          // Skip failed plans
        }
      }

      setAllStepsWithHazards(allStepsData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAllStepsWithHazards([]);
      setLoading(false);
      return;
    }
    void fetchAllData();
  }, [fetchAllData, enabled]);

  return { allStepsWithHazards, loading, error, refetch: fetchAllData };
}

// ============================================================================
// ALL CCPS HOOK - Fetch CCPs from all plans
// ============================================================================
export function useAllCCPs(enabled: boolean = true) {
  const [allCcps, setAllCcps] = useState<CCP[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllCcps = useCallback(async () => {
    try {
      setLoading(true);

      const plans = await apiFetch<HaccpPlan[]>("/haccp/plans");

      const ccpLists = await Promise.all(
        plans.map(async (plan) => {
          try {
            return await apiFetch<CCP[]>(`/haccp/plans/${plan.id}/ccps`);
          } catch {
            return [];
          }
        }),
      );

      setAllCcps(ccpLists.flat());
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setAllCcps([]);
      setLoading(false);
      return;
    }
    void fetchAllCcps();
  }, [fetchAllCcps, enabled]);

  return { allCcps, loading, error, refetch: fetchAllCcps };
}

// ============================================================================
// HACCP ASSESSMENT HOOKS (Phiếu đánh giá HACCP)
// ============================================================================
export type CreateAssessmentPayload = {
  haccp_plan_id: string;
  /** Lịch đánh giá (HACCP_ASSESSMENT); phải cùng kế hoạch với haccp_plan_id. */
  calendar_event_id: string;
  title: string;
  assessment_date?: string;
  overall_result?: string;
  overall_note?: string;
  items: {
    item_type: "PROCESS_STEP" | "CCP" | "GENERAL";
    ref_id?: string;
    question: string;
    expected_value?: string;
    actual_value?: string;
    result?: string;
    note?: string;
    evidence_url?: string;
    order_index: number;
  }[];
};

export type SubmitAssessmentPayload = {
  overall_result: "PASS" | "FAIL" | "NEEDS_IMPROVEMENT";
  overall_note?: string;
};

export type SubmitAssessmentResult = HaccpAssessment & {
  deviations_created?: number;
};

export type AddAssessmentManualItemPayload = {
  question: string;
  expected_value?: string | null;
  item_type?: "GENERAL" | "PROCESS_STEP" | "CCP";
  ref_id?: string | null;
};

export function useHaccpAssessments(
  haccp_plan_id: string | null = null,
  status: string | null = null,
  enabled: boolean = true,
) {
  const [assessments, setAssessments] = useState<HaccpAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssessments = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (haccp_plan_id) params.append("haccp_plan_id", haccp_plan_id);
      if (status) params.append("status", status);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch<HaccpAssessment[]>(`/haccp/assessments${qs}`);
      setAssessments(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [haccp_plan_id, status, enabled]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  return { assessments, loading, error, refetch: fetchAssessments };
}

export function useHaccpAssessment(assessmentId: string | null) {
  const [assessment, setAssessment] = useState<HaccpAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssessment = useCallback(async () => {
    if (!assessmentId) return;
    try {
      setLoading(true);
      const data = await apiFetch<HaccpAssessment>(`/haccp/assessments/${assessmentId}`);
      setAssessment(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  return { assessment, loading, error, refetch: fetchAssessment };
}

export async function createAssessment(payload: CreateAssessmentPayload): Promise<HaccpAssessment> {
  return apiFetch<HaccpAssessment>("/haccp/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function submitAssessment(
  assessmentId: string,
  payload: SubmitAssessmentPayload,
): Promise<SubmitAssessmentResult> {
  return apiFetch<SubmitAssessmentResult>(`/haccp/assessments/${assessmentId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateAssessmentItem(
  itemId: string,
  payload: Partial<HaccpAssessmentItem>,
): Promise<HaccpAssessmentItem> {
  return apiFetch<HaccpAssessmentItem>(`/haccp/assessment-items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function addAssessmentManualItem(
  assessmentId: string,
  payload: AddAssessmentManualItemPayload,
): Promise<HaccpAssessmentItem> {
  return apiFetch<HaccpAssessmentItem>(`/haccp/assessments/${assessmentId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: payload.question,
      expected_value: payload.expected_value ?? undefined,
      item_type: payload.item_type ?? "GENERAL",
      ref_id: payload.ref_id ?? undefined,
    }),
  });
}

export async function deleteAssessmentItem(itemId: string): Promise<void> {
  await apiFetch(`/haccp/assessment-items/${itemId}`, { method: "DELETE" });
}

export async function updateAssessment(
  assessmentId: string,
  payload: Partial<HaccpAssessment>,
): Promise<HaccpAssessment> {
  return apiFetch<HaccpAssessment>(`/haccp/assessments/${assessmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteAssessment(assessmentId: string): Promise<void> {
  await apiFetch(`/haccp/assessments/${assessmentId}`, { method: "DELETE" });
}

// ============================================================================
// HACCP SCHEDULING HOOKS
// ============================================================================
export interface HaccpSchedule {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  status: string;
  assigned_to: string | null;
  /** Kế hoạch HACCP gắn với lịch (từ API). */
  haccp_plan_id?: string | null;
  plan_name?: string | null;
  schedule_batch_id?: string | null;
  can_delete?: boolean;
}

export function isHaccpScheduleAssessmentReady(schedule: HaccpSchedule): boolean {
  return new Date(schedule.start_time).getTime() <= Date.now();
}

export function formatHaccpScheduleWindow(schedule: HaccpSchedule): string {
  const start = new Date(schedule.start_time).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!schedule.end_time) return start;
  const end = new Date(schedule.end_time).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${start} – ${end}`;
}

export function useHaccpSchedules(status: string | null = null, enabled: boolean = true) {
  const [schedules, setSchedules] = useState<HaccpSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSchedules = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      params.set("limit", "250");
      const qs = `?${params.toString()}`;
      const data = await apiFetch<HaccpSchedule[]>(`/haccp/plans/schedules${qs}`);
      setSchedules(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [status, enabled]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return { schedules, loading, error, refetch: fetchSchedules };
}

export function useUpcomingHaccpSchedules(enabled: boolean = true) {
  const [upcomingSchedules, setUpcomingSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUpcoming = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const data = await apiFetch<any[]>("/haccp/plans/upcoming-schedules");
      setUpcomingSchedules(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  return { upcomingSchedules, loading, error, refetch: fetchUpcoming };
}

export async function createHaccpSchedule(payload: any): Promise<{ message: string; count: number }> {
  return apiFetch<{ message: string; count: number }>("/haccp/plans/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteHaccpSchedule(
  eventId: string,
): Promise<{ deleted_count: number; skipped_locked_count: number }> {
  return apiFetch<{ deleted_count: number; skipped_locked_count: number }>(
    `/haccp/plans/schedules/${eventId}`,
    {
      method: "DELETE",
    },
  );
}
