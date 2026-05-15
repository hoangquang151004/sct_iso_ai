"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getCurrentPrincipal, login as loginApi, logout as logoutApi, refreshSession } from "@/services";
import type { AuthPrincipal, AuthTokenResponse } from "@/types";

type AuthContextValue = {
  principal: AuthPrincipal | null;
  loading: boolean;
  sessionExpired: boolean;
  login: (username: string, password: string, deviceLabel?: string) => Promise<AuthTokenResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthTokenResponse>;
  dismissSessionExpired: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getSafeNextPath = (pathname: string | null): string => {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/dashboard";
  }
  return pathname;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [principal, setPrincipal] = useState<AuthPrincipal | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const bootstrap = useCallback(async () => {
    try {
      try {
        await refreshSession();
      } catch {
        // No refresh cookie or invalid session; /auth/me will still run refresh-on-401 if applicable.
      }
      const me = await getCurrentPrincipal();
      setPrincipal(me);
    } catch {
      setPrincipal(null);
    } finally {
      setLoading(false);
    }
  }, [getCurrentPrincipal, refreshSession]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const handleExpired = () => {
      setPrincipal(null);
      setSessionExpired(true);
    };
    const handleRefreshed = () => {
      getCurrentPrincipal()
        .then(setPrincipal)
        .catch(() => {});
    };
    window.addEventListener("auth:session-expired", handleExpired);
    window.addEventListener("auth:token-refreshed", handleRefreshed);
    return () => {
      window.removeEventListener("auth:session-expired", handleExpired);
      window.removeEventListener("auth:token-refreshed", handleRefreshed);
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string, deviceLabel?: string) => {
      const token = await loginApi({ username, password, device_label: deviceLabel });
      const me = await getCurrentPrincipal();
      setPrincipal(me);
      return token;
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutApi();
    setPrincipal(null);
  }, []);

  const refresh = useCallback(async () => {
    const token = await refreshSession();
    const me = await getCurrentPrincipal();
    setPrincipal(me);
    return token;
  }, []);

  const dismissSessionExpired = useCallback(() => {
    setSessionExpired(false);
    const next = encodeURIComponent(getSafeNextPath(pathname));
    router.replace(`/login?next=${next}`);
  }, [pathname, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      principal,
      loading,
      sessionExpired,
      login,
      logout,
      refresh,
      dismissSessionExpired,
    }),
    [principal, loading, sessionExpired, login, logout, refresh, dismissSessionExpired],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {sessionExpired ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Phiên đăng nhập đã hết hạn</h2>
            <p className="mt-2 text-sm text-slate-600">
              Vui lòng đăng nhập lại để tiếp tục thao tác.
            </p>
            <button
              type="button"
              onClick={dismissSessionExpired}
              className="mt-4 w-full rounded-md bg-cyan-600 px-4 py-2 font-semibold text-white"
            >
              Đăng nhập lại
            </button>
          </div>
        </div>
      ) : null}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function usePermission(code: string | string[]): boolean {
  const { principal } = useAuth();
  const required = Array.isArray(code) ? code : [code];
  if (!principal) {
    return false;
  }
  const actual = new Set(principal.permissions || []);
  return required.every((item) => actual.has(item));
}
