from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator


def _dt_to_utc_iso_z(value: datetime | None) -> str | None:
    """Luôn xuất JSON dạng UTC kèm Z — tránh client hiểu nhầm offset +07."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    u = value.astimezone(timezone.utc)
    return u.strftime("%Y-%m-%dT%H:%M:%S") + "Z"


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

    @field_serializer("created_at")
    def _ser_cat_created_at(self, v: datetime | None) -> str | None:
        return _dt_to_utc_iso_z(v)


class DocumentBase(BaseModel):
    category_id: UUID | None = None
    doc_code: str
    title: str
    doc_type: str
    language: str = "vi"
    department: str | None = None
    review_period: int = 12
    tags: list[str] = Field(default_factory=list)
    ai_summary: str | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def _tags_db_null_to_list(cls, v: object) -> list[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(x) for x in v]
        return []


class DocumentCreate(BaseModel):
    """Payload tạo tài liệu (API): không có danh mục và mã — server tự gán."""

    org_id: UUID
    created_by: UUID
    title: str
    doc_type: str
    language: str = "vi"
    department: str | None = None
    review_period: int = 12
    initial_version: str = "1.0"
    tags: list[str] = Field(default_factory=list)
    ai_summary: str | None = None


class DocumentUpdate(BaseModel):
    category_id: UUID | None = None
    title: str | None = None
    doc_type: str | None = None
    language: str | None = None
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
    attachment_url: str | None = None
    attachment_file_type: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("created_at", "updated_at", "approved_at", "next_review_at")
    def _ser_doc_datetimes(self, v: datetime | None) -> str | None:
        return _dt_to_utc_iso_z(v)


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

    @field_serializer("created_at")
    def _ser_ver_created_at(self, v: datetime | None) -> str | None:
        return _dt_to_utc_iso_z(v)


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

    @field_serializer("approved_at", "created_at")
    def _ser_appr_datetimes(self, v: datetime | None) -> str | None:
        return _dt_to_utc_iso_z(v)


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

    @field_serializer("changed_at")
    def _ser_chg_changed_at(self, v: datetime | None) -> str | None:
        return _dt_to_utc_iso_z(v)


class DocumentUiContextResponse(BaseModel):
    """org_id + user_id dùng cho màn Quản lý tài liệu khi chưa cấu hình frontend."""

    org_id: UUID
    user_id: UUID
