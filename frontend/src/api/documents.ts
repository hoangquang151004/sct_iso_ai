/**
 * - NEXT_PUBLIC_API_BASE_URL: gọi thẳng URL đó (cần CORS trên backend).
 * - Mặc định dev (client): `/api-backend` -> Route Handler proxy tới uvicorn (cùng origin, không treo 127.0.0.1).
 */
const apiBase = (): string => {
  const fromEnv = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    return "/api-backend";
  }
  return "http://127.0.0.1:8000";
};

/** Nối base + path (base có thể là URL tuyệt đối hoặc prefix tương đối như /api-backend). */
function apiPath(suffix: string): string {
  const base = apiBase().replace(/\/$/, "");
  const path = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${base}${path}`;
}

/**
 * `file_url` từ API thường là `/uploads/...` (trỏ FastAPI). Trên Next dev cần qua
 * `/api-backend/uploads/...` hoặc URL backend tuyệt đối để mở/tải được.
 */
export function resolvePublicFileUrl(fileUrl: string | null | undefined): string {
  if (fileUrl == null || fileUrl === "") return "";
  const u = fileUrl.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const path = u.startsWith("/") ? u : `/${u}`;
  const base = apiBase().replace(/\/$/, "");
  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${base}${path}`;
  }
  return `${base}${path}`;
}

export function isImageFileForPreview(
  fileType: string | null | undefined,
  fileUrl: string,
): boolean {
  const ext = (fileType || "").toLowerCase().replace(/^\./, "");
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return true;
  }
  const path = fileUrl.split("?")[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(path);
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: unknown };
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((e) => JSON.stringify(e)).join("; ");
    }
  } catch {
    /* ignore */
  }
  return res.statusText || "Request failed";
}

export type DocumentCategoryDto = {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  standard: string | null;
  department: string | null;
  description: string | null;
  created_at: string | null;
};

export type DocumentDto = {
  id: string;
  org_id: string;
  category_id: string | null;
  doc_code: string;
  title: string;
  doc_type: string;
  language: string;
  department: string | null;
  review_period: number;
  tags: string[];
  ai_summary: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  current_version: string;
  status: string;
  next_review_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  attachment_url?: string | null;
  attachment_file_type?: string | null;
};

export type DocumentVersionDto = {
  id: string;
  document_id: string;
  version: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  change_summary: string | null;
  change_reason: string | null;
  created_by: string;
  created_at: string | null;
};

export type DocumentUiContextDto = {
  org_id: string;
  user_id: string;
};

const UI_CONTEXT_TIMEOUT_MS = 15_000;

export async function syncDocumentUiContext(): Promise<DocumentUiContextDto> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UI_CONTEXT_TIMEOUT_MS);
  try {
    const res = await fetch(apiPath("/documents/ui-context/sync"), {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json() as Promise<DocumentUiContextDto>;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        `Hết thời chờ (${UI_CONTEXT_TIMEOUT_MS / 1000}s) — kiểm tra backend ${apiBase()} có đang chạy không.`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export type DocumentCreatePayload = {
  org_id: string;
  created_by: string;
  title: string;
  doc_type: string;
  language: string;
  department: string | null;
  review_period: number;
  initial_version: string;
  tags: string[];
  ai_summary: string | null;
  file?: File | null;
};

export async function listDocuments(orgId: string): Promise<DocumentDto[]> {
  const qs = new URLSearchParams({ org_id: orgId }).toString();
  const res = await fetch(`${apiPath("/documents")}?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DocumentDto[]>;
}

export async function getDocument(documentId: string): Promise<DocumentDto> {
  const res = await fetch(apiPath(`/documents/${documentId}`), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DocumentDto>;
}

export async function listDocumentVersions(
  documentId: string,
): Promise<DocumentVersionDto[]> {
  const res = await fetch(apiPath(`/documents/${documentId}/versions`), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DocumentVersionDto[]>;
}

export async function listDocumentCategories(
  orgId: string,
): Promise<DocumentCategoryDto[]> {
  const qs = new URLSearchParams({ org_id: orgId }).toString();
  const res = await fetch(`${apiPath("/documents/categories")}?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DocumentCategoryDto[]>;
}

export async function createDocumentCategory(payload: {
  org_id: string;
  name: string;
  code: string | null;
  standard?: string | null;
  department?: string | null;
  description?: string | null;
}): Promise<DocumentCategoryDto> {
  const res = await fetch(apiPath("/documents/categories"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DocumentCategoryDto>;
}

export async function createDocument(
  payload: DocumentCreatePayload,
): Promise<DocumentDto> {
  const formData = new FormData();
  formData.append("org_id", payload.org_id);
  formData.append("created_by", payload.created_by);
  formData.append("title", payload.title);
  formData.append("doc_type", payload.doc_type);
  formData.append("language", payload.language);
  if (payload.department) formData.append("department", payload.department);
  formData.append("review_period", String(payload.review_period));
  formData.append("initial_version", payload.initial_version);
  formData.append("tags_json", JSON.stringify(payload.tags ?? []));
  if (payload.ai_summary) formData.append("ai_summary", payload.ai_summary);
  if (payload.file) formData.append("file", payload.file);

  const res = await fetch(apiPath("/documents"), {
    method: "POST",
    body: formData,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DocumentDto>;
}

export async function deleteDocument(
  documentId: string,
  orgId: string,
): Promise<void> {
  const qs = new URLSearchParams({ org_id: orgId }).toString();
  const res = await fetch(`${apiPath("/documents")}/${documentId}?${qs}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export type DocumentUpdatePayload = {
  title?: string;
  doc_type?: string;
  language?: string;
  department?: string | null;
  review_period?: number;
  status?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  category_id?: string | null;
  tags?: string[];
  ai_summary?: string | null;
  next_review_at?: string | null;
};

export async function updateDocument(
  documentId: string,
  payload: DocumentUpdatePayload,
): Promise<DocumentDto> {
  const body: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined) body[k] = v;
  }
  const res = await fetch(apiPath(`/documents/${documentId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<DocumentDto>;
}
