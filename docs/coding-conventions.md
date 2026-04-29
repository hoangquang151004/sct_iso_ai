# Coding Conventions - SCT-ISO.AI

Tài liệu này chia thành 2 lớp quy ước:

- Áp dụng ngay: phải tuân theo codebase hiện tại.
- Mục tiêu chuẩn hóa: áp dụng khi refactor hoặc mở rộng kiến trúc.

Ngày cập nhật: 2026-04-29.

---

## 1. Áp dụng ngay (theo code hiện tại)

### 1.1 Quy ước đặt tên backend

| Đối tượng            | Quy ước             | Ví dụ                             |
| -------------------- | ------------------- | --------------------------------- |
| File, thư mục Python | snake_case          | `get_database.py`                 |
| Class                | PascalCase          | `UserResponse`, `HaccpPlanCreate` |
| Hàm                  | snake_case          | `create_user`                     |
| Biến                 | snake_case          | `org_id`, `created_at`            |
| Bảng DB              | snake_case số nhiều | `documents`, `prp_audits`         |

Lưu ý quan trọng:

- Tên khóa tổ chức đang dùng trong model là `org_id`.

### 1.2 Quy ước API backend

- Mỗi domain module đặt trong `backend/modules/<domain>/`.
- Mỗi module thường có `router.py`, `schemas.py`, `service.py`, và `__init__.py`.
- Module nào cần nhiều router thì đặt router phụ cùng thư mục domain, ví dụ `backend/modules/auth/sessions_router.py`.
- Router của domain được đăng ký tập trung qua `backend/modules/__init__.py`.
- SQLAlchemy model hiện tập trung trong `backend/database/models.py`; không tự tạo file model riêng trong domain nếu chưa cập nhật kiến trúc.
- Migration đặt trong `backend/alembic/versions/`.
- Cross-cutting backend helper đặt trong `backend/core/` hoặc dependency module hiện có, không đặt lẫn vào domain không liên quan.
- Endpoint hiện tại chủ yếu trả dữ liệu mô phỏng theo schema.
- Route handler hiện tại dùng `def` đồng bộ (chưa ép `async def`).
- Khi sửa module hiện có, theo pattern cục bộ của module đó trước; không refactor toàn repo sang pattern mới nếu task không yêu cầu.

Mẫu module backend hiện tại:

```text
backend/modules/<domain>/
  __init__.py
  router.py
  schemas.py
  service.py
```

Ví dụ trách nhiệm:

- `router.py`: khai báo `APIRouter`, dependency auth/RBAC/DB, HTTP status, mapping request/response.
- `schemas.py`: Pydantic request/response schema cho API contract.
- `service.py`: nghiệp vụ, truy vấn DB, audit helper hoặc thao tác domain không nên nhét trực tiếp vào router.
- `__init__.py`: export router hoặc đối tượng cần đăng ký ở `backend/modules/__init__.py`.

### 1.3 Quy ước frontend hiện tại

- Dùng TypeScript cho toàn bộ trang trong `frontend/src`.
- Thành phần trang đặt theo App Router (`frontend/src/app/`, `page.tsx`, `layout.tsx`).
- Middleware Next.js: `frontend/src/middleware.ts` (cùng cấp `app/` trong `src/`).
- Route màn hình chính đặt tại `frontend/src/app/<route>/page.tsx`.
- Nhiều route hiện vẫn là `page.tsx` lớn; khi tách mới, component chỉ dùng cho một route nên đặt cạnh route trong `frontend/src/app/<route>/_components/`.
- Component theo lớp:
  - `frontend/src/components/layout/` — khung trang (ví dụ `app-shell`).
  - `frontend/src/components/shared/` — block dùng chung nhiều màn (ví dụ `auth-gate`, `require-permissions`, biểu đồ).
  - `frontend/src/components/ui/` — component hiển thị thuần / base (mở rộng dần).
- `frontend/src/components/` hiện còn một số component theo tính năng ở root (ví dụ modal tài liệu, `haccp-wizard`); không thêm component route-only mới vào root nếu chỉ phục vụ một màn.
- API client chính: `frontend/src/api/api-client.ts` (`apiRequest`, `apiFetch`, `ApiClientError`).
- Typed API module, error map và API-specific hook đặt trong `frontend/src/api/` (ví dụ `documents-api.ts`, `reports-api.ts`, `users-error-map.ts`, `api/hooks/use-haccp.ts`).
- Domain services đặt trong `frontend/src/services/` và thường gọi `@/api/api-client` (ví dụ auth, users, rbac, sessions, prp, capa, haccp).
- Kiểu dùng chung theo domain: `frontend/src/types/`.
- Kiểu dùng chung rộng đã tồn tại: `frontend/src/lib/types.ts`; chỉ mở rộng file này khi phù hợp với pattern hiện tại.
- Custom hooks app-wide: `frontend/src/hooks/`.
- API-specific hooks: `frontend/src/api/hooks/`.
- Tiện ích nền/context/config/helper/mock/export đặt trong `frontend/src/lib/` (ví dụ `auth-context.tsx`, `auth-routes.ts`, `mock-data.ts`, `reports-export.ts`, `haccp-critical-limit.ts`, `types.ts`).
- Barrel exports: `frontend/src/components/index.ts`, `frontend/src/services/index.ts`, `frontend/src/hooks/index.ts`, `frontend/src/types/index.ts` (import có thể dùng `@/services`, `@/hooks`, `@/types`, `@/components/...`).
- Không phải mọi service đều đã được barrel-export; kiểm tra `index.ts` trước khi import từ `@/services` (một số service hiện import trực tiếp như `@/services/capa-service`).
- Một phần màn hình demo vẫn đọc mock từ `frontend/src/lib/mock-data.ts`; luồng auth/users/RBAC đã gọi API thật qua `services/`.

