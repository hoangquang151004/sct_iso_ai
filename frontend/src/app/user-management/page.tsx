"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AppShell from "@/components/app-shell";
import RequirePermissions from "@/components/require-permissions";
import { ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  assignRoleToUser,
  createUser,
  getRoles,
  getUserById,
  getUsers,
  resetPassword,
  revokeAllUserSessions,
  softDeleteUser,
  updateUser,
} from "@/lib/users-api";
import { getMessageByErrorCode } from "@/lib/users-error-map";
import type { RoleResponse, UserCreatePayload, UserResponse, UserUpdatePayload } from "@/lib/users-types";

import {
  createRbacRole,
  deleteRbacRole,
  getRbacPermissions,
  getRbacRoles,
  resetSystemRolePermissions,
  updateRbacRole,
  updateRolePermissions,
} from "@/lib/rbac-api";
import type { PermissionResponse } from "@/lib/users-types";

// Icons 
const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
);
const PencilIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
);
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
const ShieldIcon = () => (
   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>
);

const emptyCreateForm = (orgId: string): UserCreatePayload => ({
  username: "",
  email: "",
  full_name: "",
  password: "",
  org_id: orgId,
  department: "",
  position: "",
  role_id: undefined,
});

function emptyEditForm(): UserUpdatePayload {
  return {
    username: "",
    email: "",
    full_name: "",
    department: "",
    position: "",
    phone: "",
  };
}

export type DrawerMode = "none" | "create" | "detail" | "edit";

