"use client";

import type { HaccpPlan } from "@/lib/types";

export type HaccpPlansListPanelProps = {
  plans: HaccpPlan[];
  filteredPlans: HaccpPlan[];
  plansLoading: boolean;
  archivedCount: number;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  planDateFilterMode: "day" | "month" | "year";
  onPlanDateFilterModeChange: (mode: "day" | "month" | "year") => void;
  selectedPlanDate: string;
  selectedPlanMonth: string;
  selectedPlanMonthYear: string;
  selectedPlanYear: string;
  planCreatedFrom: string;
  planCreatedTo: string;
  planMonthOptions: { value: string; label: string }[];
  planYearOptions: string[];
  onClearDateFilters: () => void;
  onPlanCreatedDayFilter: (value: string) => void;
  onPlanCreatedMonthFilter: (month: string, year?: string) => void;
  onPlanCreatedYearFilter: (value: string) => void;
  onOpenHiddenPlansModal: () => void;
  onApprovePlan: (planId: string) => void;
  onRestorePlan: (plan: HaccpPlan) => void;
  onHidePlan: (plan: HaccpPlan) => void;
  onOpenFlow: (planId: string) => void;
  onOpenSchedule: (planId: string) => void;
  onEditWizard: (planId: string) => void;
  onVersionCreate: (plan: HaccpPlan) => void;
};

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
  if (status === "ARCHIVED") return "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80";
  return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
}

function statusLabel(status: string) {
  if (status === "ARCHIVED") return "Đã ẩn";
  if (status === "ACTIVE") return "Hoạt động";
  if (status === "DRAFT") return "Nháp";
  return status || "DRAFT";
}

