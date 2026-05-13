/**
 * API báo cáo / KPI — cùng quy ước base URL như documents-api.
 */
const apiBase = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    return "/api-backend";
  }
  return "http://127.0.0.1:8000";
};

function apiPath(suffix: string): string {
  const base = apiBase().replace(/\/$/, "");
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${base}${path}`;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (
      typeof data.detail === "object" &&
      data.detail !== null &&
      !Array.isArray(data.detail) &&
      "message" in data.detail &&
      typeof (data.detail as { message?: unknown }).message === "string"
    ) {
      return (data.detail as { message: string }).message;
    }
    if (Array.isArray(data.detail)) {
      return data.detail.map((e) => JSON.stringify(e)).join("; ");
    }
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export type KpiSnapshotDto = {
  id: string;
  org_id: string;
  snapshot_date: string;
  period_type: string;
  doc_total: number | null;
  doc_approved: number | null;
  doc_pending: number | null;
  doc_overdue_review: number | null;
  haccp_ccp_monitored_rate: number | null;
  haccp_deviation_count: number | null;
  prp_audit_compliance_rate: number | null;
  prp_nc_open_count: number | null;
  capa_ontime_closure_rate: number | null;
  capa_open_count: number | null;
  capa_overdue_count: number | null;
  alert_critical_count: number | null;
  alert_open_count: number | null;
  computed_at: string | null;
};

export async function listKpiSnapshots(
  orgId: string,
  periodType?: string,
): Promise<KpiSnapshotDto[]> {
  const qs = new URLSearchParams({ org_id: orgId });
  if (periodType) qs.set("period_type", periodType);
  const res = await fetch(`${apiPath("/reports/kpi-snapshots")}?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<KpiSnapshotDto[]>;
}
