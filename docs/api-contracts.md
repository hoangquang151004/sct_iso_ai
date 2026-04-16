# API Contracts - SCT-ISO.AI

Tài liệu này được tách rõ theo 2 mức:

- Đã triển khai: endpoint đã có trong code backend hiện tại.
- Dự kiến: endpoint theo roadmap, chưa có trong code.

Ngày cập nhật: 2026-04-16.

---

## 1. Trạng thái triển khai

### Base URL hiện tại

- Base path: rỗng.
- Ví dụ: `/users`, `/documents`, `/haccp/plans`.
- Chưa có prefix version `/api/v1` trong code hiện tại.

### Auth và security

- Chưa có endpoint auth trong backend hiện tại.
- Chưa có JWT middleware, RBAC dependency, rate limiting ở mức implementation.

### Pagination và list response

- Hiện tại các endpoint list trả về mảng (`list[...]`).
- Chưa áp dụng format pagination `items/total/page/page_size/total_pages`.

### Error response

- Hiện tại sử dụng cơ chế mặc định của FastAPI/Pydantic.
- Chưa có unified error envelope toàn hệ thống ở mức implementation.

Chuẩn response lỗi dùng chung (áp dụng khi chuẩn hóa API versioned):

```json
{
  "detail": {
    "message": "Mô tả lỗi cho người dùng/kỹ thuật",
    "error_code": "ERROR_CODE_CONSTANT",
    "request_id": "uuid",
    "fields": []
  }
}
```

Quy ước:

- `message`: thông tin mô tả lỗi ngắn gọn.
- `error_code`: mã lỗi ổn định để frontend xử lý theo nhánh logic.
- `request_id`: mã truy vết theo request.
- `fields`: danh sách lỗi theo trường dữ liệu (dùng cho lỗi validation).

Danh mục `error_code` chuẩn tham chiếu tại:

- [docs/api-error-codes.md](docs/api-error-codes.md)

---

## 2. Endpoint đã triển khai

### Health

#### GET `/health`

- Mô tả: health check.
- Response 200:

```json
{
  "status": "ok"
}
```

### Users

#### GET `/users`

- Mô tả: lấy danh sách user.
- Response 200: `UserResponse[]`.

#### POST `/users`

- Mô tả: tạo user.
- Request body: `UserCreate`.
- Response 201: `UserResponse`.

```json
{
  "username": "demo.user",
  "email": "demo@example.com",
  "full_name": "Demo User",
  "department": "QA",
  "position": "Manager",
  "phone": null,
  "password": "secret",
  "org_id": "uuid",
  "role_id": "uuid"
}
```

#### GET `/users/{user_id}`

- Mô tả: lấy chi tiết user.
- Response 200: `UserResponse`.

### Documents

#### GET `/documents`

- Mô tả: lấy danh sách tài liệu.
- Response 200: `DocumentResponse[]`.

#### POST `/documents`

- Mô tả: tạo tài liệu.
- Request body: `DocumentCreate`.
- Response 201: `DocumentResponse`.

```json
{
  "doc_code": "SOP-001",
  "title": "Quy trình vệ sinh",
  "doc_type": "SOP",
  "category_id": "uuid",
  "department": "QA",
  "review_period": 12,
  "org_id": "uuid",
  "created_by": "uuid"
}
```

#### GET `/documents/{document_id}`

- Mô tả: lấy chi tiết tài liệu.
- Response 200: `DocumentResponse`.

### HACCP

#### GET `/haccp/plans`

- Mô tả: lấy danh sách kế hoạch HACCP.
- Response 200: `HaccpPlanResponse[]`.

#### POST `/haccp/plans`

- Mô tả: tạo kế hoạch HACCP.
- Request body: `HaccpPlanCreate`.
- Response 201: `HaccpPlanResponse`.

#### GET `/haccp/plans/{plan_id}`

- Mô tả: lấy chi tiết kế hoạch HACCP.
- Response 200: `HaccpPlanResponse`.

### PRP

#### GET `/prp/audits`

- Mô tả: lấy danh sách PRP audit.
- Response 200: `PrpAuditResponse[]`.

#### POST `/prp/audits`

- Mô tả: tạo PRP audit.
- Request body: `PrpAuditCreate`.
- Response 201: `PrpAuditResponse`.

#### GET `/prp/audits/{audit_id}`

- Mô tả: lấy chi tiết PRP audit.
- Response 200: `PrpAuditResponse`.

### CAPA

#### GET `/capa`

- Mô tả: lấy danh sách CAPA.
- Response 200: `CapaResponse[]`.

#### POST `/capa`

- Mô tả: tạo CAPA.
- Request body: `CapaCreate`.
- Response 201: `CapaResponse`.

#### GET `/capa/{capa_id}`

- Mô tả: lấy chi tiết CAPA.
- Response 200: `CapaResponse`.

### Reports

#### GET `/reports/configs`

- Mô tả: lấy danh sách cấu hình report.
- Response 200: `ReportConfigResponse[]`.

#### POST `/reports/configs`

- Mô tả: tạo cấu hình report.
- Request body: `ReportConfigCreate`.
- Response 201: `ReportConfigResponse`.

#### GET `/reports/configs/{config_id}`

- Mô tả: lấy chi tiết cấu hình report.
- Response 200: `ReportConfigResponse`.

### Scheduling

