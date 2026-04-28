import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api-client";
import { HaccpPlan, ProcessStep, CCP, HazardAnalysis, CCPMonitoringLog, HaccpVerification } from "../types";

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
// ALL CCP LOGS FOR PLAN HOOK
// ============================================================================
export function useAllCCPLogs(planId: string | null) {
  const [logs, setLogs] = useState<CCPMonitoringLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllLogs = useCallback(async () => {
    if (!planId) return;
    try {
      setLoading(true);
      // Get all CCPs first, then fetch logs for each
      const ccps = await apiFetch<CCP[]>(`/haccp/plans/${planId}/ccps`);
      const allLogs: CCPMonitoringLog[] = [];
      for (const ccp of ccps) {
        const logs = await apiFetch<CCPMonitoringLog[]>(`/haccp/ccps/${ccp.id}/logs?limit=100`);
        allLogs.push(...logs);
      }
      setLogs(allLogs.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()));
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchAllLogs();
  }, [fetchAllLogs]);

  return { logs, loading, error, refetch: fetchAllLogs };
}

// ============================================================================
// DEVIATIONS HOOK
// ============================================================================
export interface DeviationFilters {
  status?: 'NEW' | 'INVESTIGATING' | 'CORRECTIVE_ACTION' | 'RESOLVED' | 'CLOSED';
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export function useDeviations(orgId: string | null, filters?: DeviationFilters) {
  const [deviations, setDeviations] = useState<CCPMonitoringLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDeviations = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('limit', '500');
      if (orgId) {
        params.set('org_id', orgId);
      }
      if (filters?.status) {
        params.set('status', filters.status);
      }
      if (filters?.severity) {
        params.set('severity', filters.severity);
      }
      const data = await apiFetch<CCPMonitoringLog[]>(`/haccp/deviations?${params.toString()}`);
      setDeviations(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orgId, filters?.status, filters?.severity]);

  useEffect(() => {
    fetchDeviations();
  }, [fetchDeviations]);

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

export function useDeviationStats(orgId: string | null) {
  const [stats, setStats] = useState<DeviationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (orgId) {
        params.set('org_id', orgId);
      }
      const data = await apiFetch<DeviationStats>(`/haccp/deviations/stats?${params.toString()}`);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// ============================================================================
// HANDLE DEVIATION HOOK (for mutation)
// ============================================================================
export interface HandleDeviationPayload {
  deviation_status: 'NEW' | 'INVESTIGATING' | 'CORRECTIVE_ACTION' | 'RESOLVED' | 'CLOSED';
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

export function useAllProcessStepsWithHazards() {
  const [allStepsWithHazards, setAllStepsWithHazards] = useState<ProcessStepWithPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Lấy tất cả kế hoạch HACCP
      const plans = await apiFetch<HaccpPlan[]>("/haccp/plans");
      
      // 2. Với mỗi kế hoạch, lấy các công đoạn và mối nguy
      const allStepsData: ProcessStepWithPlan[] = [];
      
      for (const plan of plans) {
        try {
          // Lấy công đoạn của kế hoạch này
          const steps = await apiFetch<ProcessStep[]>(`/haccp/plans/${plan.id}/steps`);
          
          // Với mỗi công đoạn, lấy mối nguy
          for (const step of steps) {
            try {
              const hazards = await apiFetch<HazardAnalysis[]>(`/haccp/steps/${step.id}/hazards`);
              allStepsData.push({
                ...step,
                plan_id: plan.id,
                plan_name: plan.name,
                hazards: hazards || []
              });
            } catch {
              // Nếu lỗi, vẫn thêm công đoạn nhưng không có mối nguy
              allStepsData.push({
                ...step,
                plan_id: plan.id,
                plan_name: plan.name,
                hazards: []
              });
            }
          }
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
    fetchAllData();
  }, [fetchAllData]);

  return { allStepsWithHazards, loading, error, refetch: fetchAllData };
}

// ============================================================================
// ALL CCPS HOOK - Fetch CCPs from all plans
// ============================================================================
export function useAllCCPs() {
  const [allCcps, setAllCcps] = useState<CCP[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAllCcps = useCallback(async () => {
    try {
      setLoading(true);
      
      // Lấy tất cả các kế hoạch
      const plans = await apiFetch<HaccpPlan[]>("/haccp/plans");
      
      const allCcpData: CCP[] = [];
      
      // Lấy CCP từ tất cả các kế hoạch
      for (const plan of plans) {
        try {
          const ccps = await apiFetch<CCP[]>(`/haccp/plans/${plan.id}/ccps`);
          if (ccps && ccps.length > 0) {
            allCcpData.push(...ccps);
          }
        } catch {
          // Skip failed plans
        }
      }
      
      setAllCcps(allCcpData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllCcps();
  }, [fetchAllCcps]);

  return { allCcps, loading, error, refetch: fetchAllCcps };
}