export default function HaccpPlansListPanel({
  plans,
  filteredPlans,
  plansLoading,
  archivedCount,
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  planDateFilterMode,
  onPlanDateFilterModeChange,
  selectedPlanDate,
  selectedPlanMonth,
  selectedPlanMonthYear,
  selectedPlanYear,
  planCreatedFrom,
  planCreatedTo,
  planMonthOptions,
  planYearOptions,
  onClearDateFilters,
  onPlanCreatedDayFilter,
  onPlanCreatedMonthFilter,
  onPlanCreatedYearFilter,
  onOpenHiddenPlansModal,
  onApprovePlan,
  onRestorePlan,
  onHidePlan,
  onOpenFlow,
  onOpenSchedule,
  onEditWizard,
  onVersionCreate,
}: HaccpPlansListPanelProps) {
  const filtersActive =
    Boolean(searchTerm.trim()) ||
    statusFilter !== "ALL" ||
    Boolean(planCreatedFrom || planCreatedTo);

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-5">
      <header className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">Danh sách kế hoạch HACCP</h3>
            <p className="max-w-xl text-sm leading-relaxed text-slate-500">
              Tìm theo tên hoặc phạm vi, lọc theo trạng thái và ngày tạo. Mỗi dòng có các thao tác phù hợp trạng thái kế hoạch.
            </p>
            <button
              type="button"
              onClick={onOpenHiddenPlansModal}
              className="mt-2 text-left text-sm font-medium text-[#1e8b9b] hover:text-cyan-900 hover:underline"
            >
              Quy trình đã ẩn — xem hoặc hiện lại
              {archivedCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {archivedCount}
                </span>
              ) : null}
            </button>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium tabular-nums text-slate-700">
                {plansLoading ? "Đang tải…" : filtersActive ? `${filteredPlans.length} / ${plans.length}` : `${filteredPlans.length}`}{" "}
                {!plansLoading ? <span className="font-normal text-slate-500">kế hoạch</span> : null}
              </span>
            </div>
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  onSearchTermChange("");
                  onStatusFilterChange("ALL");
                  onClearDateFilters();
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Xóa bộ lọc
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-5">
            <label htmlFor="haccp-plans-search" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tìm kiếm
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                id="haccp-plans-search"
                type="search"
                autoComplete="off"
                placeholder="Tên kế hoạch, phạm vi, phiên bản…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#1e8b9b] focus:bg-white focus:ring-2 focus:ring-[#1e8b9b]/20"
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
              />
            </div>
          </div>

          <div className="lg:col-span-3">
            <label htmlFor="haccp-plans-status" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trạng thái
            </label>
            <select
              id="haccp-plans-status"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#1e8b9b] focus:ring-2 focus:ring-[#1e8b9b]/20"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="ALL">Tất cả</option>
              <option value="DRAFT">Nháp (DRAFT)</option>
              <option value="ACTIVE">Hoạt động (ACTIVE)</option>
              <option value="ARCHIVED">Đã ẩn (ARCHIVED)</option>
            </select>
          </div>

          <div className="lg:col-span-4">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày tạo</span>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="mb-3 flex rounded-lg border border-slate-200/80 bg-white p-0.5">
                {(
                  [
                    { value: "day" as const, label: "Theo ngày" },
                    { value: "month" as const, label: "Theo tháng" },
                    { value: "year" as const, label: "Theo năm" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onPlanDateFilterModeChange(opt.value);
                      onClearDateFilters();
                    }}
                    className={`min-w-0 flex-1 rounded-md px-2 py-1.5 text-center text-xs font-semibold transition ${
                      planDateFilterMode === opt.value
                        ? "bg-[#1e8b9b] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {planDateFilterMode === "day" && (
                <input
                  type="date"
                  value={selectedPlanDate}
                  onChange={(e) => onPlanCreatedDayFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1e8b9b]/20"
                  title="Chọn ngày tạo"
                />
              )}

              {planDateFilterMode === "month" && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={selectedPlanMonth}
                    onChange={(e) => onPlanCreatedMonthFilter(e.target.value, selectedPlanMonthYear)}
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1e8b9b]/20"
                  >
                    <option value="">Chọn tháng</option>
                    {planMonthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedPlanMonthYear}
                    onChange={(e) => onPlanCreatedMonthFilter(selectedPlanMonth, e.target.value)}
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1e8b9b]/20"
                  >
                    {planYearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {planDateFilterMode === "year" && (
                <select
                  value={selectedPlanYear}
                  onChange={(e) => onPlanCreatedYearFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1e8b9b]/20"
                >
                  <option value="">Chọn năm</option>
                  {planYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="w-full">
          <table className="w-full table-fixed text-left text-sm text-slate-700">
            <colgroup>
              <col className="w-[24%] min-w-0" />
              <col className="w-[8%] min-w-0" />
              <col className="w-[20%] min-w-0" />
              <col className="w-[11%] min-w-0" />
              <col className="w-[11%] min-w-0" />
              <col className="w-[26%] min-w-0" />
            </colgroup>
            <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-slate-100/95 text-slate-800 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3.5 text-xs font-bold uppercase tracking-wide">Kế hoạch</th>
                <th className="whitespace-nowrap px-3 py-3.5 text-xs font-bold uppercase tracking-wide">Phiên bản</th>
                <th className="px-3 py-3.5 text-xs font-bold uppercase tracking-wide">Phạm vi</th>
                <th className="whitespace-nowrap px-3 py-3.5 text-xs font-bold uppercase tracking-wide">Trạng thái</th>
                <th className="whitespace-nowrap px-3 py-3.5 text-xs font-bold uppercase tracking-wide">Ngày tạo</th>
                <th className="px-3 py-3.5 text-right text-xs font-bold uppercase tracking-wide">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plansLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-[#1e8b9b]" />
                      Đang tải danh sách…
                    </span>
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-slate-500">
                    {filtersActive
                      ? "Không có kế hoạch khớp bộ lọc. Thử đổi từ khóa hoặc xóa lọc."
                      : "Chưa có kế hoạch. Dùng nút «Tạo Quy Trình HACCP» trên thanh trên để bắt đầu."}
                  </td>
                </tr>
              ) : (
                filteredPlans.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-50/80">
                    <td className="min-w-0 px-4 py-3.5">
                      <div className="break-words font-semibold leading-snug text-[#0f766e]" title={p.name}>
                        {p.name}
                      </div>
                    </td>
                    <td className="min-w-0 px-3 py-3.5 align-middle">
                      <span className="font-mono text-sm font-medium text-slate-700">v{p.version}</span>
                    </td>
                    <td className="min-w-0 px-3 py-3.5 text-xs text-slate-600" title={p.scope || ""}>
                      <span className="line-clamp-2 block break-words">{p.scope?.trim() ? p.scope : "—"}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusBadgeClass(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-xs tabular-nums text-slate-600">
                      {new Date(p.created_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="min-w-0 px-3 py-3 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        {p.status === "ARCHIVED" && (
                          <button
                            type="button"
                            onClick={() => onRestorePlan(p)}
                            className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-snug text-emerald-800 shadow-sm transition hover:bg-emerald-100 sm:text-sm"
                          >
                            Hiện lại
                          </button>
                        )}
                        {p.status === "DRAFT" && (
                          <button
                            type="button"
                            onClick={() => onApprovePlan(p.id)}
                            className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-snug text-emerald-800 shadow-sm transition hover:bg-emerald-100 sm:text-sm"
                          >
                            Phê duyệt
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenFlow(p.id)}
                          className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold leading-snug text-blue-800 shadow-sm transition hover:bg-blue-100 sm:text-sm"
                        >
                          Luồng
                        </button>
                        {p.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => onOpenSchedule(p.id)}
                            className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-snug text-amber-950 shadow-sm transition hover:bg-amber-100 sm:text-sm"
                            title="Lập lịch kiểm tra"
                          >
                            Lập lịch
                          </button>
                        )}
                        {p.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => onVersionCreate(p)}
                            className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold leading-snug text-violet-900 shadow-sm transition hover:bg-violet-100 sm:text-sm"
                            title="Tạo phiên bản mới để chỉnh sửa"
                          >
                            Phiên bản mới
                          </button>
                        )}
                        {p.status === "DRAFT" && (
                          <button
                            type="button"
                            onClick={() => onEditWizard(p.id)}
                            className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold leading-snug text-violet-900 shadow-sm transition hover:bg-violet-100 sm:text-sm"
                            title="Sửa quy trình HACCP"
                          >
                            Sửa
                          </button>
                        )}
                        {p.status !== "ARCHIVED" && (
                          <button
                            type="button"
                            onClick={() => onHidePlan(p)}
                            className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-snug text-slate-700 shadow-sm transition hover:bg-slate-100 sm:text-sm"
                          >
                            Ẩn
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
