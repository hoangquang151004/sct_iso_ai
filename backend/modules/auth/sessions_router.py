from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from db_session import get_db
from modules.audit.service import audit_service

from .dependencies import get_current_principal
from .schemas import AuthPrincipal, RevokeAllResponse, SessionSummary
from .service import auth_service

sessions_router = APIRouter(prefix="/sessions", tags=["Auth Sessions"])


@sessions_router.get("", response_model=list[SessionSummary], status_code=status.HTTP_200_OK)
def list_sessions(
    principal: AuthPrincipal = Depends(get_current_principal),
    refresh_token: str | None = Cookie(default=None, alias=auth_service.refresh_cookie_name),
    db: Session = Depends(get_db),
) -> list[SessionSummary]:
    rows = auth_service.list_active_sessions(db, user_id=principal.user_id, current_raw_token=refresh_token)
    current_hash = auth_service.current_token_hash(refresh_token)
    return [
        SessionSummary(
            id=row.id,
            device_label=row.device_label,
            user_agent=row.user_agent,
            ip=row.ip,
            created_at=row.created_at,
            last_used_at=row.last_used_at,
            is_current=bool(current_hash and row.token_hash == current_hash),
        )
        for row in rows
    ]


@sessions_router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_one_session(
    session_id: str,
    request: Request,
    principal: AuthPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Response:
    ok = auth_service.revoke_session_by_id(db, user_id=principal.user_id, session_id=session_id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Không tìm thấy session.",
                "error_code": "NOT_FOUND",
                "request_id": str(uuid4()),
                "fields": [],
            },
        )
    audit_service.record(
        db,
        action="auth.session.revoke.self",
        actor=principal,
        request=request,
        target_type="session",
        target_id=session_id,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@sessions_router.post("/revoke-all", response_model=RevokeAllResponse, status_code=status.HTTP_200_OK)
def revoke_all_other_sessions(
    request: Request,
    principal: AuthPrincipal = Depends(get_current_principal),
    refresh_token: str | None = Cookie(default=None, alias=auth_service.refresh_cookie_name),
    db: Session = Depends(get_db),
) -> RevokeAllResponse:
    revoked_count = auth_service.revoke_all_sessions_except_current(
        db,
        user_id=principal.user_id,
        current_raw_token=refresh_token,
    )
    audit_service.record(
        db,
        action="auth.session.revoke.self",
        actor=principal,
        request=request,
        target_type="session",
        payload={"revoked_count": revoked_count},
    )
    db.commit()
    return RevokeAllResponse(revoked_count=revoked_count)
