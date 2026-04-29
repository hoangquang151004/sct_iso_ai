import { apiRequest } from "@/api/api-client";

export interface NonConformity {
  id: string;
  org_id: string;
  nc_code?: string;
  source: string;
  source_ref_id?: string;
  title: string;
  description?: string;
  severity: string;
  status: string;
  /** Trạng thái CAPA liên kết (nếu API trả về) */
  capa_status?: string;
  detected_at: string;
  created_at: string;
}

export interface CAPA {
  id: string;
  org_id: string;
  nc_id?: string;
  capa_code?: string;
  title: string;
  root_cause?: string;
  status: string;
  due_date?: string;
  assigned_to?: string;
  created_at: string;
}

export const capaService = {
  listNCs: async (orgId: string, status?: string, source?: string): Promise<NonConformity[]> => {
    let url = `/capa/ncs?org_id=${orgId}`;
    if (status !== undefined) url += `&status=${status}`;
    if (source) url += `&source=${source}`;
    return apiRequest<NonConformity[]>(url);
  },

  createCAPA: async (payload: Partial<CAPA>): Promise<CAPA> => {
    return apiRequest<CAPA>("/capa/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateCAPA: async (id: string, payload: Partial<CAPA>): Promise<CAPA> => {
    return apiRequest<CAPA>(`/capa/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  checkExistingNCs: async (sourceRefIds: string[]): Promise<string[]> => {
    if (sourceRefIds.length === 0) return [];
    const query = sourceRefIds.map(id => `source_ref_ids=${id}`).join("&");
    return apiRequest<string[]>(`/capa/nc/check?${query}`);
  },

  getKPIs: async (orgId: string): Promise<any> => {
    return apiRequest<any>(`/capa/kpi/${orgId}`);
  },

  getBoard: async (orgId: string): Promise<{ columns: Record<string, CAPA[]> }> => {
    return apiRequest<{ columns: Record<string, CAPA[]> }>(`/capa/board/${orgId}`);
  }
};
