# User Flows - SCT-ISO.AI

Tài liệu này mô tả luồng người dùng theo role, tập trung vào trước-sau hành động, decision points, trạng thái lỗi và kết quả mong đợi để hỗ trợ agent viết UI + API orchestration đúng nghiệp vụ.

Ngày cập nhật: 2026-04-16.

---

## 1. Mục tiêu và phạm vi

- Mô tả hành vi người dùng theo ngữ cảnh nghiệp vụ.
- Xác định rõ các bước chính và nhánh xử lý khi thành công hoặc lỗi.
- Làm cầu nối giữa màn hình frontend và endpoint backend.

Trạng thái hiện tại:

- Frontend đang dùng mock data cho phần lớn luồng.
- Backend có endpoint khung theo module, chưa đầy đủ workflow chi tiết.

---

## 2. Vai trò và mục tiêu chính

| Vai trò     | Mục tiêu chính                                      | Màn hình thường dùng              |
| ----------- | --------------------------------------------------- | --------------------------------- |
| Admin       | Quản trị user, cấu hình hệ thống, giám sát tổng thể | User Management, Reports          |
| ISO Manager | Duyệt tài liệu, giám sát tuân thủ ISO               | Document Control, Reports         |
| QA/QC       | Theo dõi HACCP, PRP, CAPA                           | HACCP Compliance, PRP Audit, CAPA |
| Auditor     | Đánh giá kết quả và truy xuất bằng chứng            | Reports, Document Control         |
| Field User  | Nhập dữ liệu hiện trường và theo dõi cảnh báo       | PRP Audit, AI Analytics           |

---

## 3. Quy ước đọc flow

- Tiền điều kiện: điều kiện cần có trước khi bắt đầu luồng.
- Luồng chính: chuỗi bước chuẩn.
- Nhánh lỗi: xử lý khi điều kiện không thỏa hoặc API trả lỗi.
- Kết quả: trạng thái dữ liệu và UI sau cùng.

---

## 3.1 Ma trận đối soát module và API

| Module UI        | Endpoint hiện có trong API                  | Mức khớp hiện tại | Ghi chú                                          |
| ---------------- | ------------------------------------------- | ----------------- | ------------------------------------------------ |
| Dashboard        | Chưa có endpoint dashboard chuyên biệt      | Trung bình        | Đang tổng hợp từ dữ liệu module khác hoặc mock   |
| Document Control | `/documents` (GET, POST, GET by id)         | Cao               | Workflow submit/approve vẫn là roadmap           |
| HACCP            | `/haccp/plans` (GET, POST, GET by id)       | Trung bình        | Steps/hazards/CCP/monitoring chi tiết là roadmap |
| PRP Audit        | `/prp/audits` (GET, POST, GET by id)        | Trung bình        | Upload bằng chứng và checklist sâu là roadmap    |
| CAPA             | `/capa` (GET, POST, GET by id)              | Trung bình        | Chuyển trạng thái/đóng CAPA là roadmap           |
| Reports          | `/reports/configs` (GET, POST, GET by id)   | Trung bình        | Export file báo cáo là roadmap                   |
| User Management  | `/users` (GET, POST, GET by id)             | Trung bình        | Cập nhật user là roadmap                         |
| AI Analytics     | Chưa có endpoint AI triển khai thật         | Thấp              | Endpoint AI nằm trong roadmap                    |
| Scheduling       | `/scheduling/events` (GET, POST, GET by id) | Cao               | Đã có API khung, cần bổ sung UI flow đầy đủ      |

---

## 4. Flow theo module

## 4.1 Dashboard

Tiền điều kiện:

- Người dùng đã vào hệ thống.

Luồng chính:

1. Mở trang dashboard.
2. Tải KPI tổng hợp và thông tin cảnh báo gần nhất.
3. Hiển thị biểu đồ xu hướng và các công việc cần xử lý.

