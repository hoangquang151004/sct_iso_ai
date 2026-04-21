from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import Request
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from modules.auth.schemas import AuthPrincipal

from .models import AuditLogEntry
from .schemas import AuditLogResponse

logger = logging.getLogger(__name__)


class AuditService:
    def record(
        self,
        db: Session,
        *,
        action: str,
        actor: AuthPrincipal | None,
        org_id: UUID | str | None = None,
        target_type: str | None = None,
        target_id: str | None = None,
        request: Request | None = None,
        payload: dict | None = None,
    ) -> None:
        try:
            org_value = str(org_id or (actor.org_id if actor else ""))
            if not org_value:
                return
            db.add(
                AuditLogEntry(
                    id=str(uuid4()),
                    org_id=org_value,
                    actor_user_id=actor.user_id if actor else None,
                    action=action,
                    target_type=target_type,
                    target_id=target_id,
                    request_id=request.headers.get("x-request-id") if request else None,
                    ip=request.client.host if request and request.client else None,
                    user_agent=(request.headers.get("user-agent") if request else None),
                    payload=payload,
                    created_at=datetime.now(timezone.utc),
                )
            )
            db.flush()
        except Exception:  # pragma: no cover
            logger.warning("Failed to write audit log for action=%s", action, exc_info=True)

    def list_logs(
        self,
        db: Session,
        *,
        org_id: UUID,
        action: str | None = None,
        actor_user_id: UUID | None = None,
        target_type: str | None = None,
        from_dt: datetime | None = None,
        to_dt: datetime | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AuditLogResponse]:
        query: Select[tuple[AuditLogEntry]] = select(AuditLogEntry).where(
            AuditLogEntry.org_id == str(org_id)
        )
        if action:
            query = query.where(AuditLogEntry.action == action)
        if actor_user_id:
            query = query.where(AuditLogEntry.actor_user_id == str(actor_user_id))
        if target_type:
            query = query.where(AuditLogEntry.target_type == target_type)
        if from_dt:
            query = query.where(AuditLogEntry.created_at >= from_dt)
        if to_dt:
            query = query.where(AuditLogEntry.created_at <= to_dt)
        rows = db.scalars(
            query.order_by(AuditLogEntry.created_at.desc()).offset(offset).limit(min(limit, 200))
        ).all()
        return [
            AuditLogResponse(
                id=UUID(row.id),
                org_id=UUID(row.org_id),
                actor_user_id=UUID(row.actor_user_id) if row.actor_user_id else None,
                action=row.action,
                target_type=row.target_type,
                target_id=row.target_id,
                request_id=row.request_id,
                ip=row.ip,
                user_agent=row.user_agent,
                payload=row.payload,
                created_at=row.created_at,
            )
            for row in rows
        ]


audit_service = AuditService()
