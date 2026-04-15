# SCT-ISO.AI — Project Context (v2.0)

> Tài liệu nội bộ SCT. Phiên bản 2.0, cập nhật tháng 8/2025.  
> File này dùng để cung cấp context cho AI agent khi phát triển hệ thống SCT-ISO.AI.

---

## 1. Tổng quan dự án

**SCT-ISO.AI** là nền tảng quản lý chất lượng và an toàn thực phẩm tích hợp AI, hỗ trợ doanh nghiệp thực phẩm tuân thủ tiêu chuẩn **ISO 22000:2018** và **HACCP**. Hệ thống bao gồm ứng dụng Web, Mobile, tầng AI (GenAI + RAG + ML), cổng IoT, và các tích hợp bên ngoài.

**Mục tiêu chính:**

- Số hóa 100% tài liệu ISO và quy trình kiểm soát chất lượng
- Cảnh báo thời gian thực khi vượt ngưỡng CCP/PRP
- AI hỗ trợ soạn thảo tài liệu, phân tích bất thường, dự báo xu hướng
- Truy xuất nguồn gốc sản phẩm (Traceability) từ nguyên liệu đến vận chuyển

**Phạm vi người dùng:** 5.000 users, 500 MAU đồng thời, 10.000 bản ghi/giờ.

---

