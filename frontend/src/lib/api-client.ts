import type { ApiErrorDetail, ApiErrorEnvelope } from "@/types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly detail: ApiErrorDetail;

  constructor(status: number, detail: ApiErrorDetail) {
    super(detail.message);
    this.name = "ApiClientError";
    this.status = status;
    this.detail = detail;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

const fallbackErrorDetail: ApiErrorDetail = {
  message: "Không thể kết nối tới máy chủ.",
  error_code: "SERVICE_UNAVAILABLE",
  fields: [],
};

const toErrorDetail = (
  input: unknown,
  fallbackRequestId?: string | null,
): ApiErrorDetail => {
  if (!input || typeof input !== "object") {
    return fallbackErrorDetail;
  }

  const payload = input as ApiErrorEnvelope;
  if (typeof payload.detail === "string") {
    return {
      message: payload.detail,
      error_code: "BAD_REQUEST",
      fields: [],
    };
  }

  if (
    payload.detail &&
    typeof payload.detail.message === "string" &&
    typeof payload.detail.error_code === "string"
  ) {
    return {
      ...payload.detail,
      request_id: payload.detail.request_id || fallbackRequestId || undefined,
    };
  }

  return {
    ...fallbackErrorDetail,
    request_id: fallbackRequestId || undefined,
  };
};

let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};

type ApiRequestOptions = {
  timeoutMs?: number;
};

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  options?: ApiRequestOptions,
): Promise<T> {
  const normalizedPath = path.split("?")[0]?.split("#")[0] ?? path;
  const shouldSkipRefresh = normalizedPath === "/auth/login" || normalizedPath === "/auth/refresh";

  const makeRequest = async (token: string | null) => {
    const controller = new AbortController();
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
      signal: controller.signal,
      ...init,
    });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  let response = await makeRequest(accessToken);
  if (response.status === 401 && !shouldSkipRefresh) {
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (refreshResponse.ok) {
      const refreshed = (await refreshResponse.json()) as { access_token?: string };
      accessToken = refreshed.access_token || null;
      response = await makeRequest(accessToken);
    } else if (refreshResponse.status === 401) {
      clearAccessToken();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
      }
    }
  }

  const requestIdFromHeader = response.headers.get("x-request-id");
  const contentLength = response.headers.get("content-length");
  if (response.ok && (response.status === 204 || contentLength === "0")) {
    return undefined as T;
  }

  const body = await response.json().catch(() => ({ detail: fallbackErrorDetail }));

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
    }
    throw new ApiClientError(response.status, toErrorDetail(body, requestIdFromHeader));
  }

  if (contentLength === "0") {
    return undefined as T;
  }
  return body as T;
}
