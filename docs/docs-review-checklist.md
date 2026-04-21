# Checklist Review Docs Trước Merge - SCT-ISO.AI

Tài liệu này dùng để rà soát nhanh chất lượng và tính nhất quán của toàn bộ tài liệu kỹ thuật trước khi merge.

Ngày cập nhật: 2026-04-21.

---

## 1. Phạm vi áp dụng

Áp dụng cho các tài liệu trong thư mục [docs](docs):

- [docs/architecture.md](docs/architecture.md)
- [docs/api-contracts.md](docs/api-contracts.md)
- [docs/api-error-codes.md](docs/api-error-codes.md)
- [docs/user-flows.md](docs/user-flows.md)
- [docs/ai-layer.md](docs/ai-layer.md)
- [docs/testing-strategy.md](docs/testing-strategy.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/known-issues.md](docs/known-issues.md)
- [docs/database-schema.md](docs/database-schema.md)
- [docs/env-and-config.md](docs/env-and-config.md)
- [docs/security-rules.md](docs/security-rules.md)
- [docs/coding-conventions.md](docs/coding-conventions.md)
- [docs/tech-stack.md](docs/tech-stack.md)

---

## 2. Checklist nhất quán nội dung

1. Trạng thái Implemented và Roadmap được tách rõ trong từng tài liệu liên quan.
2. Mọi tên field cốt lõi (ví dụ `org_id`) thống nhất giữa API, DB, security, conventions.
3. Mẫu phản hồi lỗi giống nhau giữa:

- [docs/api-contracts.md](docs/api-contracts.md)
- [docs/security-rules.md](docs/security-rules.md)
- [docs/coding-conventions.md](docs/coding-conventions.md)

4. Danh mục mã lỗi trong [docs/api-error-codes.md](docs/api-error-codes.md) không trùng nghĩa giữa các mã.
5. Mọi endpoint trong [docs/api-contracts.md](docs/api-contracts.md) phản ánh đúng trạng thái hiện tại hoặc được gắn rõ là Dự kiến.
6. Luồng trong [docs/user-flows.md](docs/user-flows.md) không mâu thuẫn với endpoint và trạng thái triển khai.
7. Nội dung trong [docs/ai-layer.md](docs/ai-layer.md) nhất quán với thực trạng stack và roadmap kỹ thuật.
8. Quy tắc trong [docs/testing-strategy.md](docs/testing-strategy.md) phù hợp với phạm vi thay đổi thực tế.
9. Mọi vấn đề trong [docs/known-issues.md](docs/known-issues.md) có workaround hoặc trạng thái xử lý rõ.
10. Quyết định trong [docs/decisions.md](docs/decisions.md) có trạng thái và tham chiếu chéo đầy đủ.

---

## 3. Checklist tham chiếu và định dạng

1. Tham chiếu tới tài liệu khác dùng cùng một kiểu markdown link.
2. Không còn tham chiếu mồ côi tới file không tồn tại.
3. Đường dẫn file trong tài liệu là đường dẫn tương đối nhất quán.
4. Tiêu đề tài liệu theo cùng quy ước đặt tên.
5. Tiếng Việt có dấu được dùng nhất quán trong phần mô tả.
6. Khi đổi cấu trúc thư mục frontend: cập nhật đồng thời [docs/architecture.md](docs/architecture.md), [docs/coding-conventions.md](docs/coding-conventions.md), [docs/security-rules.md](docs/security-rules.md), [docs/user-flows.md](docs/user-flows.md), [docs/testing-strategy.md](docs/testing-strategy.md), [docs/decisions.md](docs/decisions.md) (ADR-002 nếu liên quan), [docs/tech-stack.md](docs/tech-stack.md).

---

## 4. Checklist cấu hình và bảo mật

1. Tài liệu [docs/env-and-config.md](docs/env-and-config.md) đã khớp với file [.env.example](.env.example).
2. Không xuất hiện giá trị bí mật thật trong docs.
3. Quy tắc bảo mật trong [docs/security-rules.md](docs/security-rules.md) không mâu thuẫn với thực trạng triển khai.
4. Biến môi trường mới (nếu có) đã được cập nhật đồng thời trong docs.

---

## 5. Checklist quy trình cập nhật

1. Khi sửa API: cập nhật đồng thời

- [docs/api-contracts.md](docs/api-contracts.md)
- [docs/api-error-codes.md](docs/api-error-codes.md)
- [docs/security-rules.md](docs/security-rules.md)

2. Khi sửa DB model: cập nhật đồng thời

- [docs/database-schema.md](docs/database-schema.md)
- [docs/coding-conventions.md](docs/coding-conventions.md)

3. Khi thêm tích hợp mới hoặc đổi layout `frontend/src/`: cập nhật đồng thời

- [docs/architecture.md](docs/architecture.md)
- [docs/coding-conventions.md](docs/coding-conventions.md)
- [docs/tech-stack.md](docs/tech-stack.md)
- [docs/env-and-config.md](docs/env-and-config.md)

4. Khi thay đổi luồng nghiệp vụ: cập nhật đồng thời

- [docs/user-flows.md](docs/user-flows.md)
- [docs/testing-strategy.md](docs/testing-strategy.md)
- [docs/known-issues.md](docs/known-issues.md)

5. Khi thay đổi quyết định kiến trúc: cập nhật đồng thời

- [docs/decisions.md](docs/decisions.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/tech-stack.md](docs/tech-stack.md)

---

## 6. Tiêu chí pass trước merge

Đánh dấu pass khi:

- Không còn mâu thuẫn giữa các tài liệu cốt lõi.
- Mọi liên kết tài liệu mở đúng đích.
- Không có TODO mơ hồ cho các mục bắt buộc.
- Có ghi ngày cập nhật cho tài liệu được sửa.
