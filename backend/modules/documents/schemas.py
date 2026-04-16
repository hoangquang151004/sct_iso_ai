from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class DocumentCategoryBase(BaseModel):
    name: str
    code: str | None = None
    parent_id: UUID | None = None
    standard: str | None = None
    department: str | None = None
    description: str | None = None


class DocumentCategoryCreate(DocumentCategoryBase):
    org_id: UUID


class DocumentCategoryResponse(DocumentCategoryBase):
    id: UUID
    org_id: UUID
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentBase(BaseModel):
    category_id: UUID
    doc_code: str
    title: str
    doc_type: str
    language: str = "vi"
    department: str | None = None
    review_period: int = 12
    tags: list[str] = Field(default_factory=list)
    ai_summary: str | None = None


class DocumentCreate(DocumentBase):
    org_id: UUID
    created_by: UUID


class DocumentUpdate(BaseModel):
    category_id: UUID | None = None
    title: str | None = None
    status: str | None = None
    department: str | None = None
    review_period: int | None = None
    next_review_at: datetime | None = None
    tags: list[str] | None = None
    ai_summary: str | None = None
    approved_by: UUID | None = None
    approved_at: datetime | None = None


class DocumentResponse(DocumentBase):
    id: UUID
    org_id: UUID
    created_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    current_version: str = "1.0"
    status: str = "DRAFT"
    next_review_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentVersionBase(BaseModel):
    version: str
    file_url: str
    file_type: str | None = None
    file_size: int | None = None
    change_summary: str | None = None
    change_reason: str | None = None


class DocumentVersionCreate(DocumentVersionBase):
    created_by: UUID


class DocumentVersionResponse(DocumentVersionBase):
    id: UUID
    document_id: UUID
    created_by: UUID
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentApprovalBase(BaseModel):
    approver_id: UUID
    step_order: int = 1
    status: str = "PENDING"
    comment: str | None = None


class DocumentApprovalCreate(DocumentApprovalBase):
    version_id: UUID


class DocumentApprovalResponse(DocumentApprovalBase):
    id: UUID
    document_id: UUID
    version_id: UUID
    approved_at: datetime | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DocumentChangeLogCreate(BaseModel):
    version_from: str | None = None
    version_to: str | None = None
    changed_by: UUID
    change_type: str
    change_detail: str | None = None
    ai_change_summary: str | None = None


class DocumentChangeLogResponse(DocumentChangeLogCreate):
    id: UUID
    document_id: UUID
    changed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
