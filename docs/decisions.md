# Decisions - SCT-ISO.AI

Tài liệu này lưu các quyết định kiến trúc kỹ thuật (ADR) để tránh thảo luận lặp lại và giúp agent coding không đi ngược các quyết định đã chốt.

Ngày cập nhật: 2026-04-22.

---

## 1. Mục tiêu và phạm vi

- Ghi lại quyết định kỹ thuật cấp kiến trúc hoặc liên module.
- Nêu rõ vì sao chọn phương án hiện tại.
- Chỉ lưu quyết định quan trọng, không lưu chi tiết implementation nhỏ.

Trạng thái hiện tại:

- Đã có một số quyết định ngầm trong codebase.
- Chưa có nhật ký ADR chuẩn trong repository trước tài liệu này.

---

## 2. Trạng thái quyết định

- `Accepted`: đã chốt và áp dụng.
- `Pending`: đang đánh giá, chưa chốt.
- `Superseded`: đã bị thay thế bởi quyết định mới.

---

## 3. Mẫu ADR chuẩn

```md
## ADR-XXX: Tiêu đề quyết định

- Trạng thái: Accepted | Pending | Superseded
- Ngày: YYYY-MM-DD
- Bối cảnh:
- Các phương án đã cân nhắc:
- Quyết định:
- Lý do chọn:
- Hệ quả và đánh đổi:
- Tài liệu liên quan:
```

---

## 4. Quyết định đã chốt

## ADR-001: Chọn FastAPI cho backend

- Trạng thái: Accepted
- Ngày: 2026-04-16
- Bối cảnh: Cần API nhanh, có schema validation rõ, phù hợp module hóa.
- Các phương án đã cân nhắc: Flask, Django, FastAPI.
- Quyết định: Dùng FastAPI.
- Lý do chọn: Tích hợp tốt với Pydantic, có OpenAPI mặc định, dễ mở rộng theo module.
- Hệ quả và đánh đổi: Cần kỷ luật cấu trúc khi số module tăng.
- Tài liệu liên quan: [docs/architecture.md](docs/architecture.md), [docs/tech-stack.md](docs/tech-stack.md)

## ADR-002: Chọn Next.js App Router cho frontend

- Trạng thái: Accepted
- Ngày: 2026-04-16
- Bối cảnh: Cần kiến trúc route rõ theo module, hỗ trợ phát triển UI nhanh.
- Các phương án đã cân nhắc: React Router thuần, Next.js Pages Router, Next.js App Router.
- Quyết định: Dùng Next.js App Router.
- Lý do chọn: File-based routing, TypeScript tốt, mở rộng thuận lợi.
- Hệ quả và đánh đổi: Cần quản lý ranh giới giữa dữ liệu mock và dữ liệu thật.
- Cấu trúc mã nguồn FE (cập nhật): Toàn bộ UI dưới `frontend/src/` — `app/`, `api/`, `components/{layout,shared,ui}`, `services/` (compatibility tạm thời), `types/`, `hooks/`, `lib/` (tiện ích), `middleware.ts` cùng cấp `app/`. Chi tiết: [docs/architecture.md](docs/architecture.md), [docs/coding-conventions.md](docs/coding-conventions.md).
- Tài liệu liên quan: [docs/architecture.md](docs/architecture.md), [docs/tech-stack.md](docs/tech-stack.md)

## ADR-003: Chọn PostgreSQL làm CSDL quan hệ chính

- Trạng thái: Accepted
- Ngày: 2026-04-16
- Bối cảnh: Dữ liệu nghiệp vụ cần quan hệ rõ và nhất quán.
- Các phương án đã cân nhắc: PostgreSQL, MySQL, NoSQL thuần.
- Quyết định: Dùng PostgreSQL.
- Lý do chọn: Hỗ trợ JSONB, UUID, kiểu dữ liệu phong phú.
- Hệ quả và đánh đổi: Cần chiến lược migration và index sớm khi dữ liệu tăng.
- Tài liệu liên quan: [docs/database-schema.md](docs/database-schema.md)

## ADR-004: Dùng SQLAlchemy ORM thay cho raw SQL mặc định

- Trạng thái: Accepted
- Ngày: 2026-04-16
- Bối cảnh: Cần giảm lỗi injection và chuẩn hóa truy cập dữ liệu.
- Các phương án đã cân nhắc: Raw SQL, SQLAlchemy ORM, ORM khác.
- Quyết định: Dùng SQLAlchemy ORM làm mặc định.
- Lý do chọn: Đồng bộ với FastAPI/Pydantic, dễ bảo trì model.
- Hệ quả và đánh đổi: Cần review query để tránh N+1 khi mở rộng.
- Tài liệu liên quan: [docs/database-schema.md](docs/database-schema.md), [docs/security-rules.md](docs/security-rules.md)

## ADR-005: Cấu trúc backend module theo domain

