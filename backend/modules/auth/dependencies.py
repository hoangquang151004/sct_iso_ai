from collections.abc import Callable
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
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_error_detail("Thiếu thông tin xác thực.", "UNAUTHORIZED"),
        )
    principal = auth_service.decode_token(credentials.credentials)
    return auth_service.ensure_token_version_valid(db, principal)


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
