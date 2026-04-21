# User Flows - SCT-ISO.AI

Ngày cập nhật: 2026-04-21.

## 1) Login thật + redirect
1. User truy cập route protected (không thuộc danh sách public trong `auth-routes`).
2. Sau khi app bootstrap: nếu chưa có principal, **`AuthGate`** chuyển tới `/login?next=<path>` (client). Riêng truy cập `/`, **middleware** edge (`frontend/src/middleware.ts`) có thể redirect thẳng tới `/login` (không gửi `next` từ edge).
3. User login thành công qua `POST /auth/login`.
4. Frontend gọi `GET /auth/me`, set `principal`, rồi redirect về `next` (hoặc dashboard mặc định).
5. `AuthGate` kiểm tra `permissions` theo route (`*.read`), thiếu quyền thì redirect về `/dashboard`.
6. Nếu login fail: hiển thị message theo `error_code`.

## 2) Must-change-password flow
1. User login và `AuthPrincipal.must_change_password=true`.
2. FE điều hướng tới `/account/change-password`.
3. User đổi mật khẩu qua `POST /users/me/change-password`.
4. Thành công: reset flag `must_change_password`, chuyển về màn hình chính.

## 3) Session theo thiết bị (self-serve)
1. User mở `/account/sessions`.
2. FE gọi `GET /auth/sessions` để hiển thị device list.
3. User có thể:
   - revoke một session: `DELETE /auth/sessions/{id}`
   - revoke toàn bộ session khác: `POST /auth/sessions/revoke-all`
4. Session hiện tại giữ lại khi revoke-all-self.

## 4) Session theo thiết bị (admin)
1. Admin mở user detail trong `/user-management`.
2. Bấm "Revoke all sessions".
3. FE gọi `POST /users/{id}/sessions/revoke-all`.
4. Toàn bộ refresh token của user bị revoke, token_version tăng.

## 5) Reset password + disable user
### Reset password (admin)
1. Admin bấm reset password cho user.
2. API `POST /users/{id}/reset-password`.
3. Trả về `temporary_password`, set `must_change_password=true`, revoke sessions.

### Disable user (soft delete)
1. Admin bấm disable.
2. API `DELETE /users/{id}`.
3. User bị `is_active=false`, `disabled_at` set, sessions bị revoke.

## 6) Role/permission management
1. Admin vào `/user-management?tab=rbac`.
2. Legacy route `/rbac` redirect về `/user-management?tab=rbac`.
3. FE mở RBAC panel trong user-management và gọi API `/rbac/*` cho role/permission.
4. Danh sách role hiển thị `member_count` (số user active đang được gán role) từ API `/rbac/roles`.
5. User chỉ có `rbac.read` nhìn thấy panel ở chế độ read-only; thao tác quản trị yêu cầu `rbac.manage`.
6. Nếu role thay đổi ảnh hưởng user hiện hữu -> token_version của user liên quan được bump.

## 7) Session expiry modal
1. API client nhận `401`.
2. FE tự thử refresh.
3. Nếu refresh fail -> phát sự kiện `auth:session-expired`.
4. `AuthProvider` bật modal yêu cầu login lại.
