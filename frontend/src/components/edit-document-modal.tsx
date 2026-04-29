"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type DocumentDto,
  type DocumentVersionDto,
  getDocument,
  isImageFileForPreview,
  listDocumentVersions,
  resolvePublicFileUrl,
  updateDocument,
} from "@/api/documents-api";

type EditDocumentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  documentId: string | null;
  userId: string;
  onUpdated: () => void;
};

const DOC_TYPES = [
  { value: "Manual", label: "Sổ tay chất lượng" },
  { value: "SOP", label: "SOP" },
  { value: "WI", label: "WI" },
  { value: "Form", label: "Biểu mẫu" },
] as const;

type ApprovalChoice = "review" | "approved" | "rejected";

function approvalChoiceFromDoc(doc: DocumentDto): ApprovalChoice {
  const s = (doc.status ?? "").toUpperCase();
  if (s === "REJECTED") return "rejected";
  if (s === "APPROVED" || doc.approved_at) return "approved";
  return "review";
}

export default function EditDocumentModal({
  isOpen,
  onClose,
  documentId,
  userId,
  onUpdated,
}: EditDocumentModalProps) {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [docCode, setDocCode] = useState("");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<string>("SOP");
  const [language, setLanguage] = useState("vi");
  const [department, setDepartment] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState(12);
  const [approval, setApproval] = useState<ApprovalChoice>("review");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersionDto[]>([]);

  const resetFromDoc = useCallback((doc: DocumentDto) => {
    setDocCode(doc.doc_code);
    setTitle(doc.title);
    setDocType(doc.doc_type);
    setLanguage(doc.language || "vi");
    setDepartment(doc.department ?? "");
    setReviewPeriod(doc.review_period ?? 12);
    setApproval(approvalChoiceFromDoc(doc));
    setLoadError(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    let cancelled = false;
    setLoadingDoc(true);
    setLoadError(null);
    setError(null);
    setVersions([]);
    void (async () => {
      try {
        const [doc, vers] = await Promise.all([
          getDocument(documentId),
          listDocumentVersions(documentId),
        ]);
        if (cancelled) return;
        resetFromDoc(doc);
        setVersions(vers);
      } catch (e) {
        if (cancelled) return;
        setLoadError(
          e instanceof Error ? e.message : "Không tải được tài liệu",
        );
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, documentId, resetFromDoc]);

  if (!isOpen || !documentId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Tiêu đề là bắt buộc.");
      return;
    }
    const status =
      approval === "approved"
        ? "APPROVED"
        : approval === "rejected"
          ? "REJECTED"
          : "PENDING_REVIEW";

    setSubmitting(true);
    try {
      await updateDocument(documentId, {
        title: title.trim(),
        doc_type: docType,
        language,
        department: department.trim() || null,
        review_period: Number(reviewPeriod) || 12,
        status,
        ...(status === "APPROVED" ? { approved_by: userId } : {}),
      });
      onClose();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/40 p-4 text-left backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">Chỉnh sửa tài liệu</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {loadingDoc ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">
            Đang tải tài liệu…
          </p>
        ) : loadError ? (
          <div className="px-6 py-8">
            <p className="text-center text-sm text-rose-600" role="alert">
              {loadError}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Đóng
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="custom-scrollbar flex-1 overflow-y-auto px-6 py-4"
          >
            <p className="mb-4 text-xs text-slate-500">
              Mã tài liệu:{" "}
              <span className="font-mono font-semibold text-slate-700">
                {docCode}
              </span>
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Tiêu đề <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Loại tài liệu
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                  >
                    {DOC_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Ngôn ngữ
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">Tiếng Anh</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Phòng ban
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Chu kỳ rà soát (tháng)
                </label>
                <input
                  type="number"
                  min={1}
                  value={reviewPeriod}
                  onChange={(e) => setReviewPeriod(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <p className="text-sm font-semibold text-slate-700">
                  {"Phiên bản & tệp đính kèm"}
                </p>
                {versions.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Chưa có tệp trong hệ thống.
                  </p>
                ) : (
                  <ul className="mt-2 max-h-48 space-y-3 overflow-y-auto text-xs">
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="rounded-lg border border-slate-200 bg-white p-2"
                      >
                        <div className="font-semibold text-slate-800">
                          v{v.version}
                        </div>
                        {isImageFileForPreview(v.file_type, v.file_url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolvePublicFileUrl(v.file_url)}
                            alt=""
                            className="mt-1 max-h-28 w-full rounded border object-contain"
                          />
                        ) : null}
                        <a
                          href={resolvePublicFileUrl(v.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-cyan-600 underline hover:text-cyan-800"
                        >
                          Mở / tải tệp
                        </a>
                        {v.file_type ? (
                          <span className="ml-1 text-slate-400">
                            ({v.file_type})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <legend className="px-1 text-sm font-semibold text-slate-700">
                  Duyệt tài liệu
                </legend>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="doc-approval"
                    checked={approval === "review"}
                    onChange={() => setApproval("review")}
                    className="text-cyan-600"
                  />
                  Đang xem xét
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="doc-approval"
                    checked={approval === "approved"}
                    onChange={() => setApproval("approved")}
                    className="text-cyan-600"
                  />
                  Đã duyệt
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="doc-approval"
                    checked={approval === "rejected"}
                    onChange={() => setApproval("rejected")}
                    className="text-cyan-600"
                  />
                  Từ chối
                </label>
              </fieldset>
            </div>

            {error ? (
              <p className="mt-4 text-sm text-rose-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-8 flex gap-3 pb-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 transition-all hover:bg-cyan-700 active:scale-95 disabled:opacity-50"
              >
                {submitting ? "Đang lưu…" : "Lưu thay đổi"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
