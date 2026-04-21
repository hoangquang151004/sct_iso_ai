from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db_session import get_db
from modules.auth.dependencies import ensure_org_scope, require_permissions
from modules.auth.schemas import AuthPrincipal

from .schemas import AuditLogResponse
from .service import audit_service

audit_router = APIRouter(prefix="/audit", tags=["Audit"])


@audit_router.get("/logs", response_model=list[AuditLogResponse])
def list_audit_logs(
    org_id: UUID = Query(...),
    action: str | None = Query(default=None),
    actor_user_id: UUID | None = Query(default=None),
    target_type: str | None = Query(default=None),
    from_dt: datetime | None = Query(default=None),
    to_dt: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: AuthPrincipal = Depends(require_permissions("audit.read")),
    db: Session = Depends(get_db),
) -> list[AuditLogResponse]:
    ensure_org_scope(principal.org_id, org_id)
    return audit_service.list_logs(
        db,
        org_id=org_id,
        action=action,
        actor_user_id=actor_user_id,
        target_type=target_type,
        from_dt=from_dt,
        to_dt=to_dt,
        limit=limit,
        offset=offset,
    )
