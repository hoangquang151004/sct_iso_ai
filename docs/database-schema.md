# Database Schema - SCT-ISO.AI

Tài liệu này mô tả schema theo đúng model hiện có trong code backend.

Nguồn chuẩn:

- `backend/database/models.py`

Ngày cập nhật: 2026-04-16.

---

## 1. Quy ước hiện tại

- Schema mặc định: `sct_iso`.
- Khóa chính của các bảng: `id` kiểu UUID.
- Tên khóa tổ chức hiện dùng nhất quán theo model là `org_id`.
- Nhiều bảng dùng `created_at`, một số bảng có thêm `updated_at`.
- Một số trường JSON dùng kiểu `JSONB`.

Lưu ý quan trọng:

- Tài liệu này phản ánh đúng code hiện tại, không ép theo thiết kế mục tiêu trong tương lai.

---

## 2. Nhóm người dùng

### organizations

| Cột        | Kiểu         | Ghi chú       |
| ---------- | ------------ | ------------- |
| id         | UUID         | Khóa chính    |
| name       | VARCHAR(255) | Bắt buộc      |
| code       | VARCHAR(50)  | Unique        |
| industry   | VARCHAR(100) | Tùy chọn      |
| address    | TEXT         | Tùy chọn      |
| phone      | VARCHAR(20)  | Tùy chọn      |
| email      | VARCHAR(100) | Tùy chọn      |
| logo_url   | TEXT         | Tùy chọn      |
| is_active  | BOOLEAN      | Mặc định true |
| created_at | TIMESTAMPTZ  |               |
| updated_at | TIMESTAMPTZ  |               |

### roles

| Cột         | Kiểu         | Ghi chú                |
| ----------- | ------------ | ---------------------- |
| id          | UUID         | Khóa chính             |
| org_id      | UUID         | FK -> organizations.id |
| name        | VARCHAR(100) | Bắt buộc               |
| description | TEXT         | Tùy chọn               |
| permissions | JSONB        | Mặc định `{}`          |
| is_system   | BOOLEAN      | Mặc định false         |
| created_at  | TIMESTAMPTZ  |                        |

### users

| Cột           | Kiểu         | Ghi chú                |
| ------------- | ------------ | ---------------------- |
| id            | UUID         | Khóa chính             |
| org_id        | UUID         | FK -> organizations.id |
| role_id       | UUID         | FK -> roles.id         |
| username      | VARCHAR(100) | Unique                 |
| email         | VARCHAR(150) | Unique                 |
| password_hash | TEXT         | Bắt buộc               |
| full_name     | VARCHAR(200) | Bắt buộc               |
| department    | VARCHAR(100) | Tùy chọn               |
| position      | VARCHAR(100) | Tùy chọn               |
| phone         | VARCHAR(20)  | Tùy chọn               |
| avatar_url    | TEXT         | Tùy chọn               |
| is_active     | BOOLEAN      | Mặc định true          |
| last_login    | TIMESTAMPTZ  | Tùy chọn               |
| created_at    | TIMESTAMPTZ  |                        |
| updated_at    | TIMESTAMPTZ  |                        |

### user_activity_logs

| Cột          | Kiểu         | Ghi chú        |
| ------------ | ------------ | -------------- |
| id           | UUID         | Khóa chính     |
| user_id      | UUID         | FK -> users.id |
| action       | VARCHAR(100) | Bắt buộc       |
| module       | VARCHAR(100) | Tùy chọn       |
| target_id    | UUID         | Tùy chọn       |
| target_table | VARCHAR(100) | Tùy chọn       |
| detail       | JSONB        | Tùy chọn       |
| ip_address   | INET         | Tùy chọn       |
| user_agent   | TEXT         | Tùy chọn       |
| created_at   | TIMESTAMPTZ  |                |

---

## 3. Nhóm tài liệu

### document_categories

| Cột         | Kiểu         | Ghi chú                |
| ----------- | ------------ | ---------------------- |
| id          | UUID         | Khóa chính             |
| org_id      | UUID         | FK -> organizations.id |
| name        | VARCHAR(200) | Bắt buộc               |
| code        | VARCHAR(50)  | Tùy chọn               |
| parent_id   | UUID         | FK tự tham chiếu       |
| standard    | VARCHAR(50)  | Tùy chọn               |
| department  | VARCHAR(100) | Tùy chọn               |
| description | TEXT         | Tùy chọn               |
| created_at  | TIMESTAMPTZ  |                        |

### documents

