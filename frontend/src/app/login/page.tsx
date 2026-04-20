"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiClientError } from "@/lib/api-client";
import { getCurrentPrincipal } from "@/lib/auth-api";
import { AUTH_DEFAULT_AFTER_LOGIN } from "@/lib/auth-routes";
import { useAuth } from "@/lib/auth-context";
import { getMessageByErrorCode } from "@/lib/users-error-map";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, principal, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const nextPath = useMemo(() => {
    const value = searchParams.get("next");
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
      return AUTH_DEFAULT_AFTER_LOGIN;
    }
    return value;
  }, [searchParams]);

  useEffect(() => {
    if (loading || !principal) {
      return;
    }
    if (principal.must_change_password) {
      router.replace("/account/change-password");
      return;
    }
    router.replace(nextPath);
  }, [loading, principal, router, nextPath]);

  if (!loading && principal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef6fa] text-slate-600">
        Đang chuyển hướng…
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);
    try {
      await login(username, password);
      const principal = await getCurrentPrincipal();
      if (principal.must_change_password) {
        router.replace("/account/change-password");
      } else {
        router.replace(nextPath || AUTH_DEFAULT_AFTER_LOGIN);
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Đăng nhập thất bại. Vui lòng thử lại.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef6fa] p-4 font-sans antialiased text-slate-900 shadow-inner">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/40 bg-white/70 shadow-2xl backdrop-blur-xl transition-all hover:shadow-cyan-900/10">
        <div className="p-8 md:p-10">
          <div className="mb-10 text-center">
            <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-cyan-800">
              SCT-ISO.AI
            </h1>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">
              Nền tảng Quản lý Chất lượng & AI
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Tên đăng nhập
              </label>
              <input
                type="text"
                id="username"
                required
                className="block w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-3.5 text-slate-800 transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-700"
                >
                  Mật khẩu
                </label>
                <Link
                  href="#"
                  className="text-xs font-bold text-cyan-600 transition hover:text-cyan-700 hover:underline"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                required
                className="block w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-3.5 text-slate-800 transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-cyan-500/10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-cyan-600 transition focus:ring-cyan-500"
              />
              <label
                htmlFor="remember-me"
                className="ml-3 block text-sm font-medium text-slate-600"
              >
                Ghi nhớ đăng nhập
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 px-6 py-4 text-sm font-bold text-white transition-all hover:from-cyan-500 hover:to-blue-600 hover:shadow-lg hover:shadow-cyan-500/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  <span>Đang xử lý...</span>
                </div>
              ) : (
                "ĐĂNG NHẬP HỆ THỐNG"
              )}
            </button>
          </form>
          {errorMessage ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500">
              Vấn đề về tài khoản?{" "}
              <Link
                href="#"
                className="font-bold text-cyan-600 transition hover:text-cyan-700 hover:underline"
              >
                Liên hệ Quản trị viên
              </Link>
            </p>
          </div>
        </div>
        
        <div className="bg-slate-50/50 border-t border-slate-100 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
            Powered by SCT-ISO AI Engine &copy; 2026
          </p>
        </div>
      </div>
    </div>
  );
}
