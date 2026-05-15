"use client";

import { useState, useEffect, useMemo } from "react";
import { HaccpPlan, CCP, HaccpAssessment, HaccpAssessmentItem } from "@/lib/types";
import {
  useHaccpAssessments,
  createAssessment,
  submitAssessment,
  updateAssessmentItem,
  updateAssessment,
  deleteAssessment,
  addAssessmentManualItem,
  deleteAssessmentItem,
  CreateAssessmentPayload,
  ProcessStepWithPlan,
  useHaccpSchedules,
  HaccpSchedule,
  isHaccpScheduleAssessmentReady,
  formatHaccpScheduleWindow,
} from "@/api/hooks/use-haccp";
import { apiFetch, ApiClientError } from "@/api/api-client";

// =============================================================================
// ASSESSMENT PANEL - Tab Đánh giá HACCP
// =============================================================================

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function matchesDateRange(value: string | undefined, from: string, to: string) {
  if (!from && !to) return true;
  const current = dateOnly(value);
  if (!current) return false;
  if (from && current < from) return false;
  if (to && current > to) return false;
  return true;
}

const ASSESSMENT_MONITORING_GATE_MESSAGE =
  "Chưa thể tạo phiếu đánh giá: kế hoạch giám sát của quy trình này chưa đầy đủ.\n\n" +
  "Yêu cầu: có ít nhất một CCP và với mỗi CCP phải nhập đủ Giới hạn tới hạn, Phương pháp giám sát và Người phụ trách " +
  "(tab «Kế hoạch giám sát»).";

/**
 * Sinh hạng mục phiếu đánh giá: lần lượt từng bước quy trình (PROCESS_STEP),
 * ngay sau mỗi bước là các CCP gắn với bước đó; CCP không gắn bước hợp lệ được xếp cuối.
 */
export function buildHaccpAssessmentAutoItemsFromPlan(
  steps: ProcessStepWithPlan[],
  ccps: CCP[],
): CreateAssessmentPayload["items"] {
  const stepIds = new Set(steps.map((s) => s.id));
  const ccpsByStep = new Map<string, CCP[]>();
  const orphans: CCP[] = [];

  for (const ccp of ccps) {
    const sid = ccp.step_id;
    if (sid && stepIds.has(sid)) {
      const arr = ccpsByStep.get(sid) ?? [];
      arr.push(ccp);
      ccpsByStep.set(sid, arr);
    } else {
      orphans.push(ccp);
    }
  }
  for (const arr of ccpsByStep.values()) {
    arr.sort((a, b) => (a.ccp_code || "").localeCompare(b.ccp_code || "", "vi"));
  }
  orphans.sort((a, b) => (a.ccp_code || "").localeCompare(b.ccp_code || "", "vi"));

  const items: CreateAssessmentPayload["items"] = [];
  let order = 0;

  for (const step of steps) {
    items.push({
      item_type: "PROCESS_STEP",
      ref_id: step.id,
      question: `Bước ${step.step_order}: ${step.name} — Quy trình có được thực hiện đầy đủ và đúng như mô tả không?`,
      order_index: order++,
    });
    const stepCcps = ccpsByStep.get(step.id) ?? [];
    for (const ccp of stepCcps) {
      items.push({
        item_type: "CCP",
        ref_id: ccp.id,
        question: `CCP ${ccp.ccp_code}: ${ccp.name} — Giá trị giám sát có nằm trong giới hạn tới hạn (${ccp.critical_limit || "—"}) không?`,
        expected_value: ccp.critical_limit || undefined,
        order_index: order++,
      });
    }
  }

  for (const ccp of orphans) {
    items.push({
      item_type: "CCP",
      ref_id: ccp.id,
      question: `CCP ${ccp.ccp_code}: ${ccp.name} — Giá trị giám sát có nằm trong giới hạn tới hạn (${ccp.critical_limit || "—"}) không?`,
      expected_value: ccp.critical_limit || undefined,
      order_index: order++,
    });
  }

  return items;
}

type AssessmentCreateModalIntent = { kind: "browse" } | { kind: "presetPlan"; planId: string };

