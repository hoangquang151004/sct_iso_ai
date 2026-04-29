// ============================================================================
// SHARED TYPES (Mapped from Backend Pydantic Schemas)
// ============================================================================

export type HaccpPlan = {
  id: string;
  org_id: string;
  product_id?: string;
  name: string;
  version: string;
  scope?: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  created_by: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
};

export type ProcessStep = {
  id: string;
  haccp_plan_id: string;
  step_order: number;
  name: string;
  description?: string;
  step_type?: string;
  is_ccp: boolean;
  parent_step_id?: string;
  created_at: string;
};

export type HazardAnalysis = {
  id: string;
  step_id: string;
  hazard_type: "BIOLOGICAL" | "CHEMICAL" | "PHYSICAL";
  hazard_name: string;
  description?: string;
  likelihood: number;
  severity: number;
  risk_score: number;
  control_measure?: string;
  is_significant: boolean;
  ai_suggestion?: string;
  created_at: string;
};

export type CCP = {
  id: string;
  haccp_plan_id: string;
  step_id?: string;
  hazard_id?: string;
  ccp_code: string;
  name: string;
  critical_limit: string;
  monitoring_method?: string;
  monitoring_frequency?: string;
  monitoring_device?: string;
  responsible_user?: string;
  corrective_action?: string;
  verification_procedure?: string;
  ai_suggestion?: string;
  created_at: string;
};

export type CCPMonitoringLog = {
  id: string;
  ccp_id: string;
  batch_number?: string;
  shift?: string;
  measured_value?: number;
  unit?: string;
  is_within_limit?: boolean;
  deviation_note?: string;
  iot_device_id?: string;
  recorded_by?: string;
  recorded_at: string;
  verified_by?: string;
  verified_at?: string;
  // Deviation management fields
  deviation_severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  deviation_status?: 'NEW' | 'INVESTIGATING' | 'CORRECTIVE_ACTION' | 'RESOLVED' | 'CLOSED';
  corrective_action?: string;
  root_cause?: string;
  handled_by?: string;
  handled_at?: string;
  resolution_note?: string;
};

export type HaccpVerification = {
  id: string;
  haccp_plan_id: string;
  verification_type: "VERIFICATION" | "VALIDATION";
  period_from?: string;
  period_to?: string;
  result?: string;
  conclusion?: "PASSED" | "FAILED" | "NEEDS_IMPROVEMENT";
  report_url?: string;
  conducted_by: string;
  approved_by?: string;
  conducted_at: string;
};

// Types for generic results
export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};
