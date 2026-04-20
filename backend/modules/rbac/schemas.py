from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PermissionResponse(BaseModel):
    id: UUID
    code: str
    description: str | None = None
    created_at: datetime


class RoleResponse(BaseModel):
    id: UUID
    org_id: UUID | None = None
    name: str
    description: str | None = None
    is_system: bool
    member_count: int
    created_at: datetime
    permission_codes: list[str] = Field(default_factory=list)


class RoleCreateRequest(BaseModel):
    org_id: UUID
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class RoleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class RolePermissionsUpdateRequest(BaseModel):
    permission_codes: list[str]
