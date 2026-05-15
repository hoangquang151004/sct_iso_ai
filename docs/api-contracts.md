# API Contracts - SCT-ISO.AI

Ngày cập nhật: 2026-04-20.

## 1) Base và quy ước chung
- Base path hiện tại: không có prefix version (`/auth`, `/users`, `/rbac`, ...).
- Error envelope chuẩn:
```json
{
  "detail": {
    "message": "Mô tả lỗi",
    "error_code": "ERROR_CODE_CONSTANT",
    "request_id": "uuid",
    "fields": []
  }
}
```

## 2) Auth

### `POST /auth/login`
- Permission: không yêu cầu bearer.
- Request:
```json
{
  "username": "admin",
  "password": "Admin12345",
  "device_label": "Chrome on Windows"
}
```
- Response 200: `{ access_token, token_type, expires_at }`.
- Set-Cookie: refresh token (`httpOnly`, `path=/`, `secure/samesite` theo config).
- Error codes: `AUTH_INVALID_CREDENTIALS`, `RATE_LIMITED`.

### `GET /auth/me`
- Permission: bearer token hợp lệ.
- Response 200: `AuthPrincipal` (`user_id`, `username`, `role_ids`, `permissions`, `org_id`, `token_version`, `must_change_password`, `exp`).
- Error codes: `UNAUTHORIZED`.

`permissions` hiện bao gồm nhóm page-scope theo module:
- `dashboard.read|manage`
- `documents.read|manage`
- `haccp.read|manage`
- `prp.read|manage`
- `capa.read|manage`
- `analytics.read|manage`
- `reports.read|manage`

### `POST /auth/refresh`
- Permission: refresh cookie hợp lệ.
- Response 200: `{ access_token, token_type, expires_at }` + refresh cookie mới.
- Error codes: `UNAUTHORIZED`, `RATE_LIMITED`.

### `POST /auth/logout`
- Permission: bearer token hợp lệ.
- Response 204.
- Error codes: `UNAUTHORIZED`.

### `GET /auth/sessions`
- Permission: bearer token hợp lệ.
- Response 200:
```json
[
  {
    "id": "uuid",
    "device_label": "Chrome",
    "user_agent": "...",
    "ip": "127.0.0.1",
    "created_at": "datetime",
    "last_used_at": "datetime",
    "is_current": true
  }
]
```

### `DELETE /auth/sessions/{session_id}`
- Permission: bearer token hợp lệ.
- Response 204.
- Error codes: `NOT_FOUND`, `UNAUTHORIZED`.

### `POST /auth/sessions/revoke-all`
- Permission: bearer token hợp lệ.
- Response 200: `{ "revoked_count": 2 }`.

## 3) Users

### `GET /users?org_id=...`
- Permission: `users.read`.
- Response 200: `UserResponse[]`.

### `POST /users`
- Permission: `users.create`.
- Request: `UserCreate`.
- Response 201: `UserResponse`.
- Error codes: `USER_EMAIL_ALREADY_EXISTS`, `USER_USERNAME_ALREADY_EXISTS`, `USER_ROLE_INVALID`, `USER_PASSWORD_WEAK`.

### `GET /users/{user_id}?org_id=...`
- Permission: `users.read`.
- Response 200: `UserResponse`.
- Error codes: `USER_NOT_FOUND`.

### `PATCH /users/{user_id}?org_id=...`
- Permission: `users.update`.
- Request: `UserUpdate`.
- Response 200: `UserResponse`.
- Error codes: `USER_NOT_FOUND`, `USER_ROLE_INVALID`, `USER_INACTIVE`.

### `PATCH /users/{user_id}/role?org_id=...`
- Permission: `users.assign_role`.
- Request: `{ "role_id": "uuid" }`.
- Response 200: `UserResponse`.

### `DELETE /users/{user_id}?org_id=...`
- Permission: `users.delete`.
- Hành vi: soft delete (`is_active=false`, `disabled_at` set, revoke sessions, bump token version).
- Response 204.
- Error codes: `USER_NOT_FOUND`, `USER_INACTIVE`.

### `POST /users/{user_id}/reset-password?org_id=...`
- Permission: `users.reset_password`.
- Request:
```json
{
  "new_password": "optional"
}
```
- Response 200: `{ "temporary_password": "..." }`.
- Error codes: `USER_NOT_FOUND`, `USER_INACTIVE`, `USER_PASSWORD_WEAK`.

### `POST /users/me/change-password`
- Permission: bearer token hợp lệ.
- Request:
```json
{
  "current_password": "old",
  "new_password": "NewPass123"
}
```
- Response 204.
- Error codes: `AUTH_INVALID_CREDENTIALS`, `USER_PASSWORD_WEAK`, `USER_INACTIVE`.

### `POST /users/{user_id}/sessions/revoke-all?org_id=...`
- Permission: `users.manage_sessions`.
- Response 200: `{ "revoked_count": 3 }`.
- Error codes: `USER_NOT_FOUND`, `FORBIDDEN`.

### `GET /users/rbac/roles?org_id=...`
- Permission: `users.read`.
- Response 200: `RoleResponse[]`.

### `UserResponse` hiện tại
- Giữ tương thích cũ: `role_id`.
- Bổ sung:
  - `role`: role đầu tiên `{id, name}`.
  - `roles`: danh sách role `[{id, name}]`.
  - `disabled_at`, `must_change_password`.

## 4) RBAC

### `GET /rbac/permissions?org_id=...`
- Permission: `rbac.read`.
- Response 200: `PermissionResponse[]`.

