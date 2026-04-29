from datetime import date, datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class CAPAStatus(str, Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    VERIFYING = "VERIFYING"  # Bước chờ thẩm tra sau khi xử lý xong
    CLOSED = "CLOSED"
    REJECTED = "REJECTED"  # Nếu thẩm tra không đạt


class NCStatus(str, Enum):
    WAITING = "WAITING"
    OPEN = "OPEN"
    CLOSED = "CLOSED"


class CAPABase(BaseModel):
    org_id: UUID
    nc_id: Optional[UUID] = Field(
        None, description="ID của bản ghi lỗi gốc từ HACCP/PRP"
    )
    capa_code: Optional[str] = Field(None, max_length=100)
    title: str = Field(..., max_length=500)
    root_cause: Optional[str] = Field(None, description="Phân tích nguyên nhân gốc rễ")
    status: CAPAStatus = Field(default=CAPAStatus.OPEN)
    due_date: Optional[date] = None
    assigned_to: Optional[UUID] = None


class CAPACreate(CAPABase):
    pass


class CAPAUpdate(BaseModel):
    title: Optional[str] = None
    root_cause: Optional[str] = None
    status: Optional[CAPAStatus] = None
    due_date: Optional[date] = None
    assigned_to: Optional[UUID] = None


class NCUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[NCStatus] = None


class CAPAResponse(CAPABase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NonConformityResponse(BaseModel):
    id: UUID
    org_id: UUID
    nc_code: Optional[str] = None
    source: str
    source_ref_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    severity: str
    # DB / nghiệp vụ có thể mở rộng (đồng bộ với bảng non_conformities.status).
    status: str
    detected_by: Optional[UUID] = None
    detected_at: datetime
    created_at: datetime

    # Thông tin CAPA liên kết (nếu có)
    capa_id: Optional[UUID] = None
    capa_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Các schema cho Dashboard
class KPIResponse(BaseModel):
    total: int
    open: int
    in_progress: int
    verifying: int
    closed: int
    overdue: int
    source_distribution: dict[str, int] = {}


class KanbanBoardResponse(BaseModel):
    columns: dict[str, List[CAPAResponse]]
