from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

class PRPProgramData(BaseModel):
    org_id: UUID
    name: str = Field(..., max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=100)
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


class PRPAuditData(BaseModel):
    org_id: UUID
    prp_program_id: Optional[UUID] = None
    area: Optional[str] = Field(None, max_length=100)
    audit_date: date
    total_score: Optional[float] = Field(None, ge=0)
    compliance_rate: Optional[float] = Field(None, ge=0, le=100)
    overall_result: Optional[str] = Field(None, max_length=50)
    auditor_id: Optional[UUID] = None


class PRPAuditCreate(PRPAuditData):
    pass


class PRPAuditUpdate(BaseModel):
    prp_program_id: Optional[UUID] = None
    area: Optional[str] = Field(None, max_length=100)
    audit_date: Optional[date] = None
    total_score: Optional[float] = Field(None, ge=0)
    compliance_rate: Optional[float] = Field(None, ge=0, le=100)
    overall_result: Optional[str] = Field(None, max_length=50)
    auditor_id: Optional[UUID] = None


class PRPAuditResponse(PRPAuditData):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