Nhánh lỗi:

- Không tải được dữ liệu: hiển thị trạng thái lỗi + cho phép thử lại.

Kết quả:

- Người dùng có bức tranh tổng quan trước khi đi vào module chi tiết.

## 4.2 Document Control

Tiền điều kiện:

- Người dùng có quyền xem/tạo tài liệu.

Luồng chính:

1. Vào danh sách tài liệu.
2. Lọc hoặc tìm theo mã, trạng thái, loại tài liệu.
3. Tạo tài liệu mới hoặc mở chi tiết tài liệu hiện có.
4. Chỉnh metadata và gửi luồng duyệt (khi workflow được triển khai).

Nhánh lỗi:

- Mã tài liệu trùng: hiển thị thông báo lỗi business.
- Không đủ quyền duyệt: trả lỗi phân quyền và giữ trạng thái hiện tại.

Kết quả:

- Tài liệu được tạo/cập nhật hoặc được đánh dấu chờ duyệt theo workflow.

## 4.3 HACCP

Tiền điều kiện:

- Có sản phẩm hoặc kế hoạch HACCP đang hoạt động.

Luồng chính:

1. Mở danh sách kế hoạch HACCP.
2. Chọn kế hoạch và xem công đoạn, mối nguy, CCP.
3. Thêm hoặc cập nhật thông tin giám sát theo kế hoạch.
4. Theo dõi kết quả và cảnh báo vượt ngưỡng (khi realtime bật).

Nhánh lỗi:

- Kế hoạch không tồn tại hoặc không truy cập được.
- Dữ liệu đo không hợp lệ theo quy tắc nghiệp vụ.

Kết quả:

- Kế hoạch HACCP được theo dõi liên tục và có dữ liệu phục vụ báo cáo.

## 4.4 PRP Audit

Tiền điều kiện:

- Có chương trình PRP và lịch audit.

Luồng chính:

1. Mở danh sách audit.
2. Chọn audit cần thực hiện.
3. Điền checklist, ghi chú, bằng chứng.
4. Hoàn tất và lưu kết quả.

Nhánh lỗi:

- Thiếu trường bắt buộc trong checklist.
- Upload bằng chứng lỗi.

Kết quả:

- Kết quả audit được ghi nhận, sẵn sàng liên kết CAPA nếu có NC.

## 4.5 CAPA

Tiền điều kiện:

- Có non-conformity hoặc đầu vào cần hành động khắc phục.

Luồng chính:

1. Mở danh sách CAPA.
2. Tạo CAPA mới từ NC hoặc tạo thủ công.
3. Cập nhật nguyên nhân gốc, hành động, deadline.
4. Theo dõi tiến độ và chuyển trạng thái.
5. Đóng CAPA khi đủ điều kiện hiệu lực.

Nhánh lỗi:

- Chuyển trạng thái không hợp lệ.
- Đóng CAPA khi thiếu bằng chứng hiệu lực.

Kết quả:

- CAPA đi qua vòng đời có kiểm soát và truy vết được.

## 4.6 Reports

Tiền điều kiện:

- Dữ liệu nghiệp vụ đã có trong kỳ báo cáo.

Luồng chính:

1. Chọn loại báo cáo.
2. Chọn phạm vi thời gian và bộ lọc.
3. Xem trước dữ liệu tổng hợp.
4. Xuất báo cáo hoặc lưu cấu hình lịch (khi triển khai).

Nhánh lỗi:

- Bộ lọc không hợp lệ.
- Lỗi sinh file export.

Kết quả:

- Người dùng nhận báo cáo đúng ngữ cảnh quản trị.

## 4.7 User Management

Tiền điều kiện:

- Người dùng có quyền quản trị user.

Luồng chính:

1. Mở danh sách người dùng.
2. Tạo user mới với role phù hợp.
3. Xem chi tiết user.
4. Cập nhật thông tin user (khi endpoint cập nhật được triển khai).