- Trạng thái: Accepted
- Ngày: 2026-04-16
- Bối cảnh: Hệ thống có nhiều module nghiệp vụ độc lập.
- Các phương án đã cân nhắc: Layer theo technical, module theo domain.
- Quyết định: Tổ chức theo `backend/modules/{domain}`.
- Lý do chọn: Dễ phân tách trách nhiệm và mở rộng song song.
- Hệ quả và đánh đổi: Cần quy ước liên kết chéo giữa module chặt chẽ.
- Tài liệu liên quan: [docs/architecture.md](docs/architecture.md), [docs/coding-conventions.md](docs/coding-conventions.md)

## ADR-006: Chuẩn hóa error envelope cho API

- Trạng thái: Accepted
- Ngày: 2026-04-16
- Bối cảnh: Cần frontend xử lý lỗi ổn định theo error_code.
- Các phương án đã cân nhắc: Message tự do, envelope có cấu trúc.
- Quyết định: Dùng envelope có `message`, `error_code`, `request_id`, `fields`.
- Lý do chọn: Dễ truy vết và tách logic hiển thị với logic xử lý lỗi.
- Hệ quả và đánh đổi: Cần cập nhật đồng bộ ở toàn bộ endpoint khi triển khai thật.
- Tài liệu liên quan: [docs/api-contracts.md](docs/api-contracts.md), [docs/api-error-codes.md](docs/api-error-codes.md), [docs/security-rules.md](docs/security-rules.md)

## ADR-007: Dùng mock data cho giai đoạn UI hiện tại

- Trạng thái: Accepted
- Ngày: 2026-04-16
- Bối cảnh: Frontend cần phát triển nhanh trước khi backend hoàn thiện.
- Các phương án đã cân nhắc: Đợi API thật, mock cục bộ.
- Quyết định: Dùng mock data tạm thời.
- Lý do chọn: Giảm phụ thuộc chéo giữa đội UI và backend.
- Hệ quả và đánh đổi: Có rủi ro lệch schema giữa mock và API thật.
- Tài liệu liên quan: [docs/known-issues.md](docs/known-issues.md), [docs/user-flows.md](docs/user-flows.md)

## ADR-008: Dùng docs làm nguồn điều phối cho agent coding

- Trạng thái: Accepted
- Ngày: 2026-04-16
- Bối cảnh: Agent cần ngữ cảnh thống nhất để giảm đoán mò.
- Các phương án đã cân nhắc: Chỉ dựa vào code, kết hợp code + docs chuẩn.
- Quyết định: Ưu tiên bộ docs chuẩn hóa làm nguồn tham chiếu.
- Lý do chọn: Tăng độ ổn định khi sinh code và giảm vòng hỏi đáp.
- Hệ quả và đánh đổi: Cần duy trì docs đồng bộ liên tục với code.
- Tài liệu liên quan: [docs/docs-review-checklist.md](docs/docs-review-checklist.md)

---

## 5. Quyết định chờ chốt

## ADR-P001: Chọn kiến trúc realtime

- Trạng thái: Pending
- Ngày: 2026-04-16
- Bối cảnh: Cần cập nhật cảnh báo và dashboard thời gian thực.
- Phương án: WebSocket, SSE, polling.
- Cần dữ liệu quyết định: Tải người dùng đồng thời, tần suất dữ liệu IoT.
- Tài liệu liên quan: [docs/ai-layer.md](docs/ai-layer.md), [docs/user-flows.md](docs/user-flows.md)

## ADR-P002: Chọn stack hàng đợi tác vụ nền

- Trạng thái: Pending
- Ngày: 2026-04-16
- Bối cảnh: Cần xử lý tác vụ dài như báo cáo, AI batch.
- Phương án: Celery + Redis, RQ, giải pháp khác.
- Cần dữ liệu quyết định: Khối lượng job, độ trễ chấp nhận được.
- Tài liệu liên quan: [docs/testing-strategy.md](docs/testing-strategy.md), [docs/architecture.md](docs/architecture.md)

## ADR-P003: Chốt công nghệ AI runtime

- Trạng thái: Pending
- Ngày: 2026-04-16
- Bối cảnh: Cần cân bằng chi phí, độ chính xác, độ trễ.
- Phương án: API model thương mại, mô hình nội bộ, hybrid.
- Cần dữ liệu quyết định: Chi phí theo request, SLA phản hồi.
- Tài liệu liên quan: [docs/ai-layer.md](docs/ai-layer.md), [docs/env-and-config.md](docs/env-and-config.md)

---

## 6. Quy tắc cập nhật tài liệu quyết định

1. Mỗi quyết định mới phải có mã ADR duy nhất.
2. Không sửa lịch sử quyết định cũ; nếu thay đổi thì tạo ADR mới và đánh dấu `Superseded`.
3. Mọi ADR phải có ít nhất một tài liệu tham chiếu chéo.
4. Khi có ADR mới, cập nhật đồng thời:

- [docs/architecture.md](docs/architecture.md)
- [docs/tech-stack.md](docs/tech-stack.md)
- [docs/docs-review-checklist.md](docs/docs-review-checklist.md)

---

## 7. Phạm vi không bao gồm

- Không chứa hướng dẫn code chi tiết từng hàm.
- Không thay thế tài liệu API contracts hoặc database schema.
- Không ghi quyết định sản phẩm/kinh doanh ngoài phạm vi kỹ thuật.
