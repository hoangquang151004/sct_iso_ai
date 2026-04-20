import { apiRequest } from "@/lib/api-client";
import type {
  RoleResponse,
  UserCreatePayload,
  UserResponse,
  UserUpdatePayload,
} from "@/lib/users-types";

type UserFilter = {
  orgId: string;
  roleId?: string;
  isActive?: boolean;
  department?: string;
};

export const getUsers = async (filter: UserFilter): Promise<UserResponse[]> => {
  const searchParams = new URLSearchParams({ org_id: filter.orgId });
  if (filter.roleId) {
    searchParams.set("role_id", filter.roleId);
  }
  if (filter.isActive !== undefined) {
    searchParams.set("is_active", String(filter.isActive));
  }
  if (filter.department) {
    searchParams.set("department", filter.department);
  }
  return apiRequest<UserResponse[]>(`/users?${searchParams.toString()}`);
};

export const createUser = async (
  payload: UserCreatePayload,
): Promise<UserResponse> => {
  return apiRequest<UserResponse>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const getUserById = async (
  userId: string,
  orgId: string,
): Promise<UserResponse> => {
  return apiRequest<UserResponse>(`/users/${userId}?org_id=${orgId}`);
};

export const updateUser = async (
  userId: string,
  orgId: string,
  payload: UserUpdatePayload,
): Promise<UserResponse> => {
  return apiRequest<UserResponse>(`/users/${userId}?org_id=${orgId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

export const getRoles = async (orgId: string): Promise<RoleResponse[]> => {
  return apiRequest<RoleResponse[]>(`/users/rbac/roles?org_id=${orgId}`);
};

export const assignRoleToUser = async (
  userId: string,
  orgId: string,
  roleId: string,
): Promise<UserResponse> => {
  return apiRequest<UserResponse>(`/users/${userId}/role?org_id=${orgId}`, {
    method: "PATCH",
    body: JSON.stringify({ role_id: roleId }),
  });
};

export const resetPassword = async (
  userId: string,
  orgId: string,
  newPassword?: string,
): Promise<{ temporary_password: string }> => {
  return apiRequest<{ temporary_password: string }>(
    `/users/${userId}/reset-password?org_id=${orgId}`,
    {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    },
  );
};

export const softDeleteUser = async (userId: string, orgId: string): Promise<void> => {
  await apiRequest<void>(`/users/${userId}?org_id=${orgId}`, { method: "DELETE" });
};

export const revokeAllUserSessions = async (
  userId: string,
  orgId: string,
): Promise<{ revoked_count: number }> => {
  return apiRequest<{ revoked_count: number }>(
    `/users/${userId}/sessions/revoke-all?org_id=${orgId}`,
    { method: "POST" },
  );
};

export const changeMyPassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  await apiRequest<void>("/users/me/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
};
