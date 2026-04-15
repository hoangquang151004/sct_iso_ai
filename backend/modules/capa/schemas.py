from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CapaBase(BaseModel):
    nc_id: UUID
    title: str
    capa_type: str = "CORRECTIVE"
    root_cause: str | None = None
    due_date: date | None = None
    priority: str = "MEDIUM"


class CapaCreate(CapaBase):
    org_id: UUID
    created_by: UUID
    assigned_to: UUID | None = None


class CapaResponse(CapaBase):
    id: UUID
    org_id: UUID
    status: str = "OPEN"
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
