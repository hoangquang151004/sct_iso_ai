from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: UUID
    org_id: UUID
    actor_user_id: UUID | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    request_id: str | None = None
    ip: str | None = None
    user_agent: str | None = None
    payload: dict | None = None
    created_at: datetime