export default function UserManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { principal, logout } = useAuth();
  const orgId = principal?.org_id ?? "";

  const permissionSet = useMemo(
    () => new Set(principal?.permissions ?? []),
    [principal?.permissions],
  );
  const canReadRbac = permissionSet.has("rbac.read");
  const canManageRbac = permissionSet.has("rbac.manage");
  const canCreateUser = permissionSet.has("users.create");
  const canUpdateUser = permissionSet.has("users.update");
  const canAssignRole = permissionSet.has("users.assign_role");
  const canResetPassword = permissionSet.has("users.reset_password");
  const canManageSessions = permissionSet.has("users.manage_sessions");
  const canDeleteUser = permissionSet.has("users.delete");

  const [users, setUsers] = useState<UserResponse[]>([]);
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserResponse | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [form, setForm] = useState<UserCreatePayload>(emptyCreateForm(""));
  const [editForm, setEditForm] = useState<UserUpdatePayload>(emptyEditForm);
  
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("none");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<"info" | "security">("info");
  const [isRbacDrawerOpen, setIsRbacDrawerOpen] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [adminNewPassword, setAdminNewPassword] = useState("");

  const filteredUsers = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const roleText = (user.roles || []).map((r) => r.name).join(" ").toLowerCase();
      const statusText = user.is_active ? "kích hoạt" : "vô hiệu hóa";
      return [
        user.full_name,
        user.username,
        user.email,
        user.department || "",
        user.position || "",
        user.phone || "",
        roleText,
        statusText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [searchKeyword, users]);

  const loadUsers = async () => {
    if (!orgId) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      const data = await getUsers({ orgId });
      const safeData = Array.isArray(data) ? data : [];
      setUsers(safeData);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể tải danh sách người dùng.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoles = async () => {
    if (!orgId) return;
    try {
      const data = await getRoles(orgId);
      const safeData = Array.isArray(data) ? data : [];
      setRoles(safeData);
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (!orgId) return;
    setForm(emptyCreateForm(orgId));
  }, [orgId]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadUsers();
        await loadRoles();
      } catch {
        // no-op
      }
    };
    if (principal) {
      void bootstrap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principal, orgId]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab !== "rbac") {
      return;
    }
    if (!canReadRbac) {
      void router.replace("/user-management");
      return;
    }
    setIsRbacDrawerOpen(true);
  }, [canReadRbac, router, searchParams]);

  useEffect(() => {
    if (!selectedUserId || !orgId) {
      setSelectedUser(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        const detail = await getUserById(selectedUserId, orgId);
        setSelectedUser(detail);
      } catch (error) {
        if (error instanceof ApiClientError) {
          setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
        }
      }
    };
    void fetchDetail();
  }, [selectedUserId, drawerMode, orgId]); 

  const onLogout = async () => {
    await logout();
    setUsers([]);
    setSelectedUser(null);
    setSelectedUserId(null);
  };

  const closeDrawer = () => {
    setDrawerMode("none");
    if (drawerMode === "create" && orgId) setForm(emptyCreateForm(orgId));
    setEditForm(emptyEditForm());
    setIsEditingProfile(false);
    setActiveProfileTab("info");
  };

  const openCreateDrawer = () => {
    if (!canCreateUser || !orgId) return;
    setForm(emptyCreateForm(orgId));
    setErrorMessage("");
    setStatusMessage("");
    setDrawerMode("create");
  };

  const openRbacPanel = () => {
    if (!canReadRbac) return;
    setIsRbacDrawerOpen(true);
    void router.replace("/user-management?tab=rbac");
  };

  const closeRbacPanel = () => {
    setIsRbacDrawerOpen(false);
    if (searchParams.get("tab") === "rbac") {
      void router.replace("/user-management");
    }
  };

  const openDetailDrawer = async (userId: string) => {
    if (!orgId) return;
    setErrorMessage("");
    setStatusMessage("");
    setSelectedUserId(userId);
    setDrawerMode("detail");
    setIsEditingProfile(false);
    try {
      const detail = await getUserById(userId, orgId);
      setSelectedUser(detail);
      if (detail.role_id) setSelectedRoleId(detail.role_id);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể tải chi tiết người dùng.");
      }
    }
  };

  const openEditDrawer = () => {
    if (!selectedUser) return;
    setEditForm({
      username: selectedUser.username,
      email: selectedUser.email,
      full_name: selectedUser.full_name,
      department: selectedUser.department ?? "",
      position: selectedUser.position ?? "",
      phone: selectedUser.phone ?? "",
    });
    setErrorMessage("");
    setStatusMessage("");
    setDrawerMode("detail");
    setActiveProfileTab("info");
    setIsEditingProfile(true);
  };

  const onCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreateUser) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const payload: UserCreatePayload = {
        ...form,
        role_id: form.role_id || undefined,
      };
      await createUser(payload);
      setStatusMessage("Tạo người dùng thành công.");
      setAdminNewPassword("");
      closeDrawer();
      await loadUsers();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể tạo người dùng.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser || !canUpdateUser || !orgId) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const updated = await updateUser(selectedUser.id, orgId, {
        username: editForm.username,
        email: editForm.email,
        full_name: editForm.full_name,
        department: editForm.department || null,
        position: editForm.position || null,
        phone: editForm.phone || null,
      });
      setSelectedUser(updated);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setStatusMessage("Cập nhật thông tin thành công.");
      setAdminNewPassword("");
      setIsEditingProfile(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể cập nhật người dùng.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onToggleUserStatus = async () => {
    if (!selectedUser || !canUpdateUser || !orgId) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const updated = await updateUser(selectedUser.id, orgId, {
        is_active: !selectedUser.is_active,
      });
      setSelectedUser(updated);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setStatusMessage(`Đã ${updated.is_active ? 'kích hoạt' : 'vô hiệu hóa'} người dùng thành công.`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onAssignRole = async () => {
    if (!selectedUser || !selectedRoleId || !canAssignRole || !orgId) return;
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const updated = await assignRoleToUser(selectedUser.id, orgId, selectedRoleId);
      setSelectedUser(updated);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setStatusMessage("Gán vai trò thành công.");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !canResetPassword || !orgId) return;
    if (!adminNewPassword || adminNewPassword.length < 8) {
       setErrorMessage("Mật khẩu mới phải từ 8 ký tự trở lên.");
       return;
    }
    if (!window.confirm(`Xác nhận đặt mật khẩu '${adminNewPassword}' cho tài khoản ${selectedUser.username}?`)) return;
    
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      await resetPassword(selectedUser.id, orgId, adminNewPassword);
      setStatusMessage("Cập nhật mật khẩu thành công!");
      setAdminNewPassword("");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Lỗi hệ thống khi cập nhật mật khẩu.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRevokeAllSessions = async () => {
    if (!selectedUser || !canManageSessions || !orgId) return;
    if (!window.confirm(`Thu hồi toàn bộ phiên đăng nhập của ${selectedUser.username}?`)) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const result = await revokeAllUserSessions(selectedUser.id, orgId);
      setStatusMessage(`Đã thu hồi ${result.revoked_count} phiên đăng nhập.`);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể thu hồi phiên đăng nhập.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSoftDeleteUser = async () => {
    if (!selectedUser || !canDeleteUser || !orgId) return;
    if (!window.confirm(`Vô hiệu hóa tài khoản ${selectedUser.username}?`)) return;
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      await softDeleteUser(selectedUser.id, orgId);
      setUsers((prev) => prev.filter((item) => item.id !== selectedUser.id));
      setSelectedUser(null);
      setSelectedUserId(null);
      closeDrawer();
      setStatusMessage("Đã vô hiệu hóa người dùng.");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(getMessageByErrorCode(error.detail.error_code, error.detail.message));
      } else {
        setErrorMessage("Không thể vô hiệu hóa người dùng.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  if (!principal) {
    return (
      <AppShell activePath="/user-management">
        <div className="rounded-xl bg-white p-8 flex items-center justify-center text-slate-500 shadow-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-cyan-600 mr-3"></div>
          Đang kiểm tra phiên đăng nhập...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath="/user-management">
      <div className="relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[calc(100vh-6rem)] flex flex-col">
        
        {/* HEADER SECTION */}
        <div className="border-b border-slate-200 px-6 py-5 sm:flex sm:items-center sm:justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Người dùng & Phân quyền</h1>
            <p className="mt-1 text-sm text-slate-500">Quản lý tài khoản, vai trò và bảo mật toàn tổ chức.</p>
          </div>
          <div className="mt-4 sm:ml-4 sm:mt-0 flex flex-col md:flex-row gap-3 items-end md:items-center">
            <div className="text-right text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-3">
               <div>Org: <span className="font-mono text-slate-500">{orgId ? `${orgId.split("-")[0]}...` : "—"}</span></div>
               <div className="font-medium text-slate-700">{principal.username}</div>
            </div>
            <button
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-md transition-colors border border-slate-200 shadow-sm"
              onClick={() => void onLogout()}
            >
              Đăng xuất
            </button>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
           <div className="flex flex-wrap gap-4 items-center justify-between">
             
             {/* Left: Search */}
             <div className="flex gap-2 w-full md:w-auto">
               <div className="relative flex-1 md:w-80">
                 <input
                   className="w-full rounded-md border border-slate-300 py-2 pl-3 pr-10 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-shadow bg-white"
                   placeholder="Tìm kiếm tài khoản, email, phòng ban..."
                   value={searchKeyword}
                   onChange={(e) => setSearchKeyword(e.target.value)}
                 />
                 <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                 </div>
               </div>
               <button onClick={() => void loadUsers()} className="p-2 rounded-md border border-slate-300 text-slate-500 hover:bg-slate-200 transition-colors bg-white shadow-sm" title="Tải lại">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               </button>
             </div>

             {/* Right: Actions */}
             <div className="flex gap-2.5">
               <RequirePermissions codes={["rbac.read"]}>
                  <button
                    onClick={openRbacPanel}
                    className="rounded-md bg-white border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition flex items-center gap-2 shrink-0"
                  >
                    <ShieldIcon /> Mở tab Phân quyền (RBAC)
                  </button>
               </RequirePermissions>
               <RequirePermissions codes={["users.create"]}>
                 <button
                   className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-700 transition flex items-center gap-1.5 shrink-0"
                   onClick={openCreateDrawer}
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                   Thêm người dùng
                 </button>
               </RequirePermissions>
             </div>
           </div>

          {/* Flash Messages */}
          {statusMessage && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 flex items-center gap-2 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800 flex items-center gap-2 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
              {errorMessage}
            </div>
          )}
        </div>

        {/* DATA TABLE */}
        <div className="overflow-x-auto min-h-[400px] flex-1">
          <table className="min-w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0">
              <tr>
                <th className="px-6 py-4 font-semibold w-64">Họ tên & Email</th>
                <th className="px-6 py-4 font-semibold">Tài khoản</th>
                <th className="px-6 py-4 font-semibold">Phòng ban</th>
                <th className="px-6 py-4 font-semibold">Trạng thái</th>
                <th className="px-6 py-4 font-semibold text-right">Lần đăng nhập cuối</th>
                <th className="px-6 py-4 font-semibold text-center w-28">Tuỳ chọn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex justify-center items-center gap-3">
                       <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-cyan-600"></div>
                       <span className="font-medium text-slate-600">Đang tải dữ liệu...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <span className="bg-slate-50 rounded-full px-4 py-2 text-slate-500 border border-slate-200">Không tìm thấy người dùng nào phù hợp.</span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{user.full_name}</div>
                      <div className="text-xs text-slate-500 mt-1">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {user.department || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        user.is_active ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20" : "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20"
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        {user.is_active ? "Kích hoạt" : "Vô hiệu hóa"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-right">
                      {user.last_login
                        ? new Date(user.last_login).toLocaleString("vi-VN", { dateStyle: 'short', timeStyle: 'short' })
                        : "Chưa có"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-nowrap justify-center gap-2">
                        <button
                          type="button"
                          title="Xem chi tiết"
                          className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded bg-transparent transition-colors"
                          onClick={() => void openDetailDrawer(user.id)}
                        >
                          <EyeIcon />
                        </button>
                        {canUpdateUser ? (
                          <button
                            type="button"
                            title="Chỉnh sửa"
                            className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded bg-transparent transition-colors"
                            onClick={() => {
                              setSelectedUser(user);
                              setSelectedUserId(user.id);
                              openEditDrawer();
                            }}
                          >
                            <PencilIcon />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================================= */}
        {/* MASTER OVERTAB: RBAC PANEL */}
        {/* ========================================================= */}
        {isRbacDrawerOpen && (
           <div className="fixed inset-0 z-40 overflow-hidden" aria-labelledby="rbac-master-drawer" role="dialog" aria-modal="true">
             <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={closeRbacPanel}></div>
             <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-4 sm:p-6 z-[60]">
               <div className="pointer-events-auto w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 flex flex-col transition-all">
                 {orgId ? (
                   <RbacPanel
                     orgId={orgId}
                     canManage={canManageRbac}
                     onClose={closeRbacPanel}
                   />
                 ) : null}
               </div>
             </div>
           </div>
        )}

        {/* SIDE DRAWER FOR USER ACTIONS */}
        {drawerMode !== 'none' && (
          <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={closeDrawer}></div>
            <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-4 sm:p-6 z-[60]">
              <div className="pointer-events-auto w-full max-w-3xl max-h-[90vh] flex flex-col bg-white shadow-2xl rounded-2xl overflow-hidden transition-all">
                <div className="flex flex-col h-full overflow-y-auto">
                  
                  {/* Drawer Header */}
                  <div className="bg-slate-50 px-6 py-6 border-b border-slate-200 flex items-start justify-between shrink-0">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-slate-900" id="slide-over-title">
                        {drawerMode === 'create' && "Tạo người dùng mới"}
                        {drawerMode === 'detail' && "Hồ sơ người dùng"}
                        {drawerMode === 'edit' && "Chỉnh sửa thông tin"}
                      </h2>
                      {drawerMode === 'detail' && selectedUser && (
                        <div className="mt-1.5 flex items-center space-x-2">
                           <div className={`h-2.5 w-2.5 rounded-full ${selectedUser.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                           <p className="text-sm font-semibold text-slate-600">{selectedUser.is_active ? 'Đang hoạt động' : 'Tài khoản vô hiệu'}</p>
                        </div>
                      )}
                      {drawerMode === 'edit' && selectedUser && (
                         <p className="mt-1 text-sm text-slate-500">Người dùng đang chọn: <b>{selectedUser.username}</b></p>
                      )}
                    </div>
                    <div className="ml-3 flex h-7 items-center">
                      <button
                        type="button"
                        className="rounded-full bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-200 focus:outline-none transition p-1.5"
                        onClick={closeDrawer}
                      >
                        <XIcon />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Body - Create Form */}
                  {drawerMode === 'create' && (
                    <div className="relative flex-1 px-6 py-8">
                      <form className="space-y-5" onSubmit={onCreateUser}>
                        <div>
                           <label className="block text-sm font-medium leading-6 text-slate-900">Tên đăng nhập <span className="text-rose-500">*</span></label>
                           <div className="mt-1">
                              <input required className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6" value={form.username} onChange={(e) => setForm(p => ({...p, username: e.target.value}))} />
                           </div>
                        </div>
                        <div>
                           <label className="block text-sm font-medium leading-6 text-slate-900">Địa chỉ Email <span className="text-rose-500">*</span></label>
                           <div className="mt-1">
                              <input type="email" required className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6" value={form.email} onChange={(e) => setForm(p => ({...p, email: e.target.value}))} />
                           </div>
                        </div>
                        <div>
                           <label className="block text-sm font-medium leading-6 text-slate-900">Họ và tên <span className="text-rose-500">*</span></label>
                           <div className="mt-1">
                              <input required className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6" value={form.full_name} onChange={(e) => setForm(p => ({...p, full_name: e.target.value}))} />
                           </div>
                        </div>
                        <div>
                           <label className="block text-sm font-medium leading-6 text-slate-900">Mật khẩu <span className="text-rose-500">*</span></label>
                           <div className="mt-1">
                              <input type="password" minLength={8} autoComplete="new-password" required className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6" value={form.password} onChange={(e) => setForm(p => ({...p, password: e.target.value}))} />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="block text-sm font-medium leading-6 text-slate-900">Phòng ban</label>
                             <div className="mt-1">
                                <input className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6" value={form.department || ""} onChange={(e) => setForm(p => ({...p, department: e.target.value}))} />
                             </div>
                          </div>
                          <div>
                             <label className="block text-sm font-medium leading-6 text-slate-900">Vị trí cấp bậc</label>
                             <div className="mt-1">
                                <input className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6" value={form.position || ""} onChange={(e) => setForm(p => ({...p, position: e.target.value}))} />
                             </div>
                          </div>
                        </div>
                        {roles.length > 0 && (
                          <div>
                             <label className="block text-sm font-medium leading-6 text-slate-900">Vai trò ban đầu (tuỳ chọn)</label>
                             <div className="mt-1">
                                <select className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6" value={form.role_id || ""} onChange={(e) => setForm(p => ({...p, role_id: e.target.value || undefined}))}>
                                  <option value="">— Chưa gán —</option>
                                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                             </div>
                          </div>
                        )}
                        <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end gap-3">
                           <button type="button" onClick={closeDrawer} className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition">Hủy bỏ</button>
                           <button type="submit" disabled={isSubmitting} className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-2 transition">
                             {isSubmitting && <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>}
                             Tạo người dùng
                           </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Drawer Body - User Profile (Tabs & Inline Edit) */}
                  {drawerMode === 'detail' && selectedUser && (
                    <div className="relative flex-1 flex flex-col min-h-0 bg-slate-50/50">
                      {/* Tabs Header */}
                      <div className="flex border-b border-slate-200 px-6 pt-3 shrink-0 bg-white">
                        <button 
                          type="button"
                          onClick={() => { setActiveProfileTab("info"); setIsEditingProfile(false); setErrorMessage(""); setStatusMessage(""); }}
                          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeProfileTab === "info" ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
                        >
                          Thông tin cá nhân
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { setActiveProfileTab("security"); setIsEditingProfile(false); setErrorMessage(""); setStatusMessage(""); }}
                          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeProfileTab === "security" ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
                        >
                          Bảo mật & Phân quyền
                        </button>
                      </div>

                      {/* Tab: Info */}
                      {activeProfileTab === "info" && (
                        <div className="flex-1 overflow-y-auto px-6 py-8">
                          {!isEditingProfile ? (
                            <div className="relative bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 group">
                               {canUpdateUser && (
                                  <button 
                                    onClick={openEditDrawer} 
                                    className="absolute top-6 right-6 flex items-center gap-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-800 bg-cyan-50 px-3 py-1.5 rounded-lg opacity-0 transition group-hover:opacity-100"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Sửa hồ sơ
                                  </button>
                               )}
                               <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-800 mb-6 flex items-center gap-2"><div className="w-1.5 h-4 bg-cyan-500 rounded-full"></div> Hồ sơ hiển thị</h3>
                               <dl className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 mt-4">
                                 <div>
                                   <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tài khoản truy cập</dt>
                                   <dd className="text-sm font-semibold text-slate-900 border-b border-dashed border-slate-200 pb-2 inline-block min-w-32">{selectedUser.username}</dd>
                                 </div>
                                 <div>
                                   <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email liên hệ</dt>
                                   <dd className="text-sm font-semibold text-slate-900 border-b border-dashed border-slate-200 pb-2 inline-block min-w-32">{selectedUser.email}</dd>
                                 </div>
                                 <div className="sm:col-span-2">
                                   <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Họ và tên đầy đủ</dt>
                                   <dd className="text-lg font-bold text-slate-900 drop-shadow-sm border-b border-dashed border-slate-200 pb-2 inline-block min-w-40">{selectedUser.full_name}</dd>
                                 </div>
                                 <div>
                                   <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phòng ban</dt>
                                   <dd className="text-sm font-semibold text-slate-900 border-b border-dashed border-slate-200 pb-2 inline-block min-w-32">{selectedUser.department || "—"}</dd>
                                 </div>
                                 <div>
                                   <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vị trí, cấp bậc</dt>
                                   <dd className="text-sm font-semibold text-slate-900 border-b border-dashed border-slate-200 pb-2 inline-block min-w-32">{selectedUser.position || "—"}</dd>
                                 </div>
                                 <div>
                                   <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Số máy cá nhân</dt>
                                   <dd className="text-sm font-semibold text-slate-900 border-b border-dashed border-slate-200 pb-2 inline-block min-w-32">{selectedUser.phone || "—"}</dd>
                                 </div>
                                 <div>
                                   <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lần đăng nhập cuối</dt>
                                   <dd className="text-sm font-semibold text-slate-900 border-b border-dashed border-slate-200 pb-2 inline-block min-w-32">{selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString("vi-VN") : "Chưa có dữ liệu"}</dd>
                                 </div>
                               </dl>
                            </div>
                          ) : (
                            <form className="bg-white p-7 rounded-2xl shadow-[0_2px_15px_-3px_rgba(6,81,237,0.15)] ring-1 ring-cyan-500 space-y-6 transition-all" onSubmit={onEditUser}>
                              <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-4">
                                 <h3 className="text-sm font-extrabold uppercase tracking-widest text-cyan-800 flex items-center gap-2">Chỉnh sửa hồ sơ</h3>
                                 <button type="button" onClick={() => setIsEditingProfile(false)} className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200 transition">Hủy ✕</button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6">
                                <div className="sm:col-span-2">
                                   <label className="block text-[13px] font-bold text-slate-700 uppercase tracking-wide">Họ và tên <span className="text-rose-500">*</span></label>
                                   <input required className="mt-1.5 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 font-medium shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-cyan-600 sm:text-sm transition-all bg-slate-50 focus:bg-white" value={editForm.full_name ?? ""} onChange={(e) => setEditForm(p => ({...p, full_name: e.target.value}))} />
                                </div>
                                <div>
                                   <label className="block text-[13px] font-bold text-slate-700 uppercase tracking-wide">Tên đăng nhập</label>
                                   <input disabled className="mt-1.5 block w-full rounded-md border-0 py-2.5 px-3 text-slate-500 font-medium bg-slate-100 shadow-sm ring-1 ring-inset ring-slate-200 sm:text-sm cursor-not-allowed opacity-70" value={editForm.username ?? ""} />
                                </div>
                                <div>
                                   <label className="block text-[13px] font-bold text-slate-700 uppercase tracking-wide">Địa chỉ Email <span className="text-rose-500">*</span></label>
                                   <input type="email" required className="mt-1.5 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 font-medium shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-cyan-600 sm:text-sm transition-all bg-slate-50 focus:bg-white" value={editForm.email ?? ""} onChange={(e) => setEditForm(p => ({...p, email: e.target.value}))} />
                                </div>
                                <div>
                                   <label className="block text-[13px] font-bold text-slate-700 uppercase tracking-wide">Phòng ban</label>
                                   <input className="mt-1.5 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 font-medium shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-cyan-600 sm:text-sm transition-all bg-slate-50 focus:bg-white" value={editForm.department ?? ""} onChange={(e) => setEditForm(p => ({...p, department: e.target.value}))} />
                                </div>
                                <div>
                                   <label className="block text-[13px] font-bold text-slate-700 uppercase tracking-wide">Vị trí cấp bậc</label>
                                   <input className="mt-1.5 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 font-medium shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-cyan-600 sm:text-sm transition-all bg-slate-50 focus:bg-white" value={editForm.position ?? ""} onChange={(e) => setEditForm(p => ({...p, position: e.target.value}))} />
                                </div>
                                <div className="sm:col-span-2">
                                   <label className="block text-[13px] font-bold text-slate-700 uppercase tracking-wide">Số điện thoại</label>
                                   <input className="mt-1.5 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 font-medium shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-cyan-600 sm:text-sm transition-all bg-slate-50 focus:bg-white" value={editForm.phone ?? ""} onChange={(e) => setEditForm(p => ({...p, phone: e.target.value}))} />
                                </div>
                              </div>
                              <div className="pt-5 mt-2 flex justify-end gap-3 border-t border-slate-100">
                                <button type="button" onClick={() => setIsEditingProfile(false)} className="rounded-md px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition">Huỷ thay đổi</button>
                                <button type="submit" disabled={isSubmitting} className="rounded-md bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2 transition hover:-translate-y-0.5 active:translate-y-0">
                                   {isSubmitting && <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>}
                                   Lưu thông tin
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}

                      {/* Tab: Security & Roles */}
                      {activeProfileTab === "security" && (
                        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8">
                           {/* Roles config */}
                           <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100">
                               <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                                 <div>
                                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-800 flex items-center gap-2"><div className="w-1.5 h-4 bg-teal-500 rounded-full"></div> Nhóm & Vai trò truy cập</h3>
                                    <p className="text-xs text-slate-500 mt-1.5 font-medium">Bổ sung hoặc phân lại quyền vào các chức năng hệ thống.</p>
                                 </div>
                               </div>
                               
                               <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                                  <div className="flex gap-2.5 flex-wrap mb-5">
                                    {(selectedUser.roles || []).length > 0 ? (
                                       (selectedUser.roles || []).map(r => (
                                         <span key={r.id} className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-bold text-teal-800 shadow-sm border border-teal-200">{r.name}</span>
                                       ))
                                    ) : (
                                       <span className="text-slate-400 italic text-sm font-medium">Tài khoản này chưa được gán bất kì vai trò nào.</span>
                                    )}
                                  </div>
                                  <div className="border-t border-slate-200 pt-4 flex gap-3 items-center">
                                     <select className="flex-1 rounded-md border-0 py-2.5 pl-3 pr-8 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-teal-600 sm:text-sm font-semibold bg-white" value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>
                                       <option value="" disabled>-- Chọn một thẻ vai trò bổ sung --</option>
                                       {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                     </select>
                                     <button onClick={() => void onAssignRole()} disabled={!canAssignRole || isSubmitting || !selectedRoleId} className="rounded-md bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 transition">Gán Role</button>
                                  </div>
                               </div>
                           </div>
                           
                           {/* Quick Actions Frame */}
                           <div className="bg-white p-6 rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100">
                              <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-800 mb-5 border-b border-slate-100 pb-3 flex items-center gap-2"><div className="w-1.5 h-4 bg-amber-500 rounded-full"></div> Quản lý Phiên & Khóa Tài khoản</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                 <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between hover:border-slate-300 transition-colors">
                                    <div>
                                      <h4 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-2">Trạng thái hiện tại: <span className={`px-2 py-0.5 rounded text-xs text-white ${selectedUser.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}>{selectedUser.is_active ? 'Active' : 'Blocked'}</span></h4>
                                      <p className="text-xs text-slate-500 leading-relaxed mb-5 font-medium">Chặn đăng nhập ngay lập tức. Tính năng này vẫn giữ lại toàn bộ lịch sử nhân sự trên hệ thống.</p>
                                    </div>
                                    <button onClick={() => void onToggleUserStatus()} disabled={!canUpdateUser || isSubmitting} className={`w-full flex justify-center items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-50 ${selectedUser.is_active ? 'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
                                       {selectedUser.is_active ? 'Khóa tài khoản (Block)' : 'Mở khóa tài khoản'}
                                    </button>
                                 </div>

                                 {canResetPassword ? (
                                    <form onSubmit={onResetPassword} className="p-5 rounded-xl border border-slate-200 bg-slate-50 hover:border-slate-300 transition-colors flex flex-col justify-between">
                                      <div>
                                        <h4 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-2">Mật khẩu mới</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed mb-4 font-medium">Quản trị viên thiết lập mật khẩu truy cập mới cho tài khoản (tối thiểu 8 ký tự).</p>
                                        <input 
                                          type="text"
                                          placeholder="Mật khẩu mới..."
                                          minLength={8}
                                          required
                                          className="mb-4 block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 font-medium shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-cyan-600 sm:text-sm transition-all bg-white"
                                          value={adminNewPassword}
                                          onChange={e => setAdminNewPassword(e.target.value)}
                                        />
                                      </div>
                                      <button type="submit" disabled={isSubmitting || adminNewPassword.length < 8} className="w-full flex justify-center items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm border border-slate-300 hover:bg-slate-100 transition disabled:opacity-50">
                                         Cập nhật mật khẩu
                                      </button>
                                    </form>
                                 ) : null}
                              </div>
                              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 hover:border-slate-300 transition-colors">
                                  <h4 className="text-sm font-bold text-slate-900 mb-1.5">Phiên đăng nhập</h4>
                                  <p className="text-xs text-slate-500 leading-relaxed mb-4 font-medium">
                                    Thu hồi toàn bộ phiên đăng nhập hiện có của tài khoản này.
                                  </p>
                                  <button
                                    onClick={() => void onRevokeAllSessions()}
                                    disabled={!canManageSessions || isSubmitting}
                                    className="w-full flex justify-center items-center gap-2 rounded-md bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm border border-slate-300 hover:bg-slate-100 transition disabled:opacity-50"
                                  >
                                    Thu hồi tất cả phiên
                                  </button>
                                </div>
                                <div className="p-5 rounded-xl border border-rose-200 bg-rose-50/60 hover:border-rose-300 transition-colors">
                                  <h4 className="text-sm font-bold text-rose-900 mb-1.5">Vô hiệu hóa tài khoản</h4>
                                  <p className="text-xs text-rose-700 leading-relaxed mb-4 font-medium">
                                    Soft delete tài khoản, giữ lịch sử và dữ liệu liên quan.
                                  </p>
                                  <button
                                    onClick={() => void onSoftDeleteUser()}
                                    disabled={!canDeleteUser || isSubmitting}
                                    className="w-full flex justify-center items-center gap-2 rounded-md bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-700 transition disabled:opacity-50"
                                  >
                                    Vô hiệu hóa người dùng
                                  </button>
                                </div>
                              </div>
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}


const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
);
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
);

type RbacDrawerMode = "none" | "create" | "edit";

type RbacPanelProps = {
  orgId: string;
  canManage: boolean;
  onClose: () => void;
};

function RbacPanel({ orgId, canManage, onClose }: RbacPanelProps) {
  const [roles, setRoles] = useState<RoleResponse[]>([]);
  const [permissions, setPermissions] = useState<PermissionResponse[]>([]);

  // Drawer states
  const [drawerMode, setDrawerMode] = useState<RbacDrawerMode>("none");
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftPermissionCodes, setDraftPermissionCodes] = useState<Set<string>>(
    new Set(),
  );

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [roleRows, permissionRows] = await Promise.all([
        getRbacRoles(orgId),
        getRbacPermissions(orgId),
      ]);
      setRoles(roleRows);
      setPermissions(permissionRows);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(
          getMessageByErrorCode(error.detail.error_code, error.detail.message),
        );
      } else {
        setErrorMessage("Không thể tải dữ liệu RBAC.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [orgId]);

  // Group permissions by prefix
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionResponse[]> = {};
    permissions.forEach((perm) => {
      const prefix = perm.code.split(".")[0] || "Khác";
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(perm);
    });
    return groups;
  }, [permissions]);

  const openCreateDrawer = () => {
    if (!canManage) return;
    setEditingRole(null);
    setDraftName("");
    setDraftDescription("");
    setDraftPermissionCodes(new Set());
    setErrorMessage("");
    setStatusMessage("");
    setDrawerMode("create");
  };

  const openEditDrawer = (role: RoleResponse) => {
    if (!canManage) return;
    setEditingRole(role);
    setDraftName(role.name);
    setDraftDescription(role.description || "");
    setDraftPermissionCodes(new Set(role.permission_codes || []));
    setErrorMessage("");
    setStatusMessage("");
    setDrawerMode("edit");
  };

  const closeDrawer = () => {
    setDrawerMode("none");
  };

  const toggleDraftPermission = (code: string) => {
    setDraftPermissionCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const submitDrawer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      if (drawerMode === "create") {
        const newRole = await createRbacRole(orgId, {
          name: draftName,
          description: draftDescription,
        });
        await updateRolePermissions(
          newRole.id,
          orgId,
          Array.from(draftPermissionCodes),
        );
        setStatusMessage("Đã tạo mới và cập nhật phân quyền thành công.");
      } else if (drawerMode === "edit" && editingRole) {
        if (!editingRole.is_system) {
          await updateRbacRole(editingRole.id, orgId, {
            name: draftName,
            description: draftDescription,
          });
        }
        await updateRolePermissions(
          editingRole.id,
          orgId,
          Array.from(draftPermissionCodes),
        );
        setStatusMessage("Đã lưu thiết lập vai trò thành công.");
      }
      closeDrawer();
      await load();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(
          getMessageByErrorCode(error.detail.error_code, error.detail.message),
        );
      } else {
        setErrorMessage("Không thể lưu vai trò.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDeleteRole = async (role: RoleResponse) => {
    if (!canManage) return;
    if (role.is_system) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa vai trò '${role.name}'? Mọi người dùng thuộc vai trò này sẽ mất các quyền tương ứng.`,
      )
    )
      return;
    setErrorMessage("");
    setStatusMessage("");
    try {
      await deleteRbacRole(role.id, orgId);
      setStatusMessage("Đã xóa vai trò.");
      await load();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(
          getMessageByErrorCode(error.detail.error_code, error.detail.message),
        );
      } else {
        setErrorMessage("Không thể xóa vai trò.");
      }
    }
  };

  const onResetSystemRole = async () => {
    if (!canManage || !editingRole || !editingRole.is_system) return;
    if (!window.confirm(`Reset quyền mặc định cho role hệ thống '${editingRole.name}'?`)) return;
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);
    try {
      await resetSystemRolePermissions(editingRole.id, orgId);
      const freshRoles = await getRbacRoles(orgId);
      setRoles(freshRoles);
      const reloaded = freshRoles.find((item) => item.id === editingRole.id);
      if (reloaded) {
        setEditingRole(reloaded);
        setDraftPermissionCodes(new Set(reloaded.permission_codes || []));
      }
      setStatusMessage("Đã reset quyền mặc định cho role hệ thống.");
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrorMessage(
          getMessageByErrorCode(error.detail.error_code, error.detail.message),
        );
      } else {
        setErrorMessage("Không thể reset quyền mặc định.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldIcon /> Cấu hình vai trò & Quyền hạn
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tạo các nhóm quyền và gán ranh giới truy cập cho hệ thống.
          </p>
        </div>
        {canManage ? (
          <button
            onClick={openCreateDrawer}
            className="flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition"
          >
            <PlusIcon /> Tạo vai trò mới
          </button>
        ) : (
          <div className="inline-flex flex-col items-end gap-1">
            <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              Chế độ chỉ xem
            </span>
            <span className="text-[11px] text-slate-400">
              Cần quyền <span className="font-mono">rbac.manage</span> để chỉnh sửa.
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-2 text-slate-500 hover:bg-slate-50"
          aria-label="Đóng RBAC panel"
        >
          <XIcon />
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center gap-2">
          {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mt-4">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="min-w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Tên vai trò</th>
                <th className="px-6 py-3 font-semibold">Mô tả chi tiết</th>
                <th className="px-6 py-3 font-semibold text-center mt-0 5">
                  Thành viên
                </th>
                <th className="px-6 py-3 font-semibold text-center mt-0">
                  Loại Nhóm
                </th>
                <th className="px-6 py-3 font-semibold text-right w-32">
                  Tuỳ chọn
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    <div className="flex justify-center items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-slate-400"></div>
                      Đang lấy dữ liệu...
                    </div>
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    Chưa có vai trò nào được định nghĩa.
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr
                    key={role.id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="px-6 py-4 font-semibold text-slate-900 border-l-2 border-transparent group-hover:border-cyan-500">
                      {role.name}
                    </td>
                    <td
                      className="px-6 py-4 text-slate-500 max-w-sm truncate"
                      title={role.description || undefined}
                    >
                      {role.description || "—"}
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-slate-800">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        {role.member_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {role.is_system ? (
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-700/10">
                          Hệ thống
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-700/10">
                          Tự định nghĩa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-400">
                        <button
                          onClick={() => openEditDrawer(role)}
                          disabled={!canManage}
                          className={`px-2.5 py-1.5 rounded transition bg-white border border-slate-200 shadow-sm flex items-center gap-1 text-xs font-medium ${!canManage ? "opacity-30 cursor-not-allowed" : "hover:bg-slate-50 hover:text-cyan-600 text-slate-600"}`}
                          title="Thiết lập quyền"
                        >
                          <SettingsIcon /> Cấu hình
                        </button>
                        <button
                          onClick={() => void onDeleteRole(role)}
                          disabled={!canManage || role.is_system}
                          className={`p-1.5 rounded transition bg-white border border-slate-200 shadow-sm ${!canManage || role.is_system ? "opacity-30 cursor-not-allowed" : "hover:bg-rose-50 hover:text-rose-600 text-slate-500 hover:border-rose-200"}`}
                          title="Xóa nhóm"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overtab Drawer for Role Form & Permissions */}
      {drawerMode !== "none" && (
        <div
          className="fixed inset-0 z-[60] overflow-hidden"
          aria-labelledby="slide-over-title"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={closeDrawer}
          ></div>
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-4 sm:p-6 z-[70]">
            <div className="pointer-events-auto w-full max-w-3xl max-h-[90vh] flex flex-col bg-white shadow-2xl ring-1 ring-slate-900/10 rounded-2xl overflow-hidden transition-all">
              <div className="flex flex-col h-full bg-white overflow-y-auto">
                {/* Header */}
                <div className="bg-slate-50 px-6 py-6 border-b border-slate-200 flex items-start justify-between shrink-0">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      {drawerMode === "create"
                        ? "Định nghĩa Vai trò Mới"
                        : "Thiết lập Vai trò & Quyền hạn"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Vai trò được gắn cho người dùng để kiểm soát truy cập hệ
                      thống.
                    </p>
                  </div>
                  <div className="ml-3 flex h-7 items-center">
                    <button
                      type="button"
                      onClick={closeDrawer}
                      className="rounded-md bg-white text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 p-1"
                    >
                      <XIcon />
                    </button>
                  </div>
                </div>

                {/* Form & Permissions */}
                <form
                  id="roleForm"
                  className="flex-1 overflow-y-auto"
                  onSubmit={submitDrawer}
                >
                  <div className="p-6 pb-20 space-y-10">
                    {/* Info Section */}
                    <section>
                      <h3 className="text-base font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-2 relative inline-block">
                        1. Thông tin chung
                      </h3>
                      <div className="grid gap-5">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Tên vai trò <span className="text-rose-500">*</span>
                          </label>
                          <input
                            required
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            disabled={editingRole?.is_system}
                            className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-cyan-600 sm:text-sm"
                            placeholder="VD: Quản lý Chất lượng, Giám đốc..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Mô tả mục đích
                          </label>
                          <textarea
                            value={draftDescription}
                            onChange={(e) =>
                              setDraftDescription(e.target.value)
                            }
                            disabled={editingRole?.is_system}
                            rows={2}
                            className="block w-full rounded-md border-0 py-2 px-3 text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-cyan-600 sm:text-sm"
                            placeholder="Khu vực hoạt động, quyền hạn liên đới..."
                          />
                        </div>
                      </div>
                    </section>

                    {/* Permissions Section */}
                    <section>
                      <div className="mb-5 border-b border-slate-100 pb-3 flex justify-between items-end">
                        <div className="pr-4">
                          <h3 className="text-base font-semibold text-slate-900">
                            2. Giới hạn Quyền (Permissions)
                          </h3>
                          <p className="text-xs text-slate-500 mt-1">
                            Gán các Module chức năng mà vai trò này được phép
                            truy cập.
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Quy ước: <span className="font-mono">*.read</span>{" "}
                            để truy cập/xem trang,{" "}
                            <span className="font-mono">*.manage</span> để thao
                            tác quản trị/CRUD trong module tương ứng.
                          </p>
                        </div>
                        <div className="text-xs font-semibold px-2.5 py-1 bg-cyan-50 text-cyan-700 rounded border border-cyan-100 shrink-0">
                          Đã chọn: {draftPermissionCodes.size} /{" "}
                          {permissions.length}
                        </div>
                      </div>

                      <div className="grid gap-x-6 gap-y-6 md:grid-cols-2">
                        {Object.entries(groupedPermissions).map(
                          ([prefix, perms]) => (
                            <div
                              key={prefix}
                              className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm"
                            >
                              <h4 className="text-sm border-b border-slate-100 pb-2 mb-3 font-bold text-slate-800 uppercase tracking-widest flex items-center justify-between">
                                <span>{prefix} Domain</span>
                                <span className="text-xs font-normal text-slate-400 lowercase">
                                  {perms.length} mục
                                </span>
                              </h4>
                              <div className="space-y-3 pt-1">
                                {perms.map((p) => (
                                  <label
                                    key={p.id}
                                    className="flex flex-row items-start gap-3 cursor-pointer group hover:bg-slate-50 -mx-2 px-2 py-1 rounded transition-colors"
                                  >
                                    <div className="flex items-center h-5">
                                      <input
                                        type="checkbox"
                                        checked={draftPermissionCodes.has(
                                          p.code,
                                        )}
                                        onChange={() =>
                                          toggleDraftPermission(p.code)
                                        }
                                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600 focus:outline-none transition group-hover:border-cyan-400"
                                      />
                                    </div>
                                    <div className="flex flex-col">
                                      <span
                                        className={`text-sm font-medium ${draftPermissionCodes.has(p.code) ? "text-cyan-800" : "text-slate-700 group-hover:text-slate-900"} transition-colors`}
                                      >
                                        {p.code}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {p.description ||
                                          "Không có mô tả chi tiết."}
                                      </span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </section>
                  </div>
                </form>

                {/* Footer Actions */}
                <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2">
                    {editingRole?.is_system ? (
                      <button
                        type="button"
                        onClick={() => void onResetSystemRole()}
                        disabled={isSubmitting || !canManage}
                        className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Reset quyền mặc định
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={closeDrawer}
                      disabled={isSubmitting}
                      className="text-sm font-medium text-slate-600 hover:text-slate-900 bg-transparent px-3 py-2 disabled:opacity-50"
                    >
                      Hủy bỏ quay lại
                    </button>
                  </div>
                  <button
                    form="roleForm"
                    type="submit"
                    disabled={isSubmitting || !draftName.trim() || !canManage}
                    className="rounded-md bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    {isSubmitting && (
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                    )}
                    Xác nhận Lưu
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
