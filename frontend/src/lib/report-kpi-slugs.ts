export const REPORT_KPI_SLUGS = ["prp", "haccp", "capa"] as const;
export type ReportKpiSlug = (typeof REPORT_KPI_SLUGS)[number];

export function slugFromReportKpiLabel(label: string): ReportKpiSlug | null {
  if (label.includes("PRP")) return "prp";
  if (label.includes("HACCP")) return "haccp";
  if (label.includes("CAPA")) return "capa";
  return null;
}

export function titleForKpiSlug(slug: string): string {
  if (slug === "prp") return "Tuân thủ PRP";
  if (slug === "haccp") return "Tuân thủ HACCP";
  if (slug === "capa") return "CAPA đúng hạn";
  return "KPI";
}
