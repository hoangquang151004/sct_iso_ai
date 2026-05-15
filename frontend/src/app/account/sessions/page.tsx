"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/layout/app-shell";
import { getMySessions, revokeAllOtherSessions, revokeMySession } from "@/services";
import type { SessionSummary } from "@/types";
import { ApiClientError } from "@/api/api-client";
import { getMessageByErrorCode } from "@/api/users-error-map";
import { useAuth } from "@/hooks";
import { AUTH_LOGIN_PATH } from "@/lib/auth-routes";

export default function AccountSessionsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const rows = await getMySessions();
      setSessions(rows);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể tải danh sách phiên.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  const onRevokeOne = async (sessionId: string, isCurrent: boolean) => {
    setErrorMessage("");
    setStatusMessage("");
    if (isCurrent) {
      try {
        await logout();
        router.replace(AUTH_LOGIN_PATH);
      } catch {
        setErrorMessage("Không thể đăng xuất. Vui lòng thử lại.");
      }
      return;
    }
    try {
      await revokeMySession(sessionId);
      setStatusMessage("Đã đăng xuất phiên đã chọn.");
      await loadSessions();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể thu hồi phiên.");
      }
    }
  };

  const onRevokeAll = async () => {
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await revokeAllOtherSessions();
      setStatusMessage(`Đã thu hồi ${result.revoked_count} phiên khác.`);
      await loadSessions();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể thu hồi phiên.");
      }
    }
  };

  return (
    <AppShell activePath="/user-management">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Phiên đăng nhập theo thiết bị</h1>
        {statusMessage ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-3">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-2"
            onClick={() => void onRevokeAll()}
          >
            Đăng xuất khỏi tất cả thiết bị khác
          </button>
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-500">Đang tải...</p> : null}
        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Thiết bị</th>
                <th className="py-2">IP</th>
                <th className="py-2">Tạo lúc</th>
                <th className="py-2">Lần dùng cuối</th>
                <th className="py-2">Trạng thái</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} className="border-t border-slate-100">
                  <td className="py-2">
                    {session.device_label || session.user_agent || "Thiết bị không xác định"}
                  </td>
                  <td className="py-2">{session.ip || "-"}</td>
                  <td className="py-2">{new Date(session.created_at).toLocaleString("vi-VN")}</td>
                  <td className="py-2">
                    {session.last_used_at
                      ? new Date(session.last_used_at).toLocaleString("vi-VN")
                      : "-"}
                  </td>
                  <td className="py-2">
                    {session.is_current ? (
                      <span className="rounded bg-cyan-100 px-2 py-1 text-cyan-700">Phiên hiện tại</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      className={`rounded border px-2 py-1 text-sm transition ${
                        session.is_current
                          ? "border-rose-300 text-rose-600 hover:bg-rose-50"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50"
                      }`}
                      onClick={() => void onRevokeOne(session.id, session.is_current)}
                    >
                      {session.is_current ? "Đăng xuất tài khoản" : "Đăng xuất"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
