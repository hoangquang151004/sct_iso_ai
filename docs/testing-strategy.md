# Testing Strategy - SCT-ISO.AI

Tài liệu này định nghĩa chiến lược kiểm thử theo loại thay đổi, mức kiểm thử bắt buộc, quy tắc đặt tên test, mock policy và cổng chất lượng trước merge.

Ngày cập nhật: 2026-04-16.

---

## 1. Mục tiêu và phạm vi

- Đảm bảo thay đổi mới không gây regression.
- Chuẩn hóa cách đội dự án và agent viết test.
- Tạo tiêu chí pass/fail rõ trước merge.

Trạng thái hiện tại:

- Chưa có hệ test hoàn chỉnh trong codebase.
- Cần triển khai theo lộ trình từng pha.

---

## 2. Ma trận test bắt buộc theo loại thay đổi

| Loại thay đổi               | Unit test | Integration test | E2E test       | Ghi chú                                       |
| --------------------------- | --------- | ---------------- | -------------- | --------------------------------------------- |
| Sửa hàm thuần, util         | Bắt buộc  | Không bắt buộc   | Không bắt buộc | Ưu tiên chạy nhanh                            |
| Sửa schema request/response | Bắt buộc  | Bắt buộc         | Khuyến nghị    | Kiểm tra mapping lỗi và validation            |
| Sửa endpoint backend        | Bắt buộc  | Bắt buộc         | Khuyến nghị    | Có test nhánh lỗi                             |
| Sửa workflow liên module    | Bắt buộc  | Bắt buộc         | Bắt buộc       | Bao phủ happy path và failure path            |
| Sửa UI component nhỏ        | Bắt buộc  | Khuyến nghị      | Không bắt buộc | Snapshot không thay thế logic test            |
| Sửa luồng người dùng chính  | Bắt buộc  | Bắt buộc         | Bắt buộc       | Theo [docs/user-flows.md](docs/user-flows.md) |
| Sửa bảo mật/cấu hình        | Bắt buộc  | Bắt buộc         | Khuyến nghị    | Kiểm tra không lộ secret                      |

---

## 3. Mức kiểm thử và mục tiêu coverage

1. Unit test:

- Mục tiêu tối thiểu: 70% phần logic có thể kiểm thử.

2. Integration test:

- Mục tiêu tối thiểu: bao phủ endpoint chính và nhánh lỗi quan trọng.

3. E2E test:

- Mục tiêu: 100% luồng người dùng trọng yếu trước phát hành.

4. Performance/Security/Accessibility:

- Chạy theo cổng chất lượng release hoặc lịch định kỳ.

---

## 4. Chiến lược test backend

Quy ước vị trí:

- Đặt test gần module tương ứng hoặc trong thư mục tests theo module.

Quy ước đặt tên:

- File: `test_<module>_<feature>.py`
- Hàm: `test_<expected_behavior>_<condition>`

Nội dung bắt buộc cho endpoint test:

1. Test thành công (happy path).
2. Test validation lỗi.
3. Test lỗi nghiệp vụ quan trọng.
4. Test phản hồi lỗi theo error envelope chuẩn.

---

## 5. Chiến lược test frontend

Quy ước vị trí:

- Đặt test trong `__tests__` gần component hoặc theo feature.

Quy ước đặt tên:

- File: `<Component>.test.tsx` hoặc `<feature>.spec.ts`.

Nội dung bắt buộc:

1. Render đúng theo state chính.
2. Xử lý loading/error/success state.
3. Mapping đúng error_code sang thông báo hoặc hành động UI.

---

## 6. Luồng E2E ưu tiên

Các luồng E2E bắt buộc khi tiến tới production:

1. Tạo và theo dõi tài liệu ở Document Control.
2. Ghi nhận và xử lý CAPA qua vòng đời chính.
3. Thực hiện PRP audit và phản ánh lên dashboard/reports.

Khuyến nghị mở rộng:

- Luồng HACCP có cảnh báo.
- Luồng AI analytics với fallback khi lỗi.

## 6.1 Ma trận truy vết flow -> test bắt buộc

Ma trận này bám theo các flow trong [docs/user-flows.md](docs/user-flows.md).

