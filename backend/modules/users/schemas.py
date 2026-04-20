from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=5, max_length=255)
    full_name: str = Field(min_length=2, max_length=255)
    department: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    avatar_url: str | None = None
    is_active: bool = True


class RoleRef(BaseModel):
    id: UUID
    name: str


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    org_id: UUID
    role_id: UUID | None = None


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: str | None = Field(default=None, min_length=5, max_length=255)
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    department: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    avatar_url: str | None = None
    is_active: bool | None = None
    role_id: UUID | None = None


class UserResponse(UserBase):
    id: UUID
    org_id: UUID
    role_id: UUID | None = None
    role: RoleRef | None = None
    roles: list[RoleRef] = []
    disabled_at: datetime | None = None
    must_change_password: bool = False
    last_login: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class RoleResponse(BaseModel):
    id: UUID
    org_id: UUID | None = None
    name: str
    description: str | None = None
    is_system: bool = False


class UserRoleAssignRequest(BaseModel):
    role_id: UUID


class ResetPasswordRequest(BaseModel):
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


class ResetPasswordResponse(BaseModel):
    temporary_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