Nhánh lỗi:

- Email trùng hoặc role không hợp lệ.
- Không đủ quyền thao tác.

Kết quả:

- Thông tin user nhất quán theo quyền và phạm vi tổ chức.

## 4.8 AI Analytics

Tiền điều kiện:

- Có dữ liệu đầu vào cho phân tích.

Luồng chính:

1. Vào trang AI Analytics.
2. Chọn loại phân tích hoặc truy vấn.
3. Nhận kết quả gợi ý/cảnh báo.
4. Quyết định hành động tiếp theo ở module liên quan.

Nhánh lỗi:

- Dữ liệu không đủ cho phân tích.
- Lỗi dịch vụ AI hoặc quá thời gian phản hồi.

Kết quả:

- Người dùng có insight để ra quyết định nhanh hơn.

Lưu ý trạng thái API:

- Chưa có endpoint AI triển khai thật trong backend hiện tại.
- Luồng này đang phụ thuộc mock data và roadmap `/ai/...`.

## 4.9 Scheduling

Tiền điều kiện:

- Người dùng có quyền xem hoặc tạo lịch sự kiện.

Luồng chính:

1. Mở danh sách sự kiện theo kỳ thời gian.
2. Tạo sự kiện mới.
3. Mở chi tiết sự kiện để kiểm tra thông tin.

Nhánh lỗi:

- Dữ liệu thời gian không hợp lệ.
- Không đủ quyền tạo sự kiện.

Kết quả:

- Lịch sự kiện được ghi nhận nhất quán cho các hoạt động kiểm tra và nhắc việc.

---

## 5. Luồng phối hợp liên module

1. PRP hoặc HACCP phát hiện vấn đề -> tạo đầu vào cho CAPA.
2. Kết quả CAPA cập nhật trạng thái tuân thủ -> phản ánh lên dashboard/reports.
3. AI gợi ý từ dữ liệu lịch sử -> hỗ trợ quyết định ở HACCP/PRP/CAPA.

## 5.1 Quy tắc đồng bộ flow với testing

1. Mỗi flow ở mục 4 phải có ánh xạ test tương ứng trong [docs/testing-strategy.md](docs/testing-strategy.md) mục 6.1.
2. Flow có endpoint đã triển khai phải có integration test API cho nhánh thành công và lỗi chính.
3. Flow đang roadmap hoặc còn mock data phải có test fallback, không được bỏ trống nhánh lỗi.
4. Khi thêm flow module mới, cập nhật đồng thời:

- [docs/testing-strategy.md](docs/testing-strategy.md)
- [docs/api-contracts.md](docs/api-contracts.md)

---

## 6. Ranh giới không trùng lặp

- Không mô tả chi tiết schema request/response; tham chiếu [docs/api-contracts.md](docs/api-contracts.md).
- Không mô tả cấu trúc bảng dữ liệu; tham chiếu [docs/database-schema.md](docs/database-schema.md).
- Không mô tả chính sách bảo mật chi tiết; tham chiếu [docs/security-rules.md](docs/security-rules.md).

---

## 7. Tiêu chí đủ tốt cho agent coding

1. Mỗi flow có tiền điều kiện, luồng chính, nhánh lỗi và kết quả.
2. Mỗi flow chỉ rõ vai trò chính thực hiện.
3. Có ít nhất một điểm liên kết liên module trong mỗi flow nghiệp vụ chính.
4. Ngôn ngữ mô tả đủ cụ thể để chuyển thành xử lý UI state và API orchestration.

---

## 8. Tài liệu liên quan

- [docs/architecture.md](docs/architecture.md)
- [docs/api-contracts.md](docs/api-contracts.md)
- [docs/known-issues.md](docs/known-issues.md)
- [docs/ai-layer.md](docs/ai-layer.md)
- [docs/testing-strategy.md](docs/testing-strategy.md)
