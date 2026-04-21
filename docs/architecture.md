# Architecture - SCT-ISO.AI

Ngày cập nhật: 2026-04-21.

## 1) Tổng quan hiện tại
Monorepo gồm:
- Backend: FastAPI + SQLAlchemy + Alembic + PostgreSQL.
- Frontend: Next.js App Router + AuthProvider + AuthGate (client) + middleware edge tối thiểu.

Luồng chính:
```text
Browser
  -> Next.js middleware (edge: ví dụ redirect / -> /login)
  -> Frontend app (AuthProvider + AuthGate + api-client)
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
- **Middleware edge:** `frontend/src/middleware.ts` (Next.js khuyến nghị đặt trong `src/` khi project dùng thư mục `src/`). Hiện tại chỉ xử lý tối thiểu (ví dụ redirect `/` → `/login`). Cookie refresh gắn API (`path=/auth`) **không** dùng để xác thực tại edge; bắt buộc đăng nhập và kiểm tra route do tầng client.
- **`AuthProvider`** (`frontend/src/lib/auth-context.tsx`): principal, loading, modal `sessionExpired`.
- **`api-client`** (`frontend/src/lib/api-client.ts`): tự refresh khi 401; phát event khi refresh thất bại.
- **`AuthGate`** (`frontend/src/components/shared/auth-gate.tsx`) + **`auth-routes`**: sau khi bootstrap, redirect `/login?next=…` nếu chưa có principal; kiểm tra `*.read` theo route cho các module chính.
- **`RequirePermissions`** (`frontend/src/components/shared/require-permissions.tsx`): guard thành phần UI theo permissions.
- **`AppShell`** (`frontend/src/components/layout/app-shell.tsx`): lọc menu theo cùng tập permission để đồng bộ với khả năng truy cập route.
- **Tầng mã nguồn UI (chuẩn hóa):**
  - `frontend/src/app/`: App Router (`page.tsx`, `layout.tsx`, …).
  - `frontend/src/components/layout/`, `…/shared/`, `…/ui/`: component theo lớp (layout / dùng chung / base).
  - `frontend/src/services/`: hàm gọi API theo domain (auth, users, rbac, sessions).
  - `frontend/src/types/`: kiểu TypeScript dùng chung (API contracts phía FE).
  - `frontend/src/hooks/`: custom hooks tái sử dụng (ví dụ auth).
  - `frontend/src/lib/`: tiện ích nền (`api-client`, `auth-context`, `auth-routes`, `mock-data`, …).
  - Import ưu tiên alias `@/…` theo `frontend/tsconfig.json`.
- RBAC UI flow thống nhất qua `user-management` (query `?tab=rbac`); route `/rbac` chỉ giữ vai trò legacy redirect.
- RBAC panel dùng API `/rbac/roles` để render permission matrix và `member_count` active cho từng role.

## 5) Thành phần còn đang hoàn thiện
- E2E multi-role đầy đủ (nhiều spec vẫn `test.skip`).
- Coverage gating >=80% trong CI.
- Cache phân tán cho token-version (roadmap Redis).
