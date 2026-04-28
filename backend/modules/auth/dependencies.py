from collections.abc import Callable
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from db_session import get_db

from .schemas import AuthPrincipal
from .service import auth_service

bearer_scheme = HTTPBearer(auto_error=False)


def _error_detail(message: str, error_code: str) -> dict:
    return {
        "message": message,
        "error_code": error_code,
        "request_id": str(uuid4()),
        "fields": [],
    }


def get_current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AuthPrincipal:
    # DEV BYPASS: Allow testing without real auth in development environment
    from core.config import settings
    if settings.app_env == "dev" and (credentials is None or credentials.scheme.lower() != "bearer"):
        # Get real admin user from database
        from database.models import User
        from sqlalchemy import select
        admin_user = db.scalar(select(User).where(User.username == settings.auth_bootstrap_admin_username))
        if admin_user:
            return AuthPrincipal(
                user_id=str(admin_user.id),
                username=admin_user.username,
                role_ids=["admin"],
                permissions=[
                    "dashboard.read", "dashboard.manage", "documents.read", "documents.manage",
                    "haccp.read", "haccp.manage", "prp.read", "prp.manage",
                    "capa.read", "capa.manage", "analytics.read", "users.read", "audit.read"
                ],
                org_id=admin_user.org_id,
                exp=int((datetime.now() + timedelta(days=1)).timestamp())
            )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_error_detail("Thiếu thông tin xác thực.", "UNAUTHORIZED"),
        )
    try:
        principal = auth_service.decode_token(credentials.credentials)
        return auth_service.ensure_token_version_valid(db, principal)
    except Exception:
        if settings.app_env == "dev":
            # Get real admin user from database
            from database.models import User
            from sqlalchemy import select
            admin_user = db.scalar(select(User).where(User.username == settings.auth_bootstrap_admin_username))
            if admin_user:
                return AuthPrincipal(
                    user_id=str(admin_user.id),
                    username=admin_user.username,
                    role_ids=["admin"],
                    permissions=[
                        "dashboard.read", "dashboard.manage", "documents.read", "documents.manage",
                        "haccp.read", "haccp.manage", "prp.read", "prp.manage",
                        "capa.read", "capa.manage", "analytics.read", "users.read", "audit.read"
                    ],
                    org_id=admin_user.org_id,
                    exp=int((datetime.now() + timedelta(days=1)).timestamp())
                )
        raise


def require_permissions(*required_permissions: str) -> Callable:
    def dependency(principal: AuthPrincipal = Depends(get_current_principal)) -> AuthPrincipal:
        principal_permissions = set(principal.permissions)
        if not set(required_permissions).issubset(principal_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=_error_detail(
                    "Bạn không có quyền truy cập tài nguyên này.", "FORBIDDEN"
                ),
            )
        return principal

    return dependency


def ensure_org_scope(principal_org_id: UUID, request_org_id: UUID) -> None:
    if principal_org_id != request_org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_error_detail(
                "Bạn không thể truy cập dữ liệu ngoài phạm vi tổ chức.",
                "FORBIDDEN",
            ),
        )