| Cột             | Kiểu         | Ghi chú                      |
| --------------- | ------------ | ---------------------------- |
| id              | UUID         | Khóa chính                   |
| org_id          | UUID         | FK -> organizations.id       |
| category_id     | UUID         | FK -> document_categories.id |
| doc_code        | VARCHAR(100) | Bắt buộc                     |
| title           | VARCHAR(500) | Bắt buộc                     |
| doc_type        | VARCHAR(50)  | Bắt buộc                     |
| current_version | VARCHAR(20)  | Mặc định `1.0`               |
| status          | VARCHAR(50)  | Mặc định `DRAFT`             |
| language        | VARCHAR(10)  | Mặc định `vi`                |
| department      | VARCHAR(100) | Tùy chọn                     |
| created_by      | UUID         | FK -> users.id               |
| approved_by     | UUID         | FK -> users.id               |
| approved_at     | TIMESTAMPTZ  | Tùy chọn                     |
| review_period   | INTEGER      | Mặc định 12                  |
| next_review_at  | TIMESTAMPTZ  | Tùy chọn                     |
| tags            | ARRAY(TEXT)  | Tùy chọn                     |
| ai_summary      | TEXT         | Tùy chọn                     |
| created_at      | TIMESTAMPTZ  |                              |
| updated_at      | TIMESTAMPTZ  |                              |

### document_versions

| Cột            | Kiểu        | Ghi chú            |
| -------------- | ----------- | ------------------ |
| id             | UUID        | Khóa chính         |
| document_id    | UUID        | FK -> documents.id |
| version        | VARCHAR(20) | Bắt buộc           |
| file_url       | TEXT        | Bắt buộc           |
| file_type      | VARCHAR(20) | Tùy chọn           |
| file_size      | BIGINT      | Tùy chọn           |
| change_summary | TEXT        | Tùy chọn           |
| change_reason  | TEXT        | Tùy chọn           |
| created_by     | UUID        | FK -> users.id     |
| created_at     | TIMESTAMPTZ |                    |

---

## 4. Nhóm HACCP

### products

| Cột         | Kiểu         | Ghi chú                |
| ----------- | ------------ | ---------------------- |
| id          | UUID         | Khóa chính             |
| org_id      | UUID         | FK -> organizations.id |
| name        | VARCHAR(255) | Bắt buộc               |
| code        | VARCHAR(100) | Unique, tùy chọn       |
| category    | VARCHAR(100) | Tùy chọn               |
| description | TEXT         | Tùy chọn               |
| is_active   | BOOLEAN      | Mặc định true          |
| created_at  | TIMESTAMPTZ  |                        |

### haccp_plans

| Cột         | Kiểu         | Ghi chú                |
| ----------- | ------------ | ---------------------- |
| id          | UUID         | Khóa chính             |
| org_id      | UUID         | FK -> organizations.id |
| product_id  | UUID         | FK -> products.id      |
| name        | VARCHAR(255) | Bắt buộc               |
| version     | VARCHAR(20)  | Mặc định `1.0`         |
| status      | VARCHAR(50)  | Mặc định `DRAFT`       |
| scope       | TEXT         | Tùy chọn               |
| created_by  | UUID         | FK -> users.id         |
| approved_by | UUID         | FK -> users.id         |
| approved_at | TIMESTAMPTZ  | Tùy chọn               |
| created_at  | TIMESTAMPTZ  |                        |
| updated_at  | TIMESTAMPTZ  |                        |

### process_steps

| Cột            | Kiểu         | Ghi chú              |
| -------------- | ------------ | -------------------- |
| id             | UUID         | Khóa chính           |
| haccp_plan_id  | UUID         | FK -> haccp_plans.id |
| step_order     | INTEGER      | Bắt buộc             |
| name           | VARCHAR(255) | Bắt buộc             |
| description    | TEXT         | Tùy chọn             |
| step_type      | VARCHAR(50)  | Tùy chọn             |
| is_ccp         | BOOLEAN      | Mặc định false       |
| parent_step_id | UUID         | FK tự tham chiếu     |
| created_at     | TIMESTAMPTZ  |                      |

### hazard_analyses

| Cột             | Kiểu         | Ghi chú                |
| --------------- | ------------ | ---------------------- |
| id              | UUID         | Khóa chính             |
| step_id         | UUID         | FK -> process_steps.id |
| hazard_type     | VARCHAR(50)  | Bắt buộc               |
| hazard_name     | VARCHAR(255) | Bắt buộc               |
| description     | TEXT         | Tùy chọn               |
| likelihood      | INTEGER      | Tùy chọn               |
| severity        | INTEGER      | Tùy chọn               |
| risk_score      | INTEGER      | Tùy chọn               |
| control_measure | TEXT         | Tùy chọn               |
| is_significant  | BOOLEAN      | Mặc định false         |
| ai_suggestion   | TEXT         | Tùy chọn               |
| created_at      | TIMESTAMPTZ  |                        |

### ccps