Mẫu route frontend khi cần tách màn hình:

```text
frontend/src/app/<route>/
  page.tsx
  _components/
    domain-panel.tsx
    domain-form.tsx
```

Chọn nơi đặt frontend code:

- Màn hình có URL: `frontend/src/app/<route>/page.tsx`.
- Component chỉ dùng trong màn hình đó: `frontend/src/app/<route>/_components/` khi tách mới từ `page.tsx`.
- Component dùng lại nhiều màn: `frontend/src/components/shared/` hoặc `frontend/src/components/ui/` tùy mức độ trừu tượng.
- Layout/shell/navigation: `frontend/src/components/layout/`.
- API client chung, typed API module, error map, API-specific hook: `frontend/src/api/`.
- Domain service gọi backend qua API client: `frontend/src/services/`.
- Hook dùng nhiều nơi: `frontend/src/hooks/`.
- Hook gắn chặt với API client: `frontend/src/api/hooks/`.
- Type dùng chung: `frontend/src/types/`; type nền hoặc lịch sử đang dùng rộng: `frontend/src/lib/types.ts`.
- Utility/context/config/helper/mock/export: `frontend/src/lib/`.

### 1.4 Quy ước kiểu dữ liệu

- UUID dùng kiểu `string` ở JSON phía frontend.
- Thời gian trả về theo kiểu datetime string của FastAPI/Pydantic.
- Không dùng `any` nếu có thể mô tả kiểu rõ ràng.

### 1.5 Quy ước dependency injection và import

#### FastAPI database session

Luôn inject database session theo pattern `Depends(...)`. Không tạo session trực tiếp trong router.

Repo hiện có nhiều helper DB đang cùng tồn tại (`backend/db_session.py`, `backend/database/deps.py`, `db_manager.get_db`). Khi sửa module hiện có, dùng helper mà module đó đang dùng, trừ khi task yêu cầu chuẩn hóa DB session toàn repo.

```python
# ✅ Đúng
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db_session import get_db

router = APIRouter()

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    ...
```

```python
# ❌ Sai — tạo session trực tiếp trong handler
@router.get("/users")
def list_users():
    db = SessionLocal()
    ...
```

#### Quy ước import giữa các module domain

- Không import trực tiếp từ module domain khác trong `router.py`.
- Nếu cần dùng model hoặc schema từ module khác, import từ `database.models` (shared models) hoặc tạo schema dùng chung.
- Không import vòng tròn: module A không được import từ module B nếu B đã import từ A.

```python
# ✅ Đúng — import từ shared models
from database.models import User, Document

# ❌ Sai — import chéo trực tiếp giữa module domain
from backend.modules.users.router import some_function
```

#### Entry point import path

- Mỗi service entry point phải khai báo `sys.path` rõ ràng nếu chạy trực tiếp bằng `python`.
- Ưu tiên chạy qua `uvicorn backend.main:app` từ thư mục root để tránh path ambiguity.

---

## 2. Mục tiêu chuẩn hóa (roadmap kỹ thuật)

### 2.1 Backend

1. Chuyển dần route handler sang `async def` khi có DB/session bất đồng bộ.
2. Tách service layer riêng khi nghiệp vụ tăng độ phức tạp.
3. Chuẩn hóa error envelope cho toàn bộ API.
4. Chuẩn hóa pagination cho endpoint list.

Mẫu error envelope mục tiêu:

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

Danh mục mã lỗi chuẩn tham chiếu tại:

- [docs/api-error-codes.md](docs/api-error-codes.md)

### 2.2 Frontend

1. ~~Tạo API client dùng chung~~ **Đã có:** `frontend/src/lib/api-client.ts` + `frontend/src/services/*`.
2. ~~Tách kiểu dữ liệu dùng chung vào thư mục `types`~~ **Đã có:** `frontend/src/types/` (barrel `index.ts`).
3. ~~Chuẩn hóa custom hooks~~ **Đang áp dụng:** `frontend/src/hooks/` (mở rộng dần theo domain).
4. **Tiếp theo:** giảm dần phụ thuộc `mock-data` trên các màn production; E2E/Storybook (nếu có) có thể giữ mock riêng.

### 2.3 Dữ liệu

1. Thống nhất naming giữa DB model và API schema.
2. Bổ sung migration và quy tắc thay đổi schema có kiểm soát.

---

## 3. Quy tắc chung

### 3.1 Comment và docstring

- Chỉ viết comment cho logic khó hoặc ràng buộc nghiệp vụ.
- Không viết comment mô tả điều hiển nhiên.

### 3.2 Commit message

Sử dụng Conventional Commits:

- `feat:` thêm tính năng.
- `fix:` sửa lỗi.
- `refactor:` cải tổ mã nguồn.
- `docs:` cập nhật tài liệu.
- `test:` thêm hoặc sửa kiểm thử.
- `chore:` việc kỹ thuật phụ trợ.

### 3.3 Bảo mật và cấu hình

- Không hardcode secret, key, URL môi trường trong code.
- Không lưu mật khẩu dạng rõ.
- Không ghi log dữ liệu nhạy cảm.

---

## 4. Những điều không nên làm

| Không nên làm                                       | Nên làm                                    |
| --------------------------------------------------- | ------------------------------------------ |
| Trộn business logic phức tạp trực tiếp trong router | Tách dần sang service layer                |
| Đổi tên field tùy ý giữa các tầng                   | Dùng một mapping thống nhất                |
| Mở rộng endpoint nhưng không cập nhật docs          | Cập nhật đồng thời API docs và schema docs |
| Dùng mock data cho production flow                  | Thay bằng API thật có schema rõ ràng       |
