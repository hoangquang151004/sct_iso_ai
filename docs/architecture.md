# Architecture - SCT-ISO.AI

Ngày cập nhật: 2026-04-20.

## 1) Tổng quan hiện tại
Monorepo gồm:
- Backend: FastAPI + SQLAlchemy + Alembic + PostgreSQL.
- Frontend: Next.js App Router + AuthProvider + middleware route guard.

Luồng chính:
```text
Browser
  -> Next.js middleware (route guard)
  -> Frontend app (AuthProvider + api-client)
  -> FastAPI routers (auth/users/rbac/audit)
  -> Service layer
  -> PostgreSQL
```

## 2) Các thành phần bảo mật mới
- JWT access token chứa claim `tv` (token_version) và `mcp` (must_change_password).
- Refresh token lưu DB (`refresh_tokens`) + cookie `httpOnly`.
- Rate limit (`slowapi`) cho login/refresh.
- Token-version validation với cache in-proc 30s.
- Audit log module ghi các action auth/users/rbac.

## 3) Session store theo thiết bị
`refresh_tokens` lưu:
- `user_agent`
- `ip`
- `device_label`
- `last_used_at`

Từ đó hỗ trợ:
- self-service sessions (`/auth/sessions/*`)
- admin revoke-all (`/users/{id}/sessions/revoke-all`)

## 4) Frontend auth architecture
- `AuthProvider` quản lý principal + loading + sessionExpired modal.
- `api-client` tự refresh khi gặp 401 và phát event khi refresh thất bại.
- `RequirePermissions` guard thành phần UI theo permissions.
- `middleware.ts` chặn route private từ edge layer.
- RBAC UI flow thống nhất qua `user-management` (query `?tab=rbac`); route `/rbac` chỉ giữ vai trò legacy redirect.
- RBAC panel dùng API `/rbac/roles` để render permission matrix và `member_count` active cho từng role.
- `AuthGate` + `auth-routes` áp dụng page-level permission guard (`*.read`) cho toàn bộ module chính.
- `AppShell` lọc menu theo cùng tập permission để đồng bộ giữa khả năng truy cập route và khả năng nhìn thấy menu.

## 5) Thành phần còn đang hoàn thiện
- E2E multi-role đầy đủ (nhiều spec vẫn `test.skip`).
- Coverage gating >=80% trong CI.
- Cache phân tán cho token-version (roadmap Redis).
