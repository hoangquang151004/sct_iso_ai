# Environment và Configuration - SCT-ISO.AI

Tài liệu này mô tả quy ước cấu hình môi trường để tránh hardcode và giúp agent triển khai đúng theo từng môi trường.

Ngày cập nhật: 2026-04-16.

---

## 1. Trạng thái hiện tại

- Repository hiện chưa có lớp cấu hình tập trung cho backend.
- Đã có tệp [.env.example](.env.example) ở thư mục gốc để làm mẫu khai báo biến.
- Frontend hiện chưa tích hợp API thật nên chưa dùng đầy đủ biến runtime.

---

## 2. Nguyên tắc cấu hình

1. Không hardcode secret, URL, khóa truy cập trong mã nguồn.
2. Chỉ lưu tên biến trong tài liệu, không lưu giá trị thật.
3. Mỗi môi trường (dev, staging, prod) có bộ giá trị riêng.
4. Giá trị bí mật chỉ nạp qua secret manager hoặc biến môi trường an toàn.
5. Khi thêm biến mới phải cập nhật tài liệu này cùng lúc.

---

## 3. Biến môi trường backend (đề xuất chuẩn)

### 3.1 Core

- APP_NAME
- APP_ENV
- APP_DEBUG
- APP_HOST
- APP_PORT

### 3.2 Database

- DATABASE_URL
- DATABASE_POOL_SIZE
- DATABASE_MAX_OVERFLOW

### 3.3 Security

- JWT_SECRET_KEY
- JWT_ALGORITHM
- ACCESS_TOKEN_TTL_MINUTES
- REFRESH_TOKEN_TTL_DAYS
- TOTP_ENCRYPTION_KEY

### 3.4 CORS

- FRONTEND_URL
- CORS_ALLOWED_ORIGINS

### 3.5 Logging và tracing

- LOG_LEVEL
- LOG_FORMAT
- REQUEST_ID_HEADER

### 3.6 Tích hợp mở rộng (khi triển khai)

- MONGODB_URL
- CHROMA_HOST
- CHROMA_PORT
- MQTT_BROKER_URL
- MQTT_BROKER_PORT
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_S3_BUCKET
- SMTP_HOST
- SMTP_PORT
- SMTP_USERNAME
- SMTP_PASSWORD

---

## 4. Biến môi trường frontend (đề xuất chuẩn)

- NEXT_PUBLIC_API_BASE_URL
- NEXT_PUBLIC_APP_ENV
- NEXT_PUBLIC_ENABLE_MOCK_DATA
- NEXT_PUBLIC_SENTRY_DSN (nếu có)

Lưu ý:

- Chỉ dùng tiền tố `NEXT_PUBLIC_` cho biến được phép lộ ở phía trình duyệt.
- Không đưa secret backend vào biến `NEXT_PUBLIC_*`.

---

## 5. Nạp cấu hình theo môi trường

### 5.1 Development

- Dùng tệp `.env.local` (không commit).
- Ưu tiên giá trị phục vụ chạy local.

### 5.2 Staging

- Nạp biến từ hệ thống CI/CD hoặc secret store.
- Dữ liệu kết nối riêng, không dùng chung với production.

### 5.3 Production

- Chỉ nạp biến từ secret manager.
- Không bật debug.
- Bật log ở mức đủ truy vết nhưng không lộ dữ liệu nhạy cảm.

---

## 6. Mẫu tệp `.env.example`

Vị trí tệp mẫu: [.env.example](.env.example).

```env
# Core
APP_NAME=
APP_ENV=
APP_DEBUG=
APP_HOST=
APP_PORT=

# Database
DATABASE_URL=
DATABASE_POOL_SIZE=
DATABASE_MAX_OVERFLOW=

# Security
JWT_SECRET_KEY=
JWT_ALGORITHM=
ACCESS_TOKEN_TTL_MINUTES=
REFRESH_TOKEN_TTL_DAYS=
TOTP_ENCRYPTION_KEY=

# CORS
FRONTEND_URL=
CORS_ALLOWED_ORIGINS=

# Logging
LOG_LEVEL=
LOG_FORMAT=
REQUEST_ID_HEADER=
```

---

## 7. Checklist khi thêm cấu hình mới

1. Thêm biến vào tài liệu này.
2. Thêm biến vào [.env.example](.env.example).
3. Cập nhật nơi đọc cấu hình trong backend hoặc frontend.
4. Kiểm tra biến không bị lộ vào log.
5. Bổ sung kiểm thử hoặc kiểm tra khởi động để phát hiện thiếu biến bắt buộc.
