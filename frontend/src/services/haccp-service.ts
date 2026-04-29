import { apiRequest } from "@/api/api-client";

export type ListPlansParams = {
  org_id: string;
  status?: string;
  product_id?: string;
};

export type CreatePlanPayload = {
  org_id: string;
  created_by: string;
  name: string;
  version: string;
  scope?: string;
  product_id?: string;
};

export type CreateLogPayload = {
  recorded_by: string;
  measured_value: number;
  unit?: string;
  batch_number?: string;
  shift?: string;
  notes?: string;
};

export type CcpLogResponse = {
  id: string;
  ccp_id: string;
  recorded_by: string;
  measured_value: number;
  is_within_limit: boolean;
  [key: string]: unknown;
};

export type ReorderItem = { id: string; step_order: number };

export type ScheduleMonitoringPayload = {
  org_id: string;
  ccp_id: string;
  start_date: string;
  end_date: string;
  frequency: string;
};

export type ScheduleMonitoringResponse = {
  message?: string;
  count?: number;
};

export type SuggestControlPayload = {
  hazard_type: string;
  hazard_name: string;
  process_step_name: string;
};

export type SuggestControlResponse = {
  suggestion: string;
  rationale?: string;
};

export type HaccpKpiResponse = {
  compliance_rate: number;
  total_logs: number;
  deviations_today: number;
  plans_active: number;
  pending_approvals: number;
};

export async function listPlans(params: ListPlansParams): Promise<unknown[]> {
  const qs = new URLSearchParams({ org_id: params.org_id });
  if (params.status) qs.set("status", params.status);
  if (params.product_id) qs.set("product_id", params.product_id);
  return apiRequest<unknown[]>(`/haccp/plans?${qs.toString()}`);
}

export async function createPlan(payload: CreatePlanPayload): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/haccp/plans", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approvePlan(planId: string, approvedBy: string): Promise<unknown> {
  const qs = new URLSearchParams({ approved_by: approvedBy });
  return apiRequest(`/haccp/plans/${planId}/approve?${qs.toString()}`, {
    method: "POST",
  });
}

export async function createLog(
  ccpId: string,
  payload: CreateLogPayload,
): Promise<CcpLogResponse> {
  const body = { ...payload, ccp_id: ccpId };
  return apiRequest<CcpLogResponse>(`/haccp/ccps/${ccpId}/logs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reorderSteps(planId: string, orders: ReorderItem[]): Promise<unknown[]> {
  return apiRequest<unknown[]>(`/haccp/plans/${planId}/steps/reorder`, {
    method: "POST",
    body: JSON.stringify({ orders }),
  });
}

export async function listDeviations(params: {
  org_id: string;
  limit?: number;
}): Promise<unknown[]> {
  const qs = new URLSearchParams({ org_id: params.org_id });
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  return apiRequest<unknown[]>(`/haccp/deviations?${qs.toString()}`);
}

export async function autoVerifyFromIot(logId: string, iotDeviceId: string): Promise<unknown> {
  const qs = new URLSearchParams({ iot_device_id: iotDeviceId });
  return apiRequest(`/haccp/logs/${logId}/iot-verify?${qs.toString()}`, {
    method: "POST",
  });
}

export async function scheduleMonitoring(
  payload: ScheduleMonitoringPayload,
): Promise<ScheduleMonitoringResponse> {
  return apiRequest<ScheduleMonitoringResponse>("/haccp/monitoring/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function suggestControl(
  payload: SuggestControlPayload,
): Promise<SuggestControlResponse> {
  return apiRequest<SuggestControlResponse>("/haccp/ai/suggest-control", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getKpis(orgId: string): Promise<HaccpKpiResponse> {
  const qs = new URLSearchParams({ org_id: orgId });
  return apiRequest<HaccpKpiResponse>(`/haccp/kpis?${qs.toString()}`);
}
