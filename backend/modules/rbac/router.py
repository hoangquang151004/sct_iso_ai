from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from db_session import get_db
from modules.audit.service import audit_service
from modules.auth.dependencies import ensure_org_scope, require_permissions
from modules.auth.schemas import AuthPrincipal

from .schemas import (
    PermissionResponse,
    RoleCreateRequest,
    RolePermissionsUpdateRequest,
    RoleResponse,
    RoleUpdateRequest,
)
from .service import rbac_service

rbac_router = APIRouter(prefix="/rbac", tags=["RBAC"])


@rbac_router.get("/permissions", response_model=list[PermissionResponse])
def list_permissions(
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("rbac.read")),
    db: Session = Depends(get_db),
) -> list[PermissionResponse]:
    ensure_org_scope(principal.org_id, org_id)
    return rbac_service.list_permissions(db)


@rbac_router.get("/roles", response_model=list[RoleResponse])
def list_roles(
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("rbac.read")),
    db: Session = Depends(get_db),
) -> list[RoleResponse]:
    ensure_org_scope(principal.org_id, org_id)
    return rbac_service.list_roles(db, org_id=org_id)


@rbac_router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreateRequest,
    request: Request,
    principal: AuthPrincipal = Depends(require_permissions("rbac.manage")),
    db: Session = Depends(get_db),
) -> RoleResponse:
    ensure_org_scope(principal.org_id, payload.org_id)
    result = rbac_service.create_role(db, payload)
    audit_service.record(
        db,
        action="rbac.role.create",
        actor=principal,
        org_id=payload.org_id,
        target_type="role",
        target_id=str(result.id),
        request=request,
        payload={"name": result.name},
    )
    db.commit()
    return result


@rbac_router.patch("/roles/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: UUID,
    payload: RoleUpdateRequest,
    request: Request,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("rbac.manage")),
    db: Session = Depends(get_db),
) -> RoleResponse:
    ensure_org_scope(principal.org_id, org_id)
    result = rbac_service.update_role(db, role_id=role_id, org_id=org_id, payload=payload)
    audit_service.record(
        db,
        action="rbac.role.update",
        actor=principal,
        org_id=org_id,
        target_type="role",
        target_id=str(result.id),
        request=request,
    )
    db.commit()
    return result


@rbac_router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(
    role_id: UUID,
    request: Request,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("rbac.manage")),
    db: Session = Depends(get_db),
) -> Response:
    ensure_org_scope(principal.org_id, org_id)
    rbac_service.delete_role(db, role_id=role_id, org_id=org_id)
    audit_service.record(
        db,
        action="rbac.role.delete",
        actor=principal,
        org_id=org_id,
        target_type="role",
        target_id=str(role_id),
        request=request,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@rbac_router.put("/roles/{role_id}/permissions", status_code=status.HTTP_200_OK)
def update_role_permissions(
    role_id: UUID,
    payload: RolePermissionsUpdateRequest,
    request: Request,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("rbac.manage")),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    ensure_org_scope(principal.org_id, org_id)
    rbac_service.update_role_permissions(
        db,
        role_id=role_id,
        org_id=org_id,
        permission_codes=payload.permission_codes,
    )
    audit_service.record(
        db,
        action="rbac.role.permissions.update",
        actor=principal,
        org_id=org_id,
        target_type="role",
        target_id=str(role_id),
        request=request,
        payload={"permission_codes": payload.permission_codes},
    )
    db.commit()
    return {"updated_permissions": len(payload.permission_codes)}


@rbac_router.post("/roles/{role_id}/permissions/reset", status_code=status.HTTP_200_OK)
def reset_system_role_permissions(
    role_id: UUID,
    request: Request,
    org_id: UUID = Query(...),
    principal: AuthPrincipal = Depends(require_permissions("rbac.manage")),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    ensure_org_scope(principal.org_id, org_id)
    permission_codes = rbac_service.reset_system_role_permissions(
        db,
        role_id=role_id,
        org_id=org_id,
    )
    audit_service.record(
        db,
        action="rbac.role.permissions.reset",
        actor=principal,
        org_id=org_id,
        target_type="role",
        target_id=str(role_id),
        request=request,
        payload={"permission_codes": permission_codes},
    )
    db.commit()
    return {"updated_permissions": len(permission_codes)}
