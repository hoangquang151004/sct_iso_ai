"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/layout/app-shell";
import CreateDocumentModal from "@/components/create-document-modal";
import EditDocumentModal from "@/components/edit-document-modal";
import DocumentScheduleModal, {
  type DocumentAutoScheduleState,
  formatDocumentScheduleSummary,
  loadDocumentSchedule,
} from "@/components/document-schedule-modal";
import {
  type DocumentCategoryDto,
  type DocumentDto,
  type DocumentVersionDto,
  deleteDocument,
  getDocument,
  isImageFileForPreview,
  listDocumentCategories,
  listDocumentVersions,
  listDocuments,
  resolvePublicFileUrl,
  syncDocumentUiContext,
} from "@/api/documents-api";

const DOC_TYPE_LABELS: Record<string, string> = {
  Manual: "Sổ tay chất lượng",
  SOP: "SOP",
  WI: "WI",
  Form: "Biểu mẫu",
};

function isRejected(doc: DocumentDto): boolean {
  return (doc.status ?? "").toUpperCase() === "REJECTED";
}

function isApproved(doc: DocumentDto): boolean {
  if (isRejected(doc)) return false;
  if (doc.approved_at) return true;
  return (doc.status ?? "").toUpperCase() === "APPROVED";
}

function workflowStatusLabel(
  doc: DocumentDto,
): "Đã Duyệt" | "Đang Xem Xét" | "Từ chối" {
  if (isRejected(doc)) return "Từ chối";
  if (isApproved(doc)) return "Đã Duyệt";
  return "Đang Xem Xét";
}

function workflowStatusClass(doc: DocumentDto) {
  if (isRejected(doc)) return "text-rose-600";
  if (isApproved(doc)) return "text-emerald-600";
  return "text-amber-600";
}

function displayDocType(docType: string) {
  return DOC_TYPE_LABELS[docType] ?? docType;
}

