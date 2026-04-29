# Security Rules - SCT-ISO.AI

Ngày cập nhật: 2026-04-21.

## 1) Trạng thái đã triển khai
- Auth API thật: `/auth/login`, `/auth/me`, `/auth/refresh`, `/auth/logout`.
- Refresh token dùng cookie `httpOnly`, `path=/`, `secure/samesite` theo config.
- RBAC theo permission guard `require_permissions`.
- Rate limit đã bật cho `login` và `refresh`.
- Audit log đã có (`audit_log` + `GET /audit/logs`).
- Token invalidation theo `users.token_version` + claim `tv`.
- Session theo thiết bị đã có (`/auth/sessions/*` và admin revoke-all).
- Frontend: middleware edge (`frontend/src/middleware.ts`) không đọc cookie refresh (cookie gắn origin FE khi dùng proxy dev `/api-backend`, `path=/`); bắt buộc đăng nhập và kiểm tra quyền route do **AuthGate** + principal sau `GET /auth/me`. Modal **phiên hết hạn** khi refresh token thất bại (xử lý trong `api-client` / `AuthProvider`).

## 2) Quy tắc bắt buộc
1. Không log dữ liệu nhạy cảm (password, raw token, secret).
2. Không hardcode secret; đọc từ biến môi trường qua `backend/core/config.py`.
3. Mọi endpoint nhạy cảm phải có guard permission và kiểm soát `org_id`.
4. Mọi lỗi API trả theo envelope chuẩn + `error_code`.
5. Frontend route guard phải map theo permission `*.read` cho từng module trang chính.

## 3) Cookie/Session rules
- Refresh cookie:
  - `HttpOnly=true`
  - `Path=/`
  - `Secure` theo `REFRESH_COOKIE_SECURE`
  - `SameSite` theo `REFRESH_COOKIE_SAMESITE`
- Bắt buộc:
  - `APP_ENV in {staging, prod}` => `REFRESH_COOKIE_SECURE=true`
  - `REFRESH_COOKIE_SAMESITE=none` => `REFRESH_COOKIE_SECURE=true`
- Session management:
  - User tự xem/revoke session qua `/auth/sessions`.
  - Admin revoke toàn bộ session user qua `/users/{id}/sessions/revoke-all`.

## 4) Rate limit rules
- `POST /auth/login`: mặc định `10/minute`.
- `POST /auth/refresh`: mặc định `30/minute`.
- `APP_ENV=test`: ngưỡng nâng cao (mặc định `1000/minute`) để tránh làm hỏng CI.
- Khi vượt ngưỡng trả `429` với `error_code=RATE_LIMITED`.

## 5) Password policy và reset flow
- Password policy:
  - >= 8 ký tự
  - có ít nhất 1 chữ và 1 số
  - không có khoảng trắng đầu/cuối
- Lỗi policy dùng `USER_PASSWORD_WEAK` (422).
- Admin reset password:
  - có thể sinh `temporary_password`
  - set `must_change_password=true`
  - revoke session + bump token version
- User đổi mật khẩu:
  - cần `current_password` đúng
  - endpoint `POST /users/me/change-password` chỉ yêu cầu bearer token hợp lệ (không yêu cầu `users.read`)
  - set `must_change_password=false`
  - revoke session trừ session hiện tại

## 6) Audit log rules
- Ghi các action nhạy cảm:
  - `auth.login.success/fail`
  - `auth.refresh.success/fail`
  - `auth.logout`
  - `auth.session.revoke.self/admin`
  - `users.create/update/role.assign`
  - `user.soft_delete`, `user.reset_password`, `user.change_password`
  - `rbac.role.create/update/delete/permissions.update`
- Không ghi password hoặc token gốc vào payload audit.

## 7) Token invalidation
- Access token có claim `tv` (token_version).
- Mỗi request bearer so sánh `tv` với `users.token_version` trong DB (cache in-proc TTL 30s).
- Nếu token cũ hơn => trả `401 UNAUTHORIZED`.
- Long-term roadmap: chuyển cache Redis để đồng bộ multi-worker.

## 8) RBAC system role rules
- `is_system=true` role không được sửa/xóa.
- Endpoint `rbac.manage` (create/update/delete/permissions) chỉ dành cho principal có permission `rbac.manage`.
- Principal chỉ có `rbac.read` được xem RBAC panel ở chế độ read-only trên frontend.
- Permission quy ước:
  - `*.read`: truy cập/xem module.
  - `*.manage`: thao tác quản trị/CRUD theo module.
- API RBAC phải trả:
  - `ROLE_SYSTEM_PROTECTED` khi cố sửa/xóa system role.
  - `ROLE_IN_USE` khi xóa role đang được gán user.
