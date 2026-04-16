# AI Layer - SCT-ISO.AI

Tài liệu này chuẩn hóa cách thiết kế và tích hợp tầng AI cho hệ thống, bao gồm RAG flow, prompt template, guardrail, cách chọn model và fallback khi lỗi.

Ngày cập nhật: 2026-04-16.

---

## 1. Mục tiêu và phạm vi

- Định nghĩa kiến trúc AI ở mức hệ thống.
- Mô tả luồng dữ liệu AI từ đầu vào đến đầu ra.
- Cung cấp chuẩn để agent coding viết integration nhất quán.

Trạng thái hiện tại:

- Chưa có triển khai AI runtime trong backend hiện tại.
- Frontend mới ở mức mock cho phần analytics.

Roadmap:

- Pha 1: RAG và gợi ý cho tài liệu/CAPA.
- Pha 2: Anomaly detection và forecasting theo dữ liệu IoT.

---

## 2. Thành phần AI chính

1. Generative AI:

- Sinh gợi ý nội dung nghiệp vụ (SOP, CAPA action, checklist).

2. RAG:

- Tìm tài liệu liên quan từ kho tri thức trước khi gọi model sinh ngôn ngữ.

3. Anomaly Detection:

- Phát hiện bất thường trên dữ liệu giám sát theo thời gian.

4. Forecasting:

- Dự báo xu hướng ngắn hạn để cảnh báo sớm.

---

## 3. Use case AI theo module

| Module           | Use case                           | Đầu vào                          | Đầu ra                      |
| ---------------- | ---------------------------------- | -------------------------------- | --------------------------- |
| Document Control | Gợi ý dàn ý tài liệu               | Loại tài liệu, mục tiêu          | Dàn ý và khuyến nghị        |
| HACCP            | Gợi ý CCP hoặc cảnh báo lệch chuẩn | Kế hoạch HACCP, dữ liệu giám sát | Danh sách gợi ý/rủi ro      |
| PRP              | Gợi ý tối ưu checklist             | Kết quả audit lịch sử            | Checklist cải tiến          |
| CAPA             | Gợi ý hành động khắc phục          | NC, lịch sử CAPA                 | Danh sách hành động đề xuất |
| Reports          | Tóm tắt xu hướng                   | Dữ liệu kỳ báo cáo               | Insight và cảnh báo         |

---

## 4. RAG flow chuẩn

1. Nhận truy vấn từ người dùng hoặc tác vụ hệ thống.
2. Chuẩn hóa truy vấn (lọc nhiễu, chuẩn hóa ngôn ngữ).
3. Chuyển truy vấn thành embedding.
4. Truy xuất top-k tài liệu/chunk liên quan từ vector store.
5. Dựng prompt gồm system instruction + context + user query.
6. Gọi model sinh ngôn ngữ.
7. Áp dụng guardrail và hậu kiểm đầu ra.
8. Trả về kết quả có metadata nguồn tham chiếu.

Thông số mặc định đề xuất:

- Top-k: 3 đến 5.
- Nhiệt độ (temperature): thấp cho tác vụ compliance.
- Giới hạn token: theo năng lực model và yêu cầu latency.

---

## 5. Prompt template chuẩn

## 5.1 Mẫu system prompt

```text
Bạn là trợ lý chuyên gia ISO 22000/HACCP.
Chỉ trả lời dựa trên ngữ cảnh được cung cấp.
Nếu ngữ cảnh không đủ, hãy nói rõ thiếu dữ liệu và gợi ý bước tiếp theo.
Không bịa thông tin.
```

## 5.2 Mẫu user prompt cho CAPA

```text
Ngữ cảnh:
- NC: {nc_summary}
- Lịch sử CAPA liên quan: {history}
- Ràng buộc: {constraints}

Yêu cầu:
Đề xuất 3 hành động khắc phục và 3 hành động phòng ngừa,
ưu tiên hành động khả thi trong {timeline_days} ngày.
```

## 5.3 Mẫu user prompt cho HACCP

