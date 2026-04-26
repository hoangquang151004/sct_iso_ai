# Tech Stack - SCT-ISO.AI

Tài liệu này mô tả công nghệ theo 2 lớp:

- Thành phần đã xác nhận trong mã nguồn hiện tại.
- Thành phần dự kiến bổ sung theo roadmap.

Ngày cập nhật: 2026-04-22.

---

## 1. Thành phần đã xác nhận

### 1.1 Backend

- Ngôn ngữ: Python.
- Framework API: FastAPI.
- ORM: SQLAlchemy.
- Schema và kiểm tra dữ liệu: Pydantic.
- Cấu trúc: module theo miền trong thư mục backend/modules.

Ghi chú phiên bản:

- Repository hiện chưa có tệp khóa phiên bản backend như requirements hoặc pyproject.
- Vì vậy chưa thể chốt chính xác phiên bản từng gói Python.

### 1.2 Database

- Cơ sở dữ liệu quan hệ chính: PostgreSQL.
- Schema đang dùng: sct_iso.
- Kiểu dữ liệu nổi bật trong model: UUID, JSONB, ARRAY, INET, TIMESTAMPTZ.

### 1.3 Frontend

- Framework: Next.js 16.2.3.
- Thư viện UI: React 19.2.4.
- Ngôn ngữ giao diện: TypeScript 5.x.
- CSS framework: Tailwind CSS 4.
- Biểu đồ: Chart.js 4.5.1 và react-chartjs-2 5.3.1.
- Lint: ESLint 9 cùng eslint-config-next 16.2.3.

Cấu trúc mã nguồn UI (App Router, `frontend/src/`): `app/`, `api/`, `components/{layout,shared,ui}`, `services/` (compatibility), `types/`, `hooks/`, `lib/`, `middleware.ts` — mô tả chi tiết trong [docs/architecture.md](docs/architecture.md) và [docs/coding-conventions.md](docs/coding-conventions.md).

---

## 2. Thành phần chưa thấy trong mã hiện tại

Các thành phần sau được nhắc trong bối cảnh sản phẩm nhưng chưa thấy triển khai trong repository hiện tại:

- Cơ chế xác thực JWT hoàn chỉnh.
- IoT ingestion qua MQTT.
- Lớp AI hoặc RAG tích hợp runtime.
- Hàng đợi tác vụ nền và lập lịch xử lý.

Các mục này nên được ghi ở trạng thái Dự kiến trong tài liệu liên quan.

---

## 3. Định hướng chuẩn hóa stack

1. Bổ sung tệp quản lý phụ thuộc backend để khóa phiên bản.
2. Chốt phiên bản Python mục tiêu cho môi trường phát triển và triển khai.
3. Tách rõ nhóm phụ thuộc chạy thực tế và phụ thuộc phát triển.
4. Cập nhật tài liệu ngay khi thêm thư viện cốt lõi mới.

---

## 4. Ma trận tham chiếu tài liệu

- API và trạng thái endpoint: [docs/api-contracts.md](docs/api-contracts.md)
- Danh mục mã lỗi API: [docs/api-error-codes.md](docs/api-error-codes.md)
- Kiến trúc tổng thể: [docs/architecture.md](docs/architecture.md)
- Luồng nghiệp vụ người dùng: [docs/user-flows.md](docs/user-flows.md)
- Tầng AI và RAG: [docs/ai-layer.md](docs/ai-layer.md)
- Chiến lược kiểm thử: [docs/testing-strategy.md](docs/testing-strategy.md)
- Quyết định kiến trúc (ADR): [docs/decisions.md](docs/decisions.md)
- Vấn đề đã biết: [docs/known-issues.md](docs/known-issues.md)
- Lược đồ dữ liệu: [docs/database-schema.md](docs/database-schema.md)
- Cấu hình môi trường: [docs/env-and-config.md](docs/env-and-config.md)
- Quy ước mã nguồn: [docs/coding-conventions.md](docs/coding-conventions.md)
- Quy tắc bảo mật: [docs/security-rules.md](docs/security-rules.md)
- Checklist review docs: [docs/docs-review-checklist.md](docs/docs-review-checklist.md)
