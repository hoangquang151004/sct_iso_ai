from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PrpAuditBase(BaseModel):
    prp_program_id: UUID
    area: str
    audit_date: date
    notes: str | None = None


class PrpAuditCreate(PrpAuditBase):
    org_id: UUID
    auditor_id: UUID


class PrpAuditResponse(PrpAuditBase):
    id: UUID
    org_id: UUID
    overall_result: str | None = None
    compliance_rate: float | None = None

    model_config = ConfigDict(from_attributes=True)
