"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks";
import { APP_NAV_ITEMS, AUTH_LOGIN_PATH, filterNavItemsForPermissions } from "@/lib/auth-routes";

type AppShellProps = {
  activePath: string;
  children: ReactNode;
};

export default function AppShell({ activePath, children }: AppShellProps) {
  const { principal, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const permissionSet = useMemo(
    () => new Set(principal?.permissions ?? []),
    [principal?.permissions],
  );

  const visibleNavItems = useMemo(
    () => filterNavItemsForPermissions(APP_NAV_ITEMS, permissionSet),
    [permissionSet],
  );

  const profileHref = permissionSet.has("users.read") ? "/user-management" : "/account/sessions";

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    setMenuOpen(false);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      router.replace(AUTH_LOGIN_PATH);
    }
  }, [logout, router]);

  return (
    <div className="app-shell-bg min-h-screen p-3 md:p-4">
      <div className="mx-auto max-w-[1320px] overflow-hidden rounded-2xl border border-white/25 bg-slate-100 shadow-2xl shadow-cyan-900/30">
        <header className="app-header px-4 py-3 text-white md:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/dashboard"
              className="text-3xl font-extrabold tracking-tight md:text-4xl"
            >
              SCT-ISO.AI
            </Link>
            <nav
              className="hidden flex-wrap items-center gap-1 text-sm font-semibold lg:flex"
              aria-label="Điều hướng chính"
            >
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 transition ${
                    activePath === item.href
                      ? "bg-white/20 text-white ring-1 ring-white/35"
                      : "text-white/85 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-white/15 text-lg hover:bg-white/25 transition"
                aria-label="Tài khoản"
                aria-expanded={menuOpen}
              >
                <span aria-hidden="true">U</span>
              </button>

              {menuOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    {principal ? (
                      <div className="border-b border-slate-100 px-4 py-3">
                        <p className="truncate text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {principal.username}
                        </p>
                      </div>
                    ) : null}
                    <Link
                      href="/account/change-password"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                    >
                      Đổi mật khẩu
                    </Link>
                    <div className="border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => void handleLogout()}
                        disabled={loggingOut}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition disabled:opacity-60"
                      >
                        {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="bg-[#eef6fa] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
