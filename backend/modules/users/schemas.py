from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserBase(BaseModel):
    username: str
    email: str
    full_name: str
    department: str | None = None
    position: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str
    org_id: UUID
    role_id: UUID | None = None


class UserResponse(UserBase):
    id: UUID
    org_id: UUID
    role_id: UUID | None = None
    last_login: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
