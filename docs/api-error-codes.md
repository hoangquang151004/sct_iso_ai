# Danh mục Mã Lỗi API - SCT-ISO.AI

Tài liệu này định nghĩa danh mục mã lỗi chuẩn để backend và frontend dùng thống nhất.

Ngày cập nhật: 2026-04-16.

---

## 1. Mục tiêu

- Chuẩn hóa giá trị `error_code` trong phản hồi lỗi API.
- Giúp frontend xử lý lỗi theo logic ổn định, không phụ thuộc nội dung `message`.
- Giảm rủi ro sai lệch giữa các module khi mở rộng hệ thống.

---

## 2. Mẫu phản hồi lỗi chuẩn

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

---

## 3. Quy ước đặt tên error_code

Quy tắc đề xuất:

- Dạng: `MODULE_REASON`
- Viết hoa toàn bộ, dùng dấu gạch dưới.

Ví dụ:

- `AUTH_INVALID_CREDENTIALS`
- `DOCUMENT_NOT_FOUND`
- `CAPA_INVALID_STATUS_TRANSITION`

---

## 4. Mã lỗi dùng chung

| HTTP | error_code            | Khi nào dùng                              |
| ---- | --------------------- | ----------------------------------------- |
| 400  | `BAD_REQUEST`         | Yêu cầu không hợp lệ ở mức tổng quát      |
| 401  | `UNAUTHORIZED`        | Chưa xác thực hoặc token không hợp lệ     |
| 403  | `FORBIDDEN`           | Không có quyền truy cập tài nguyên        |
| 404  | `NOT_FOUND`           | Không tìm thấy tài nguyên                 |
| 409  | `CONFLICT`            | Xung đột dữ liệu hoặc trạng thái          |
| 422  | `VALIDATION_ERROR`    | Lỗi kiểm tra dữ liệu đầu vào              |
| 429  | `RATE_LIMITED`        | Vượt ngưỡng giới hạn tốc độ               |
| 500  | `INTERNAL_ERROR`      | Lỗi hệ thống không mong muốn              |
| 503  | `SERVICE_UNAVAILABLE` | Dịch vụ phụ thuộc tạm thời không sẵn sàng |

---

## 5. Mã lỗi theo module (roadmap)

### 5.1 Auth

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_OTP_REQUIRED`
- `AUTH_OTP_INVALID`
- `AUTH_TOKEN_EXPIRED`
- `AUTH_REFRESH_TOKEN_INVALID`

### 5.2 Users

- `USER_NOT_FOUND`
- `USER_EMAIL_ALREADY_EXISTS`
- `USER_ROLE_INVALID`
- `USER_INACTIVE`

### 5.3 Documents

- `DOCUMENT_NOT_FOUND`
- `DOCUMENT_CODE_ALREADY_EXISTS`
- `DOCUMENT_INVALID_STATUS_TRANSITION`
- `DOCUMENT_VERSION_NOT_FOUND`
- `DOCUMENT_APPROVAL_FORBIDDEN`

### 5.4 HACCP

- `HACCP_PLAN_NOT_FOUND`
- `HACCP_STEP_NOT_FOUND`
- `HACCP_HAZARD_NOT_FOUND`
- `HACCP_CCP_NOT_FOUND`
- `HACCP_CRITICAL_LIMIT_INVALID`

### 5.5 PRP

- `PRP_PROGRAM_NOT_FOUND`
- `PRP_AUDIT_NOT_FOUND`
- `PRP_AUDIT_INVALID_STATUS_TRANSITION`

### 5.6 CAPA

- `CAPA_NOT_FOUND`
- `CAPA_INVALID_STATUS_TRANSITION`
- `CAPA_EFFECTIVENESS_REQUIRED`
- `CAPA_CLOSE_FORBIDDEN`

### 5.7 Reports

- `REPORT_CONFIG_NOT_FOUND`
- `REPORT_EXPORT_FORMAT_INVALID`
- `REPORT_GENERATION_FAILED`

### 5.8 Scheduling

- `SCHEDULE_EVENT_NOT_FOUND`
- `SCHEDULE_EVENT_TIME_INVALID`
- `SCHEDULE_EVENT_CONFLICT`

---

## 6. Hướng dẫn áp dụng

1. Backend luôn trả `error_code` thuộc danh mục đã công bố.
2. Frontend xử lý nhánh logic theo `error_code`, chỉ hiển thị `message` cho người dùng.
3. Khi thêm mã lỗi mới, cập nhật tài liệu này cùng pull request.
4. Không tái sử dụng cùng một `error_code` cho nhiều ngữ cảnh khác nghĩa.

---

## 7. Trạng thái hiện tại

- Backend hiện tại đang ở mức khung endpoint và chưa áp dụng đầy đủ danh mục mã lỗi này.
- Danh mục này được xem là chuẩn mục tiêu để triển khai từ phiên bản API có chuẩn hóa lỗi.