```text
Ngữ cảnh:
- Sản phẩm: {product}
- Công đoạn: {process_step}
- Dữ liệu giám sát gần nhất: {recent_logs}

Yêu cầu:
Xác định nguy cơ lệch chuẩn và đề xuất hành động theo mức ưu tiên.
```

---

## 6. Guardrail và an toàn đầu ra

1. Guardrail nội dung:

- Chặn nội dung không thuộc miền nghiệp vụ.
- Không đưa khuyến nghị vi phạm an toàn thực phẩm.

2. Guardrail dữ liệu:

- Không làm lộ dữ liệu nhạy cảm từ đầu vào.
- Không trả thông tin vượt phạm vi truy cập.

3. Guardrail vận hành:

- Giới hạn số lần retry khi model thất bại.
- Có timeout rõ cho từng loại request AI.

4. Guardrail truy vết:

- Lưu request_id và metadata phục vụ audit.

---

## 7. Cách chọn model

Nguyên tắc chọn model:

1. Ưu tiên độ tin cậy và truy vết được cho tác vụ compliance.
2. Cân bằng giữa chi phí, độ trễ và chất lượng.
3. Pin phiên bản model theo môi trường triển khai.

Bảng định hướng chọn model:

| Tác vụ                     | Ưu tiên                         | Gợi ý chọn                                 |
| -------------------------- | ------------------------------- | ------------------------------------------ |
| Sinh khuyến nghị nghiệp vụ | Độ chính xác + ổn định          | Model hội thoại chất lượng cao             |
| RAG trả lời có nguồn       | Đúng ngữ cảnh + kiểm soát       | Model hỗ trợ context dài, temperature thấp |
| Anomaly detection          | Độ nhạy + nhất quán             | Mô hình ML chuyên time-series              |
| Forecasting                | Độ ổn định theo chuỗi thời gian | Mô hình dự báo chuyên dụng                 |

---

## 8. Fallback khi lỗi

## 8.1 Fallback cấp model

- Nếu model chính lỗi timeout: chuyển model dự phòng.
- Nếu model dự phòng cũng lỗi: trả kết quả degrade mode.

## 8.2 Fallback cấp dữ liệu

- Nếu không truy xuất được context từ vector store:
  - Trả thông báo thiếu ngữ cảnh.
  - Đề xuất người dùng thu hẹp câu hỏi hoặc bổ sung dữ liệu.

## 8.3 Fallback cấp trải nghiệm người dùng

- Hiển thị trạng thái “AI tạm thời không sẵn sàng”.
- Cho phép retry thủ công.
- Ghi sự kiện để theo dõi reliability.

---

## 9. Integration points

Điểm tích hợp chính:

- Backend API orchestration: gọi dịch vụ AI và chuẩn hóa response.
- Frontend: gọi API AI qua lớp client chung, quản lý loading/error/success state.
- Data layer: lưu metadata truy vấn và kết quả để audit.
- Env config: đọc key/host từ [docs/env-and-config.md](docs/env-and-config.md).

Gợi ý endpoint roadmap:

- `/ai/chat`
- `/ai/suggest/capa`
- `/ai/suggest/checklist`

---

## 10. Chỉ số theo dõi chất lượng AI

1. Tỷ lệ phản hồi thành công theo request.
2. Thời gian phản hồi trung vị và p95.
3. Tỷ lệ fallback.
4. Tỷ lệ phản hồi bị guardrail chặn.
5. Mức độ hữu ích theo đánh giá người dùng.

---

## 11. Ranh giới không trùng lặp

- Không thay thế mô tả endpoint chi tiết; dùng [docs/api-contracts.md](docs/api-contracts.md).
- Không thay thế quy tắc bảo mật chung; dùng [docs/security-rules.md](docs/security-rules.md).
- Không thay thế chiến lược test; dùng [docs/testing-strategy.md](docs/testing-strategy.md).

---

## 12. Tài liệu liên quan

- [docs/architecture.md](docs/architecture.md)
- [docs/user-flows.md](docs/user-flows.md)
- [docs/api-contracts.md](docs/api-contracts.md)
- [docs/security-rules.md](docs/security-rules.md)
- [docs/env-and-config.md](docs/env-and-config.md)
- [docs/testing-strategy.md](docs/testing-strategy.md)