/** Chuỗi ISO không kèm múi giờ từ backend là UTC — ép Z. Chuỗi có Z/+00:00 đã là UTC thì format ra giờ VN. */
function parseBackendDateTime(raw: string): Date {
  let s = raw.trim();
  if (!s) return new Date(NaN);
  s = s.replace(" ", "T");
  s = s.replace(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d{3})\d+/,
    "$1$2",
  );
  const hasExplicitTz =
    /Z$/i.test(s) ||
    /[+-]\d{2}:\d{2}$/.test(s) ||
    /[+-]\d{4}$/.test(s);
  if (hasExplicitTz) return new Date(s);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    return new Date(`${s}Z`);
  }
  return new Date(s);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseBackendDateTime(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(n: number | null | undefined): string {
  if (n == null || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function DocumentControlPage() {
  const envOrgId = process.env.NEXT_PUBLIC_ORG_ID?.trim() ?? "";
  const envUserId = process.env.NEXT_PUBLIC_USER_ID?.trim() ?? "";

  const [effectiveOrgId, setEffectiveOrgId] = useState("");
  const [effectiveUserId, setEffectiveUserId] = useState("");
  const [contextReady, setContextReady] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [categories, setCategories] = useState<DocumentCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [autoSchedule, setAutoSchedule] =
    useState<DocumentAutoScheduleState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [editSuccessOpen, setEditSuccessOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentDto | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailDoc, setDetailDoc] = useState<DocumentDto | null>(null);
  const [detailVersions, setDetailVersions] = useState<DocumentVersionDto[]>(
    [],
  );
  const [detailError, setDetailError] = useState<string | null>(null);

  /** Tránh kẹt “Đang lấy cấu hình…” khi React Strict Mode hủy effect trước khi fetch xong. */
  const bootstrapGen = useRef(0);

  useEffect(() => {
    const gen = ++bootstrapGen.current;
    (async () => {
      if (envOrgId && envUserId) {
        if (bootstrapGen.current !== gen) return;
        setEffectiveOrgId(envOrgId);
        setEffectiveUserId(envUserId);
        setContextError(null);
        setContextReady(true);
        return;
      }
      try {
        const ctx = await syncDocumentUiContext();
        if (bootstrapGen.current !== gen) return;
        setEffectiveOrgId(ctx.org_id);
        setEffectiveUserId(ctx.user_id);
        setContextError(null);
      } catch (e) {
        if (bootstrapGen.current !== gen) return;
        setContextError(
          e instanceof Error ? e.message : "Không lấy được org/user từ server",
        );
      } finally {
        if (bootstrapGen.current === gen) setContextReady(true);
      }
    })();
  }, [envOrgId, envUserId]);

  const categoryById = useMemo(() => {
    const m = new Map<string, DocumentCategoryDto>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const loadData = useCallback(async () => {
    if (!effectiveOrgId) {
      setLoading(false);
      setDocuments([]);
      setCategories([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [docs, cats] = await Promise.all([
        listDocuments(effectiveOrgId),
        listDocumentCategories(effectiveOrgId),
      ]);
      setDocuments(docs);
      setCategories(cats);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Không tải được dữ liệu");
      setDocuments([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId]);

  useEffect(() => {
    if (!contextReady) return;
    void loadData();
  }, [contextReady, loadData]);

  useEffect(() => {
    if (!effectiveOrgId || typeof window === "undefined") {
      setAutoSchedule(null);
      return;
    }
    setAutoSchedule(loadDocumentSchedule(effectiveOrgId));
  }, [effectiveOrgId]);

  const filtered = useMemo(() => {
    let list = documents;
    if (docTypeFilter.trim()) {
      list = list.filter((d) => d.doc_type === docTypeFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.doc_code.toLowerCase().includes(q) ||
        (d.department?.toLowerCase().includes(q) ?? false),
    );
  }, [documents, search, docTypeFilter]);

  const handleDocumentCreated = useCallback(() => {
    void loadData();
    setSuccessOpen(true);
  }, [loadData]);

  const handleDocumentUpdated = useCallback(() => {
    void loadData();
    setEditSuccessOpen(true);
  }, [loadData]);

  const executeDelete = useCallback(
    async (doc: DocumentDto) => {
      setLoadError(null);
      setDeletingId(doc.id);
      try {
        await deleteDocument(doc.id, doc.org_id);
        setDeleteTarget(null);
        await loadData();
        setDeleteSuccessOpen(true);
      } catch (e) {
        setLoadError(
          e instanceof Error ? e.message : "Không xóa được tài liệu",
        );
      } finally {
        setDeletingId(null);
      }
    },
    [loadData],
  );

  const openDocumentDetail = useCallback(async (documentId: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setDetailDoc(null);
    setDetailVersions([]);
    try {
      const [doc, versions] = await Promise.all([
        getDocument(documentId),
        listDocumentVersions(documentId),
      ]);
      setDetailDoc(doc);
      setDetailVersions(versions);
    } catch (e) {
      setDetailError(
        e instanceof Error ? e.message : "Không tải được chi tiết tài liệu",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDocumentDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailLoading(false);
    setDetailDoc(null);
    setDetailVersions([]);
    setDetailError(null);
  }, []);

  const configMissing =
    contextReady &&
    (!!contextError || !effectiveOrgId || !effectiveUserId);

  const handleScheduleSaved = useCallback((state: DocumentAutoScheduleState) => {
    setAutoSchedule(state);
  }, []);

  return (
    <AppShell activePath="/document-control">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-5xl font-extrabold text-slate-800">
          Quản lý tài liệu
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!contextReady || configMissing}
            onClick={() => setScheduleModalOpen(true)}
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-cyan-300 hover:bg-cyan-50/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Đặt lịch tự động
          </button>
          <button
            type="button"
            disabled={!contextReady || configMissing}
            onClick={() => setIsModalOpen(true)}
            className="cursor-pointer rounded-lg bg-cyan-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-cyan-600/20 transition-all hover:bg-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Tạo tài liệu
          </button>
        </div>
      </div>

      {!configMissing &&
      effectiveOrgId &&
      autoSchedule &&
      (autoSchedule.enabled || autoSchedule.updatedAt) ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-800">
            Lịch tự động (chỉ trên trình duyệt):{" "}
          </span>
          {formatDocumentScheduleSummary(autoSchedule)}
          {autoSchedule.updatedAt ? (
            <span className="mt-1 block text-xs text-slate-500">
              Cập nhật cấu hình:{" "}
              {formatDateTime(autoSchedule.updatedAt)}
            </span>
          ) : null}
        </div>
      ) : null}

      <DocumentScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        orgId={effectiveOrgId}
        onSaved={handleScheduleSaved}
      />

      {configMissing ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Chưa kết nối được ngữ cảnh tài liệu</p>
          <p className="mt-1">
            {contextError ? (
              <>
                Lỗi: {contextError}. Kiểm tra backend đang chạy, CORS, và biến{" "}
                <code className="rounded bg-amber-100/80 px-1">
                  ENABLE_DOCUMENT_UI_BOOTSTRAP=true
                </code>{" "}
                trong <code className="rounded bg-amber-100/80 px-1">backend/.env</code>
                .
              </>
            ) : (
              <>
                Tạo file{" "}
                <code className="rounded bg-amber-100/80 px-1">
                  frontend/.env.local
                </code>{" "}
                với{" "}
                <code className="rounded bg-amber-100/80 px-1">
                  NEXT_PUBLIC_ORG_ID
                </code>{" "}
                và{" "}
                <code className="rounded bg-amber-100/80 px-1">
                  NEXT_PUBLIC_USER_ID
                </code>
                , hoặc đảm bảo API{" "}
                <code className="rounded bg-amber-100/80 px-1">
                  /documents/ui-context/sync
                </code>{" "}
                hoạt động và PostgreSQL đã có bảng/schema.
              </>
            )}
          </p>
        </div>
      ) : null}

      {loadError && !configMissing ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {loadError}
        </div>
      ) : null}

      <CreateDocumentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        orgId={effectiveOrgId}
        userId={effectiveUserId}
        onCreated={handleDocumentCreated}
      />

      <EditDocumentModal
        isOpen={editDocumentId !== null}
        onClose={() => setEditDocumentId(null)}
        documentId={editDocumentId}
        userId={effectiveUserId}
        onUpdated={handleDocumentUpdated}
      />

      {successOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-labelledby="success-title"
          >
            <h2
              id="success-title"
              className="text-lg font-bold text-slate-800"
            >
              Tạo tài liệu thành công
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Tài liệu đã được lưu vào cơ sở dữ liệu. Bạn có thể tiếp tục tạo
              thêm hoặc xem trong danh sách bên dưới.
            </p>
            <button
              type="button"
              onClick={() => setSuccessOpen(false)}
              className="mt-6 w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}

      {deleteSuccessOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-labelledby="delete-success-title"
          >
            <h2
              id="delete-success-title"
              className="text-lg font-bold text-slate-800"
            >
              Xóa tài liệu thành công
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Tài liệu đã được xóa khỏi cơ sở dữ liệu. Danh sách bên dưới đã
              được cập nhật.
            </p>
            <button
              type="button"
              onClick={() => setDeleteSuccessOpen(false)}
              className="mt-6 w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}

      {editSuccessOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-labelledby="edit-success-title"
          >
            <h2
              id="edit-success-title"
              className="text-lg font-bold text-slate-800"
            >
              Cập nhật tài liệu thành công
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Thay đổi đã được lưu vào cơ sở dữ liệu. Danh sách bên dưới đã được
              cập nhật.
            </p>
            <button
              type="button"
              onClick={() => setEditSuccessOpen(false)}
              className="mt-6 w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-[61] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-labelledby="delete-confirm-title"
            aria-describedby="delete-confirm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="delete-confirm-title"
              className="text-lg font-bold text-slate-800"
            >
              Xác nhận xóa
            </h2>
            <p
              id="delete-confirm-desc"
              className="mt-3 text-sm text-slate-600"
            >
              Bạn có muốn xoá tài liệu này không?
            </p>
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
              {deleteTarget.title}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Hành động không hoàn tác.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId === deleteTarget.id}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void executeDelete(deleteTarget)}
                disabled={deletingId === deleteTarget.id}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingId === deleteTarget.id ? "Đang xóa…" : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen ? (
        <div
          className="fixed inset-0 z-[62] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDocumentDetail();
          }}
        >
          <div
            className="custom-scrollbar flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-200"
            role="dialog"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <h2
                id="detail-title"
                className="text-lg font-bold text-slate-800"
              >
                Chi tiết tài liệu
              </h2>
              <button
                type="button"
                onClick={closeDocumentDetail}
                className="shrink-0 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
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
            {detailLoading ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Đang tải…
              </p>
            ) : detailError ? (
              <p className="py-8 text-center text-sm text-rose-600">
                {detailError}
              </p>
            ) : detailDoc ? (
              <>
                <dl className="mt-4 grid grid-cols-[minmax(0,9.5rem)_1fr] gap-x-4 gap-y-2.5 text-sm">
                  <dt className="font-medium text-slate-500">Mã tài liệu</dt>
                  <dd className="text-slate-800">{detailDoc.doc_code}</dd>
                  <dt className="font-medium text-slate-500">Tiêu đề</dt>
                  <dd className="text-slate-800">{detailDoc.title}</dd>
                  <dt className="font-medium text-slate-500">Loại</dt>
                  <dd className="text-slate-800">
                    {displayDocType(detailDoc.doc_type)}
                  </dd>
                  <dt className="font-medium text-slate-500">Ngôn ngữ</dt>
                  <dd className="text-slate-800">{detailDoc.language}</dd>
                  <dt className="font-medium text-slate-500">Phòng ban</dt>
                  <dd className="text-slate-800">
                    {detailDoc.department ?? "—"}
                  </dd>
                  <dt className="font-medium text-slate-500">
                    Chu kỳ rà soát (tháng)
                  </dt>
                  <dd className="text-slate-800">{detailDoc.review_period}</dd>
                  <dt className="font-medium text-slate-500">
                    Phiên bản hiện tại
                  </dt>
                  <dd className="text-slate-800">v{detailDoc.current_version}</dd>
                  <dt className="font-medium text-slate-500">Trạng thái</dt>
                  <dd className={workflowStatusClass(detailDoc)}>
                    {workflowStatusLabel(detailDoc)}
                  </dd>
                  <dt className="font-medium text-slate-500">Danh mục</dt>
                  <dd className="text-slate-800">
                    {detailDoc.category_id
                      ? (() => {
                          const c = categoryById.get(detailDoc.category_id);
                          return c
                            ? `${c.name}${c.code ? ` (${c.code})` : ""}`
                            : detailDoc.category_id;
                        })()
                      : "—"}
                  </dd>
                  <dt className="font-medium text-slate-500">Tiêu chuẩn</dt>
                  <dd className="text-slate-800">
                    {detailDoc.category_id
                      ? (categoryById.get(detailDoc.category_id)?.standard ??
                        "—")
                      : "—"}
                  </dd>
                  <dt className="font-medium text-slate-500">Phê duyệt lúc</dt>
                  <dd className="text-slate-800">
                    {formatDateTime(detailDoc.approved_at)}
                  </dd>
                  <dt className="font-medium text-slate-500">Tạo lúc</dt>
                  <dd className="text-slate-800">
                    {formatDateTime(detailDoc.created_at)}
                  </dd>
                  <dt className="font-medium text-slate-500">Cập nhật lúc</dt>
                  <dd className="text-slate-800">
                    {formatDateTime(detailDoc.updated_at)}
                  </dd>
                  <dt className="font-medium text-slate-500">ID tài liệu</dt>
                  <dd className="break-all font-mono text-xs text-slate-700">
                    {detailDoc.id}
                  </dd>
                  <dt className="font-medium text-slate-500">org_id</dt>
                  <dd className="break-all font-mono text-xs text-slate-700">
                    {detailDoc.org_id}
                  </dd>
                  <dt className="font-medium text-slate-500">created_by</dt>
                  <dd className="break-all font-mono text-xs text-slate-700">
                    {detailDoc.created_by}
                  </dd>
                  <dt className="font-medium text-slate-500">approved_by</dt>
                  <dd className="break-all font-mono text-xs text-slate-700">
                    {detailDoc.approved_by ?? "—"}
                  </dd>
                </dl>
                <h3 className="mt-6 border-t border-slate-100 pt-4 text-sm font-bold text-slate-800">
                  Phiên bản và tệp đính kèm
                </h3>
                {detailVersions.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Chưa có phiên bản nào trong hệ thống.
                  </p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[32rem] text-left text-xs text-slate-700">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Phiên bản</th>
                          <th className="px-3 py-2">Tệp</th>
                          <th className="px-3 py-2">Dung lượng</th>
                          <th className="px-3 py-2">Tóm tắt thay đổi</th>
                          <th className="px-3 py-2">Tạo lúc</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailVersions.map((v, i) => (
                          <tr
                            key={v.id}
                            className={
                              i === detailVersions.length - 1
                                ? ""
                                : "border-b border-slate-100"
                            }
                          >
                            <td className="px-3 py-2 font-semibold">
                              v{v.version}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex max-w-[14rem] flex-col gap-2">
                                {isImageFileForPreview(
                                  v.file_type,
                                  v.file_url,
                                ) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={resolvePublicFileUrl(v.file_url)}
                                    alt=""
                                    className="max-h-32 w-full rounded border border-slate-200 object-contain"
                                  />
                                ) : null}
                                <a
                                  href={resolvePublicFileUrl(v.file_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="text-cyan-600 underline hover:text-cyan-800"
                                >
                                  Mở / tải tệp
                                </a>
                                {v.file_type ? (
                                  <span className="text-slate-400">
                                    ({v.file_type})
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {formatBytes(v.file_size)}
                            </td>
                            <td className="max-w-[10rem] truncate px-3 py-2" title={v.change_summary ?? ""}>
                              {v.change_summary ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                              {formatDateTime(v.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
            <button
              type="button"
              onClick={closeDocumentDetail}
              className="mt-6 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Đóng
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold text-slate-700">Tất cả tài liệu</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="doc-type-filter">
              Lọc theo loại tài liệu
            </label>
            <select
              id="doc-type-filter"
              value={docTypeFilter}
              onChange={(e) => setDocTypeFilter(e.target.value)}
              className="min-w-[11rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              disabled={!contextReady || configMissing}
            >
              <option value="">Tất cả loại</option>
              {(Object.keys(DOC_TYPE_LABELS) as Array<keyof typeof DOC_TYPE_LABELS>).map(
                (key) => (
                  <option key={key} value={key}>
                    {DOC_TYPE_LABELS[key]}
                  </option>
                ),
              )}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm sm:max-w-xs"
              placeholder="Tìm theo tiêu đề, mã, phòng ban"
              disabled={!contextReady || configMissing}
            />
          </div>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2">Tên</th>
              <th className="py-2">Loại</th>
              <th className="py-2">Phòng ban</th>
              <th className="py-2">Phiên bản</th>
              <th className="py-2">Tệp đính kèm</th>
              <th className="py-2">Tiêu chuẩn</th>
              <th className="py-2">Trạng thái</th>
              <th className="py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {!contextReady ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Đang lấy cấu hình từ server…
                </td>
              </tr>
            ) : configMissing ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Chưa có dữ liệu hiển thị. Xem thông báo phía trên.
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Đang tải…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  Chưa có tài liệu. Nhấn &quot;Tạo tài liệu&quot; để thêm từ cơ
                  sở dữ liệu.
                </td>
              </tr>
            ) : (
              filtered.map((doc, index) => {
                const cat = doc.category_id
                  ? categoryById.get(doc.category_id)
                  : undefined;
                const standard = cat?.standard ?? "—";
                return (
                  <tr
                    key={doc.id}
                    className={
                      index === filtered.length - 1
                        ? ""
                        : "border-b border-slate-100"
                    }
                  >
                    <td className="max-w-[250px] py-2 font-medium text-slate-900">
                      {doc.title}
                    </td>
                    <td>{displayDocType(doc.doc_type)}</td>
                    <td>{doc.department ?? "—"}</td>
                    <td>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        v{doc.current_version}
                      </span>
                    </td>
                    <td className="max-w-[7rem] py-2 align-top">
                      {doc.attachment_url ? (
                        <div className="flex flex-col gap-1.5">
                          {isImageFileForPreview(
                            doc.attachment_file_type ?? null,
                            doc.attachment_url,
                          ) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolvePublicFileUrl(doc.attachment_url)}
                              alt=""
                              className="h-11 w-11 rounded border border-slate-200 object-cover"
                            />
                          ) : null}
                          <a
                            href={resolvePublicFileUrl(doc.attachment_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-cyan-600 underline hover:text-cyan-800"
                          >
                            Tải / mở
                          </a>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td>{standard}</td>
                    <td className={workflowStatusClass(doc)}>
                      {workflowStatusLabel(doc)}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          title="Xem chi tiết"
                          type="button"
                          onClick={() => void openDocumentDetail(doc.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-cyan-50 hover:text-cyan-600"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                        <button
                          title="Chỉnh sửa"
                          type="button"
                          onClick={() => setEditDocumentId(doc.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                        <button
                          title="Xóa"
                          type="button"
                          disabled={deletingId === doc.id}
                          onClick={() => setDeleteTarget(doc)}
                          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
