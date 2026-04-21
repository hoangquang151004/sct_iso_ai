# Testing Strategy - SCT-ISO.AI

Ngày cập nhật: 2026-04-21.

## 1) 3 tầng test
1. Backend integration: `pytest` (`backend/tests`), DB PostgreSQL thật.
2. Frontend unit: `vitest` + RTL.
3. Frontend e2e: `playwright` (`frontend/e2e`).

**Ghi chú cấu trúc FE (2026-04):** unit test thường `vi.mock` theo module alias `@/services`, `@/hooks` (không còn shim `lib/*-api.ts`). Test gần implementation: ví dụ `frontend/src/services/*.test.ts` cho service layer.

## 2) Trạng thái hiện tại
- Backend: đã có test auth/users/rbac/session/audit mức integration; local có thể skip nếu chưa cấu hình `TEST_DATABASE_URL`.
- Frontend: unit tests cho auth context, login page, user management, rbac page, sessions page.
- Frontend: bổ sung test route/query flow cho RBAC panel (`/user-management?tab=rbac`) và test block hành động khi thiếu permission (`users.assign_role`, `users.update`, `users.manage_sessions`).
- Backend: có regression test cho `/users/rbac/roles` static route, guard `users.read`, và flow `POST /users/me/change-password` chỉ cần bearer hợp lệ.
- Backend: mở rộng matrix cho `rbac.manage` lifecycle (`POST/PATCH/DELETE/PUT /rbac/roles*`) và test `member_count` trong response `/rbac/roles`.
- Frontend: có test read-only RBAC panel (thiếu `rbac.manage`) và hiển thị `member_count` thật.
- Frontend: có test guard route theo page permission (`dashboard.read`, `documents.read`, `haccp.read`, `prp.read`, `capa.read`, `analytics.read`, `reports.read`) và nav filtering theo permission.
- Backend: có test seed permission set theo role để đảm bảo principal nhận đủ page permissions expected.
- E2E: có `login_redirect.spec.ts` chạy thật; nhiều spec đa role đang scaffold `test.skip`.

## 3) Role x endpoint matrix (backend integration)
Ma trận tối thiểu cần duy trì:
- `admin`: allow toàn bộ users/rbac/audit/session admin endpoints.
- `iso_manager`: deny các endpoint `rbac.manage`, `users.manage_sessions`, `users.reset_password`, `users.delete` (trừ các quyền được cấp riêng).
- `auditor`: chỉ read (`users.read`, `rbac.read`, `audit.read`).
- `regular_user`: deny management endpoints.

## 4) Pattern fixture bắt buộc
- Session-scoped engine + migrate Alembic một lần.
- Function-scoped transaction rollback để cô lập test.
- Override `get_db` dependency cho FastAPI TestClient.
- Fixture người dùng theo role để tái sử dụng.

## 5) CI
- Backend workflow có PostgreSQL service + migrate + pytest.
- Frontend workflow có Vitest + Playwright; backend service được dựng trước E2E.

## 6) Mục tiêu coverage
- Mục tiêu module users/auth/rbac/audit: >= 80%.
- Trạng thái hiện tại: chưa đạt full do E2E đa role còn đang hoàn thiện.

## 7) Ưu tiên tiếp theo
1. Bỏ `skip` cho ít nhất 2 kịch bản E2E chính (`admin_user_management`, `iso_manager`).
2. Bổ sung báo cáo coverage backend/frontend trong CI.
3. Chuẩn hóa test data seed cho E2E đa role.
