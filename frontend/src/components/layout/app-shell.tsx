"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";

import { useAuth } from "@/hooks";
import { APP_NAV_ITEMS, filterNavItemsForPermissions } from "@/lib/auth-routes";

type AppShellProps = {
  activePath: string;
  children: ReactNode;
};

export default function AppShell({ activePath, children }: AppShellProps) {
  const { principal } = useAuth();

  const permissionSet = useMemo(
    () => new Set(principal?.permissions ?? []),
    [principal?.permissions],
  );

  const visibleNavItems = useMemo(
    () => filterNavItemsForPermissions(APP_NAV_ITEMS, permissionSet),
    [permissionSet],
  );

  const profileHref = permissionSet.has("users.read") ? "/user-management" : "/account/sessions";

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
            <Link
              href={profileHref}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-white/15 text-lg"
              aria-label="Tài khoản và phiên đăng nhập"
            >
              <span aria-hidden="true">U</span>
            </Link>
          </div>
        </header>

        <main className="bg-[#eef6fa] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