| Cột                    | Kiểu         | Ghi chú                  |
| ---------------------- | ------------ | ------------------------ |
| id                     | UUID         | Khóa chính               |
| haccp_plan_id          | UUID         | FK -> haccp_plans.id     |
| step_id                | UUID         | FK -> process_steps.id   |
| hazard_id              | UUID         | FK -> hazard_analyses.id |
| ccp_code               | VARCHAR(50)  | Bắt buộc                 |
| name                   | VARCHAR(255) | Bắt buộc                 |
| critical_limit         | TEXT         | Bắt buộc                 |
| monitoring_method      | VARCHAR(255) | Tùy chọn                 |
| monitoring_frequency   | VARCHAR(100) | Tùy chọn                 |
| monitoring_device      | VARCHAR(255) | Tùy chọn                 |
| responsible_user       | UUID         | FK -> users.id           |
| corrective_action      | TEXT         | Tùy chọn                 |
| verification_procedure | TEXT         | Tùy chọn                 |
| ai_suggestion          | TEXT         | Tùy chọn                 |
| created_at             | TIMESTAMPTZ  |                          |

### ccp_monitoring_logs

| Cột             | Kiểu          | Ghi chú        |
| --------------- | ------------- | -------------- |
| id              | UUID          | Khóa chính     |
| ccp_id          | UUID          | FK -> ccps.id  |
| batch_number    | VARCHAR(100)  | Tùy chọn       |
| shift           | VARCHAR(50)   | Tùy chọn       |
| measured_value  | NUMERIC(10,3) | Tùy chọn       |
| unit            | VARCHAR(20)   | Tùy chọn       |
| is_within_limit | BOOLEAN       | Tùy chọn       |
| deviation_note  | TEXT          | Tùy chọn       |
| recorded_by     | UUID          | FK -> users.id |
| recorded_at     | TIMESTAMPTZ   |                |
| verified_by     | UUID          | FK -> users.id |
| verified_at     | TIMESTAMPTZ   | Tùy chọn       |
| iot_device_id   | VARCHAR(100)  | Tùy chọn       |

---

## 5. Nhóm PRP

### prp_programs

| Cột          | Kiểu         | Ghi chú                |
| ------------ | ------------ | ---------------------- |
| id           | UUID         | Khóa chính             |
| org_id       | UUID         | FK -> organizations.id |
| name         | VARCHAR(255) | Bắt buộc               |
| code         | VARCHAR(50)  | Tùy chọn               |
| category     | VARCHAR(100) | Tùy chọn               |
| description  | TEXT         | Tùy chọn               |
| standard_ref | VARCHAR(100) | Tùy chọn               |
| is_active    | BOOLEAN      | Mặc định true          |
| created_at   | TIMESTAMPTZ  |                        |

### prp_audits

| Cột             | Kiểu         | Ghi chú                |
| --------------- | ------------ | ---------------------- |
| id              | UUID         | Khóa chính             |
| org_id          | UUID         | FK -> organizations.id |
| prp_program_id  | UUID         | FK -> prp_programs.id  |
| area            | VARCHAR(100) | Tùy chọn               |
| audit_date      | DATE         | Bắt buộc               |
| total_score     | NUMERIC(5,2) | Tùy chọn               |
| compliance_rate | NUMERIC(5,2) | Tùy chọn               |
| overall_result  | VARCHAR(50)  | Tùy chọn               |
| auditor_id      | UUID         | FK -> users.id         |
| created_at      | TIMESTAMPTZ  |                        |

---

## 6. Nhóm CAPA

### non_conformities

| Cột           | Kiểu         | Ghi chú                |
| ------------- | ------------ | ---------------------- |
| id            | UUID         | Khóa chính             |
| org_id        | UUID         | FK -> organizations.id |
| nc_code       | VARCHAR(100) | Tùy chọn               |
| source        | VARCHAR(50)  | Bắt buộc               |
| source_ref_id | UUID         | Tùy chọn               |
| title         | VARCHAR(500) | Bắt buộc               |
| description   | TEXT         | Tùy chọn               |
| severity      | VARCHAR(20)  | Bắt buộc               |
| status        | VARCHAR(50)  | Mặc định `OPEN`        |
| detected_by   | UUID         | FK -> users.id         |
| detected_at   | TIMESTAMPTZ  |                        |
| created_at    | TIMESTAMPTZ  |                        |

### capas

| Cột         | Kiểu         | Ghi chú                   |
| ----------- | ------------ | ------------------------- |
| id          | UUID         | Khóa chính                |
| org_id      | UUID         | FK -> organizations.id    |
| nc_id       | UUID         | FK -> non_conformities.id |
| capa_code   | VARCHAR(100) | Tùy chọn                  |
| title       | VARCHAR(500) | Bắt buộc                  |
| root_cause  | TEXT         | Tùy chọn                  |
| status      | VARCHAR(50)  | Mặc định `OPEN`           |
| due_date    | DATE         | Tùy chọn                  |
| assigned_to | UUID         | FK -> users.id            |
| created_at  | TIMESTAMPTZ  |                           |

