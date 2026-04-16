# Known Issues - SCT-ISO.AI

Tài liệu này ghi nhận các vấn đề đã biết, workaround tạm thời, và rủi ro cần lưu ý để agent coding không sửa nhầm hoặc tạo regression.

Ngày cập nhật: 2026-04-16.

---

## 1. Mục tiêu và phạm vi

- Cung cấp danh sách lỗi/giới hạn hiện hữu ở mức hệ thống.
- Tách rõ mức độ ưu tiên để định hướng xử lý.
- Ghi workaround tạm thời cho giai đoạn chưa hoàn thiện.

Trạng thái hiện tại:

- Backend đang ở mức khung endpoint.
- Frontend đang dùng dữ liệu mock cho nhiều luồng.

---

## 2. Quy ước phân loại mức độ

- `P0`: Nghiêm trọng, chặn khả năng phát hành.
- `P1`: Ảnh hưởng lớn, cần xử lý sớm theo roadmap.
- `P2`: Ảnh hưởng nhỏ hoặc cải tiến chất lượng.

---

## 3. Critical Issues (P0)

| ID     | Mô tả                                                | Workaround tạm thời                                       | Hướng xử lý                                                                 |
| ------ | ---------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------- |
| P0-001 | Chưa có auth thật cho backend                        | Chỉ dùng nội bộ dev, không public                         | Triển khai JWT + RBAC theo [docs/security-rules.md](docs/security-rules.md) |
| P0-002 | Endpoint hiện trả dữ liệu mô phỏng, chưa ghi DB thật | Frontend bám mock ổn định, không giả định persisted state | Kết nối DB và service layer theo module                                     |
| P0-003 | Chưa có middleware xử lý lỗi thống nhất              | Xử lý lỗi tối thiểu ở client khi gọi API                  | Áp dụng error envelope theo [docs/api-contracts.md](docs/api-contracts.md)  |
| P0-004 | Lệch tiềm ẩn giữa mock data và schema API            | Kiểm tra chéo thủ công khi sửa schema                     | Giảm dần mock, thay bằng API thật và test contract                          |

---

## 4. Major Issues (P1)

| ID     | Mô tả                                   | Workaround tạm thời                                    | Hướng xử lý                                                                       |
| ------ | --------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| P1-001 | Chưa có pagination cho list endpoint    | Dataset nhỏ thì chấp nhận tạm                          | Bổ sung chuẩn pagination cho mọi endpoint list                                    |
| P1-002 | Chưa có service layer ở backend modules | Giữ router mỏng, tránh thêm logic phức tạp             | Tách service layer khi mở rộng nghiệp vụ                                          |
| P1-003 | Chưa có realtime alerts                 | UI hiển thị dữ liệu gần realtime bằng refresh thủ công | Quyết định WebSocket/SSE và triển khai ở pha tiếp theo                            |
| P1-004 | Chưa có export báo cáo thật             | Hiển thị dữ liệu màn hình thay cho file export         | Triển khai PDF/Excel và kiểm thử định dạng                                        |
| P1-005 | Chưa có CI gate test đầy đủ             | Chạy lint thủ công khi cần                             | Áp dụng chiến lược test theo [docs/testing-strategy.md](docs/testing-strategy.md) |
| P1-006 | Chưa có migration backend chính thức    | Hạn chế thay đổi schema liên tục                       | Bổ sung công cụ migration và quy trình kiểm soát                                  |
| P1-007 | Chưa có chuẩn i18n rõ cho UI            | Duy trì tiếng Việt hiện có                             | Tách thông điệp UI thành cấu trúc i18n có quản lý                                 |

---

## 5. Minor Issues (P2)

| ID     | Mô tả                                             | Workaround tạm thời                       | Tình trạng |
| ------ | ------------------------------------------------- | ----------------------------------------- | ---------- |
| P2-001 | Một số mô tả technical còn lẫn thuật ngữ Anh      | Dùng glossary nội bộ khi review           | Theo dõi   |
| P2-002 | Một số bảng docs còn thiếu owner chịu trách nhiệm | Gán tạm reviewer theo module              | Theo dõi   |
| P2-003 | Chưa có trang index docs tổng                     | Điều hướng qua architecture và tech-stack | Theo dõi   |
| P2-004 | Chưa có checklist regression theo issue           | Kiểm tra thủ công các flow chính          | Theo dõi   |
| P2-005 | Chưa đo performance chuẩn theo SLA                | Đo thủ công khi cần                       | Theo dõi   |

---

## 6. Security Concerns

| ID      | Mô tả                               | Giảm thiểu tạm thời                | Hướng xử lý                                       |
| ------- | ----------------------------------- | ---------------------------------- | ------------------------------------------------- |
| SEC-001 | Chưa có xác thực truy cập endpoint  | Chỉ chạy môi trường dev nội bộ     | Triển khai auth đầy đủ                            |
| SEC-002 | Chưa có rate limiting               | Hạn chế sử dụng công khai          | Bật rate limiting khi có auth                     |
| SEC-003 | Chưa có request_id middleware chuẩn | Theo dõi log thủ công ở mức cơ bản | Triển khai request tracing chuẩn                  |
| SEC-004 | Chưa có policy upload file thực tế  | Không bật upload file production   | Áp dụng kiểm tra MIME, kích thước và malware scan |

---

## 7. Vấn đề nhất quán dữ liệu

1. Mock data và schema API có nguy cơ lệch theo thời gian.
2. Luồng nhiều tổ chức (multi-tenant) chưa được thực thi đầy đủ trong endpoint hiện tại.
3. Một số trạng thái nghiệp vụ (workflow) mới tồn tại ở tài liệu, chưa tồn tại trong code.

---

## 8. Ranh giới giữa issue và giới hạn thiết kế

Các mục dưới đây là giới hạn thiết kế tạm thời, không hẳn là bug:

- Dùng mock data để phát triển UI nhanh.
- Chưa bật realtime ở tất cả màn hình.
- Chưa bật đầy đủ pipeline AI runtime.

---

## 9. Quy trình cập nhật issue

1. Thêm issue mới theo đúng mức P0/P1/P2.
2. Mỗi issue phải có workaround hoặc quyết định "không workaround" rõ ràng.
3. Khi issue được xử lý, cập nhật trạng thái và ngày đóng.
4. Khi sửa issue liên module, cập nhật thêm:

- [docs/user-flows.md](docs/user-flows.md)
- [docs/testing-strategy.md](docs/testing-strategy.md)
- [docs/security-rules.md](docs/security-rules.md)

---

## 10. Phạm vi không bao gồm

- Không thay thế hệ thống ticket tracking chi tiết.
- Không mô tả patch code cụ thể cho từng bug.
- Không chứa issue quá nhỏ ở mức styling đơn lẻ.
