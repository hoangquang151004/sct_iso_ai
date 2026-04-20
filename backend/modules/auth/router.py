from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.rate_limit import limiter, login_rate_limit, refresh_rate_limit
from db_session import get_db
from modules.audit.service import audit_service
from modules.auth.rbac_models import User
from .dependencies import get_current_principal
from .schemas import AuthLoginRequest, AuthPrincipal, AuthTokenResponse
from .sessions_router import sessions_router
from .service import auth_service

auth_router = APIRouter(prefix="/auth", tags=["Auth"])
auth_router.include_router(sessions_router)


@auth_router.post("/login", response_model=AuthTokenResponse, status_code=status.HTTP_200_OK)
@limiter.limit(login_rate_limit)
def login(
    request: Request,
    payload: AuthLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    try:
        account = auth_service.authenticate(db, payload.username, payload.password)
    except HTTPException:
        org_id = db.scalar(select(User.org_id).where(User.username == payload.username))
        audit_service.record(
            db,
            action="auth.login.fail",
            actor=None,
            org_id=org_id,
            request=request,
            payload={"username": payload.username},
        )
        db.commit()
        raise
    principal = auth_service.principal_from_user_id(db, account.id)
    access_token, expires_at = auth_service.create_access_token(principal)
    refresh_token, refresh_expires_at = auth_service.issue_refresh_token(
        db,
        account.id,
        request=request,
        device_label=payload.device_label,
    )
    auth_service.set_refresh_cookie(response, refresh_token, refresh_expires_at)
    audit_service.record(
        db,
        action="auth.login.success",
        actor=principal,
        request=request,
        payload={"username": payload.username},
    )
    db.commit()
    return AuthTokenResponse(access_token=access_token, expires_at=expires_at)


@auth_router.get("/me", response_model=AuthPrincipal, status_code=status.HTTP_200_OK)
def me(principal: AuthPrincipal = Depends(get_current_principal)) -> AuthPrincipal:
    return principal


@auth_router.post("/refresh", response_model=AuthTokenResponse, status_code=status.HTTP_200_OK)
@limiter.limit(refresh_rate_limit)
def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=auth_service.refresh_cookie_name),
    db: Session = Depends(get_db),
) -> AuthTokenResponse:
    try:
        principal, current_session = auth_service.rotate_refresh_token(db, refresh_token or "")
    except HTTPException:
        audit_service.record(
            db,
            action="auth.refresh.fail",
            actor=None,
            request=request,
        )
        db.commit()
        raise
    access_token, expires_at = auth_service.create_access_token(principal)
    new_refresh, refresh_expires_at = auth_service.issue_refresh_token(
        db,
        principal.user_id,
        request=request,
        inherited_user_agent=current_session.user_agent,
        inherited_ip=current_session.ip,
        inherited_device_label=current_session.device_label,
    )
    auth_service.set_refresh_cookie(response, new_refresh, refresh_expires_at)
    audit_service.record(db, action="auth.refresh.success", actor=principal, request=request)
    db.commit()
    return AuthTokenResponse(access_token=access_token, expires_at=expires_at)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=auth_service.refresh_cookie_name),
    principal: AuthPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> Response:
    auth_service.revoke_refresh_token(db, refresh_token)
    audit_service.record(db, action="auth.logout", actor=principal, request=request)
    db.commit()
    auth_service.clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
