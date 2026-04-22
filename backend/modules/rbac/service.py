from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from database.models import Permission, Role, RolePermission, User, UserRole
from modules.auth.bootstrap import SYSTEM_ROLE_PERMISSION_SPECS
from modules.auth.service import auth_service

from .schemas import PermissionResponse, RoleCreateRequest, RoleResponse, RoleUpdateRequest


class RbacService:
    def _permission_codes_for_role(self, db: Session, role_id: str) -> list[str]:
        return list(
            db.scalars(
                select(Permission.code)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .where(RolePermission.role_id == role_id)
                .order_by(Permission.code.asc())
            ).all()
        )

    @staticmethod
    def _error_detail(message: str, error_code: str) -> dict:
        return {
            "message": message,
            "error_code": error_code,
            "request_id": str(uuid4()),
            "fields": [],
        }

    def _member_count_for_role(self, db: Session, role_id: str) -> int:
        return len(
            db.scalars(
                select(UserRole.user_id)
                .join(User, User.id == UserRole.user_id)
                .where(UserRole.role_id == role_id)
                .where(User.is_active.is_(True))
            ).all()
        )

    def _role_or_404(self, db: Session, role_id: UUID, org_id: UUID) -> Role:
        role = db.scalar(
            select(Role).where(Role.id == role_id).where(or_(Role.org_id == org_id, Role.org_id.is_(None)))
        )
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=self._error_detail("Không tìm thấy vai trò.", "ROLE_NOT_FOUND"),
            )
        return role

    def _ensure_not_system_role(self, role: Role) -> None:
        if role.is_system:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=self._error_detail("Không thể sửa/xóa system role.", "ROLE_SYSTEM_PROTECTED"),
            )

    def _ensure_role_name_unique(
        self, db: Session, *, org_id: UUID, name: str, excluded_role_id: UUID | None = None
    ) -> None:
        query = select(Role).where(Role.org_id == org_id).where(Role.name.ilike(name))
        if excluded_role_id is not None:
            query = query.where(Role.id != excluded_role_id)
        if db.scalar(query):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=self._error_detail("Tên vai trò đã tồn tại.", "ROLE_NAME_ALREADY_EXISTS"),
            )

    def list_permissions(self, db: Session) -> list[PermissionResponse]:
        rows = db.scalars(select(Permission).order_by(Permission.code.asc())).all()
        return [
            PermissionResponse(
                id=item.id,
                code=item.code,
                description=item.description,
                created_at=item.created_at,
            )
            for item in rows
        ]

    def list_roles(self, db: Session, *, org_id: UUID) -> list[RoleResponse]:
        rows = db.scalars(
            select(Role)
            .where(or_(Role.org_id == str(org_id), Role.org_id.is_(None)))
            .order_by(Role.is_system.desc(), Role.name.asc())
        ).all()
        return [
            RoleResponse(
                id=role.id,
                org_id=role.org_id,
                name=role.name,
                description=role.description,
                is_system=role.is_system,
                member_count=self._member_count_for_role(db, role.id),
                created_at=role.created_at,
                permission_codes=self._permission_codes_for_role(db, role.id),
            )
            for role in rows
        ]

    def create_role(self, db: Session, payload: RoleCreateRequest) -> RoleResponse:
        self._ensure_role_name_unique(db, org_id=payload.org_id, name=payload.name)
        role = Role(
            id=uuid4(),
            org_id=payload.org_id,
            name=payload.name,
            description=payload.description,
            is_system=False,
            created_at=datetime.now(UTC),
        )
        db.add(role)
        db.flush()
        return RoleResponse(
            id=role.id,
            org_id=role.org_id,
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            member_count=0,
            created_at=role.created_at,
            permission_codes=[],
        )

    def update_role(
        self,
        db: Session,
        *,
        role_id: UUID,
        org_id: UUID,
        payload: RoleUpdateRequest,
    ) -> RoleResponse:
        role = self._role_or_404(db, role_id, org_id)
        self._ensure_not_system_role(role)
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return RoleResponse(
                id=role.id,
                org_id=role.org_id,
                name=role.name,
                description=role.description,
                is_system=role.is_system,
                member_count=self._member_count_for_role(db, role.id),
                created_at=role.created_at,
                permission_codes=self._permission_codes_for_role(db, role.id),
            )
        if update_data.get("name"):
            self._ensure_role_name_unique(
                db,
                org_id=org_id,
                name=update_data["name"],
                excluded_role_id=role_id,
            )
        for key, value in update_data.items():
            setattr(role, key, value)
        db.flush()
        return RoleResponse(
            id=role.id,
            org_id=role.org_id,
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            member_count=self._member_count_for_role(db, role.id),
            created_at=role.created_at,
            permission_codes=self._permission_codes_for_role(db, role.id),
        )

    def delete_role(self, db: Session, *, role_id: UUID, org_id: UUID) -> None:
        role = self._role_or_404(db, role_id, org_id)
        self._ensure_not_system_role(role)
        in_use = db.scalar(select(UserRole).where(UserRole.role_id == role.id))
        if in_use is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=self._error_detail("Vai trò đang được sử dụng.", "ROLE_IN_USE"),
            )
        db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
        db.delete(role)
        db.flush()

    def update_role_permissions(
        self,
        db: Session,
        *,
        role_id: UUID,
        org_id: UUID,
        permission_codes: list[str],
    ) -> None:
        role = self._role_or_404(db, role_id, org_id)
        permissions = db.scalars(select(Permission).where(Permission.code.in_(permission_codes))).all()
        permission_by_code = {item.code: item for item in permissions}
        missing = [code for code in permission_codes if code not in permission_by_code]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=self._error_detail(
                    f"Permission không tồn tại: {', '.join(missing)}",
                    "PERMISSION_NOT_FOUND",
                ),
            )

        existing = db.scalars(select(RolePermission).where(RolePermission.role_id == role.id)).all()
        existing_permission_ids = {item.permission_id for item in existing}
        desired_permission_ids = {permission_by_code[code].id for code in permission_codes}

        to_add = desired_permission_ids - existing_permission_ids
        to_remove = existing_permission_ids - desired_permission_ids

        for permission_id in to_add:
            db.add(
                RolePermission(
                    id=uuid4(),
                    role_id=role.id,
                    permission_id=permission_id,
                    created_at=datetime.now(UTC),
                )
            )
        if to_remove:
            db.query(RolePermission).filter(
                and_(RolePermission.role_id == role.id, RolePermission.permission_id.in_(to_remove))
            ).delete(synchronize_session=False)

        user_ids = db.scalars(select(UserRole.user_id).where(UserRole.role_id == role.id)).all()
        for user_id in set(user_ids):
            user = db.scalar(select(User).where(User.id == user_id))
            if user is None:
                continue
            user.token_version += 1
            auth_service.invalidate_user_token_version_cache(user.id)
        db.flush()

    def reset_system_role_permissions(
        self,
        db: Session,
        *,
        role_id: UUID,
        org_id: UUID,
    ) -> list[str]:
        role = self._role_or_404(db, role_id, org_id)
        if not role.is_system:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=self._error_detail(
                    "Chỉ hỗ trợ reset quyền mặc định cho system role.",
                    "ROLE_NOT_SYSTEM",
                ),
            )
        default_permission_codes = SYSTEM_ROLE_PERMISSION_SPECS.get(role.name)
        if default_permission_codes is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=self._error_detail(
                    "Không tìm thấy cấu hình quyền mặc định cho system role.",
                    "ROLE_DEFAULT_NOT_FOUND",
                ),
            )
        self.update_role_permissions(
            db,
            role_id=role_id,
            org_id=org_id,
            permission_codes=default_permission_codes,
        )
        return default_permission_codes


rbac_service = RbacService()
