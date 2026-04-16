# Architecture - SCT-ISO.AI

Tài liệu này mô tả kiến trúc theo hai lớp thông tin:

- Trạng thái hiện tại: đúng với code đang có trong repository.
- Định hướng roadmap: mục tiêu kỹ thuật cho các giai đoạn tiếp theo.

Ngày cập nhật: 2026-04-16.

---

## 1. Tổng quan kiến trúc

### 1.1 Trạng thái hiện tại

Hệ thống hiện tại là monorepo gồm 2 phần chính:

- Backend: FastAPI, cấu trúc module theo domain.
- Frontend: Next.js App Router, dữ liệu hiển thị đang dùng mock data.

Luồng hiện tại:

```text
Frontend (Next.js)
    |
    | HTTP
    v
Backend (FastAPI)
    |
    v
PostgreSQL models (mức khai báo schema)
```

### 1.2 Định hướng roadmap

Roadmap kiến trúc mở rộng bao gồm:

- Lớp xác thực và phân quyền đầy đủ (JWT, RBAC).
- Lớp xử lý IoT, AI, cảnh báo thời gian thực.
- Chuẩn hóa API versioning theo namespace `/api/v1`.

---

## 2. Cấu trúc thư mục thực tế

```text
project-root/
├── backend/
│   ├── main.py
│   ├── database/
│   │   ├── get_database.py
│   │   └── models.py
│   └── modules/
│       ├── users/
│       ├── documents/
│       ├── haccp/
│       ├── prp/
│       ├── capa/
│       ├── reports/
│       └── scheduling/
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       └── lib/
└── docs/
    ├── architecture.md
    ├── api-contracts.md
    ├── api-error-codes.md
    ├── user-flows.md
    ├── ai-layer.md
    ├── testing-strategy.md
    ├── decisions.md
    ├── known-issues.md
    ├── docs-review-checklist.md
    ├── database-schema.md
    ├── coding-conventions.md
    ├── env-and-config.md
    ├── security-rules.md
    └── tech-stack.md
```

Lưu ý:

- Hiện chưa có thư mục auth, ai, iot trong backend/modules.
- Hiện chưa có migration tool được cấu hình trong repository.

---

## 3. Backend hiện tại

### 3.1 Entry point và router

- File khởi tạo app: `backend/main.py`.
- Các router đang được include trực tiếp, chưa gắn prefix `/api/v1`.

Các nhóm endpoint hiện có:

- `/users`
- `/documents`
- `/haccp`
- `/prp`
- `/capa`
- `/reports`
- `/scheduling`
- `/health`

### 3.2 Mẫu tổ chức module

Mỗi module hiện gồm:

- `router.py`: định nghĩa endpoint.
- `schemas.py`: định nghĩa request/response model.

Trạng thái hiện tại chưa có service layer riêng cho từng module.

### 3.3 Data layer

- Các SQLAlchemy model tập trung tại `backend/database/models.py`.
- File `backend/database/get_database.py` hiện đang để trống.

---

## 4. Frontend hiện tại

### 4.1 Routing

- Dùng Next.js App Router.
- Các trang module là các route trực tiếp như:
  - `/dashboard`
  - `/document-control`
  - `/haccp-compliance`
  - `/capa-management`
  - `/prp-audit`
  - `/ai-analytics`
  - `/reports`
  - `/user-management`

### 4.2 Dữ liệu và tích hợp API

- Hiện đang dùng mock data từ `frontend/src/lib/mock-data.ts`.
- Chưa có lớp API client chung kiểu `lib/api.ts` để gọi backend thật.

---

## 5. Mẫu giao tiếp giữa các lớp

### 5.1 Trạng thái hiện tại

- Pattern chính: REST nội bộ giữa frontend và backend.
- Chưa có event-driven integration trong code backend hiện tại.

### 5.2 Định hướng roadmap

- Bổ sung WebSocket hoặc kênh realtime cho cảnh báo.
- Bổ sung background jobs cho tác vụ dài hạn.
- Bổ sung tích hợp IoT gateway và AI pipeline.

---

## 6. Ràng buộc kiến trúc đề xuất

Các ràng buộc dưới đây là mục tiêu chuẩn hóa để dùng khi mở rộng codebase:

1. Chuẩn hóa prefix API theo version (`/api/v1`).
2. Chuẩn hóa response list theo pagination envelope.
3. Chuẩn hóa một định dạng error response duy nhất.
4. Tách business logic khỏi router khi module bắt đầu phức tạp.
5. Thống nhất một quy ước tên field xuyên suốt giữa DB model, API schema, frontend type.

---

## 7. Theo dõi chênh lệch triển khai

Danh sách mục lớn đã ghi tài liệu nhưng chưa có implementation tương ứng:

- Auth flow (login/refresh/logout/me).
- RBAC dependency và middleware bảo mật.
- IoT ingestion, MQTT, thiết bị realtime.
- AI layer (RAG, phân tích bất thường, gợi ý).
- Notification workflow đầy đủ.

Khi triển khai từng mục, cần cập nhật đồng thời:

- [docs/api-contracts.md](docs/api-contracts.md)
- [docs/api-error-codes.md](docs/api-error-codes.md)
- [docs/user-flows.md](docs/user-flows.md)
- [docs/ai-layer.md](docs/ai-layer.md)
- [docs/testing-strategy.md](docs/testing-strategy.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/known-issues.md](docs/known-issues.md)
- [docs/database-schema.md](docs/database-schema.md)
- [docs/docs-review-checklist.md](docs/docs-review-checklist.md)
- [docs/env-and-config.md](docs/env-and-config.md)
- [docs/security-rules.md](docs/security-rules.md)
