import { useMemo } from "react";

import type { AuthPrincipal } from "@/types";

type PermissionFlags = {
  canReadRbac: boolean;
  canManageRbac: boolean;
  canCreateUser: boolean;
  canUpdateUser: boolean;
  canAssignRole: boolean;
  canResetPassword: boolean;
  canManageSessions: boolean;
  canDeleteUser: boolean;
  canReadAudit: boolean;
};

export function usePermissionFlags(principal: AuthPrincipal | null): PermissionFlags {
  return useMemo(() => {
    const permissionSet = new Set(principal?.permissions ?? []);

    return {
      canReadRbac: permissionSet.has("rbac.read"),
      canManageRbac: permissionSet.has("rbac.manage"),
      canCreateUser: permissionSet.has("users.create"),
      canUpdateUser: permissionSet.has("users.update"),
      canAssignRole: permissionSet.has("users.assign_role"),
      canResetPassword: permissionSet.has("users.reset_password"),
      canManageSessions: permissionSet.has("users.manage_sessions"),
      canDeleteUser: permissionSet.has("users.delete"),
      canReadAudit: permissionSet.has("audit.read"),
    };
  }, [principal?.permissions]);
}
