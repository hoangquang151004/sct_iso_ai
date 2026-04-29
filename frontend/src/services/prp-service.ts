import { apiRequest } from "@/api/api-client";
import type { 
  PRPProgram, 
  Location, 
  PRPChecklistTemplate, 
  PRPAudit, 
  PRPAuditFullCreate 
} from "@/types";

export async function listPrograms(): Promise<PRPProgram[]> {
  return apiRequest<PRPProgram[]>("/prp/programs");
}

export async function listLocations(): Promise<Location[]> {
  return apiRequest<Location[]>("/prp/locations");
}

export async function getTemplatesByLocation(locationId: string, onlyActive: boolean = true): Promise<PRPChecklistTemplate[]> {
  return apiRequest<PRPChecklistTemplate[]>(`/prp/templates/location/${locationId}?only_active=${onlyActive}`);
}

export async function createTemplate(payload: Partial<PRPChecklistTemplate>): Promise<PRPChecklistTemplate> {
  return apiRequest<PRPChecklistTemplate>("/prp/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateTemplate(id: string, payload: Partial<PRPChecklistTemplate>): Promise<PRPChecklistTemplate> {
  return apiRequest<PRPChecklistTemplate>(`/prp/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function listAudits(params?: {
  org_id?: string;
  area_id?: string;
  audit_date?: string;
  month?: number;
  year?: number;
}): Promise<PRPAudit[]> {
  const query = new URLSearchParams();
  if (params?.org_id) query.append("org_id", params.org_id);
  if (params?.area_id) query.append("area_id", params.area_id);
  if (params?.audit_date) query.append("audit_date", params.audit_date);
  if (params?.month) query.append("month", params.month.toString());
  if (params?.year) query.append("year", params.year.toString());
  
  const queryString = query.toString();
  return apiRequest<PRPAudit[]>(`/prp/${queryString ? `?${queryString}` : ""}`);
}

export async function getAuditById(id: string): Promise<PRPAudit> {
  return apiRequest<PRPAudit>(`/prp/${id}`);
}

export async function deleteTemplate(id: string): Promise<void> {
  return apiRequest<void>(`/prp/templates/${id}`, { method: "DELETE" });
}

export async function createProgram(payload: any): Promise<PRPProgram> {
  return apiRequest<PRPProgram>("/prp/programs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProgram(id: string, payload: any): Promise<PRPProgram> {
  return apiRequest<PRPProgram>(`/prp/programs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function createFullAudit(payload: PRPAuditFullCreate): Promise<PRPAudit> {
  return apiRequest<PRPAudit>("/prp/full", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createSchedule(payload: any): Promise<{ message: string; count: number }> {
  return apiRequest<{ message: string; count: number }>("/prp/schedule", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getUpcomingSchedules(orgId: string): Promise<any[]> {
  return apiRequest<any[]>(`/prp/upcoming-schedules?org_id=${orgId}`);
}

export async function listSchedules(orgId: string, status?: string): Promise<any[]> {
  const query = new URLSearchParams();
  query.append("org_id", orgId);
  if (status) query.append("status", status);
  return apiRequest<any[]>(`/prp/schedules?${query.toString()}`);
}

export async function createNC(payload: any): Promise<any> {
  return apiRequest<any>("/prp/nc", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