---

## 7. Nhóm IoT và AI

### iot_devices

| Cột         | Kiểu         | Ghi chú                |
| ----------- | ------------ | ---------------------- |
| id          | UUID         | Khóa chính             |
| org_id      | UUID         | FK -> organizations.id |
| device_code | VARCHAR(100) | Unique                 |
| name        | VARCHAR(255) | Tùy chọn               |
| device_type | VARCHAR(100) | Tùy chọn               |
| location    | VARCHAR(255) | Tùy chọn               |
| is_active   | BOOLEAN      | Mặc định true          |
| last_seen   | TIMESTAMPTZ  | Tùy chọn               |
| created_at  | TIMESTAMPTZ  |                        |

### alerts

| Cột        | Kiểu         | Ghi chú                |
| ---------- | ------------ | ---------------------- |
| id         | UUID         | Khóa chính             |
| org_id     | UUID         | FK -> organizations.id |
| alert_type | VARCHAR(50)  | Bắt buộc               |
| severity   | VARCHAR(20)  | Bắt buộc               |
| title      | VARCHAR(500) | Bắt buộc               |
| message    | TEXT         | Tùy chọn               |
| status     | VARCHAR(50)  | Mặc định `OPEN`        |
| device_id  | UUID         | FK -> iot_devices.id   |
| created_at | TIMESTAMPTZ  |                        |

### ai_analysis_results

| Cột           | Kiểu         | Ghi chú                |
| ------------- | ------------ | ---------------------- |
| id            | UUID         | Khóa chính             |
| org_id        | UUID         | FK -> organizations.id |
| analysis_type | VARCHAR(100) | Bắt buộc               |
| input_data    | JSONB        | Tùy chọn               |
| result        | JSONB        | Tùy chọn               |
| insight_text  | TEXT         | Tùy chọn               |
| confidence    | NUMERIC(4,2) | Tùy chọn               |
| created_at    | TIMESTAMPTZ  |                        |

---

## 8. Nhóm lịch và báo cáo

### calendar_events

| Cột         | Kiểu         | Ghi chú                |
| ----------- | ------------ | ---------------------- |
| id          | UUID         | Khóa chính             |
| org_id      | UUID         | FK -> organizations.id |
| title       | VARCHAR(500) | Bắt buộc               |
| description | TEXT         | Tùy chọn               |
| event_type  | VARCHAR(100) | Bắt buộc               |
| start_time  | TIMESTAMPTZ  | Bắt buộc               |
| end_time    | TIMESTAMPTZ  | Tùy chọn               |
| status      | VARCHAR(50)  | Mặc định `SCHEDULED`   |
| assigned_to | UUID         | FK -> users.id         |
| created_at  | TIMESTAMPTZ  |                        |

### notification_logs

| Cột     | Kiểu         | Ghi chú                |
| ------- | ------------ | ---------------------- |
| id      | UUID         | Khóa chính             |
| org_id  | UUID         | FK -> organizations.id |
| user_id | UUID         | FK -> users.id         |
| channel | VARCHAR(20)  | Bắt buộc               |
| title   | VARCHAR(500) | Tùy chọn               |
| message | TEXT         | Tùy chọn               |
| is_read | BOOLEAN      | Mặc định false         |
| sent_at | TIMESTAMPTZ  |                        |

### kpi_snapshots

| Cột                       | Kiểu         | Ghi chú                |
| ------------------------- | ------------ | ---------------------- |
| id                        | UUID         | Khóa chính             |
| org_id                    | UUID         | FK -> organizations.id |
| snapshot_date             | DATE         | Bắt buộc               |
| period_type               | VARCHAR(20)  | Bắt buộc               |
| doc_total                 | INTEGER      | Tùy chọn               |
| haccp_deviation_count     | INTEGER      | Tùy chọn               |
| prp_audit_compliance_rate | NUMERIC(5,2) | Tùy chọn               |
| capa_open_count           | INTEGER      | Tùy chọn               |
| computed_at               | TIMESTAMPTZ  |                        |

---

## 9. Định hướng chuẩn hóa (roadmap)

Đây là các điểm nên chuẩn hóa trong giai đoạn tiếp theo:

1. Thống nhất tên khóa tổ chức giữa toàn bộ tầng dữ liệu (`org_id` hoặc `organization_id`).
2. Chuẩn hóa enum trạng thái theo cùng một kiểu chữ và tập giá trị.
3. Bổ sung migration script chính thức để quản lý thay đổi schema.
4. Bổ sung chỉ mục (index) theo truy vấn thực tế ở các bảng log và bảng nghiệp vụ lớn.
