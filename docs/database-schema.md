# Database Schema - SCT-ISO.AI

Ngày cập nhật: 2026-04-22.

## 1) Nguồn schema chuẩn
- Schema chính: `sct_iso` (single-schema).
- Nguồn model duy nhất: `backend/database/models.py`.
- Các module nghiệp vụ không định nghĩa model trùng cho auth/rbac/audit.

## 2) Chuỗi migration hiện tại
- `5e28a4a66bed_baseline_init`: baseline hiện tại trên `sct_iso`.

## 3) Nhóm bảng auth/users/rbac/audit
- **users**
  - `id` (uuid, pk), `org_id` (uuid, fk), `role_id` (uuid, nullable, fk -> `roles.id`)
  - `username` (unique), `email` (unique), `password_hash`
  - `is_active`, `token_version` (default 0), `disabled_at`, `must_change_password`
  - `last_login`, `created_at`, `updated_at`
- **roles**
  - `id` (uuid, pk), `org_id` (uuid, nullable), `name`, `description`, `is_system`, `created_at`
  - unique constraint: `uq_roles_org_name` trên `(org_id, name)`
- **permissions**
  - `id` (uuid, pk), `code` (unique), `description`, `created_at`
- **role_permissions**
  - `id` (uuid, pk), `role_id` (uuid, fk), `permission_id` (uuid, fk), `created_at`
  - unique constraint: `uq_role_permissions` trên `(role_id, permission_id)`
- **user_roles**
  - `id` (uuid, pk), `user_id` (uuid, fk), `role_id` (uuid, fk), `created_at`
  - unique constraint: `uq_user_roles` trên `(user_id, role_id)`
- **refresh_tokens**
  - `id` (uuid, pk), `user_id` (uuid, fk), `token_hash` (unique)
  - `user_agent`, `ip`, `device_label`, `last_used_at`
  - `expires_at`, `revoked_at`, `created_at`
- **audit_log**
  - `id` (uuid, pk), `org_id` (uuid, fk), `actor_user_id` (uuid, nullable, fk)
  - `action`, `target_type`, `target_id`, `request_id`, `ip`, `user_agent`
  - `payload` (json/jsonb), `created_at`
  - indexes:
    - `ix_audit_log_org_created_at` trên `(org_id, created_at)`
    - `ix_audit_log_actor_created_at` trên `(actor_user_id, created_at)`
    - `ix_audit_log_action_created_at` trên `(action, created_at)`

## 4) Quy ước dữ liệu cần giữ ổn định
- Dùng UUID native PostgreSQL cho các khóa chính/phụ của auth/rbac/audit.
- Audit chuẩn dùng `audit_log`; không dùng flow mới trên `user_activity_logs`.
- JSON payload audit dùng cột `payload`.

## 5) Vận hành và thay đổi schema
- Chỉ thay đổi schema qua Alembic migration.
- Không dùng `create_all()` thay migration trong môi trường shared/production.
- Quy trình khởi tạo DB rỗng:
  1. Cấu hình `DATABASE_URL` hợp lệ trong `backend/.env`.
  2. Chạy `alembic upgrade head` trong thư mục `backend/`.
  3. (Tuỳ chọn) chạy `python script/create_user.py` để seed organization + admin mặc định.
- Khi đổi model trong `backend/database/models.py`, bắt buộc tạo migration mới và cập nhật tài liệu này.
- Khuyến nghị dọn/partition `audit_log` theo chính sách retention khi dữ liệu tăng lớn.
