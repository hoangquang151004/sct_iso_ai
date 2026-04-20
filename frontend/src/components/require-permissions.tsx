"use client";

import React from "react";

import { useAuth } from "@/lib/auth-context";

type RequirePermissionsProps = {
  codes: string[];
  mode?: "all" | "any";
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export default function RequirePermissions({
  codes,
  mode = "all",
  fallback,
  children,
}: RequirePermissionsProps) {
  const { principal } = useAuth();
  const actual = new Set(principal?.permissions || []);
  const hasAll = codes.every((code) => actual.has(code));
  const hasAny = codes.some((code) => actual.has(code));
  const allow = mode === "all" ? hasAll : hasAny;
  if (!allow) {
    return (
      <>
        {fallback || (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            Bạn không có quyền truy cập nội dung này.
          </div>
        )}
      </>
    );
  }
  return <>{children}</>;
}
