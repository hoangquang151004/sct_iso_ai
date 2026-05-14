"use client";

import { useState, useCallback } from "react";
import { HaccpPlan, ProcessStep, CCP, HaccpAssessment, HaccpAssessmentItem } from "@/lib/types";
import {
  useHaccpAssessments,
  createAssessment,
  submitAssessment,
  updateAssessmentItem,
  updateAssessment,
  deleteAssessment,
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

export default function AssessmentPanel({
  plans,
  stepsMap,
  ccpsMap,
}: {
  plans: HaccpPlan[];
  stepsMap: Record<string, ProcessStep[]>;
  ccpsMap: Record<string, CCP[]>;
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
            Tạo, điền và gửi phiếu đánh giá khảo sát thực tế
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
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewTab === "draft"
                ? "bg-white text-cyan-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Bản nháp ({draftAssessments.length})
          </button>
          <button
            onClick={() => setViewTab("submitted")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewTab === "submitted"
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
          stepsMap={stepsMap}
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
  stepsMap,
  ccpsMap,
  onClose,
  onCreated,
}: {
  plans: HaccpPlan[];
  stepsMap: Record<string, ProcessStep[]>;
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
    const steps = stepsMap[selectedPlanId] || [];
    const ccps = ccpsMap[selectedPlanId] || [];

    // Tự động sinh các hạng mục đánh giá
    const items: CreateAssessmentPayload["items"] = [];
    let order = 0;

    // Câu hỏi chung — kiểm tra 7 nguyên tắc HACCP và điều kiện thực tế
    items.push({
      item_type: "GENERAL",
      question: "Nhóm HACCP có được thành lập đầy đủ và hoạt động hiệu quả không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Sơ đồ quy trình có được lập và cập nhật theo thực tế không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Phân tích nguy cơ (mô tả + mức độ) có đầy đủ và phù hợp không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Hồ sơ tài liệu HACCP có được lưu trữ đầy đủ và dễ tra cứu không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Nhân viên vận hành tại các CCP có được đào tạo, biết nhiệm vụ và hành động khắc phục không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Thiết bị đo lường, giám sát tại CCP có được hiệu chuẩn định kỳ, có chứng nhận không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Có thủ tục xác minh (verification) định kỳ và lịch sử xác minh không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Khi vượt giới hạn tới hạn, có hành động khắc phục ngay, đánh giá sản phẩm và lưu hồ sơ không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Nguy cơ phòng ngừa chéo (cross-contamination), nhiễm bẩn được kiểm soát không?",
      order_index: order++,
    });
    items.push({
      item_type: "GENERAL",
      question: "Cơ sở vật chất, thiết bị chế biến đảm bảo vệ sinh, bảo trì định kỳ không?",
      order_index: order++,
    });

    // Câu hỏi cho từng Process Step — kiểm tra quy trình, nguy cơ, kiểm soát
    steps.forEach((step) => {
      items.push({
        item_type: "PROCESS_STEP",
        ref_id: step.id,
        question: `Bước ${step.step_order}: ${step.name} — Quy trình được thực hiện đúng theo mô tả (${step.description || "—"})?`,
        expected_value: "Thực hiện đúng theo quy trình được phê duyệt",
        order_index: order++,
      });
      items.push({
        item_type: "PROCESS_STEP",
        ref_id: step.id,
        question: `Bước ${step.step_order}: ${step.name} — Các nguy cơ sinh học/hóa học/vật lý được xác định và kiểm soát không?`,
        expected_value: "Xác định đầy đủ nguy cơ và có biện pháp kiểm soát",
        order_index: order++,
      });
      items.push({
        item_type: "PROCESS_STEP",
        ref_id: step.id,
        question: `Bước ${step.step_order}: ${step.name} — Có phải CCP không? Nếu có, giám sát và hồ sơ có đầy đủ không?`,
        expected_value: "Xác định đúng CCP, có giám sát và hồ sơ đầy đủ",
        order_index: order++,
      });
    });

    // Câu hỏi cho từng CCP — kiểm tra giám sát, ghi chép, giới hạn, khắc phục
    ccps.forEach((ccp) => {
      items.push({
        item_type: "CCP",
        ref_id: ccp.id,
        question: `CCP ${ccp.ccp_code}: ${ccp.name} — Thiết bị giám sát (${ccp.monitoring_method || "—"}) hoạt động chính xác, được hiệu chuẩn không?`,
        expected_value: "Thiết bị hoạt động tốt, có chứng nhận hiệu chuẩn",
        order_index: order++,
      });
      items.push({
        item_type: "CCP",
        ref_id: ccp.id,
        question: `CCP ${ccp.ccp_code}: ${ccp.name} — Giá trị giám sát có nằm trong giới hạn tới hạn (${ccp.critical_limit}) không?`,
        expected_value: ccp.critical_limit,
        order_index: order++,
      });
      items.push({
        item_type: "CCP",
        ref_id: ccp.id,
        question: `CCP ${ccp.ccp_code}: ${ccp.name} — Hồ sơ giám sát (${ccp.monitoring_frequency || "—"}) có được ghi đầy đủ, rõ ràng, có chữ ký không?`,
        expected_value: "Ghi chép đầy đủ, đúng tần suất, có chữ ký xác nhận",
        order_index: order++,
      });
      items.push({
        item_type: "CCP",
        ref_id: ccp.id,
        question: `CCP ${ccp.ccp_code}: ${ccp.name} — Khi vượt giới hạn, có hành động khắc phục ngay và lưu hồ sơ không?`,
        expected_value: "Có corrective action và hồ sơ điều chỉnh đầy đủ",
        order_index: order++,
      });
    });

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

// =============================================================================
// Fill Assessment Modal
// =============================================================================
function FillAssessmentModal({
  assessment,
  onClose,
  onSubmitted,
}: {
  assessment: HaccpAssessment;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [items, setItems] = useState<HaccpAssessmentItem[]>(assessment.items || []);
  const [overallResult, setOverallResult] = useState<string>("PASS");
  const [overallNote, setOverallNote] = useState("");
  const [saving, setSaving] = useState(false);

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
            result: item.result,
            note: item.note,
          }),
        ),
      );
      await submitAssessment(assessment.id, {
        overall_result: overallResult as "PASS" | "FAIL" | "NEEDS_IMPROVEMENT",
        overall_note: overallNote,
      });
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
            <div key={item.id} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <span className="text-xs font-bold text-cyan-600 mt-0.5">{idx + 1}</span>
                <div className="flex-1">
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
                    {/* Ghi chú — vẫn viết tay */}
                    <textarea
                      placeholder="Ghi chú khảo sát (nếu có)..."
                      value={item.note || ""}
                      onChange={(e) => updateItem(item.id, { note: e.target.value })}
                      onBlur={() => handleSaveItem(item.id)}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
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
  const [savingNote, setSavingNote] = useState(false);

  const handleSaveNote = async () => {
    if (!additionalNote.trim()) return;
    setSavingNote(true);
    try {
      const newNote = assessment.overall_note 
        ? assessment.overall_note + "\n\n--- Đánh giá bổ sung ---\n" + additionalNote
        : additionalNote;
      await updateAssessment(assessment.id, { overall_note: newNote, status: "REVIEWED" });
      if (onUpdated) onUpdated();
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
                    {item.expected_value && (
                      <div className="text-xs text-slate-500">
                        Mong đợi: {item.expected_value}
                      </div>
                    )}
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

        {/* Thêm đánh giá bổ sung nếu đã submit */}
        {assessment.status === "SUBMITTED" && onUpdated && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <h4 className="text-sm font-bold text-slate-800 mb-2">Thêm đánh giá bổ sung (Người duyệt)</h4>
            <textarea
              value={additionalNote}
              onChange={(e) => setAdditionalNote(e.target.value)}
              placeholder="Nhập nhận xét, đánh giá thêm hoặc kết luận của người duyệt..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm mb-3 resize-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNote}
                disabled={savingNote || !additionalNote.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
              >
                {savingNote && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {savingNote ? "Đang lưu..." : "Lưu đánh giá bổ sung"}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
