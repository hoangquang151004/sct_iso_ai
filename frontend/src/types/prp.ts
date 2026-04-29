export interface PRPProgram {
  id: string;
  org_id: string;
  name: string;
  code?: string;
  category?: string;
  description?: string;
  standard_ref?: string;
  is_active: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  name: string;
  is_active: boolean;
}

export interface PRPChecklistTemplate {
  id: string;
  prp_program_id: string;
  location_id?: string;
  document_id?: string;
  question_text: string;
  answer_type: "BOOLEAN" | "TEXT" | "NUMBER" | "SELECT";
  /** Mục tiêu số (ví dụ ngưỡng tuân thủ) khi answer_type là NUMBER */
  target_value?: number;
  options?: Record<string, any>;
  requirement?: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export interface PRPAudit {
  id: string;
  org_id: string;
  prp_program_id?: string;
  area_id?: string;
  audit_date: string;
  total_score?: number;
  compliance_rate?: number;
  overall_result?: string;
  auditor_id?: string;
  created_at: string;
  area?: Location;
  prp_program?: PRPProgram;
  details?: PRPAuditDetail[];
}

export interface PRPAuditDetail {
  id: string;
  audit_id: string;
  checklist_id: string;
  result: string;
  score?: number;
  observation?: string;
  evidence_url?: string;
  checklist?: PRPChecklistTemplate;
}

export interface PRPAuditFullCreate {
  audit_data: {
    org_id: string;
    prp_program_id?: string;
    area_id?: string;
    audit_date: string;
    total_score?: number;
    compliance_rate?: number;
    overall_result?: string;
    auditor_id?: string;
  };
  details: {
    checklist_id: string;
    result: string;
    score?: number;
    observation?: string;
    evidence_url?: string;
  }[];
}