export default function AssessmentPanel({
  plans,
  ccpsMap,
  stepsMap,
  monitoringReadyByPlanId,
  pendingCreateFromPlanId = null,
  onConsumePendingCreate,
  onAssessmentSubmitted,
  onNavigateToDeviations,
}: {
  plans: HaccpPlan[];
  ccpsMap: Record<string, CCP[]>;
  stepsMap: Record<string, ProcessStepWithPlan[]>;
  monitoringReadyByPlanId: Record<string, boolean>;
  pendingCreateFromPlanId?: string | null;
  onConsumePendingCreate?: () => void;
  /** Gọi sau khi gửi phiếu thành công (ví dụ làm mới độ lệch / thống kê). */
  onAssessmentSubmitted?: () => void;
  /** Chuyển sang tab Độ lệch CCP sau khi gửi phiếu có CCP không đạt. */
  onNavigateToDeviations?: () => void;
}) {
  const [viewTab, setViewTab] = useState<"draft" | "submitted">("draft");
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [createModalIntent, setCreateModalIntent] = useState<AssessmentCreateModalIntent | null>(null);
  const [isFilling, setIsFilling] = useState(false);
  const [currentAssessment, setCurrentAssessment] = useState<HaccpAssessment | null>(null);
  const [detailView, setDetailView] = useState<HaccpAssessment | null>(null);

  const planQuery = planFilter === "ALL" ? null : planFilter;
  // Luôn fetch tất cả trạng thái để tính đúng số lượng cho cả 2 tab
  const { assessments, loading, error, refetch } = useHaccpAssessments(planQuery, null);
  const { schedules, loading: schedulesLoading, refetch: refetchSchedules } = useHaccpSchedules(null, true);

  const visiblePlanIds = useMemo(() => new Set(plans.map((p) => p.id)), [plans]);
  const schedulesEligibleForCreate = useMemo(() => {
    return schedules.filter((s) => {
      if (!s.haccp_plan_id || !visiblePlanIds.has(s.haccp_plan_id)) return false;
      if (s.status === "COMPLETED") return false;
      return true;
    });
  }, [schedules, visiblePlanIds]);

  const scheduleByEventId = useMemo(() => {
    const map: Record<string, HaccpSchedule> = {};
    for (const s of schedules) map[s.id] = s;
    return map;
  }, [schedules]);

  useEffect(() => {
    if (!pendingCreateFromPlanId || !onConsumePendingCreate) return;
    const planId = pendingCreateFromPlanId;
    if (!monitoringReadyByPlanId[planId]) {
      alert(ASSESSMENT_MONITORING_GATE_MESSAGE);
      onConsumePendingCreate();
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setCreateModalIntent({ kind: "presetPlan", planId });
      onConsumePendingCreate();
    });
    return () => {
      cancelled = true;
    };
  }, [pendingCreateFromPlanId, onConsumePendingCreate, monitoringReadyByPlanId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Xác nhận xóa phiếu đánh giá này?")) return;
    try {
      await deleteAssessment(id);
      refetch();
    } catch (e) {
      alert("Lỗi khi xóa: " + (e as Error).message);
    }
  };

  const draftAssessments = assessments.filter((a) => a.status === "DRAFT");
  const submittedAssessments = assessments.filter((a) => a.status !== "DRAFT");
  const tabList = viewTab === "draft" ? draftAssessments : submittedAssessments;
  const displayList = tabList.filter((a) => {
    const plan = plans.find((p) => p.id === a.haccp_plan_id);
    const query = assessmentSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      a.title.toLowerCase().includes(query) ||
      (plan?.name || "").toLowerCase().includes(query) ||
      (a.overall_note || "").toLowerCase().includes(query);
    const matchesResult = resultFilter === "ALL" || a.overall_result === resultFilter;
    const matchesDate = matchesDateRange(a.assessment_date || a.created_at, dateFrom, dateTo);
    return matchesSearch && matchesResult && matchesDate;
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Phiếu Đánh giá HACCP</h3>
          <p className="text-sm text-slate-500 mt-1">
            Có thể tạo phiếu trước giờ bắt đầu; chỉ điền và gửi khi đã đến giờ bắt đầu lịch. Gửi trong khung giờ → hoàn thành;
            sau giờ kết thúc → quá hạn. Cần đủ kế hoạch giám sát CCP trước khi tạo phiếu.
          </p>
        </div>
        <button
          onClick={() => setCreateModalIntent({ kind: "browse" })}
          className="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 text-sm font-medium transition-colors"
        >
          + Tạo phiếu đánh giá
        </button>
      </div>

      {/* Sub-tabs + Plan filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewTab("draft")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewTab === "draft"
              ? "bg-white text-cyan-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
              }`}
          >
            Bản nháp ({draftAssessments.length})
          </button>
          <button
            onClick={() => setViewTab("submitted")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewTab === "submitted"
              ? "bg-white text-cyan-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
              }`}
          >
            Đã gửi ({submittedAssessments.length})
          </button>
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-md text-sm"
        >
          <option value="ALL">Tất cả kế hoạch</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Tìm phiếu đánh giá</label>
            <input
              type="text"
              value={assessmentSearch}
              onChange={(e) => setAssessmentSearch(e.target.value)}
              placeholder="Tìm theo tiêu đề, kế hoạch, ghi chú..."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Kết quả</label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white min-w-[180px]"
            >
              <option value="ALL">Tất cả kết quả</option>
              <option value="PASS">Đạt</option>
              <option value="FAIL">Không đạt</option>
              <option value="NEEDS_IMPROVEMENT">Cần cải tiến</option>
            </select>
          </div>
          <div className="text-xs text-slate-500 pb-2">
            Hiển thị {displayList.length}/{tabList.length} phiếu
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Từ ngày đánh giá</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase">Đến ngày đánh giá</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
            />
          </div>
          {(planFilter !== "ALL" || assessmentSearch || resultFilter !== "ALL" || dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setPlanFilter("ALL");
                setAssessmentSearch("");
                setResultFilter("ALL");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-sm text-slate-500 hover:text-slate-800 px-2 py-2"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">Đang tải...</div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-500">
          Lỗi: {error.message}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Tiêu đề</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Kế hoạch</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Ngày đánh giá</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Trạng thái</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-700">Kết quả</th>
                <th className="text-right px-3 py-2 font-semibold text-slate-700">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    {viewTab === "draft" ? "Chưa có phiếu nháp nào" : "Chưa có phiếu đã gửi nào"}
                  </td>
                </tr>
              ) : (
                displayList.map((a: HaccpAssessment) => {
                  const plan = plans.find((p) => p.id === a.haccp_plan_id);
                  return (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{a.title}</td>
                      <td className="px-3 py-2 text-slate-600">{plan?.name || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{a.assessment_date || "-"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultBadge result={a.overall_result} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          {a.status === "DRAFT" && (
                            <button
                              onClick={() => {
                                setCurrentAssessment(a);
                                setIsFilling(true);
                              }}
                              className="px-2 py-1 text-xs bg-cyan-50 text-cyan-700 rounded hover:bg-cyan-100"
                            >
                              Điền form
                            </button>
                          )}
                          <button
                            onClick={() => setDetailView(a)}
                            className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                          >
                            Xem
                          </button>
                          {a.status === "DRAFT" && (
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {createModalIntent && (
        <CreateAssessmentModal
          intent={createModalIntent}
          plans={plans}
          ccpsMap={ccpsMap}
          stepsMap={stepsMap}
          schedules={schedulesEligibleForCreate}
          schedulesLoading={schedulesLoading}
          monitoringReadyByPlanId={monitoringReadyByPlanId}
          onClose={() => setCreateModalIntent(null)}
          onCreated={() => {
            setCreateModalIntent(null);
            refetch();
            void refetchSchedules();
          }}
        />
      )}

      {/* Fill Form Modal */}
      {isFilling && currentAssessment && (
        <FillAssessmentModal
          assessment={currentAssessment}
          linkedSchedule={
            currentAssessment.calendar_event_id
              ? scheduleByEventId[currentAssessment.calendar_event_id]
              : undefined
          }
          onClose={() => {
            setIsFilling(false);
            setCurrentAssessment(null);
          }}
          onSubmitted={() => {
            setIsFilling(false);
            setCurrentAssessment(null);
            refetch();
          }}
          onAssessmentSubmitted={() => {
            void refetchSchedules();
            onAssessmentSubmitted?.();
          }}
          onNavigateToDeviations={onNavigateToDeviations}
        />
      )}

      {/* Detail Modal */}
      {detailView && (
        <AssessmentDetailModal
          assessment={detailView}
          plans={plans}
          onClose={() => setDetailView(null)}
          onUpdated={() => {
            setDetailView(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Status Badge
// =============================================================================
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    SUBMITTED: "bg-cyan-100 text-cyan-700",
    REVIEWED: "bg-emerald-100 text-emerald-700",
    CLOSED: "bg-amber-100 text-amber-700",
  };
  const labels: Record<string, string> = {
    DRAFT: "Bản nháp",
    SUBMITTED: "Đã gửi",
    REVIEWED: "Đã xem xét",
    CLOSED: "Đã đóng",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || "bg-slate-100 text-slate-700"}`}>
      {labels[status] || status}
    </span>
  );
}

function ResultBadge({ result }: { result?: string }) {
  if (!result) return <span className="text-slate-400 text-xs">-</span>;
  const map: Record<string, string> = {
    PASS: "bg-emerald-100 text-emerald-700",
    FAIL: "bg-red-100 text-red-700",
    NEEDS_IMPROVEMENT: "bg-amber-100 text-amber-700",
  };
  const labels: Record<string, string> = {
    PASS: "Đạt",
    FAIL: "Không đạt",
    NEEDS_IMPROVEMENT: "Cần cải thiện",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[result] || ""}`}>
      {labels[result] || result}
    </span>
  );
}

// =============================================================================
// Create Assessment Modal
// =============================================================================
function scheduleOptionLabel(s: HaccpSchedule) {
  const when = formatHaccpScheduleWindow(s);
  const plan = s.plan_name || "Kế hoạch HACCP";
  const st =
    s.status === "OVERDUE"
      ? "Quá hạn"
      : !isHaccpScheduleAssessmentReady(s)
        ? "Chưa đến giờ"
        : "Trong hạn";
  return `${plan} — ${when} (${st})`;
}

function CreateAssessmentModal({
  intent,
  plans,
  ccpsMap,
  stepsMap,
  schedules,
  schedulesLoading,
  monitoringReadyByPlanId,
  onClose,
  onCreated,
}: {
  intent: AssessmentCreateModalIntent;
  plans: HaccpPlan[];
  ccpsMap: Record<string, CCP[]>;
  stepsMap: Record<string, ProcessStepWithPlan[]>;
  schedules: HaccpSchedule[];
  schedulesLoading: boolean;
  monitoringReadyByPlanId: Record<string, boolean>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const presetPlanId = intent.kind === "presetPlan" ? intent.planId : null;

  const [schedulePlanFilter, setSchedulePlanFilter] = useState<string>("ALL");
  const [scheduleQuery, setScheduleQuery] = useState("");

  const schedulesBaseVisible = useMemo(() => {
    let list = schedules;
    if (presetPlanId) {
      list = list.filter((s) => s.haccp_plan_id === presetPlanId);
    } else if (schedulePlanFilter !== "ALL") {
      list = list.filter((s) => s.haccp_plan_id === schedulePlanFilter);
    }
    const copy = [...list];
    copy.sort((a, b) => {
      const ao = a.status === "OVERDUE" ? 0 : 1;
      const bo = b.status === "OVERDUE" ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
    return copy;
  }, [schedules, presetPlanId, schedulePlanFilter]);

  const schedulePool = useMemo(() => {
    const q = scheduleQuery.trim().toLowerCase();
    if (!q) return schedulesBaseVisible;
    return schedulesBaseVisible.filter((s) => {
      const hay = [
        s.plan_name,
        s.title,
        scheduleOptionLabel(s),
        new Date(s.start_time).toLocaleDateString("vi-VN"),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [schedulesBaseVisible, scheduleQuery]);

  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [title, setTitle] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  const selectedSchedule = useMemo(
    () => schedulePool.find((s) => s.id === selectedScheduleId),
    [schedulePool, selectedScheduleId],
  );

  useEffect(() => {
    setSelectedScheduleId("");
    setScheduleQuery("");
    setSchedulePlanFilter("ALL");
  }, [presetPlanId, intent.kind]);

  useEffect(() => {
    if (!selectedScheduleId) return;
    if (!schedulePool.some((s) => s.id === selectedScheduleId)) {
      setSelectedScheduleId("");
    }
  }, [schedulePool, selectedScheduleId]);

  useEffect(() => {
    if (!selectedScheduleId) return;
    const sch = schedulePool.find((s) => s.id === selectedScheduleId);
    if (!sch?.haccp_plan_id) return;
    const statusTag = sch.status === "OVERDUE" ? " — Quá hạn" : "";
    setTitle(`${sch.title || "Đánh giá HACCP"}${statusTag}`);
    setAssessmentDate(new Date(sch.start_time).toLocaleDateString("en-CA"));
  }, [selectedScheduleId, schedulePool]);

  const planIdResolved = selectedSchedule?.haccp_plan_id ?? "";
  const monitoringOk = Boolean(planIdResolved && monitoringReadyByPlanId[planIdResolved] === true);

  const handleCreate = async () => {
    if (!selectedScheduleId || !selectedSchedule?.haccp_plan_id) {
      alert("Vui lòng chọn một lịch đánh giá (lịch phải thuộc kế hoạch HACCP đang mở và chưa hoàn thành).");
      return;
    }
    const planId = selectedSchedule.haccp_plan_id;
    if (!title.trim()) {
      alert("Vui lòng nhập tiêu đề phiếu");
      return;
    }
    if (!monitoringReadyByPlanId[planId]) {
      alert(ASSESSMENT_MONITORING_GATE_MESSAGE);
      return;
    }
    const steps = stepsMap[planId] || [];
    const ccps = ccpsMap[planId] || [];
    const items = buildHaccpAssessmentAutoItemsFromPlan(steps, ccps);

    setSubmitting(true);
    try {
      await createAssessment({
        haccp_plan_id: planId,
        calendar_event_id: selectedScheduleId,
        title: title.trim(),
        assessment_date: assessmentDate,
        items,
      });
      onCreated();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : (e as Error).message;
      alert("Lỗi khi tạo phiếu: " + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const noSchedulesAvailable = !schedulesLoading && schedulesBaseVisible.length === 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Tạo Phiếu Đánh giá HACCP</h3>
        <div className="space-y-4">
          {presetPlanId && (
            <p className="text-xs text-cyan-800 bg-cyan-50 border border-cyan-100 rounded-md px-3 py-2">
              Kế hoạch:{" "}
              <span className="font-semibold">{plans.find((p) => p.id === presetPlanId)?.name || "—"}</span>
              . Chọn một lịch đánh giá đã lên cho quy trình này.
            </p>
          )}

          {!presetPlanId && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lọc theo kế hoạch</label>
              <select
                value={schedulePlanFilter}
                onChange={(e) => setSchedulePlanFilter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
              >
                <option value="ALL">Tất cả kế hoạch đang mở</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (v{p.version})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tìm lịch</label>
            <input
              type="search"
              value={scheduleQuery}
              onChange={(e) => setScheduleQuery(e.target.value)}
              placeholder="Tên kế hoạch, tiêu đề lịch, ngày giờ…"
              disabled={schedulesLoading}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Chọn lịch đánh giá *</label>
            <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/60">
              {schedulesLoading ? (
                <div className="p-4 text-sm text-slate-500">Đang tải lịch…</div>
              ) : schedulePool.length === 0 ? (
                <div className="p-4 text-sm text-slate-500">
                  {schedulesBaseVisible.length === 0
                    ? "Không có lịch nào trong bộ lọc hiện tại."
                    : "Không có lịch khớp từ khóa — xóa ô tìm hoặc đổi bộ lọc kế hoạch."}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {schedulePool.map((s) => {
                    const active = s.id === selectedScheduleId;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedScheduleId(s.id)}
                          className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${active
                            ? "bg-cyan-50 text-cyan-900 font-medium ring-1 ring-inset ring-cyan-200/80"
                            : "text-slate-800 hover:bg-white"
                            }`}
                        >
                          {scheduleOptionLabel(s)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Danh sách ưu tiên lịch quá hạn, sau đó sắp theo thời gian bắt đầu.
            </p>
            {noSchedulesAvailable && (
              <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 leading-relaxed">
                {presetPlanId
                  ? "Chưa có lịch khả dụng cho kế hoạch này (chưa hoàn thành). Hãy lập lịch từ màn hình chính."
                  : "Chưa có lịch khả dụng: thuộc kế hoạch đang mở và chưa hoàn thành."}
              </p>
            )}
            {planIdResolved && monitoringReadyByPlanId[planIdResolved] !== true && (
              <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 leading-relaxed">
                Kế hoạch gắn với lịch này chưa đủ kế hoạch giám sát CCP (Giới hạn tới hạn, Phương pháp giám sát, Người
                phụ trách cho mọi CCP) — hoàn thiện ở tab «Kế hoạch giám sát» trước.
              </p>
            )}
          </div>

          {selectedSchedule && (
            <p className="text-xs text-slate-600">
              Phiếu sẽ thuộc kế hoạch:{" "}
              <span className="font-semibold text-slate-800">
                {plans.find((p) => p.id === selectedSchedule.haccp_plan_id)?.name || selectedSchedule.plan_name || "—"}
              </span>
              . Kế hoạch trên phiếu luôn trùng với kế hoạch trên lịch đã chọn.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề phiếu</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Đánh giá theo lịch tháng 5"
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ngày đánh giá</label>
            <input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Có thể tạo phiếu trước giờ bắt đầu; điền và gửi khi đã đến giờ bắt đầu. Gửi trong khung giờ → hoàn thành; sau giờ kết thúc → quá hạn.
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={submitting || !selectedScheduleId || !title.trim() || !monitoringOk || noSchedulesAvailable}
            className="px-4 py-2 bg-cyan-600 text-white rounded-md text-sm hover:bg-cyan-700 disabled:opacity-50"
          >
            {submitting ? "Đang tạo..." : "Tạo phiếu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function sortAssessmentItems(list: HaccpAssessmentItem[]): HaccpAssessmentItem[] {
  return [...list].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
}

// =============================================================================
// Fill Assessment Modal
// =============================================================================
function FillAssessmentModal({
  assessment,
  linkedSchedule,
  onClose,
  onSubmitted,
  onAssessmentSubmitted,
  onNavigateToDeviations,
}: {
  assessment: HaccpAssessment;
  linkedSchedule?: HaccpSchedule;
  onClose: () => void;
  onSubmitted: () => void;
  onAssessmentSubmitted?: () => void;
  onNavigateToDeviations?: () => void;
}) {
  const fillUnlocked = linkedSchedule ? isHaccpScheduleAssessmentReady(linkedSchedule) : true;
  const fillOpensAt = linkedSchedule
    ? new Date(linkedSchedule.start_time).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const [items, setItems] = useState<HaccpAssessmentItem[]>(() =>
    sortAssessmentItems(assessment.items || []),
  );
  const [overallResult, setOverallResult] = useState<string>("PASS");
  const [overallNote, setOverallNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualExpected, setManualExpected] = useState("");
  const [addingManual, setAddingManual] = useState(false);

  useEffect(() => {
    setItems(sortAssessmentItems(assessment.items || []));
  }, [assessment.id]);

  const reloadItemsFromServer = async () => {
    const data = await apiFetch<HaccpAssessment>(`/haccp/assessments/${assessment.id}`);
    setItems(sortAssessmentItems(data.items || []));
  };

  const handleAddManualQuestion = async () => {
    if (!fillUnlocked) {
      alert(`Chưa đến giờ bắt đầu kiểm tra${fillOpensAt ? ` (${fillOpensAt})` : ""}.`);
      return;
    }
    const q = manualQuestion.trim();
    if (!q) {
      alert("Vui lòng nhập nội dung câu hỏi");
      return;
    }
    setAddingManual(true);
    try {
      await addAssessmentManualItem(assessment.id, {
        question: q,
        expected_value: manualExpected.trim() || undefined,
        item_type: "GENERAL",
      });
      setManualQuestion("");
      setManualExpected("");
      await reloadItemsFromServer();
    } catch (e) {
      alert("Không thêm được câu hỏi: " + (e as Error).message);
    } finally {
      setAddingManual(false);
    }
  };

  const handleDeleteGeneralItem = async (itemId: string) => {
    if (!confirm("Xóa hạng mục tự soạn này?")) return;
    try {
      await deleteAssessmentItem(itemId);
      await reloadItemsFromServer();
    } catch (e) {
      alert("Không xóa được: " + (e as Error).message);
    }
  };

  const updateItem = (itemId: string, updates: Partial<HaccpAssessmentItem>) => {
    if (!fillUnlocked) return;
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, ...updates } : it)),
    );
  };

  const handleSaveItem = async (itemId: string) => {
    if (!fillUnlocked) return;
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    try {
      await updateAssessmentItem(itemId, {
        actual_value: item.actual_value,
        batch_number: item.batch_number,
        result: item.result,
        note: item.note,
      });
    } catch (e) {
      console.error("Lỗi cập nhật item:", e);
    }
  };

  const handleSubmit = async () => {
    if (!fillUnlocked) {
      alert(`Chưa đến giờ bắt đầu kiểm tra${fillOpensAt ? ` (${fillOpensAt})` : ""}. Chỉ được gửi phiếu sau thời điểm này.`);
      return;
    }
    setSaving(true);
    try {
      // Cập nhật tất cả items trước
      await Promise.all(
        items.map((item) =>
          updateAssessmentItem(item.id, {
            actual_value: item.actual_value,
            batch_number: item.batch_number,
            result: item.result,
            note: item.note,
          }),
        ),
      );
      const submitResult = await submitAssessment(assessment.id, {
        overall_result: overallResult as "PASS" | "FAIL" | "NEEDS_IMPROVEMENT",
        overall_note: overallNote,
      });

      onAssessmentSubmitted?.();

      const deviationsCreated = submitResult.deviations_created ?? 0;
      if (deviationsCreated > 0) {
        const goDeviations = confirm(
          `Đã gửi phiếu đánh giá.\n\n${deviationsCreated} CCP không đạt đã được ghi vào tab «Độ lệch CCP» (trạng thái mới). Bạn có thể xử lý và bấm «Gửi CAPA» tại đó.\n\nMở tab Độ lệch CCP ngay?`,
        );
        if (goDeviations) {
          onNavigateToDeviations?.();
        }
      }

      onSubmitted();
    } catch (e) {
      alert("Lỗi khi gửi phiếu: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh]">
        <div className="p-6 pb-2 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 mb-1">{assessment.title}</h3>
          <p className="text-sm text-slate-500">
            {fillUnlocked
              ? "Điền kết quả khảo sát thực tế cho từng hạng mục"
              : `Chưa đến giờ bắt đầu${fillOpensAt ? ` (${fillOpensAt})` : ""} — xem trước hạng mục, chưa điền được.`}
          </p>
        </div>

        {!fillUnlocked && (
          <div className="mx-6 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Phiếu đã tạo sẵn. Đến giờ bắt đầu lịch mới được điền và gửi báo cáo.
            {linkedSchedule && (
              <span className="mt-1 block text-amber-800">
                Khung giờ: {formatHaccpScheduleWindow(linkedSchedule)}
              </span>
            )}
          </div>
        )}

        <div className={`px-6 overflow-y-auto flex-1 ${!fillUnlocked ? "opacity-60" : ""}`}>
          <fieldset disabled={!fillUnlocked} className="min-w-0 border-0 p-0 m-0">
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="border border-slate-200 rounded-lg p-4 relative">
                {item.item_type === "GENERAL" && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteGeneralItem(item.id)}
                    className="absolute top-3 right-3 text-xs text-red-600 hover:text-red-800 font-medium"
                  >
                    Xóa
                  </button>
                )}
                <div className={`flex items-start gap-3 ${item.item_type === "GENERAL" ? "pr-14" : ""}`}>
                  <span className="text-xs font-bold text-cyan-600 mt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${item.item_type === "GENERAL"
                          ? "bg-violet-100 text-violet-800"
                          : item.item_type === "PROCESS_STEP"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-orange-100 text-orange-800"
                          }`}
                      >
                        {item.item_type === "GENERAL"
                          ? "Tự soạn"
                          : item.item_type === "PROCESS_STEP"
                            ? "Bước QT"
                            : "CCP"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800">{item.question}</p>
                    {item.expected_value && (
                      <p className="text-xs text-slate-500 mt-1">
                        Giá trị mong đợi: {item.expected_value}
                      </p>
                    )}
                    <div className="mt-3 space-y-3">
                      {/* Radio group — tích chọn kết quả */}
                      <div className="flex flex-wrap gap-2">
                        {[
                          { key: "PASS", label: "Đạt", color: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100" },
                          { key: "FAIL", label: "Không đạt", color: "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" },
                          { key: "NA", label: "N/A", color: "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100" },
                        ].map((opt) => {
                          const active = item.result === opt.key;
                          return (
                            <label
                              key={opt.key}
                              className={`cursor-pointer px-4 py-2 rounded-md border text-sm font-medium transition-colors ${active ? opt.color + " ring-2 ring-offset-1 ring-cyan-300" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                            >
                              <input
                                type="radio"
                                name={`result-${item.id}`}
                                value={opt.key}
                                checked={active}
                                onChange={() => {
                                  updateItem(item.id, { result: opt.key as "PASS" | "FAIL" | "NA" | "" });
                                }}
                                onBlur={() => handleSaveItem(item.id)}
                                className="sr-only"
                              />
                              <span className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${active ? "border-current" : "border-slate-300"}`}>
                                  {active && <span className="w-2 h-2 rounded-full bg-current" />}
                                </span>
                                {opt.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {/* Nhập Số lô và Giá trị đo cho CCP */}
                      {item.item_type === "CCP" && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số lô sản xuất</label>
                            <input
                              type="text"
                              placeholder="VD: LÔ2024-05-14-A"
                              value={item.batch_number || ""}
                              onChange={(e) => updateItem(item.id, { batch_number: e.target.value })}
                              onBlur={() => handleSaveItem(item.id)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-cyan-50/30 focus:bg-white transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Giá trị đo thực tế</label>
                            <input
                              type="text"
                              placeholder="Nhập giá trị số..."
                              value={item.actual_value || ""}
                              onChange={(e) => updateItem(item.id, { actual_value: e.target.value })}
                              onBlur={() => handleSaveItem(item.id)}
                              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-cyan-50/30 focus:bg-white transition-colors"
                            />
                          </div>
                        </div>
                      )}

                      {/* Ghi chú — vẫn viết tay */}
                      <textarea
                        placeholder={
                          item.item_type === "CCP"
                            ? "Ghi chú/Hành động khắc phục (nếu có)..."
                            : item.item_type === "PROCESS_STEP"
                              ? "Ghi chú kiểm tra bước quy trình (nếu có)..."
                              : "Ghi chú khảo sát (nếu có)..."
                        }
                        value={item.note || ""}
                        onChange={(e) => updateItem(item.id, { note: e.target.value })}
                        onBlur={() => handleSaveItem(item.id)}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm resize-none mt-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-violet-200 bg-violet-50/40 p-4">
            <h4 className="text-sm font-bold text-slate-800 mb-1">Thêm câu hỏi thủ công</h4>
            <p className="text-xs text-slate-600 mb-3">
              Soạn thêm hạng mục theo quy trình thực tế (ví dụ kiểm tra PRP, ghi chép, đào tạo…). Các mục tự soạn có thể xóa trước khi gửi phiếu.
            </p>
            <div className="space-y-2">
              <textarea
                placeholder="Nội dung câu hỏi / tiêu chí kiểm tra *"
                value={manualQuestion}
                onChange={(e) => setManualQuestion(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
              />
              <input
                type="text"
                placeholder="Giá trị mong đợi hoặc căn cứ đánh giá (tuỳ chọn)"
                value={manualExpected}
                onChange={(e) => setManualExpected(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white"
              />
              <button
                type="button"
                onClick={() => void handleAddManualQuestion()}
                disabled={addingManual}
                className="px-4 py-2 text-sm font-medium rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {addingManual ? "Đang thêm…" : "Thêm hạng mục"}
              </button>
            </div>
          </div>

          {/* Overall result */}
          <div className="mt-4 border-t border-slate-200 pt-4">
            <h4 className="text-sm font-bold text-slate-800 mb-2">Kết luận tổng quát</h4>
            <div className="flex gap-4 items-start">
              <select
                value={overallResult}
                onChange={(e) => setOverallResult(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-md text-sm"
              >
                <option value="PASS">Đạt</option>
                <option value="FAIL">Không đạt</option>
                <option value="NEEDS_IMPROVEMENT">Cần cải thiện</option>
              </select>
              <textarea
                value={overallNote}
                onChange={(e) => setOverallNote(e.target.value)}
                placeholder="Nhận xét tổng quát..."
                rows={2}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm"
              />
            </div>
          </div>

          </fieldset>
        </div> {/* End Body */}

        <div className="p-6 pt-4 shrink-0 border-t border-slate-100 mt-auto">
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !fillUnlocked}
              className="px-4 py-2 bg-cyan-600 text-white rounded-md text-sm hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {saving ? "Đang đánh giá bằng AI..." : "Gửi phiếu đánh giá"}
            </button>
          </div>
        </div>
      </div> {/* End Modal Container */}
    </div>
  );

}

// =============================================================================
// Assessment Detail Modal
// =============================================================================
function AssessmentDetailModal({
  assessment,
  plans,
  onClose,
  onUpdated,
}: {
  assessment: HaccpAssessment;
  plans: HaccpPlan[];
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const isClosed = assessment.status === "CLOSED";
  const plan = plans.find((p) => p.id === assessment.haccp_plan_id);
  const passCount = assessment.items.filter((i) => i.result === "PASS").length;
  const failCount = assessment.items.filter((i) => i.result === "FAIL").length;
  const naCount = assessment.items.filter((i) => i.result === "NA").length;
  const emptyCount = assessment.items.filter((i) => !i.result).length;

  const [additionalNote, setAdditionalNote] = useState("");
  const [reviewStatus, setReviewStatus] = useState<string>(assessment.status);
  const [reviewResult, setReviewResult] = useState<string>(assessment.overall_result || "PASS");
  const [savingNote, setSavingNote] = useState(false);

  const handleSaveNote = async () => {
    if (reviewStatus === "CLOSED" && assessment.status !== "CLOSED") {
      const ok = confirm("Bạn có chắc chắn muốn đóng phiếu này không? Sau khi đóng sẽ không thể chỉnh sửa.");
      if (!ok) return;
    }

    setSavingNote(true);
    try {
      const payload: any = {
        status: reviewStatus,
        overall_result: reviewResult,
      };

      if (additionalNote.trim()) {
        payload.overall_note = assessment.overall_note
          ? assessment.overall_note + "\n\n--- Đánh giá bổ sung ---\n" + additionalNote
          : additionalNote;
      }

      await updateAssessment(assessment.id, payload);
      setAdditionalNote("");
      if (onUpdated) onUpdated();
      alert("Đã cập nhật phiếu đánh giá thành công!");
    } catch (e) {
      alert("Lỗi khi lưu đánh giá: " + (e as Error).message);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full flex flex-col max-h-[90vh]">
        {/* Header - Fixed */}
        <div className="p-6 pb-4 border-b shrink-0 flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{assessment.title}</h3>
            <p className="text-sm text-slate-500">
              Kế hoạch: {plan?.name || "-"} | Ngày: {assessment.assessment_date || "-"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            &times;
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">

          <div className="flex gap-2 mb-4">
            <StatusBadge status={assessment.status} />
            {assessment.overall_result && <ResultBadge result={assessment.overall_result} />}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-700">{passCount}</div>
              <div className="text-xs text-emerald-600">Đạt</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-700">{failCount}</div>
              <div className="text-xs text-red-600">Không đạt</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-slate-700">{naCount}</div>
              <div className="text-xs text-slate-600">N/A</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-700">{emptyCount}</div>
              <div className="text-xs text-amber-600">Chưa đánh giá</div>
            </div>
          </div>

          {assessment.overall_note && (
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <h4 className="text-sm font-bold text-slate-700 mb-1">Nhận xét tổng quát</h4>
              <p className="text-sm text-slate-600">{assessment.overall_note}</p>
            </div>
          )}

          {assessment.ai_evaluation && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
                  </svg>
                </span>
                <h4 className="text-base font-bold text-blue-900">Đánh giá & Hướng phát triển (AI)</h4>
              </div>
              <div className="text-sm text-blue-800 whitespace-pre-wrap leading-relaxed">
                {assessment.ai_evaluation}
              </div>
            </div>
          )}

          {/* Items table */}
          <h4 className="text-sm font-bold text-slate-700 mb-2">Chi tiết đánh giá</h4>
          <div className="max-h-[40vh] overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Hạng mục</th>
                  <th className="text-left px-3 py-2">Kết quả</th>
                  <th className="text-left px-3 py-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {assessment.items.map((item, idx) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{item.question}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        {item.expected_value && (
                          <div className="text-xs text-slate-500">
                            <span className="font-semibold">Mong đợi:</span> {item.expected_value}
                          </div>
                        )}
                        {item.batch_number && (
                          <div className="text-xs text-cyan-700">
                            <span className="font-semibold text-slate-500">Số lô:</span> {item.batch_number}
                          </div>
                        )}
                        {item.actual_value && (
                          <div className="text-xs text-cyan-700">
                            <span className="font-semibold text-slate-500">Giá trị đo:</span> {item.actual_value}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <ResultBadge result={item.result} />
                    </td>
                    <td className="px-3 py-2 text-slate-600">{item.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cập nhật đánh giá bổ sung nếu đã gửi hoặc đang review */}
          {assessment.status !== "DRAFT" && onUpdated && (
            <div className={`mt-6 border-t border-slate-200 pt-4 ${isClosed ? "bg-slate-100/50" : "bg-slate-50/50"} -mx-6 px-6 pb-6 rounded-b-lg`}>
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-4 bg-cyan-600 rounded-full"></span>
                Khu vực dành cho Người duyệt / Quản lý
                {isClosed && (
                  <span className="ml-auto text-[10px] text-slate-500 font-normal italic">Phiếu đã đóng - Chỉ xem</span>
                )}
              </h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái phiếu</label>
                  <select
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    disabled={isClosed}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="SUBMITTED">Đã gửi (Chờ duyệt)</option>
                    <option value="REVIEWED">Đã xem xét</option>
                    <option value="CLOSED">Hoàn tất / Đóng phiếu</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kết luận tổng quát</label>
                  <select
                    value={reviewResult}
                    onChange={(e) => setReviewResult(e.target.value)}
                    disabled={isClosed}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="PASS">Đạt (PASS)</option>
                    <option value="FAIL">Không đạt (FAIL)</option>
                    <option value="NEEDS_IMPROVEMENT">Cần cải thiện</option>
                  </select>
                </div>
              </div>

              {!isClosed && (
                <>
                  <div className="mb-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thêm ghi chú đánh giá</label>
                    <textarea
                      value={additionalNote}
                      onChange={(e) => setAdditionalNote(e.target.value)}
                      placeholder="Nhập nhận xét, hướng dẫn hoặc kết luận của người duyệt..."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm mb-3 resize-none focus:ring-1 focus:ring-cyan-500 bg-white"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveNote}
                      disabled={savingNote}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-sm transition-all flex items-center gap-2"
                    >
                      {savingNote && (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {savingNote ? "Đang lưu..." : "Lưu thay đổi & Cập nhật"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
