"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AppShell from "@/components/app-shell";
import { ApiClientError } from "@/lib/api-client";
import { changeMyPassword } from "@/lib/users-api";
import { getMessageByErrorCode } from "@/lib/users-error-map";

const isStrongEnough = (password: string) =>
  password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);

export default function ChangePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    const value = searchParams.get("next");
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
      return "/user-management";
    }
    return value;
  }, [searchParams]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    if (newPassword !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (!isStrongEnough(newPassword)) {
      setErrorMessage("Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ và số.");
      return;
    }
    setSubmitting(true);
    try {
      await changeMyPassword(currentPassword, newPassword);
      setStatusMessage("Đổi mật khẩu thành công. Đang chuyển hướng...");
      router.replace(nextPath);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể đổi mật khẩu.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell activePath="/user-management">
      <div className="mx-auto max-w-lg rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Đổi mật khẩu</h1>
        {statusMessage ? (
          <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            {errorMessage}
          </div>
        ) : null}
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <input
            type="password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Mật khẩu hiện tại"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Mật khẩu mới"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="Xác nhận mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-cyan-600 px-3 py-2 font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Đang xử lý..." : "Cập nhật mật khẩu"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
