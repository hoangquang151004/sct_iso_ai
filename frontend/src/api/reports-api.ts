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

export type ReportLocationDto = {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
};

export type InternalSignalDto = {
  level: string;
  message: string;
};

export type InternalAuditSummaryDto = {
  location_id: string | null;
  location_name: string;
  period_days: number;
  prp_audit_count: number;
  prp_avg_compliance: number | null;
  prp_low_compliance_sessions: number;
  open_nc_org_count: number;
  haccp_deviation_org_count: number;
  signals: InternalSignalDto[];
};

export type KpiDrilldownRowDto = {
  row_id: string;
  title: string;
  subtitle: string | null;
  metric_primary: string;
  metric_secondary: string | null;
  severity: string;
};

export type KpiDrilldownBlockDto = {
  dimension: string;
  rows: KpiDrilldownRowDto[];
};

export type KpiDrilldownDto = {
  kpi_type: string;
  headline_label: string;
  headline_value: string;
  period_days: number;
  is_low_signal: boolean;
  ai_insights: string[];
  blocks: KpiDrilldownBlockDto[];
};

export async function listReportLocations(
  orgId: string,
): Promise<ReportLocationDto[]> {
  const qs = new URLSearchParams({ org_id: orgId });
  const res = await fetch(`${apiPath("/reports/locations")}?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<ReportLocationDto[]>;
}

export async function getInternalAuditSummary(
  orgId: string,
  locationId?: string,
  periodDays = 120,
): Promise<InternalAuditSummaryDto> {
  const qs = new URLSearchParams({
    org_id: orgId,
    period_days: String(periodDays),
  });
  if (locationId) qs.set("location_id", locationId);
  const res = await fetch(`${apiPath("/reports/internal-audit-summary")}?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<InternalAuditSummaryDto>;
}

export type KpiDrillRequest =
  | { mode: "snapshot"; periodType: string; cursor: string }
  | { mode: "rolling"; periodDays: number };

export async function getKpiDrilldown(
  orgId: string,
  kpiType: "prp" | "haccp" | "capa",
  req: KpiDrillRequest,
): Promise<KpiDrilldownDto> {
  const qs = new URLSearchParams({
    org_id: orgId,
    kpi_type: kpiType,
  });
  if (req.mode === "snapshot") {
    qs.set("period_type", req.periodType);
    qs.set("cursor", req.cursor);
    qs.set("period_days", "120");
  } else {
    qs.set("period_days", String(req.periodDays));
  }
  const res = await fetch(`${apiPath("/reports/kpi-drilldown")}?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<KpiDrilldownDto>;
}
