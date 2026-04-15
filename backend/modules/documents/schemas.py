from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    doc_code: str
    title: str
    doc_type: str
    category_id: UUID
    department: str | None = None
    review_period: int = 12


class DocumentCreate(DocumentBase):
    org_id: UUID
    created_by: UUID


class DocumentResponse(DocumentBase):
    id: UUID
    org_id: UUID
    current_version: str = "1.0"
    status: str = "DRAFT"
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