| Flow module      | Unit test | Integration test        | E2E test    | Ghi chú triển khai                                                                |
| ---------------- | --------- | ----------------------- | ----------- | --------------------------------------------------------------------------------- |
| Dashboard        | Bắt buộc  | Bắt buộc                | Khuyến nghị | Chưa có endpoint dashboard chuyên biệt, test tích hợp theo nguồn dữ liệu tổng hợp |
| Document Control | Bắt buộc  | Bắt buộc                | Bắt buộc    | Kiểm thử list/create/detail với `/documents`; workflow duyệt là roadmap           |
| HACCP            | Bắt buộc  | Bắt buộc                | Khuyến nghị | Kiểm thử lõi với `/haccp/plans`; luồng monitoring sâu là roadmap                  |
| PRP Audit        | Bắt buộc  | Bắt buộc                | Bắt buộc    | Kiểm thử lõi với `/prp/audits`; upload sâu là roadmap                             |
| CAPA             | Bắt buộc  | Bắt buộc                | Bắt buộc    | Kiểm thử lõi với `/capa`; chuyển trạng thái/đóng là roadmap                       |
| Reports          | Bắt buộc  | Bắt buộc                | Khuyến nghị | Kiểm thử `/reports/configs`; export file là roadmap                               |
| User Management  | Bắt buộc  | Bắt buộc                | Khuyến nghị | Kiểm thử list/create/detail với `/users`; cập nhật user là roadmap                |
| AI Analytics     | Bắt buộc  | Bắt buộc (mock adapter) | Khuyến nghị | Chưa có endpoint AI thật, cần test fallback và lỗi timeout                        |
| Scheduling       | Bắt buộc  | Bắt buộc                | Khuyến nghị | Kiểm thử list/create/detail với `/scheduling/events`                              |

## 6.2 Bộ kịch bản tối thiểu theo flow

1. Mỗi flow phải có ít nhất 1 kịch bản happy path và 1 kịch bản failure path.
2. Với flow có endpoint thật: failure path phải bao gồm lỗi validation hoặc lỗi nghiệp vụ chính.
3. Với flow đang roadmap/mock (ví dụ AI Analytics): phải có kịch bản fallback rõ cho trạng thái dịch vụ không sẵn sàng.
4. Với flow trọng yếu trước phát hành (Document Control, PRP Audit, CAPA): E2E phải kiểm thử xuyên module theo [docs/user-flows.md](docs/user-flows.md).

---

## 7. Mock policy

Nguyên tắc chung:

1. Unit test: mock phụ thuộc ngoài để test logic cô lập.
2. Integration test: hạn chế mock, ưu tiên test tích hợp thật ở mức hợp lý.
3. E2E test: không mock logic nghiệp vụ cốt lõi.

Quy định bắt buộc:

- Không mock để che lỗi nghiệp vụ.
- Mọi mock phải có lý do và phạm vi rõ.
- Khi API thật đã sẵn sàng, giảm dần mock ở frontend.

---

## 8. Test cho bảo mật và cấu hình

Bắt buộc kiểm tra:

1. Không có secret hardcode trong source.
2. Không log dữ liệu nhạy cảm.
3. Lỗi API trả đúng envelope chuẩn và không lộ stack trace.
4. Biến môi trường bắt buộc có kiểm tra thiếu cấu hình.

Tham chiếu:

- [docs/security-rules.md](docs/security-rules.md)
- [docs/env-and-config.md](docs/env-and-config.md)

---

## 9. Cổng chất lượng trước merge

Cổng tối thiểu:

1. Lint pass.
2. Unit test pass.
3. Integration test pass cho phần bị ảnh hưởng.
4. Không giảm coverage dưới ngưỡng đã chốt.
5. Nếu thay đổi luồng chính: E2E liên quan phải pass.

---

## 10. Checklist khi tạo test mới

1. Tên test mô tả rõ hành vi mong đợi.
2. Có test nhánh thành công và ít nhất một nhánh lỗi.
3. Dữ liệu test dễ đọc, không phụ thuộc trạng thái bên ngoài.
4. Không trùng lặp với test đã có.
5. Có liên kết với flow hoặc contract tương ứng.

---

## 11. Ranh giới không trùng lặp

- Không thay thế danh mục issue; dùng [docs/known-issues.md](docs/known-issues.md).
- Không thay thế API contracts; dùng [docs/api-contracts.md](docs/api-contracts.md).
- Không thay thế coding style; dùng [docs/coding-conventions.md](docs/coding-conventions.md).

---

## 12. Tài liệu liên quan

- [docs/user-flows.md](docs/user-flows.md)
- [docs/api-contracts.md](docs/api-contracts.md)
- [docs/api-error-codes.md](docs/api-error-codes.md)
- [docs/known-issues.md](docs/known-issues.md)
- [docs/security-rules.md](docs/security-rules.md)
- [docs/coding-conventions.md](docs/coding-conventions.md)
