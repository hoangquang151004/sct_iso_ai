from datetime import timezone, datetime
from uuid import uuid4

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from core.config import settings
from db_session import SessionLocal
from .rbac_models import (
    Organization,
    Permission,
    RefreshToken,
    Role,
    RolePermission,
    User,
    UserRole,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


DEFAULT_ORG_ID = settings.auth_bootstrap_org_id

# Khớp CONTEXT.md mục 10 (Admin, ISO Manager, QA/QC, Auditor, User).
CONTEXT_ROLE_DESCRIPTIONS: dict[str, str] = {
    "admin": "Admin — toàn bộ hệ thống, quản lý user, cấu hình.",
    "iso_manager": "ISO Manager — tài liệu, HACCP, PRP, CAPA, báo cáo.",
    "qa_qc": "QA/QC — tuân thủ, chất lượng, giám sát CCP, NC và CAPA.",
    "auditor": "Auditor — xem và đánh giá; không chỉnh sửa dữ liệu sản xuất.",
    "user": "User — truy cập module được phân quyền; ghi nhận dữ liệu hiện trường.",
}

SYSTEM_ROLE_PERMISSION_SPECS: dict[str, list[str]] = {
    "admin": [
        "dashboard.read",
        "dashboard.manage",
        "documents.read",
        "documents.manage",
        "haccp.read",
        "haccp.manage",
        "prp.read",
        "prp.manage",
        "capa.read",
        "capa.manage",
        "analytics.read",
        "analytics.manage",
        "reports.read",
        "reports.manage",
        "users.read",
        "users.create",
        "users.update",
        "users.assign_role",
        "users.manage_sessions",
        "users.delete",
        "users.reset_password",
        "rbac.read",
        "rbac.manage",
        "audit.read",
    ],
    "iso_manager": [
        "dashboard.read",
        "dashboard.manage",
        "documents.read",
        "documents.manage",
        "haccp.read",
        "haccp.manage",
        "prp.read",
        "prp.manage",
        "capa.read",
        "capa.manage",
        "analytics.read",
        "analytics.manage",
        "reports.read",
        "reports.manage",
        "users.read",
        "users.create",
        "users.update",
        "rbac.read",
    ],
    "qa_qc": [
        "dashboard.read",
        "documents.read",
        "haccp.read",
        "haccp.manage",
        "prp.read",
        "prp.manage",
        "capa.read",
        "capa.manage",
        "analytics.read",
        "reports.read",
        "users.read",
        "users.update",
        "rbac.read",
        "audit.read",
    ],
    "auditor": [
        "dashboard.read",
        "documents.read",
        "haccp.read",
        "prp.read",
        "capa.read",
        "analytics.read",
        "reports.read",
        "users.read",
        "rbac.read",
        "audit.read",
    ],
    "user": [
        "dashboard.read",
        "documents.read",
        "haccp.read",
        "prp.read",
        "capa.read",
        "analytics.read",
        "reports.read",
    ],
}


def _seed_permissions(db: Session) -> dict[str, Permission]:
    required = {
        "dashboard.read": "Xem bảng điều khiển",
        "dashboard.manage": "Quản trị bảng điều khiển",
        "documents.read": "Xem tài liệu",
        "documents.manage": "Quản trị tài liệu",
        "haccp.read": "Xem module HACCP",
        "haccp.manage": "Quản trị module HACCP",
        "prp.read": "Xem module PRP",
        "prp.manage": "Quản trị module PRP",
        "capa.read": "Xem module CAPA",
        "capa.manage": "Quản trị module CAPA",
        "analytics.read": "Xem analytics",
        "analytics.manage": "Quản trị analytics",
        "reports.read": "Xem báo cáo",
        "reports.manage": "Quản trị báo cáo",
        "users.read": "Xem danh sách và chi tiết người dùng",
        "users.create": "Tạo người dùng",
        "users.update": "Cập nhật thông tin người dùng",
        "users.assign_role": "Gán vai trò cho người dùng",
        "users.manage_sessions": "Quản lý session của người dùng",
        "users.delete": "Vô hiệu hóa người dùng",
        "users.reset_password": "Đặt lại mật khẩu người dùng",
        "rbac.read": "Xem danh sách role/permission",
        "rbac.manage": "Quản trị role/permission",
        "audit.read": "Xem nhật ký audit",
    }
    existing = {
        item.code: item for item in db.scalars(select(Permission).where(Permission.code.in_(required)))
    }
    for code, description in required.items():
        if code not in existing:
            perm = Permission(code=code, description=description)
            db.add(perm)
            db.flush()
            existing[code] = perm
    return existing


def _seed_roles(db: Session, permissions: dict[str, Permission]) -> dict[str, Role]:
    role_specs = SYSTEM_ROLE_PERMISSION_SPECS
    result: dict[str, Role] = {}
    for role_name, permission_codes in role_specs.items():
        role = db.scalar(
            select(Role).where(Role.org_id == DEFAULT_ORG_ID).where(Role.name == role_name)
        )
        if role is None:
            role = Role(
                id=str(uuid4()),
                org_id=DEFAULT_ORG_ID,
                name=role_name,
                description=CONTEXT_ROLE_DESCRIPTIONS.get(
                    role_name, f"System role: {role_name}"
                ),
                is_system=True,
            )
            db.add(role)
            db.flush()
        existing_permission_ids = {
            rp.permission_id
            for rp in db.scalars(select(RolePermission).where(RolePermission.role_id == role.id))
        }
        for permission_code in permission_codes:
            permission = permissions[permission_code]
            if permission.id not in existing_permission_ids:
                db.add(
                    RolePermission(
                        id=str(uuid4()),
                        role_id=role.id,
                        permission_id=permission.id,
                    )
                )
        result[role_name] = role
    return result


def _seed_user(db: Session, roles: dict[str, Role], username: str, password: str, role_name: str) -> None:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        user = User(
            id=str(uuid4()),
            org_id=DEFAULT_ORG_ID,
            username=username,
            email=f"{username}@example.com",
            full_name=username.replace("_", " ").title(),
            password_hash=pwd_context.hash(password),
            is_active=True,
        )
        db.add(user)
        db.flush()
    role = roles[role_name]
    has_role = db.scalar(
        select(UserRole).where(UserRole.user_id == user.id).where(UserRole.role_id == role.id)
    )
    if has_role is None:
        db.add(UserRole(id=str(uuid4()), user_id=user.id, role_id=role.id))


def seed_rbac_defaults() -> None:
    try:
        with SessionLocal() as db:
            org = db.scalar(select(Organization).where(Organization.id == DEFAULT_ORG_ID))
            if org is None:
                db.add(
                    Organization(
                        id=DEFAULT_ORG_ID,
                        name="Default Organization",
                        code="DEFAULT_ORG",
                        is_active=True,
                    )
                )
                db.flush()
            permissions = _seed_permissions(db)
            roles = _seed_roles(db, permissions)
            _seed_user(
                db,
                roles,
                username=settings.auth_bootstrap_admin_username,
                password=settings.auth_bootstrap_admin_password,
                role_name="admin",
            )
            _seed_user(
                db,
                roles,
                username=settings.auth_bootstrap_iso_manager_username,
                password=settings.auth_bootstrap_iso_manager_password,
                role_name="iso_manager",
            )
            db.query(RefreshToken).filter(RefreshToken.expires_at < datetime.now(timezone.utc)).delete()
            db.commit()
    except SQLAlchemyError as exc:
        raise RuntimeError(
            "RBAC seed failed. Ensure database migrations are applied (run `alembic upgrade head`)."
        ) from exc