#### GET `/scheduling/events`

- Mô tả: lấy danh sách event.
- Response 200: `CalendarEventResponse[]`.

#### POST `/scheduling/events`

- Mô tả: tạo event.
- Request body: `CalendarEventCreate`.
- Response 201: `CalendarEventResponse`.

#### GET `/scheduling/events/{event_id}`

- Mô tả: lấy chi tiết event.
- Response 200: `CalendarEventResponse`.

### 2.5 Error responses chuẩn cho endpoint đã triển khai

Áp dụng cho toàn bộ endpoint trong mục 2. Backend phải trả response lỗi theo mẫu envelope chuẩn (xem mục Error response ở đầu tài liệu).

#### Bảng quy ước lỗi theo tình huống

| Tình huống | HTTP | `error_code` điển hình | Ghi chú |
| --- | --- | --- | --- |
| `{id}` không tồn tại trong DB | 404 | `NOT_FOUND` hoặc `*_NOT_FOUND` | Ví dụ `USER_NOT_FOUND`, `DOCUMENT_NOT_FOUND` |
| Request body sai kiểu hoặc thiếu field | 422 | `VALIDATION_ERROR` | FastAPI/Pydantic tự phát hiện, cần wrap về envelope chuẩn |
| Trùng dữ liệu unique (email, doc_code…) | 409 | `CONFLICT` hoặc `*_ALREADY_EXISTS` | Ví dụ `USER_EMAIL_ALREADY_EXISTS`, `DOCUMENT_CODE_ALREADY_EXISTS` |
| Tạo/sửa thất bại do logic nghiệp vụ | 400 | `BAD_REQUEST` | Dùng khi validation schema pass nhưng nghiệp vụ từ chối |

#### Ví dụ Response 404

```json
{
  "detail": {
    "message": "Không tìm thấy user với id đã cho.",
    "error_code": "USER_NOT_FOUND",
    "request_id": "uuid",
    "fields": []
  }
}
```

#### Ví dụ Response 422

```json
{
  "detail": {
    "message": "Dữ liệu đầu vào không hợp lệ.",
    "error_code": "VALIDATION_ERROR",
    "request_id": "uuid",
    "fields": [
      { "field": "email", "message": "Không đúng định dạng email." }
    ]
  }
}
```

#### Ví dụ Response 409

```json
{
  "detail": {
    "message": "Email đã tồn tại trong hệ thống.",
    "error_code": "USER_EMAIL_ALREADY_EXISTS",
    "request_id": "uuid",
    "fields": []
  }
}
```

Danh mục đầy đủ `error_code` theo module tham chiếu tại:

- [docs/api-error-codes.md](docs/api-error-codes.md)

---

## 3. Endpoint dự kiến (roadmap)

Mục này giữ vai trò roadmap. Chưa được triển khai trong backend hiện tại:

- Auth: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- Document workflow: version upload, submit, approve, reject.
- HACCP deep workflow: steps, hazards, ccps, monitoring logs.
- IoT và cảnh báo: lịch sử dữ liệu thiết bị, xác nhận cảnh báo.
- AI: chat RAG, suggest capa/checklist.
- Quản lý vai trò và phân quyền.
- Calendar API theo namespace `/calendar/...`.

---

## 3.1 Ma trận đối soát API và module user flow

| Module trong user flow | Endpoint API hiện có                   | Trạng thái khớp | Ghi chú                                        |
| ---------------------- | -------------------------------------- | --------------- | ---------------------------------------------- |
| Dashboard              | Chưa có endpoint dashboard chuyên biệt | Một phần        | Hiện tổng hợp từ dữ liệu module khác hoặc mock |
| Document Control       | `/documents`                           | Khớp phần lõi   | Workflow duyệt là roadmap                      |
| HACCP                  | `/haccp/plans`                         | Khớp phần lõi   | Steps/hazards/CCP chi tiết là roadmap          |
| PRP Audit              | `/prp/audits`                          | Khớp phần lõi   | Upload bằng chứng chi tiết là roadmap          |
| CAPA                   | `/capa`                                | Khớp phần lõi   | Chuyển trạng thái và đóng CAPA là roadmap      |
| Reports                | `/reports/configs`                     | Khớp phần lõi   | Export file là roadmap                         |
| User Management        | `/users`                               | Khớp phần lõi   | Endpoint cập nhật user chưa có                 |
| AI Analytics           | Chưa có endpoint AI triển khai thật    | Chưa khớp       | Đang ở roadmap `/ai/...`                       |
| Scheduling             | `/scheduling/events`                   | Đã khớp         | Đã có list/create/detail ở mức khung           |

Khi triển khai roadmap, cần chốt lại đồng bộ với:

- [docs/architecture.md](docs/architecture.md)
- [docs/database-schema.md](docs/database-schema.md)
- [docs/security-rules.md](docs/security-rules.md)
- [docs/user-flows.md](docs/user-flows.md)

---

## 4. Quy tắc migration tiếp theo

Khi nâng cấp sang API versioned, đề xuất quy tắc:

1. Tạo namespace mới `/api/v1` và giữ backward compatibility tạm thời.
2. Không đổi tên field request/response trong cùng một version.
3. Áp dụng pagination envelope cho tất cả endpoint list mới.
4. Chốt một error envelope duy nhất theo mẫu ở mục Error response trước khi mở rộng frontend integration.
