from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HaccpPlanBase(BaseModel):
    product_id: UUID
    name: str
    version: str = "1.0"
    scope: str | None = None


class HaccpPlanCreate(HaccpPlanBase):
    org_id: UUID
    created_by: UUID


class HaccpPlanResponse(HaccpPlanBase):
    id: UUID
    org_id: UUID
    status: str = "DRAFT"
    approved_by: UUID | None = None
    approved_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
