# Database Schema - SCT-ISO.AI

Ngày cập nhật: 2026-04-20.

## 1) Migration baseline và các revision chính
- `0001_rbac_baseline`: baseline duy nhất cho module users/auth/rbac/audit trên schema `sct_iso`, đã bao gồm các cột hardening/session/users polish và bảng `audit_log`.

Schema chuẩn hiện tại cho module users/auth/rbac/audit: `sct_iso` (single-schema).

## 2) Bảng users (đáng chú ý)
- `id` (uuid, pk)
- `org_id` (uuid, fk)
- `username` (unique)
- `email` (unique)
- `password_hash`
- `is_active`
- `token_version` (int, default 0, not null)
- `disabled_at` (timestamptz, nullable)
- `must_change_password` (bool, default false)
- `last_login`
- `created_at`, `updated_at`

## 3) Bảng refresh_tokens (session store)
- `id` (uuid, pk)
- `user_id` (uuid, fk)
- `token_hash` (unique)
- `expires_at`, `revoked_at`
- `user_agent` (nullable)
- `ip` (nullable)
- `device_label` (nullable)
- `last_used_at` (nullable)
- `created_at`

## 4) Bảng audit_log
- `id` (string 36, pk)
- `org_id` (string 36)
- `actor_user_id` (string 36, nullable)
- `action` (string 128)
- `target_type` (string 128, nullable)
- `target_id` (string 64, nullable)
- `metadata` (json/jsonb nullable)
- `created_at` (timestamptz)

Indexes chính:
- `ix_audit_log_org_created_at` trên `(org_id, created_at)`
- `ix_audit_log_actor_created_at` trên `(actor_user_id, created_at)`
- `ix_audit_log_action_created_at` trên `(action, created_at)`

## 5) Lưu ý vận hành
- Chỉ dùng Alembic để đổi schema trong môi trường chia sẻ.
- Không dùng `create_all()` thay cho migration ở production.
- Khuyến nghị định kỳ dọn/partition `audit_log` khi dữ liệu tăng lớn.
