export type ApiErrorDetail = {
  message: string;
  error_code: string;
  request_id?: string;
  fields?: Array<{ field?: string; message?: string }>;
};

export type ApiErrorEnvelope = {
  detail: ApiErrorDetail | string;
};

export type UserResponse = {
  id: string;
  org_id: string;
  role_id: string | null;
  role?: RoleRef | null;
  roles?: RoleRef[];
  username: string;
  email: string;
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  disabled_at?: string | null;
  must_change_password?: boolean;
  last_login: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RoleRef = {
  id: string;
  name: string;
};

export type UserCreatePayload = {
  username: string;
  email: string;
  full_name: string;
  password: string;
  org_id: string;
  role_id?: string | null;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  is_active?: boolean;
};

export type UserUpdatePayload = Partial<
  Omit<UserCreatePayload, "password" | "org_id">
>;

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
};

export type AuthPrincipal = {
  user_id: string;
  username: string;
  role_ids: string[];
  permissions: string[];
  org_id: string;
  token_version?: number;
  must_change_password?: boolean;
  exp: number;
};

export type RoleResponse = {
  id: string;
  org_id: string | null;
  name: string;
  description: string | null;
  is_system: boolean;
  member_count: number;
  created_at: string;
  permission_codes: string[];
};

export type PermissionResponse = {
  id: string;
  code: string;
  description: string | null;
  created_at: string;
};

export type SessionSummary = {
  id: string;
  device_label: string | null;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_used_at: string | null;
  is_current: boolean;
};

export type AuditLogResponse = {
  id: string;
  org_id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  request_id: string | null;
  ip: string | null;
  user_agent: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};
