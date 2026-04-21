# Danh mục Mã Lỗi API - SCT-ISO.AI

Ngày cập nhật: 2026-04-20.

## 1) Error envelope
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

## 2) Mã lỗi dùng chung
| HTTP | error_code | Khi nào dùng |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | Request không hợp lệ mức tổng quát |
| 401 | `UNAUTHORIZED` | Thiếu hoặc sai thông tin xác thực |
| 403 | `FORBIDDEN` | Không đủ quyền |
| 404 | `NOT_FOUND` | Không tìm thấy tài nguyên |
| 409 | `CONFLICT` | Xung đột dữ liệu nghiệp vụ |
| 422 | `VALIDATION_ERROR` | Validation dữ liệu đầu vào |
| 429 | `RATE_LIMITED` | Vượt ngưỡng rate limit |
| 503 | `SERVICE_UNAVAILABLE` | Dịch vụ phụ trợ chưa sẵn sàng |

## 3) Auth
| HTTP | error_code | Bối cảnh |
| --- | --- | --- |
| 401 | `AUTH_INVALID_CREDENTIALS` | Sai username/password |
| 401 | `UNAUTHORIZED` | Token/refresh token không hợp lệ hoặc đã bị revoke |
| 429 | `RATE_LIMITED` | Vượt rate limit `/auth/login` hoặc `/auth/refresh` |

## 4) Users
| HTTP | error_code | Bối cảnh |
| --- | --- | --- |
| 404 | `USER_NOT_FOUND` | User không tồn tại trong org |
| 409 | `USER_EMAIL_ALREADY_EXISTS` | Email bị trùng |
| 409 | `USER_USERNAME_ALREADY_EXISTS` | Username bị trùng |
| 422 | `USER_ROLE_INVALID` | Role không hợp lệ hoặc khác org |
| 403 | `USER_INACTIVE` | Thao tác trên user đã bị vô hiệu hóa |
| 422 | `USER_PASSWORD_WEAK` | Mật khẩu không đạt policy |
| 403 | `USER_PERMISSION_DENIED` | Dành cho mapping UI; backend hiện trả `FORBIDDEN` |

Ghi chú frontend mapping trong user-management flow:
- `FORBIDDEN` -> thông điệp không đủ quyền thao tác.
- `UNAUTHORIZED` -> thông điệp phiên đăng nhập không hợp lệ/hết hạn.
- `USER_PERMISSION_DENIED` -> giữ để tương thích UI mapping khi backend tách mã lỗi chi tiết hơn.

## 5) RBAC
| HTTP | error_code | Bối cảnh |
| --- | --- | --- |
| 404 | `ROLE_NOT_FOUND` | Role không tồn tại |
| 403 | `ROLE_SYSTEM_PROTECTED` | Cố sửa/xóa system role |
| 409 | `ROLE_IN_USE` | Cố xóa role đang được user sử dụng |
| 409 | `ROLE_NAME_ALREADY_EXISTS` | Tên role bị trùng trong cùng org |
| 422 | `PERMISSION_NOT_FOUND` | `permission_codes` có mã không tồn tại |

## 6) Ví dụ thực tế

### 6.1 RATE_LIMITED
```json
{
  "detail": {
    "message": "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.",
    "error_code": "RATE_LIMITED",
    "request_id": "uuid",
    "fields": []
  }
}
```

### 6.2 USER_PASSWORD_WEAK
```json
{
  "detail": {
    "message": "Mật khẩu không hợp lệ.",
    "error_code": "USER_PASSWORD_WEAK",
    "request_id": "uuid",
    "fields": [
      { "field": "password", "message": "Tối thiểu 8 ký tự, gồm chữ và số." }
    ]
  }
}
```
