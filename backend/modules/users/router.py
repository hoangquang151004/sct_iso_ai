from uuid import UUID
from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import User
from db_session import get_db
from modules.audit.service import audit_service
from modules.auth.dependencies import ensure_org_scope, get_current_principal, require_permissions
from modules.auth.schemas import AuthPrincipal
from modules.auth.service import auth_service
from .schemas import (
    ChangePasswordRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    RoleResponse,
    UserCreate,
    UserResponse,
    UserRoleAssignRequest,
    UserUpdate,
)
from .service import user_service

users_router = APIRouter(prefix="/users", tags=["Users"])


@users_router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    request: Request,
    payload: UserCreate,
    principal: AuthPrincipal = Depends(require_permissions("users.create")),
    db: Session = Depends(get_db),
) -> UserResponse:
    ensure_org_scope(principal.org_id, payload.org_id)
    result = user_service.create_user(db, payload)
    audit_service.record(
        db,
        action="users.create",
        actor=principal,
        org_id=payload.org_id,
        target_type="user",
        target_id=str(result.id),
        request=request,
        payload={"username": result.username},
    )
    db.commit()
    return result


@users_router.get("", response_model=list[UserResponse])
def list_users(
    org_id: UUID = Query(...),
    role_id: UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    department: str | None = Query(default=None),
    principal: AuthPrincipal = Depends(require_permissions("users.read")),
    db: Session = Depends(get_db),
) -> list[UserResponse]:
    ensure_org_scope(principal.org_id, org_id)
    result = user_service.list_users(
        db=db,
        org_id=org_id,
        role_id=role_id,
        is_active=is_active,
        department=department,
    )
    return result


@users_router.get("/rbac/roles", response_model=list[RoleResponse])
def list_roles(
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("users.read")),
    db: Session = Depends(get_db),
) -> list[RoleResponse]:
    ensure_org_scope(principal.org_id, org_id)
    result = user_service.list_roles(db=db, org_id=org_id)
    return result


@users_router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("users.read")),
    db: Session = Depends(get_db),
) -> UserResponse:
    ensure_org_scope(principal.org_id, org_id)
    result = user_service.get_user_by_org(db=db, user_id=user_id, org_id=org_id)
    return result


@users_router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    request: Request,
    user_id: UUID,
    payload: UserUpdate,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("users.update")),
    db: Session = Depends(get_db),
) -> UserResponse:
    ensure_org_scope(principal.org_id, org_id)
    result = user_service.update_user(db=db, user_id=user_id, org_id=org_id, payload=payload)
    audit_service.record(
        db,
        action="users.update",
        actor=principal,
        org_id=org_id,
        target_type="user",
        target_id=str(result.id),
        request=request,
    )
    db.commit()
    return result


@users_router.patch("/{user_id}/role", response_model=UserResponse)
def assign_role(
    request: Request,
    user_id: UUID,
    payload: UserRoleAssignRequest,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("users.assign_role")),
    db: Session = Depends(get_db),
) -> UserResponse:
    ensure_org_scope(principal.org_id, org_id)
    result = user_service.update_user(
        db=db,
        user_id=user_id,
        org_id=org_id,
        payload=UserUpdate(role_id=payload.role_id),
    )
    audit_service.record(
        db,
        action="users.role.assign",
        actor=principal,
        org_id=org_id,
        target_type="user",
        target_id=str(result.id),
        request=request,
        payload={"role_id": str(payload.role_id)},
    )
    db.commit()
    return result


@users_router.post(
    "/{user_id}/sessions/revoke-all",
    status_code=status.HTTP_200_OK,
)
def admin_revoke_all_sessions(
    user_id: UUID,
    request: Request,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("users.manage_sessions")),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    ensure_org_scope(principal.org_id, org_id)
    target_user = db.scalar(
        select(User).where(User.id == user_id).where(User.org_id == org_id)
    )
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Không tìm thấy người dùng.",
                "error_code": "USER_NOT_FOUND",
                "request_id": str(uuid4()),
                "fields": [],
            },
        )
    revoked_count = auth_service.admin_revoke_all_sessions_for_user(
        db,
        user_id=target_user.id,
    )
    audit_service.record(
        db,
        action="auth.session.revoke.admin",
        actor=principal,
        org_id=org_id,
        target_type="user",
        target_id=target_user.id,
        request=request,
        payload={"revoked_count": revoked_count},
    )
    db.commit()
    return {"revoked_count": revoked_count}


@users_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete_user(
    user_id: UUID,
    request: Request,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("users.delete")),
    db: Session = Depends(get_db),
) -> Response:
    ensure_org_scope(principal.org_id, org_id)
    user_service.soft_delete_user(db, user_id=user_id, org_id=org_id)
    audit_service.record(
        db,
        action="user.soft_delete",
        actor=principal,
        org_id=org_id,
        target_type="user",
        target_id=str(user_id),
        request=request,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@users_router.post("/{user_id}/reset-password", response_model=ResetPasswordResponse)
def reset_password(
    user_id: UUID,
    payload: ResetPasswordRequest,
    request: Request,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("users.reset_password")),
    db: Session = Depends(get_db),
) -> ResetPasswordResponse:
    ensure_org_scope(principal.org_id, org_id)
    temporary_password = user_service.admin_reset_password(
        db,
        user_id=user_id,
        org_id=org_id,
        new_password=payload.new_password,
    )
    audit_service.record(
        db,
        action="user.reset_password",
        actor=principal,
        org_id=org_id,
        target_type="user",
        target_id=str(user_id),
        request=request,
    )
    db.commit()
    return ResetPasswordResponse(temporary_password=temporary_password)


@users_router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    principal: AuthPrincipal = Depends(get_current_principal),
    refresh_token: str | None = Cookie(default=None, alias=auth_service.refresh_cookie_name),
    db: Session = Depends(get_db),
) -> Response:
    user_service.change_my_password(
        db,
        principal_user_id=principal.user_id,
        current_password=payload.current_password,
        new_password=payload.new_password,
        current_refresh_token=refresh_token,
    )
    audit_service.record(
        db,
        action="user.change_password",
        actor=principal,
        org_id=principal.org_id,
        target_type="user",
        target_id=principal.user_id,
        request=request,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
