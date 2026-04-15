from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    department: str | None = None
    position: str | None = None
    phone: str | None = None


class UserCreate(UserBase):
    password: str
    org_id: UUID
    role_id: UUID


class UserResponse(UserBase):
    id: UUID
    org_id: UUID
    role_id: UUID
    is_active: bool = True
    last_login: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
