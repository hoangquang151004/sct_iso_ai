# Environment và Configuration - SCT-ISO.AI

Ngày cập nhật: 2026-04-20.

## 1) Nguồn cấu hình
- Backend dùng `pydantic-settings` tại `backend/core/config.py`.
- DB runtime dùng duy nhất `DATABASE_URL` (PostgreSQL).
- Alembic đọc DB URL từ cùng nguồn settings.

## 2) Biến môi trường backend

### Core
- `APP_ENV` (`dev|test|staging|prod`)
- `APP_NAME`
- `APP_DEBUG`
- `APP_HOST`
- `APP_PORT`

### Database
- `DATABASE_URL` (bắt buộc)
- `TEST_DATABASE_URL` (khuyến nghị cho CI/integration tests)

### JWT/Auth
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `ACCESS_TOKEN_TTL_MINUTES`
- `REFRESH_TOKEN_TTL_DAYS`
- `REFRESH_TOKEN_COOKIE_NAME`
- `REFRESH_COOKIE_SECURE`
- `REFRESH_COOKIE_SAMESITE`
- `LOGIN_RATE_LIMIT`
- `REFRESH_RATE_LIMIT`

### Bootstrap user/org
- `AUTH_BOOTSTRAP_ORG_ID`
- `AUTH_BOOTSTRAP_ADMIN_USERNAME`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `AUTH_BOOTSTRAP_ISO_MANAGER_USERNAME`
- `AUTH_BOOTSTRAP_ISO_MANAGER_PASSWORD`

### CORS/Logging
- `CORS_ALLOWED_ORIGINS`
- `FRONTEND_URL`
- `LOG_LEVEL`
- `LOG_FORMAT`
- `REQUEST_ID_HEADER`

## 3) Fail-fast rules
1. Thiếu `DATABASE_URL` => app không khởi động.
2. `APP_ENV in {staging, prod}` => bắt buộc `REFRESH_COOKIE_SECURE=true`.
3. `REFRESH_COOKIE_SAMESITE=none` => bắt buộc `REFRESH_COOKIE_SECURE=true`.
4. `APP_ENV != dev` => cấm secret mặc định và credential bootstrap mặc định.

## 4) Local dev (Docker Compose)
1. Tạo `.env` từ `.env.example`.
2. Chạy DB: `docker compose up -d postgres`.
3. Migrate: `cd backend && alembic upgrade head`.
4. Chạy API: `cd backend && uvicorn main:app --reload`.
5. Chạy FE: `cd frontend && npm run dev`.

## 5) CI notes
- Backend tests:
  - ưu tiên dùng `TEST_DATABASE_URL` trỏ PostgreSQL service.
  - chạy `alembic upgrade head` trước pytest.
- Frontend E2E:
  - cần backend + db đã migrate và seed dữ liệu role.
