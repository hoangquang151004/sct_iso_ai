from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AuthLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    device_label: str | None = Field(default=None, max_length=128)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime


class AuthPrincipal(BaseModel):
    user_id: str
    username: str
    role_ids: list[str] = []
    permissions: list[str] = []
    org_id: UUID
    token_version: int = 0
    must_change_password: bool = False
    exp: int

    model_config = ConfigDict(extra="ignore")


class SessionSummary(BaseModel):
    id: str
    device_label: str | None = None
    user_agent: str | None = None
    ip: str | None = None
    created_at: datetime
    last_used_at: datetime | None = None
    is_current: bool


class RevokeAllResponse(BaseModel):
    revoked_count: int
