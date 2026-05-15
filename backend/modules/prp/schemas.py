from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


from enum import Enum

class PRPCategory(str, Enum):
    GHP_SSOP = "GHP/SSOP"
    GMP = "GMP"
    PEST_CONTROL = "Pest Control"
    MAINTENANCE_CALIBRATION = "Maintenance & Calibration"
    PERSONNEL_HYGIENE_TRAINING = "Personnel Hygiene & Training"


# Danh mục các điều khoản ISO 22000:2018 liên quan đến PRP
ISO22000_CLAUSES = {
    "8.2.4 (a)": "Xây dựng và bố trí nhà xưởng, các tiện ích liên quan",
    "8.2.4 (b)": "Bố trí mặt bằng khu vực làm việc và cơ sở vật chất",
    "8.2.4 (c)": "Cung cấp không khí, nước, năng lượng và các tiện ích khác",
    "8.2.4 (d)": "Kiểm soát sinh vật gây hại, xử lý chất thải",
    "8.2.4 (e)": "Sự phù hợp của thiết bị, vệ sinh và bảo trì",
    "8.2.4 (f)": "Quản lý vật tư đầu vào",
    "8.2.4 (g)": "Biện pháp ngăn ngừa nhiễm chéo",
    "8.2.4 (h)": "Vệ sinh và khử trùng",
    "8.2.4 (i)": "Vệ sinh cá nhân",
    "8.2.4 (j)": "Thông tin sản phẩm/nhận thức người tiêu dùng",
    "8.2.4 (k)": "Các vấn đề khác (Thu hồi sản phẩm, lưu kho...)",
}


class PRPProgramData(BaseModel):
    org_id: UUID
    name: str = Field(..., max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    category: PRPCategory = Field(..., description="Phân loại chương trình con của PRP")
    description: Optional[str] = None
    standard_ref: Optional[str] = Field(None, max_length=100)
    is_active: bool = True


class PRPProgramCreate(PRPProgramData):
    pass


class PRPProgramUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    standard_ref: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class PRPProgramResponse(PRPProgramData):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- LOCATION SCHEMAS (Minimalist) ---
class LocationResponse(BaseModel):
    id: UUID
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class PRPAuditData(BaseModel):
    org_id: UUID
    prp_program_id: Optional[UUID] = None
    area_id: Optional[UUID] = None  # Dùng ID từ bảng Location
    calendar_event_id: Optional[UUID] = None  # Liên kết với lịch
    audit_date: date
    total_score: Optional[float] = Field(None, ge=0)
    compliance_rate: Optional[float] = Field(None, ge=0, le=100)
    overall_result: Optional[str] = Field(None, max_length=50)
    auditor_id: Optional[UUID] = None


class PRPAuditCreate(PRPAuditData):
    pass


# --- CHECKLIST TEMPLATE SCHEMAS ---
class PRPChecklistTemplateBase(BaseModel):
    question_text: str = Field(..., description="Nội dung câu hỏi kiểm tra")
    answer_type: str = "BOOLEAN" # BOOLEAN, TEXT, NUMBER, SELECT
    options: Optional[dict] = None # Các lựa chọn cho SELECT
    target_value: Optional[float] = None # Giá trị mục tiêu cho kiểu NUMBER
    requirement: Optional[str] = None
    order_index: int = 0
    is_active: bool = True



class PRPChecklistTemplateCreate(PRPChecklistTemplateBase):
    prp_program_id: UUID
    location_id: Optional[UUID] = None
    document_id: Optional[UUID] = None


class PRPChecklistTemplateUpdate(BaseModel):
    question_text: Optional[str] = None
    answer_type: Optional[str] = None
    options: Optional[dict] = None
    target_value: Optional[float] = None
    requirement: Optional[str] = None
    order_index: Optional[int] = None
    is_active: Optional[bool] = None
    location_id: Optional[UUID] = None
    document_id: Optional[UUID] = None


class PRPChecklistTemplateResponse(PRPChecklistTemplateBase):
    id: UUID
    prp_program_id: UUID
    location_id: Optional[UUID] = None
    document_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- AUDIT DETAIL SCHEMAS ---
class PRPAuditDetailBase(BaseModel):
    checklist_id: UUID
    result: str  # Nội dung câu trả lời (linh hoạt)
    score: Optional[float] = None
    observation: Optional[str] = None
    evidence_url: Optional[str] = None
    create_nc: bool = False


class PRPAuditDetailCreate(PRPAuditDetailBase):
    pass


class PRPAuditDetailResponse(PRPAuditDetailBase):
    id: UUID
    audit_id: UUID
    checklist: Optional[PRPChecklistTemplateResponse] = None  # Thông tin câu hỏi

    model_config = ConfigDict(from_attributes=True)


class PRPAuditResponse(PRPAuditData):
    id: UUID
    created_at: datetime
    area: Optional[LocationResponse] = None  # Trả về object khu vực đầy đủ
    prp_program: Optional[PRPProgramResponse] = None  # Trả về object chương trình đầy đủ
    details: Optional[list[PRPAuditDetailResponse]] = None  # Bao gồm chi tiết kết quả

    model_config = ConfigDict(from_attributes=True)


# --- FULL AUDIT SCHEMA (Header + Details) ---
class PRPAuditFullCreate(BaseModel):
    audit_data: PRPAuditCreate
    details: list[PRPAuditDetailCreate]


class PRPNCRequest(BaseModel):
    org_id: UUID
    source_ref_id: UUID
    title: str
    description: Optional[str] = None
    severity: str = "MEDIUM"


# --- SCHEDULING SCHEMAS ---
class PRPScheduleFrequency(str, Enum):
    ONCE = "ONCE"
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"

class PRPScheduleRequest(BaseModel):
    org_id: UUID
    prp_program_id: UUID
    location_id: UUID
    assigned_to: Optional[UUID] = None
    start_date: date
    start_time: Optional[str] = Field(None, description="Giờ bắt đầu (HH:mm)")
    duration_minutes: int = Field(60, description="Thời gian thực hiện dự kiến (phút)")
    end_date: Optional[date] = None # Chỉ dùng cho lặp lại
    frequency: PRPScheduleFrequency = PRPScheduleFrequency.ONCE
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="0=Monday, 6=Sunday")
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    title: Optional[str] = None
    description: Optional[str] = None