### `GET /rbac/roles?org_id=...`
- Permission: `rbac.read`.
- Response 200: `RoleResponse[]` (bao gồm system role).
- `RoleResponse` hiện tại gồm:
  - `id`, `org_id`, `name`, `description`, `is_system`
  - `member_count` (số user active đang được gán role)
  - `created_at`, `permission_codes`

### `POST /rbac/roles`
- Permission: `rbac.manage`.
- Request: `{ org_id, name, description }`.
- Response 201: `RoleResponse`.
- Error codes: `ROLE_NAME_ALREADY_EXISTS`.

### `PATCH /rbac/roles/{role_id}?org_id=...`
- Permission: `rbac.manage`.
- Response 200: `RoleResponse`.
- Error codes: `ROLE_NOT_FOUND`, `ROLE_SYSTEM_PROTECTED`, `ROLE_NAME_ALREADY_EXISTS`.

### `DELETE /rbac/roles/{role_id}?org_id=...`
- Permission: `rbac.manage`.
- Response 204.
- Error codes: `ROLE_NOT_FOUND`, `ROLE_SYSTEM_PROTECTED`, `ROLE_IN_USE`.

### `PUT /rbac/roles/{role_id}/permissions?org_id=...`
- Permission: `rbac.manage`.
- Request: `{ "permission_codes": ["users.read", "audit.read"] }`.
- Response 200: `{ "updated_permissions": 2 }`.
- Error codes: `ROLE_NOT_FOUND`, `PERMISSION_NOT_FOUND`.

## 5) Audit

### `GET /audit/logs?org_id=...`
- Permission: `audit.read`.
- Query hỗ trợ: `action`, `actor_user_id`, `target_type`, `from_dt`, `to_dt`, `limit`, `offset`.
- Response 200: `AuditLogResponse[]`.

## 6) HACCP — phiếu đánh giá (bổ sung)

### `GET /haccp/assignees`
- Permission: `haccp.read` (không yêu cầu `users.read`).
- Query: `is_active` (boolean, tuỳ chọn; bỏ qua = trả về mọi user trong org).
- Response 200: `HaccpAssigneeResponse[]` — `{ id, full_name, department, is_active }` trong phạm vi `org_id` của principal.
- Dùng cho dropdown «Người phụ trách» / «Người xử lý» trên màn HACCP.

### `POST /haccp/assessments`
- Permission: bearer; `org_id` gắn từ principal.
- Request body (`HaccpAssessmentCreate`): `haccp_plan_id`, **`calendar_event_id`** (bắt buộc), `title`, `assessment_date` (tuỳ chọn), `items` (tuỳ chọn).
- `calendar_event_id` phải trỏ tới `calendar_events` của org, `event_type = HACCP_ASSESSMENT`, trạng thái còn `SCHEDULED`, và `haccp_plan_id` trong payload phải trùng `haccp_plan_id` lưu trong JSON `description` của sự kiện lịch.
- **Mỗi `calendar_event_id` chỉ một phiếu** (mọi trạng thái). Nếu đã có phiếu gắn lịch → `400` với mô tả tiếng Việt. Xóa phiếu nháp (`DELETE`) thì có thể tạo lại cho cùng lịch.
- `GET /haccp/plans/schedules`: mỗi phần tử có thêm `has_assessment` (boolean) — `true` nếu org đã có phiếu gắn `id` lịch đó.
- Response 201: `HaccpAssessmentResponse` (có thể có `calendar_event_id`).
- Lỗi nghiệp vụ: `400` với `detail` là chuỗi mô tả (tiếng Việt).

### `POST /haccp/assessments/{assessment_id}/submit`
- Response: `HaccpAssessmentSubmitResponse` (phiếu đã gửi + **`deviations_created`**).
- Mỗi hạng mục **`CCP`** có `result = FAIL` tạo một bản ghi `ccp_monitoring_logs` (`is_within_limit = false`, `deviation_status = NEW`) — hiển thị ở tab **Độ lệch CCP** để xử lý và «Gửi CAPA».
- Khi gửi phiếu thành công, nếu phiếu có `calendar_event_id` và sự kiện lịch còn `SCHEDULED`, hệ thống cập nhật sự kiện đó sang **`COMPLETED`** (lịch «Quản lý» / «Sắp tới» phản ánh trạng thái mới sau khi refetch).

### `GET /haccp/plans/schedules`
- Response: mỗi phần tử gồm `id`, `title`, `start_time`, `status` (có thể là `OVERDUE` khi hiển thị dù DB vẫn `SCHEDULED`), **`haccp_plan_id`**, **`plan_name`** (phục vụ UI chọn lịch khi tạo phiếu).

### `POST /haccp/assessments/{assessment_id}/items`
- Permission: bearer; phiếu thuộc `org_id` của principal.
- Request body (`HaccpAssessmentManualItemCreate`): `question` (bắt buộc), `expected_value` (tuỳ chọn), `item_type` (`GENERAL` mặc định, hoặc `PROCESS_STEP` / `CCP`), `ref_id` (tuỳ chọn).
- Response 201: `HaccpAssessmentItemResponse`.
- Chỉ cho phép khi phiếu đang `DRAFT`; nếu không: `400` với mô tả trạng thái; `404` nếu không tìm thấy phiếu theo org.

### `DELETE /haccp/assessment-items/{item_id}`
- Permission: bearer; hạng mục thuộc phiếu `DRAFT` của org.
- Response 204 khi xóa thành công; `404` nếu không xóa được (phiếu không nháp, sai org, hoặc không tồn tại).
