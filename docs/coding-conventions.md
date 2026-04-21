# Coding Conventions - SCT-ISO.AI

Tài liệu này chia thành 2 lớp quy ước:

- Áp dụng ngay: phải tuân theo codebase hiện tại.
- Mục tiêu chuẩn hóa: áp dụng khi refactor hoặc mở rộng kiến trúc.

Ngày cập nhật: 2026-04-21.

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

- Mỗi module có `router.py` và `schemas.py`.
- Endpoint hiện tại chủ yếu trả dữ liệu mô phỏng theo schema.
- Route handler hiện tại dùng `def` đồng bộ (chưa ép `async def`).

### 1.3 Quy ước frontend hiện tại

- Dùng TypeScript cho toàn bộ trang trong `frontend/src`.
- Thành phần trang đặt theo App Router (`frontend/src/app/`, `page.tsx`, `layout.tsx`).
- Middleware Next.js: `frontend/src/middleware.ts` (cùng cấp `app/` trong `src/`).
- Component theo lớp:
  - `frontend/src/components/layout/` — khung trang (ví dụ `app-shell`).
  - `frontend/src/components/shared/` — block dùng chung nhiều màn (ví dụ `auth-gate`, `require-permissions`, biểu đồ).
  - `frontend/src/components/ui/` — component hiển thị thuần / base (mở rộng dần).
- Gọi HTTP tới FastAPI: `frontend/src/services/` (theo domain: auth, users, rbac, sessions).
- Kiểu dùng chung: `frontend/src/types/`.
- Custom hooks: `frontend/src/hooks/`.
- Tiện ích nền (API client, auth context, route config, mock): `frontend/src/lib/` (ví dụ `api-client.ts`, `auth-context.tsx`, `auth-routes.ts`, `mock-data.ts`).
- Barrel exports: `frontend/src/components/index.ts`, `frontend/src/services/index.ts`, `frontend/src/hooks/index.ts`, `frontend/src/types/index.ts` (import có thể dùng `@/services`, `@/hooks`, `@/types`, `@/components/...`).
- Một phần màn hình demo vẫn đọc mock từ `frontend/src/lib/mock-data.ts`; luồng auth/users/RBAC đã gọi API thật qua `services/`.

### 1.4 Quy ước kiểu dữ liệu

- UUID dùng kiểu `string` ở JSON phía frontend.
- Thời gian trả về theo kiểu datetime string của FastAPI/Pydantic.
- Không dùng `any` nếu có thể mô tả kiểu rõ ràng.

### 1.5 Quy ước dependency injection và import

#### FastAPI database session

Luôn inject database session theo pattern `Depends(get_db)`. Không tạo session trực tiếp trong router.

```python
# ✅ Đúng
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database.get_database import get_db

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
- Nếu cần dùng model hoặc schema từ module khác, import từ `backend.database.models` (shared models) hoặc tạo schema dùng chung.
- Không import vòng tròn: module A không được import từ module B nếu B đã import từ A.

```python
# ✅ Đúng — import từ shared models
from backend.database.models import User, Document

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