## 2. Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────┐
│                   Web Application                    │
│  (Document Control, HACCP, PRP, CAPA, Reports, IoT) │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                 Mobile Application                   │
│  (KPI, Checklist hiện trường, NC, AI Chat/Voice)    │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              AI Layer (GenAI + RAG + ML)             │
│  RAG ─ GenAI ─ Anomaly Detection ─ Forecasting      │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                  IoT Gateway                         │
│  MQTT/HTTP ─ Buffer ─ Mapping ─ Alerting            │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                   Data Layer                         │
│  PostgreSQL │ MongoDB (raw) │ Chroma (vector)        │
└─────────────────────────────────────────────────────┘
```

---

## 3. Modules — Web Application

### 3.1 Document Control (Quản lý tài liệu & phiên bản)

**Mục đích:** Số hóa và quản lý toàn bộ tài liệu ISO (Sổ tay chất lượng, SOP, WI, biểu mẫu).

**Chức năng chính:**

- CRUD tài liệu (DOCX/PDF/IMG) với metadata đầy đủ (mã tài liệu, phiên bản, người soạn, phòng ban)
- Phân loại theo tiêu chuẩn – phòng ban – quy trình (multi-tag)
- Version control: lưu lịch sử thay đổi, cho phép khôi phục bản cũ
- Workflow phê duyệt điện tử (duyệt/từ chối), audit log toàn bộ hành động
- Change log: ghi lại người chỉnh sửa, thời gian, lý do — lưu trữ ≥5 năm
- Full-text search kết hợp metadata, hỗ trợ tiếng Việt & tiếng Anh
- Lịch nhắc rà soát định kỳ, đồng bộ với lịch hệ thống
- Dashboard báo cáo trạng thái tài liệu (soạn thảo / chờ duyệt / đã duyệt / hết hạn)

**AI hỗ trợ:**

- Sinh dàn ý SOP theo ISO 22000:2018
- Phát hiện chồng chéo nội dung, từ vựng không chuẩn
- Gợi ý người duyệt phù hợp theo loại tài liệu
- Tóm tắt thay đổi tự động

**Tiêu chí hoàn thành:** 100% tài liệu ISO được số hóa; tìm kiếm thông minh; truy vết phiên bản đầy đủ.

---

### 3.2 HACCP

**Mục đích:** Xây dựng và quản lý kế hoạch HACCP theo ISO 22000:2018.

**Chức năng chính:**

- Tạo/chỉnh sửa sơ đồ quy trình (Process Flow) dạng drag & drop (editor BPMN)
- Phân tích mối nguy: sinh học, hóa học, vật lý — gán mức độ rủi ro và biện pháp kiểm soát
- Xác định CCP & Giới hạn tới hạn (Critical Limit — CL), có thể chọn từ thư viện mẫu
- Lập kế hoạch giám sát CCP (tần suất, phương pháp, thiết bị đo, người phụ trách)
- Form ghi nhận dữ liệu CCP theo ca/lô (nhập tay hoặc IoT), offline mobile
- Xác nhận – Thẩm tra – Thẩm định (ký số), theo chuẩn ISO 22000:2018
- Cảnh báo real-time khi vượt CL, gợi ý hành động khắc phục
- Báo cáo tuân thủ theo lô (xuất PDF/Excel/email)

**AI hỗ trợ:**

- Gợi ý CCP/CL tham chiếu theo sản phẩm/quy trình
- Phát hiện xu hướng lệch chuẩn
- Gợi ý cải tiến dựa trên dữ liệu nhiều lô

**Tiêu chí:** 100% CCP có giám sát; cảnh báo realtime; truy xuất lô thông minh với AI.

---

### 3.3 PRP Audit (Chương trình tiên quyết)

**Mục đích:** Quản lý và kiểm tra các chương trình tiên quyết (GHP/SSOP/5S...).

**Chức năng chính:**

- Thư viện checklist PRP: vệ sinh, kiểm soát côn trùng, nhà xưởng, nước/không khí, bảo trì, lưu kho — tùy chỉnh theo DN
- Lập lịch kiểm tra (ngày/tuần/tháng/quý), phân công người phụ trách, thông báo tự động
- Chấm điểm từng hạng mục, đính kèm ảnh/video minh chứng từ hiện trường (mobile offline)
- Theo dõi điểm không phù hợp (NC): phân loại mức độ, gắn nguyên nhân, liên kết CAPA
- Báo cáo PRP theo kỳ/khu vực (tháng, quý — xuất Excel/PDF, gửi email tự động)
- Phân tích & đề xuất cải tiến dựa trên lịch sử nhiều kỳ

**AI hỗ trợ:**

- Gợi ý câu hỏi checklist theo khu vực/ngành
- Tổng hợp phát hiện lặp lại
- Đề xuất trọng điểm kiểm tra kỳ sau (ML từ lịch sử)

**Tiêu chí:** Báo cáo PRP tự động theo tháng/quý.

---

### 3.4 CAPA (Corrective & Preventive Action)

**Mục đích:** Quản lý toàn bộ vòng đời hành động khắc phục và phòng ngừa.

**Nguồn NC đầu vào:** HACCP, PRP Audit, đánh giá nội bộ, khiếu nại khách hàng, SCAR (Supplier Corrective Action Request).

**Chức năng chính:**

- Tiếp nhận NC tự động, phân loại theo nguồn và mức độ
- Phân tích nguyên nhân gốc (RCA): 5 Why, Fishbone Diagram
- Lập kế hoạch CAPA: hành động khắc phục (CA) + phòng ngừa (PA), mốc thời gian
- Phân công nhân sự, đặt deadline, push notification (email/app)
- Theo dõi tiến độ trên bảng Kanban/Timeline (kéo thả task)
- Xác nhận hiệu lực sau khắc phục (Effectiveness Check)
- Đóng CAPA (chỉ đóng khi đã xác nhận đạt), lưu trữ theo chuẩn ISO

**Output:** Bảng Kanban CAPA, chỉ số on-time closure, hiệu quả CAPA.

**AI hỗ trợ:**

- Gợi ý hành động dựa trên lịch sử dữ liệu
- Cảnh báo CAPA sắp/quá hạn
- Đề xuất biện pháp phòng ngừa dài hạn

---

### 3.5 AI Phân tích dữ liệu & IoT Monitoring

**Mục đích:** Thu thập, xử lý và phân tích dữ liệu cảm biến thời gian thực.

**Chức năng chính:**

- Kết nối IoT qua MQTT broker hoặc HTTP API (nhiệt độ, độ ẩm, pH, áp suất, thời gian giữ nhiệt, v.v.)
- Lưu trữ tập trung: PostgreSQL (structured), MongoDB (raw), Chroma (vector data)
- Thiết lập ngưỡng (threshold/setpoint) theo dây chuyền/sản phẩm/tiêu chuẩn ISO 22000/HACCP
- Phân tích real-time & batch, bộ lọc đa điều kiện
- Cảnh báo đa kênh: Email / SMS / Zalo OA / App push; hỗ trợ escalation nhiều cấp
- Dashboard thời gian thực: thông số, cảnh báo, trạng thái thiết bị, hiệu suất dây chuyền (drill-down)
- Báo cáo định kỳ về tuân thủ và hiệu suất (xuất PDF/Excel, hỗ trợ chữ ký số)

**AI hỗ trợ:**

- Anomaly detection (phát hiện bất thường)
- Forecast xu hướng (1h/24h tiếp theo) — mô hình Mistral hoặc Prophet
- Đề xuất điều chỉnh setpoint

---

### 3.6 Báo cáo tổng hợp (Analytics & Reporting)

**Chức năng chính:**

- KPI tuân thủ: PRP đúng hạn, HACCP giám sát đủ, CAPA on-time closure
- OEE / Quality Yield (tùy chọn, kết nối IoT)
- Báo cáo đánh giá nội bộ ISO 22000 (filter theo kỳ/khu vực)
- Export PDF/Excel (tự động chèn logo, chữ ký số)
- Lịch gửi báo cáo tự động (ngày/tuần/tháng) qua Email hoặc Zalo OA
- Role-based dashboard: Lãnh đạo (KPI overview) / QA-QC (tuân thủ & chất lượng) / ISO Manager (toàn bộ)
- Drill-down: click KPI → xem chi tiết theo lô/khu vực/thiết bị

---

### 3.7 Quản lý người dùng & Bảo mật

**Phân quyền (RBAC):** Admin, ISO Manager, QA/QC, Auditor, User — có thể tạo role tùy chỉnh.

**Xác thực:**

- OAuth2/OIDC
- 2FA/MFA qua OTP (SMS/Email/Auth App)
- Cảnh báo login bất thường (IP/thiết bị lạ)

**Bảo mật dữ liệu:**

- TLS 1.3 cho dữ liệu truyền tải (client ↔ server ↔ IoT gateway)
- AES-256 cho dữ liệu lưu trữ (at rest)
- Quản lý khóa qua KMS
- Audit log bất biến (không thể sửa/xóa): timestamp, IP, user, action
- Chính sách mật khẩu chuẩn (độ dài, ký tự đặc biệt, thời gian hết hạn)

**Tuân thủ:**

- Phạm vi dữ liệu theo site/line (RBAC/ABAC)
- Backup/DR, thời gian lưu trữ hồ sơ theo ISO
- Dữ liệu AI: tách riêng, không dùng để huấn luyện chung; xóa theo yêu cầu

---

### 3.8 Lịch & Nhắc việc tự động

**Loại lịch quản lý:**

- PRP Audit (tuần/tháng/quý)
- HACCP Review định kỳ
- Đào tạo nhân viên (ATVSTP, ISO 22000, HACCP, PRP) — có điểm danh
- Hiệu chuẩn thiết bị đo lường & cảm biến IoT

**Tính năng:**

- Nhắc trước hạn qua Email/SMS/Zalo OA
- Tái lập lịch tự động khi thay đổi ca/khu vực
- Đồng bộ với hệ thống chấm công/ERP
- Dashboard lịch theo tuần/tháng (filter theo loại lịch, khu vực)
- AI điều chỉnh thời điểm nhắc tối ưu theo hành vi người dùng

---

## 4. Modules — Mobile Application

| Module                      | Chức năng chính                                                                    | Tiêu chí                                        |
| --------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Trang chủ & KPI**         | Thẻ KPI PRP/HACCP/CAPA, biểu đồ donut/line, cảnh báo gần nhất, công việc hôm nay   | Tối ưu one-hand use                             |
| **Tra cứu tài liệu**        | Tải trước SOP/WI theo khu vực, tìm kiếm NLP tiếng Việt, hiển thị ảnh/video         | Đồng bộ nền, offline version control            |
| **PRP & HACCP hiện trường** | Checklist PRP động (ảnh/GPS/ghi âm/ký nhận), ghi CCP theo ca, scan QR, e-signature | Nhanh, chống nhập trùng, nén ảnh tự động        |
| **NC & CAPA di động**       | Tạo NC từ hiện trường, đính kèm ảnh/video, chọn mức độ, gán người xử lý, đóng CAPA | Tạo NC < 120s, push notification ngay lập tức   |
| **Cảnh báo thời gian thực** | Push khi KPI vượt ngưỡng, lịch đến hạn, CAPA quá hạn; chế độ im lặng theo ca       | —                                               |
| **Trợ lý AI (chat/voice)**  | Hỏi đáp quy trình, gợi ý xử lý sự cố theo SOP/HACCP, TTS/ASR cho ca sản xuất       | Phản hồi có caching, RAG kèm trích dẫn tài liệu |
| **Nhiệm vụ & Phê duyệt**    | Todo CAPA/PRP/HACCP, phê duyệt tài liệu/biểu mẫu, xác nhận hoàn thành              | Lưu log đầy đủ                                  |

---

## 5. Tầng AI (Generative AI + RAG + ML)

### 5.1 RAG (Retrieval-Augmented Generation)

- Kết nối kho tài liệu ISO để trả lời có trích dẫn nguồn
- Kiểm soát miền kiến thức (domain-scoped)
- Vector store: **Chroma**

### 5.2 GenAI Soạn tài liệu

- Gợi ý cấu trúc SOP/WI/phân công
- Kiểm tra ngôn ngữ và nhất quán thuật ngữ ISO

### 5.3 Phân tích & Dự báo (ML)

- **Anomaly detection:** phát hiện bất thường dữ liệu chuỗi thời gian
- **Forecast xu hướng CCP:** mô hình Mistral hoặc Prophet
- **Khuyến nghị setpoint/hành động**

### 5.4 Tự động hóa báo cáo

- Tóm tắt kết quả PRP/HACCP theo ngày/tuần/tháng
- Sinh báo cáo đánh giá nội bộ theo mẫu

### 5.5 Guardrails & Kiểm duyệt

- Giới hạn miền (domain restriction)
- Từ khóa cấm
- Kiểm soát PII
- Log hội thoại để audit

**KPI AI:** Độ chính xác gợi ý ≥85% theo đánh giá người dùng.

---

## 6. Cổng kết nối IoT

| Thành phần    | Chi tiết                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------- |
| **Ingestion** | MQTT/HTTP, batch & streaming, buffer cục bộ khi mất mạng, retry queue                         |
| **Bảo mật**   | TLS cho kết nối IoT                                                                           |
| **Mapping**   | Cảm biến ↔ Thiết bị ↔ Công đoạn ↔ CCP; tự động kế thừa ngưỡng theo sản phẩm                   |
| **Alerting**  | Rule-based + anomaly detection; ngưỡng động theo thời gian/ca; playbook phản ứng liên kết SOP |
| **Cấu hình**  | UI-based (không cần code); audit cảnh báo đầy đủ                                              |

---

## 7. Truy xuất nguồn gốc (Product Traceability)

### Web App

- Gắn mã QR, barcode hoặc RFID cho từng lô sản phẩm
- Lưu thông tin từng khâu: nguyên liệu → sản xuất → đóng gói → vận chuyển
- Liên kết dữ liệu PRP, HACCP, CAPA vào hồ sơ lô hàng

### Mobile App

- Quét QR để xem nguồn gốc sản phẩm (nhân viên & khách hàng)
- Cảnh báo nếu sản phẩm thuộc lô đã bị thu hồi hoặc không đạt chuẩn

### IoT & AI

- IoT ghi thông số môi trường bảo quản suốt vòng đời sản phẩm
- AI phát hiện bất thường trong chuỗi cung ứng

### Kết nối bên ngoài

- API kết nối với hệ thống truy xuất nguồn gốc quốc gia hoặc quốc tế
- Đảm bảo tính minh bạch, chống giả mạo

---

## 8. Tích hợp & Mở rộng

| Loại tích hợp   | Chi tiết                                                       |
| --------------- | -------------------------------------------------------------- |
| **API**         | OpenAPI/Swagger, webhooks, SDK client                          |
| **ERP/MES/WMS** | Tích hợp đấu nối                                               |
| **HRM**         | Đào tạo, thi chứng chỉ                                         |
| **DMS**         | SharePoint, Google Drive                                       |
| **BI**          | Power BI, Metabase; xuất CSV/Parquet; lịch ETL                 |
| **Zalo OA**     | Cảnh báo, báo cáo tự động                                      |
| **Ngôn ngữ**    | Tiếng Việt & Tiếng Anh; chuẩn hóa thuật ngữ ISO; đổi đơn vị đo |

---

## 9. Hạ tầng & Triển khai

| Thành phần       | Chi tiết                                                       |
| ---------------- | -------------------------------------------------------------- |
| **Triển khai**   | Cloud / VPS / On-premise                                       |
| **Container**    | Docker / Kubernetes                                            |
| **Pipeline**     | CI/CD: dev → staging → prod                                    |
| **Database**     | PostgreSQL (primary), MongoDB (raw IoT), Chroma (vector/RAG)   |
| **Caching**      | Hỗ trợ CQRS read/write pattern                                 |
| **Search index** | Full-text search có hỗ trợ tiếng Việt                          |
| **Media**        | Nén ảnh/video tự động, CDN                                     |
| **Monitoring**   | Prometheus + Grafana (metrics), ELK/OpenSearch (log tập trung) |
| **Alerting SRE** | Alert khi vi phạm SLA/SLO                                      |

---

## 10. Vai trò người dùng (RBAC)

| Role            | Quyền truy cập                                                |
| --------------- | ------------------------------------------------------------- |
| **Admin**       | Toàn bộ hệ thống, quản lý user, cấu hình hệ thống             |
| **ISO Manager** | Toàn bộ module ISO: tài liệu, HACCP, PRP, CAPA, báo cáo       |
| **QA/QC**       | Tuân thủ, chất lượng, giám sát CCP, NC & CAPA                 |
| **Auditor**     | Xem và đánh giá, không chỉnh sửa dữ liệu sản xuất             |
| **User**        | Truy cập module được phân quyền, ghi nhận dữ liệu hiện trường |

---

## 11. Thuật ngữ chuyên ngành

| Thuật ngữ   | Giải thích                                       |
| ----------- | ------------------------------------------------ |
| **HACCP**   | Hazard Analysis and Critical Control Points      |
| **CCP**     | Critical Control Point — Điểm kiểm soát tới hạn  |
| **CL**      | Critical Limit — Giới hạn tới hạn                |
| **PRP**     | Prerequisite Programme — Chương trình tiên quyết |
| **GHP**     | Good Hygiene Practice                            |
| **SSOP**    | Sanitation Standard Operating Procedure          |
| **CAPA**    | Corrective Action and Preventive Action          |
| **NC**      | Non-Conformity — Điểm không phù hợp              |
| **SCAR**    | Supplier Corrective Action Request               |
| **RCA**     | Root Cause Analysis — Phân tích nguyên nhân gốc  |
| **SOP**     | Standard Operating Procedure                     |
| **WI**      | Work Instruction                                 |
| **OEE**     | Overall Equipment Effectiveness                  |
| **RAG**     | Retrieval-Augmented Generation                   |
| **RBAC**    | Role-Based Access Control                        |
| **ABAC**    | Attribute-Based Access Control                   |
| **TTS/ASR** | Text-to-Speech / Automatic Speech Recognition    |
| **KMS**     | Key Management System                            |

---

## 12. Quy tắc nghiệp vụ quan trọng

1. **Phê duyệt tài liệu:** Tài liệu chỉ được phát hành khi đã qua toàn bộ workflow phê duyệt. Mọi hành động đều phải ghi vào audit log.
2. **Đóng CAPA:** Chỉ được đóng sau khi Effectiveness Check xác nhận đạt yêu cầu.
3. **CCP:** 100% CCP phải có giám sát; cảnh báo bắt buộc khi vượt CL.
4. **Lưu trữ hồ sơ:** Change log và audit log tối thiểu 5 năm; log không thể sửa/xóa.
5. **Offline-first (Mobile):** Ứng dụng mobile phải hoạt động offline, đồng bộ khi có mạng.
6. **Bảo mật AI:** Dữ liệu khách hàng không được dùng để huấn luyện mô hình chung.
7. **Phân quyền tối thiểu:** Mỗi user chỉ được truy cập đúng phạm vi vai trò.
8. **Traceability:** Mọi lô sản phẩm phải có đầy đủ chuỗi dữ liệu PRP + HACCP + CAPA.
