from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ReportConfigBase(BaseModel):
    name: str
    report_type: str
    description: str | None = None
    schedule_type: str | None = None
    recipients: list[str] = []


class ReportConfigCreate(ReportConfigBase):
    org_id: UUID
    created_by: UUID


class ReportConfigResponse(ReportConfigBase):
    id: UUID
    org_id: UUID
    is_active: bool = True
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
