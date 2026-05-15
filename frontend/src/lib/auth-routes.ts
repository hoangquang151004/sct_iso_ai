/**
 * Định tuyến xác thực phía client. Cookie refresh thường gắn với origin API
 * (ví dụ :8000) nên middleware Next.js (:3000) không đọc được — gate dựa trên
 * principal sau khi gọi /auth/me hoặc refresh.
 */

export const AUTH_LOGIN_PATH = "/login";
export const AUTH_DEFAULT_AFTER_LOGIN = "/dashboard";

const PUBLIC_PATH_EXACT = new Set<string>([AUTH_LOGIN_PATH]);

/** Route cần đủ permission; kiểm tra theo prefix dài nhất trước (sort bằng tay). */
export type RoutePermissionRule = {
  prefix: string;
  codes: string[];
  mode?: "all" | "any";
};

export const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  { prefix: "/reports", codes: ["reports.read"], mode: "all" },
  { prefix: "/ai-analytics", codes: ["analytics.read"], mode: "all" },
  { prefix: "/capa-management", codes: ["capa.read"], mode: "all" },
  { prefix: "/prp-audit", codes: ["prp.read"], mode: "all" },
  { prefix: "/haccp-compliance", codes: ["haccp.read"], mode: "all" },
  { prefix: "/document-control", codes: ["documents.read"], mode: "all" },
  { prefix: "/dashboard", codes: ["dashboard.read"], mode: "all" },
  { prefix: "/rbac", codes: ["users.read", "rbac.read"], mode: "all" },
  { prefix: "/user-management", codes: ["users.read"], mode: "all" },
];

/** Mục menu AppShell: `codes` rỗng/không có = mọi user đã đăng nhập. */
export type AppNavItem = {
  href: string;
  label: string;
  codes?: string[];
};

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/dashboard", label: "Bảng điều khiển", codes: ["dashboard.read"] },
  { href: "/document-control", label: "Tài liệu", codes: ["documents.read"] },
  { href: "/haccp-compliance", label: "Đánh giá rủi ro", codes: ["haccp.read"] },
  { href: "/prp-audit", label: "Đánh giá PRP", codes: ["prp.read"] },
  { href: "/capa-management", label: "CAPA", codes: ["capa.read"] },
  { href: "/ai-analytics", label: "Giám sát", codes: ["analytics.read"] },
  { href: "/reports", label: "Báo cáo", codes: ["reports.read"] },
  { href: "/user-management", label: "Quản lý người dùng", codes: ["users.read"] },
];

export function filterNavItemsForPermissions(
  items: readonly AppNavItem[],
  permissions: Set<string>,
): AppNavItem[] {
  return items.filter((item) => {
    const codes = item.codes;
    if (!codes?.length) {
      return true;
    }
    return codes.every((c) => permissions.has(c));
  });
}

export function getFirstAccessibleRoute(permissions: Set<string>): string {
  for (const item of APP_NAV_ITEMS) {
    const codes = item.codes;
    if (!codes?.length || codes.every((c) => permissions.has(c))) {
      return item.href;
    }
  }
  return "/account/sessions";
}

/** Chỉ dùng `?next=` sau đăng nhập khi user có quyền vào pathname của URL đó. */
export function resolvePostLoginPath(next: string | null, permissions: Set<string>): string {
  const trimmed = next?.trim();
  if (!trimmed) {
    return getFirstAccessibleRoute(permissions);
  }
  const pathOnly = trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
  if (!pathOnly.startsWith("/") || pathOnly.startsWith("//")) {
    return getFirstAccessibleRoute(permissions);
  }
  if (hasRoutePermissions(pathOnly, permissions).ok) {
    return trimmed;
  }
  return getFirstAccessibleRoute(permissions);
}

export function isAuthPublicPath(pathname: string): boolean {
  if (PUBLIC_PATH_EXACT.has(pathname)) {
    return true;
  }
  return false;
}

export function hasRoutePermissions(
  pathname: string,
  permissions: Set<string>,
): { ok: true } | { ok: false; rule: RoutePermissionRule } {
  for (const rule of ROUTE_PERMISSION_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      const mode = rule.mode ?? "all";
      const ok =
        mode === "all"
          ? rule.codes.every((c) => permissions.has(c))
          : rule.codes.some((c) => permissions.has(c));
      if (!ok) {
        return { ok: false, rule };
      }
      return { ok: true };
    }
  }
  return { ok: true };
}
