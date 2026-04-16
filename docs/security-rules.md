# Security Rules - SCT-ISO.AI

Tài liệu này phân tách rõ:

- Trạng thái bảo mật hiện tại trong repository.
- Quy tắc bắt buộc khi viết mới.
- Mục tiêu bảo mật cho giai đoạn roadmap.

Ngày cập nhật: 2026-04-16.

---

## 1. Trạng thái hiện tại

Theo code backend và frontend hiện tại:

- Chưa có endpoint xác thực đăng nhập theo JWT.
- Chưa có middleware xác thực, phân quyền vai trò, giới hạn tốc độ.
- Chưa có luồng lưu trữ token vì frontend vẫn dùng dữ liệu mô phỏng.
- Chưa có lớp cấu hình môi trường tập trung trong backend.

Vì vậy, các quy tắc ở mục roadmap là mục tiêu triển khai, chưa phải hành vi đang chạy thực tế.

---

## 2. Quy tắc bắt buộc áp dụng ngay

### 2.1 Không lộ dữ liệu nhạy cảm

Không ghi log các dữ liệu sau:

- Mật khẩu gốc hoặc mật khẩu băm.
- Mã OTP, token, khóa bí mật.
- Thông tin cá nhân không cần thiết trong log nghiệp vụ.

### 2.2 Không hardcode cấu hình bí mật

- Không ghi trực tiếp secret, key, mật khẩu vào mã nguồn.
- Mọi giá trị nhạy cảm phải lấy từ biến môi trường.

### 2.3 Bảo vệ truy vấn dữ liệu theo tổ chức

- Khi bổ sung truy vấn DB thật, phải luôn ràng buộc theo khóa tổ chức.
- Trong codebase hiện tại, khóa tổ chức đang dùng là `org_id`.

### 2.4 Kiểm tra dữ liệu đầu vào

- Dùng Pydantic schema để xác thực request body.
- Không nhận dữ liệu tự do rồi ánh xạ trực tiếp vào model DB.

### 2.5 Mật khẩu

- Khi triển khai luồng người dùng thật, mật khẩu bắt buộc phải băm bằng bcrypt.
- Tuyệt đối không lưu mật khẩu dạng rõ trong bất kỳ bảng nào.

---

## 3. Mục tiêu triển khai bảo mật (roadmap)

### 3.1 Xác thực

- Áp dụng JWT access token và refresh token.
- Thiết lập thời hạn sống rõ ràng cho từng loại token.
- Payload token chỉ chứa thông tin định danh tối thiểu.

### 3.2 Phân quyền

- Bổ sung cơ chế RBAC theo module và hành động.
- Chặn truy cập trái quyền ở tầng dependency hoặc middleware.

### 3.3 Giới hạn tốc độ

- Bổ sung giới hạn tốc độ cho đăng nhập và API tổng quát.
- Có cơ chế khóa tạm thời khi vượt ngưỡng thất bại đăng nhập.

### 3.4 CORS và xử lý lỗi production

- Không dùng ký tự đại diện cho nguồn truy cập ở môi trường production.
- Không trả stack trace nội bộ cho phía client.

Chuẩn phản hồi lỗi API (đồng bộ với tài liệu API contracts):

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

Nguyên tắc bảo mật cho phản hồi lỗi:

- Không để lộ stack trace hoặc thông tin nội bộ hệ thống.
- `error_code` phải ổn định để client xử lý mà không phụ thuộc vào nội dung `message`.
- `request_id` phải có để truy vết log ở môi trường vận hành.

Danh mục mã lỗi chuẩn tham chiếu tại:

- [docs/api-error-codes.md](docs/api-error-codes.md)

### 3.5 Frontend security

- Không lưu token trong localStorage.
- Ưu tiên refresh token qua cookie chỉ cho HTTP.
- Tránh render HTML thô nếu chưa qua bước làm sạch dữ liệu.

---

## 4. Danh sách biến môi trường đề xuất

Danh sách dưới đây là định hướng để triển khai các lớp bảo mật và tích hợp:

- JWT_SECRET_KEY
- DATABASE_URL
- FRONTEND_URL
- MONGODB_URL
- CHROMA_HOST
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- SMTP_PASSWORD
- TOTP_ENCRYPTION_KEY

Lưu ý:

- Chỉ công bố tên biến, không đưa giá trị thật vào tài liệu.

---

## 5. Checklist rà soát bảo mật trước khi hợp nhất mã

1. Không có secret hoặc token trong mã nguồn.
2. Không có log chứa dữ liệu nhạy cảm.
3. Có kiểm tra đầu vào bằng schema cho endpoint mới.
4. Có ràng buộc truy vấn theo tổ chức cho nghiệp vụ đa tenant.
5. Có cập nhật đồng bộ tài liệu bảo mật khi thay đổi kiến trúc xác thực.
6. Endpoint mới dùng đúng mẫu phản hồi lỗi thống nhất.
