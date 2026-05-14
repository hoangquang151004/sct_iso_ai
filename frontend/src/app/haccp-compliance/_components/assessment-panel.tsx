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
  useAllCCPLogs,
  CreateAssessmentPayload,
} from "@/api/hooks/use-haccp";
import { apiFetch } from "@/api/api-client";

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

/**
 * Sinh hạng mục phiếu đánh giá từ CCP hiện có (kế hoạch giám sát / danh mục CCP),
 * không dùng bộ câu hỏi GENERAL/PROCESS_STEP dựng sẵn.
 * Mỗi CCP một mục: kiểm tra giới hạn tới hạn — dùng khi gửi phiếu để ghi nhật ký giám sát.
 */
export function buildHaccpAssessmentAutoItemsFromCcps(ccps: CCP[]): CreateAssessmentPayload["items"] {
  let order = 0;
  return ccps.map((ccp) => ({
    item_type: "CCP" as const,
    ref_id: ccp.id,
    question: `CCP ${ccp.ccp_code}: ${ccp.name} — Giá trị giám sát có nằm trong giới hạn tới hạn (${ccp.critical_limit || "—"}) không?`,
    expected_value: ccp.critical_limit || undefined,
    order_index: order++,
  }));
}

export default function AssessmentPanel({
  plans,
  ccpsMap,
  pendingCreateFromPlanId = null,
  onConsumePendingCreate,
  onLogsSyncedFromAssessment,
}: {
  plans: HaccpPlan[];
  ccpsMap: Record<string, CCP[]>;
  pendingCreateFromPlanId?: string | null;
  onConsumePendingCreate?: () => void;
  onLogsSyncedFromAssessment?: () => void;
}) {
  const [viewTab, setViewTab] = useState<"draft" | "submitted">("draft");
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const [assessmentSearch, setAssessmentSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [currentAssessment, setCurrentAssessment] = useState<HaccpAssessment | null>(null);
  const [detailView, setDetailView] = useState<HaccpAssessment | null>(null);

  const planQuery = planFilter === "ALL" ? null : planFilter;
  // Luôn fetch tất cả trạng thái để tính đúng số lượng cho cả 2 tab
  const { assessments, loading, error, refetch } = useHaccpAssessments(planQuery, null);

  useEffect(() => {
    if (!pendingCreateFromPlanId || !onConsumePendingCreate) return;
    const planId = pendingCreateFromPlanId;
    const ccps = ccpsMap[planId] ?? [];
    const plan = plans.find((p) => p.id === planId);
    let cancelled = false;

    void (async () => {
      try {
        const items = buildHaccpAssessmentAutoItemsFromCcps(ccps);
        const today = new Date().toISOString().split("T")[0];
        const title = `Mẫu đánh giá sau kế hoạch giám sát — ${plan?.name || "HACCP"} — ${today}`;
        await createAssessment({
          haccp_plan_id: planId,
          title,
          assessment_date: today,
          items,
        });
        if (!cancelled) {
          alert(
            ccps.length === 0
              ? "Đã tạo phiếu đánh giá (chưa có CCP trên kế hoạch — chưa có hạng mục kiểm tra). Thêm CCP rồi tạo phiếu mới hoặc bổ sung hạng mục sau."
              : `Đã tạo phiếu với ${ccps.length} hạng mục (mỗi CCP: kiểm tra giới hạn tới hạn theo dữ liệu hiện có). Điền và «Gửi phiếu» để ghi nhật ký giám sát.`,
          );
          await refetch();
          onConsumePendingCreate();
        }
      } catch (e) {
        if (!cancelled) {
          alert("Không tạo được mẫu phiếu đánh giá: " + (e as Error).message);
          onConsumePendingCreate();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pendingCreateFromPlanId, onConsumePendingCreate, ccpsMap, plans, refetch]);

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
            Hạng mục CCP tự sinh; trong «Điền form» có thể thêm câu hỏi thủ công theo quy trình
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
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
      {isCreating && (
        <CreateAssessmentModal
          plans={plans}
          ccpsMap={ccpsMap}
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            setIsCreating(false);
            refetch();
          }}
        />
      )}

      {/* Fill Form Modal */}
      {isFilling && currentAssessment && (
        <FillAssessmentModal
          assessment={currentAssessment}
          onClose={() => {
            setIsFilling(false);
            setCurrentAssessment(null);
          }}
          onSubmitted={() => {
            setIsFilling(false);
            setCurrentAssessment(null);
            refetch();
          }}
          onLogsSyncedFromAssessment={onLogsSyncedFromAssessment}
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
function CreateAssessmentModal({
  plans,
  ccpsMap,
  onClose,
  onCreated,
}: {
  plans: HaccpPlan[];
  ccpsMap: Record<string, CCP[]>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [title, setTitle] = useState("");
  const [assessmentDate, setAssessmentDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!selectedPlanId || !title) {
      alert("Vui lòng chọn kế hoạch và nhập tiêu đề");
      return;
    }
    const ccps = ccpsMap[selectedPlanId] || [];
    const items = buildHaccpAssessmentAutoItemsFromCcps(ccps);

    setSubmitting(true);
    try {
      await createAssessment({
        haccp_plan_id: selectedPlanId,
        title,
        assessment_date: assessmentDate,
        items,
      });
      onCreated();
    } catch (e) {
      alert("Lỗi khi tạo phiếu: " + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Tạo Phiếu Đánh giá HACCP</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kế hoạch HACCP</label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm"
            >
              <option value="">-- Chọn kế hoạch --</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (v{p.version})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề phiếu</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Đánh giá Q2/2025 - Dây chuyền sản xuất A"
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
            Hạng mục CCP được tạo tự động theo danh sách CCP. Sau khi tạo phiếu, mở «Điền form» để thêm câu hỏi thủ công
            theo quy trình (PRP, ghi chép, đào tạo…). Nếu kế hoạch chưa có CCP, phiếu sẽ không có hạng mục CCP.
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
          >
            Hủy
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting}
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
function isCcpCriticalLimitAssessmentItem(item: HaccpAssessmentItem): boolean {
  return (
    item.item_type === "CCP" &&
    Boolean(item.ref_id) &&
    /giới hạn tới hạn/i.test(item.question) &&
    /Giá trị giám sát có nằm trong/i.test(item.question)
  );
}

function FillAssessmentModal({
  assessment,
  onClose,
  onSubmitted,
  onLogsSyncedFromAssessment,
}: {
  assessment: HaccpAssessment;
  onClose: () => void;
  onSubmitted: () => void;
  onLogsSyncedFromAssessment?: () => void;
}) {
  const [items, setItems] = useState<HaccpAssessmentItem[]>(() =>
    sortAssessmentItems(assessment.items || []),
  );
  const [overallResult, setOverallResult] = useState<string>("PASS");
  const [overallNote, setOverallNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [manualQuestion, setManualQuestion] = useState("");
  const [manualExpected, setManualExpected] = useState("");
  const [addingManual, setAddingManual] = useState(false);

  // Lấy toàn bộ nhật ký để gợi ý số lô
  const { logs: allLogs } = useAllCCPLogs(assessment.haccp_plan_id);
  const suggestedBatches = useMemo(() => {
    if (!allLogs) return [];
    const unique = Array.from(new Set(allLogs.map(l => l.batch_number).filter(Boolean)));
    return unique.slice(0, 10); // Lấy 10 lô gần nhất
  }, [allLogs]);

  useEffect(() => {
    setItems(sortAssessmentItems(assessment.items || []));
  }, [assessment.id]);

  const reloadItemsFromServer = async () => {
    const data = await apiFetch<HaccpAssessment>(`/haccp/assessments/${assessment.id}`);
    setItems(sortAssessmentItems(data.items || []));
  };

  const handleAddManualQuestion = async () => {
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
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, ...updates } : it)),
    );
  };

  const handleSaveItem = async (itemId: string) => {
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
      await submitAssessment(assessment.id, {
        overall_result: overallResult as "PASS" | "FAIL" | "NEEDS_IMPROVEMENT",
        overall_note: overallNote,
      });

      const limitItems = items.filter(isCcpCriticalLimitAssessmentItem);
      const logErrors: string[] = [];
      for (const it of limitItems) {
        const rid = it.ref_id;
        if (!rid) continue;
        if (!it.result || it.result === "NA") continue;
        const isWithin = it.result === "PASS";
        const raw = String(it.actual_value ?? "").trim().replace(",", ".");
        const parsed = parseFloat(raw);
        const body: Record<string, unknown> = {
          ccp_id: rid,
          is_within_limit: isWithin,
          batch_number: it.batch_number?.trim() || undefined,
        };
        if (!Number.isNaN(parsed)) {
          body.measured_value = parsed;
        }
        if (!isWithin) {
          body.deviation_note =
            (it.note || "").trim() || "Không đạt theo phiếu đánh giá HACCP";
        }
        try {
          await apiFetch(`/haccp/ccps/${rid}/logs`, {
            method: "POST",
            body: JSON.stringify(body),
          });
        } catch (err) {
          logErrors.push(`${rid}: ${(err as Error).message}`);
        }
      }
      if (logErrors.length > 0) {
        alert(
          "Phiếu đã gửi nhưng một số nhật ký giám sát chưa ghi được:\n" + logErrors.join("\n"),
        );
      }
      onLogsSyncedFromAssessment?.();

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
            Điền kết quả khảo sát thực tế cho từng hạng mục
          </p>
        </div>

        <div className="px-6 overflow-y-auto flex-1">
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
                <div className="flex items-start gap-3 pr-14">
                  <span className="text-xs font-bold text-cyan-600 mt-0.5">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${item.item_type === "GENERAL"
                            ? "bg-violet-100 text-violet-800"
                            : "bg-orange-100 text-orange-800"
                          }`}
                      >
                        {item.item_type === "GENERAL" ? "Tự soạn" : "CCP"}
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
                              list="batch-suggestions"
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
                        placeholder={item.item_type === "CCP" ? "Ghi chú/Hành động khắc phục (nếu có)..." : "Ghi chú khảo sát (nếu có)..."}
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

        </div>
      </div>

      <datalist id="batch-suggestions">
        {suggestedBatches.map(b => (
          <option key={b} value={b} />
        ))}
      </datalist>

      <div className="p-6 pt-4 shrink-0 border-t border-slate-100 mt-2">
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
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
            <div className="mt-6 border-t border-slate-200 pt-4 bg-slate-50/50 -mx-6 px-6 pb-6 rounded-b-lg">
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-4 bg-cyan-600 rounded-full"></span>
                Khu vực dành cho Người duyệt / Quản lý
              </h4>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái phiếu</label>
                  <select
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-cyan-500"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="PASS">Đạt (PASS)</option>
                    <option value="FAIL">Không đạt (FAIL)</option>
                    <option value="NEEDS_IMPROVEMENT">Cần cải thiện</option>
                  </select>
                </div>
              </div>

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
