"use client";

import { useEffect, useState } from "react";
import {
  createDocument,
  DOCUMENT_ATTACHMENT_ALLOWED_MESSAGE,
  isAllowedDocumentUploadFile,
} from "@/api/documents-api";

type CreateDocumentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  userId: string;
  onCreated: () => void;
};

const DOC_TYPES = [
  { value: "Manual", label: "Sổ tay chất lượng" },
  { value: "SOP", label: "SOP" },
  { value: "WI", label: "WI" },
  { value: "Form", label: "Biểu mẫu" },
] as const;

export default function CreateDocumentModal({
  isOpen,
  onClose,
  orgId,
  userId,
  onCreated,
}: CreateDocumentModalProps) {
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1.0");
  const [docType, setDocType] = useState<string>("SOP");
  const [language, setLanguage] = useState("vi");
  const [department, setDepartment] = useState("");
  const [reviewPeriod, setReviewPeriod] = useState(12);
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file?.type.startsWith("image/")) {
      setFilePreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setFilePreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setVersion("1.0");
    setDocType("SOP");
    setLanguage("vi");
    setDepartment("");
    setReviewPeriod(12);
    setFile(null);
    setError(null);
    setSubmitting(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!version.trim() || !title.trim()) {
      setError("Phiên bản và tiêu đề là bắt buộc.");
      return;
    }
    if (file && !isAllowedDocumentUploadFile(file)) {
      setError(DOCUMENT_ATTACHMENT_ALLOWED_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      await createDocument({
        org_id: orgId,
        created_by: userId,
        title: title.trim(),
        doc_type: docType,
        language,
        department: department.trim() || null,
        review_period: Number(reviewPeriod) || 12,
        initial_version: version.trim(),
        tags: [],
        ai_summary: null,
        file: file ?? undefined,
      });
      onClose();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo tài liệu thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 text-left backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-800">Tạo tài liệu mới</h2>
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

        <form
          onSubmit={handleSubmit}
          className="custom-scrollbar flex-1 overflow-y-auto px-6 py-4"
        >
          <p className="mb-4 text-xs text-slate-500">
            Mã tài liệu và danh mục nội bộ do hệ thống gán. Trạng thái{" "}
            <span className="font-semibold">DRAFT</span> do hệ thống gán.
          </p>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Phiên bản <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="VD: 1.0"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 transition-all focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Tiêu đề <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề tài liệu"
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
                placeholder="VD: QA/QC"
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
          </div>

          <div className="mt-4 space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Tệp đính kèm (PDF, ảnh)
            </label>
            <div className="flex w-full items-center justify-center">
              {!file ? (
                <label
                  htmlFor="dropzone-file"
                  className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:bg-slate-100"
                >
                  <div className="flex flex-col items-center justify-center pb-6 pt-5 text-center">
                    <svg
                      className="mx-auto mb-3 h-8 w-8 text-slate-400"
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 20 16"
                    >
                      <path
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                      />
                    </svg>
                    <p className="mb-2 text-sm text-slate-500">
                      <span className="font-semibold text-cyan-600">
                        Nhấn để chọn tệp
                      </span>{" "}
                      hoặc kéo thả vào đây
                    </p>
                    <p className="px-2 text-xs text-slate-400">
                      Chỉ PDF và ảnh (PNG, JPG, …)
                    </p>
                  </div>
                  <input
                    id="dropzone-file"
                    type="file"
                    className="hidden"
                    accept="application/pdf,image/*,.pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (f && !isAllowedDocumentUploadFile(f)) {
                        setError(DOCUMENT_ATTACHMENT_ALLOWED_MESSAGE);
                        setFile(null);
                        e.target.value = "";
                        return;
                      }
                      setError(null);
                      setFile(f);
                    }}
                  />
                </label>
              ) : (
                <div className="flex w-full items-center justify-between rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
                  <div className="flex min-w-0 flex-1 items-center space-x-4">
                    <div className="shrink-0 rounded-lg border border-cyan-100 bg-white p-2.5 text-cyan-600 shadow-sm">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-slate-700">
                        {file.name}
                      </span>
                      <span className="mt-0.5 text-xs text-slate-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="ml-2 shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    title="Xóa tệp"
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
              )}
            </div>
            {filePreviewUrl ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Xem trước ảnh
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={filePreviewUrl}
                  alt={file?.name ?? ""}
                  className="mx-auto max-h-48 max-w-full object-contain"
                />
              </div>
            ) : file ? (
              <p className="mt-2 text-xs text-slate-500">
                Đã chọn tệp:{" "}
                <span className="font-medium text-slate-700">{file.name}</span>
                {file.type.startsWith("image/") ? null : (
                  <span className="text-slate-400">
                    {" "}
                    (PDF: xem sau khi lưu; ảnh xem trước tại đây)
                  </span>
                )}
              </p>
            ) : null}
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
              {submitting ? "Đang lưu…" : "Lưu tài liệu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
