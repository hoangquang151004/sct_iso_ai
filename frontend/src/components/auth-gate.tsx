"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  AUTH_DEFAULT_AFTER_LOGIN,
  AUTH_LOGIN_PATH,
  hasRoutePermissions,
  isAuthPublicPath,
} from "@/lib/auth-routes";
import { useAuth } from "@/lib/auth-context";

type AuthGateProps = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { principal, loading } = useAuth();

  const search = searchParams.toString();
  const pathWithQuery = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    if (loading) {
      return;
    }

    if (isAuthPublicPath(pathname)) {
      return;
    }

    if (!principal) {
      const next = encodeURIComponent(pathWithQuery || AUTH_DEFAULT_AFTER_LOGIN);
      router.replace(`${AUTH_LOGIN_PATH}?next=${next}`);
      return;
    }

    const permSet = new Set(principal.permissions || []);
    const access = hasRoutePermissions(pathname, permSet);
    if (!access.ok) {
      router.replace(AUTH_DEFAULT_AFTER_LOGIN);
    }
  }, [loading, pathname, pathWithQuery, principal, router]);

  if (isAuthPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Đang kiểm tra phiên đăng nhập…
      </div>
    );
  }

  if (!principal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Đang chuyển đến trang đăng nhập…
      </div>
    );
  }

  const permSet = new Set(principal.permissions || []);
  if (!hasRoutePermissions(pathname, permSet).ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Bạn không có quyền truy cập trang này. Đang chuyển về bảng điều khiển…
      </div>
    );
  }

  return <>{children}</>;
}
