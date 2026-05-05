import secrets
import string
from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from database.models import Role, User, UserRole
from modules.auth.password_policy import validate_password_strength
from modules.auth.service import auth_service
from .schemas import RoleRef, RoleResponse, UserCreate, UserResponse, UserUpdate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserService:
    @staticmethod
    def _error_detail(message: str, error_code: str, fields: list[dict] | None = None) -> dict:
        return {
            "message": message,
            "error_code": error_code,
            "request_id": str(uuid4()),
            "fields": fields or [],
        }

    def _to_response(self, db: Session, item: User) -> UserResponse:
        assigned_roles = db.execute(
            select(Role.id, Role.name)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(UserRole.user_id == item.id)
            .order_by(Role.name.asc())
        ).all()
        role_refs = [RoleRef(id=role_id, name=role_name) for role_id, role_name in assigned_roles]
        first_role = role_refs[0] if role_refs else None
        return UserResponse(
            id=item.id,
            org_id=item.org_id,
            role_id=first_role.id if first_role else None,
            role=first_role,
            roles=role_refs,
            username=item.username,
            email=item.email,
            full_name=item.full_name,
            department=item.department,
            position=item.position,
            phone=item.phone,
            avatar_url=item.avatar_url,
            is_active=item.is_active,
            disabled_at=item.disabled_at,
            must_change_password=item.must_change_password,
            last_login=item.last_login,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )

    def _ensure_user_active(self, user: User) -> None:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=self._error_detail("Người dùng đã bị vô hiệu hóa.", "USER_INACTIVE"),
            )

    def _get_user_or_404(self, db: Session, user_id: UUID, org_id: UUID | None = None) -> User:
        result = db.scalar(select(User).where(User.id == user_id))
        # Normalize both values to string because SQLAlchemy may return UUID or str
        # depending on dialect/column config. Direct UUID-vs-str comparison causes false 404.
        if result is None or (org_id is not None and str(result.org_id) != str(org_id)):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=self._error_detail("Không tìm thấy người dùng.", "USER_NOT_FOUND"),
            )
        return result

    def _ensure_unique_fields(
        self,
        db: Session,
        *,
        email: str | None = None,
        username: str | None = None,
        excluded_user_id: UUID | None = None,
    ) -> None:
        if email is not None:
            query = select(User).where(User.email.ilike(email))
            if excluded_user_id is not None:
                query = query.where(User.id != str(excluded_user_id))
            if db.scalar(query):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=self._error_detail("Email đã tồn tại trong hệ thống.", "USER_EMAIL_ALREADY_EXISTS"),
                )
        if username is not None:
            query = select(User).where(User.username.ilike(username))
            if excluded_user_id is not None:
                query = query.where(User.id != str(excluded_user_id))
            if db.scalar(query):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=self._error_detail("Tên đăng nhập đã tồn tại trong hệ thống.", "USER_USERNAME_ALREADY_EXISTS"),
                )

    def _validate_role(self, db: Session, org_id: UUID, role_id: UUID | None) -> Role | None:
        if role_id is None:
            return None
        role = db.scalar(select(Role).where(Role.id == role_id))
        # Normalize org identifiers to string to avoid false invalid-role checks
        # when DB driver returns UUID objects.
        if role is None or (role.org_id is not None and str(role.org_id) != str(org_id)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=self._error_detail("Vai trò không hợp lệ.", "USER_ROLE_INVALID"),
            )
        return role

    def create_user(self, db: Session, payload: UserCreate) -> UserResponse:
        self._ensure_unique_fields(db, email=payload.email, username=payload.username)
        validate_password_strength(payload.password)
        role = self._validate_role(db, payload.org_id, payload.role_id)
        now = datetime.now(UTC)
        entity = User(
            id=uuid4(),
            org_id=payload.org_id,
            username=payload.username,
            email=payload.email,
            password_hash=pwd_context.hash(payload.password),
            full_name=payload.full_name,
            department=payload.department,
            position=payload.position,
            phone=payload.phone,
            avatar_url=payload.avatar_url,
            is_active=payload.is_active,
            created_at=now,
            updated_at=now,
        )
        db.add(entity)
        db.flush()
        if role is not None:
            db.add(UserRole(id=uuid4(), user_id=entity.id, role_id=role.id))
        db.commit()
        db.refresh(entity)
        return self._to_response(db, entity)

    def list_users(
        self,
        db: Session,
        org_id: UUID,
        role_id: UUID | None = None,
        is_active: bool | None = None,
        department: str | None = None,
    ) -> list[UserResponse]:
        query = select(User).where(User.org_id == org_id)
        if is_active is not None:
            query = query.where(User.is_active == is_active)
        if department is not None:
            query = query.where(User.department == department)
        if role_id is not None:
            query = query.join(UserRole, UserRole.user_id == User.id).where(UserRole.role_id == role_id)
        result = db.scalars(query.order_by(User.created_at.desc())).all()
        return [self._to_response(db, item) for item in result]

    def get_user(self, db: Session, user_id: UUID) -> UserResponse:
        result = self._get_user_or_404(db, user_id)
        return self._to_response(db, result)

    def get_user_by_org(self, db: Session, user_id: UUID, org_id: UUID) -> UserResponse:
        result = self._get_user_or_404(db, user_id, org_id=org_id)
        return self._to_response(db, result)

    def update_user(self, db: Session, user_id: UUID, org_id: UUID, payload: UserUpdate) -> UserResponse:
        current = self._get_user_or_404(db, user_id, org_id=org_id)
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=self._error_detail(
                    "Dữ liệu cập nhật không hợp lệ.", "VALIDATION_ERROR"
                ),
            )

        new_email = update_data.get("email")
        new_username = update_data.get("username")
        self._ensure_unique_fields(
            db,
            email=new_email,
            username=new_username,
            excluded_user_id=user_id,
        )

        for key, value in update_data.items():
            if key == "role_id":
                continue
            setattr(current, key, value)
        current.updated_at = datetime.now(UTC)
        db.flush()
        if "role_id" in update_data:
            role = self._validate_role(db, org_id, update_data["role_id"])
            db.query(UserRole).filter(UserRole.user_id == current.id).delete()
            if role is not None:
                db.add(UserRole(id=uuid4(), user_id=current.id, role_id=role.id))
            current.token_version += 1
            auth_service.invalidate_user_token_version_cache(current.id)
        if "is_active" in update_data and update_data["is_active"] is False:
            current.token_version += 1
            auth_service.invalidate_user_token_version_cache(current.id)
        db.commit()
        db.refresh(current)
        return self._to_response(db, current)

    def soft_delete_user(self, db: Session, *, user_id: UUID, org_id: UUID) -> None:
        current = self._get_user_or_404(db, user_id, org_id=org_id)
        self._ensure_user_active(current)
        now = datetime.now(UTC)
        current.is_active = False
        current.disabled_at = now
        current.updated_at = now
        auth_service.admin_revoke_all_sessions_for_user(db, user_id=current.id)
        db.flush()

    def admin_reset_password(
        self,
        db: Session,
        *,
        user_id: UUID,
        org_id: UUID,
        new_password: str | None,
    ) -> str:
        current = self._get_user_or_404(db, user_id, org_id=org_id)
        self._ensure_user_active(current)
        if new_password is not None:
            validate_password_strength(new_password)
            temporary_password = new_password
            must_change = False
        else:
            alphabet = string.ascii_letters + string.digits
            temporary_password = "".join(secrets.choice(alphabet) for _ in range(16))
            must_change = True
            
        current.password_hash = pwd_context.hash(temporary_password)
        current.must_change_password = must_change
        current.updated_at = datetime.now(UTC)
        auth_service.admin_revoke_all_sessions_for_user(db, user_id=current.id)
        db.flush()
        return temporary_password

    def change_my_password(
        self,
        db: Session,
        *,
        principal_user_id: str,
        current_password: str,
        new_password: str,
        current_refresh_token: str | None,
    ) -> None:
        user = db.scalar(select(User).where(User.id == principal_user_id))
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=self._error_detail("Không tìm thấy người dùng.", "USER_NOT_FOUND"),
            )
        self._ensure_user_active(user)
        if not pwd_context.verify(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._error_detail("Thông tin đăng nhập không hợp lệ.", "AUTH_INVALID_CREDENTIALS"),
            )
        validate_password_strength(new_password)
        user.password_hash = pwd_context.hash(new_password)
        user.must_change_password = False
        user.token_version += 1
        user.updated_at = datetime.now(UTC)
        auth_service.invalidate_user_token_version_cache(user.id)
        auth_service.revoke_all_sessions_except_current(
            db,
            user_id=user.id,
            current_raw_token=current_refresh_token,
        )
        db.flush()

    def list_roles(self, db: Session, org_id: UUID) -> list[RoleResponse]:
        roles = db.scalars(select(Role).where(or_(Role.org_id.is_(None), Role.org_id == org_id))).all()
        return [
            RoleResponse(
                id=role.id,
                org_id=role.org_id,
                name=role.name,
                description=role.description,
                is_system=role.is_system,
            )
            for role in roles
        ]


user_service = UserService()
