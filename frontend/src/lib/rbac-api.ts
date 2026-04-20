import { apiRequest } from "@/lib/api-client";
import type { PermissionResponse, RoleResponse } from "@/lib/users-types";

export const normalizeRoleResponse = (
  role: Omit<RoleResponse, "member_count" | "permission_codes" | "created_at"> & {
    member_count?: number | null;
    permission_codes?: string[] | null;
    created_at?: string | null;
  },
): RoleResponse => ({
  ...role,
  member_count: role.member_count ?? 0,
  created_at: role.created_at ?? new Date(0).toISOString(),
  permission_codes: role.permission_codes ?? [],
});

export const getRbacPermissions = async (orgId: string): Promise<PermissionResponse[]> => {
  return apiRequest<PermissionResponse[]>(`/rbac/permissions?org_id=${orgId}`);
};

export const getRbacRoles = async (orgId: string): Promise<RoleResponse[]> => {
  const roles = await apiRequest<
    Array<
      Omit<RoleResponse, "member_count" | "permission_codes" | "created_at"> & {
        member_count?: number | null;
        permission_codes?: string[] | null;
        created_at?: string | null;
      }
    >
  >(`/rbac/roles?org_id=${orgId}`);
  return roles.map(normalizeRoleResponse);
};

export const createRbacRole = async (
  orgId: string,
  payload: { name: string; description?: string },
): Promise<RoleResponse> => {
  return apiRequest<RoleResponse>("/rbac/roles", {
    method: "POST",
    body: JSON.stringify({ org_id: orgId, ...payload }),
  });
};

export const updateRbacRole = async (
  roleId: string,
  orgId: string,
  payload: { name?: string; description?: string },
): Promise<RoleResponse> => {
  return apiRequest<RoleResponse>(`/rbac/roles/${roleId}?org_id=${orgId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

export const deleteRbacRole = async (roleId: string, orgId: string): Promise<void> => {
  await apiRequest<void>(`/rbac/roles/${roleId}?org_id=${orgId}`, {
    method: "DELETE",
  });
};

export const updateRolePermissions = async (
  roleId: string,
  orgId: string,
  permissionCodes: string[],
): Promise<void> => {
  await apiRequest<void>(`/rbac/roles/${roleId}/permissions?org_id=${orgId}`, {
    method: "PUT",
    body: JSON.stringify({ permission_codes: permissionCodes }),
  });
};

export const resetSystemRolePermissions = async (
  roleId: string,
  orgId: string,
): Promise<{ updated_permissions: number }> => {
  return apiRequest<{ updated_permissions: number }>(
    `/rbac/roles/${roleId}/permissions/reset?org_id=${orgId}`,
    {
      method: "POST",
    },
  );
};
