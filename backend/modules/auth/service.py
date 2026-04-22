import secrets
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID
from uuid import uuid4

from fastapi import HTTPException, Request, Response, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from core.config import settings
from database.models import Permission, RefreshToken, RolePermission, User, UserRole

from .schemas import AuthPrincipal

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    def __init__(self) -> None:
        self._secret_key = settings.jwt_secret_key
        self._algorithm = settings.jwt_algorithm
        self._access_ttl_minutes = settings.access_token_ttl_minutes
        self._refresh_ttl_days = settings.refresh_token_ttl_days
        self._refresh_cookie_name = settings.refresh_token_cookie_name
        self._refresh_cookie_secure = settings.refresh_cookie_secure
        self._refresh_cookie_samesite = settings.refresh_cookie_samesite
        self._token_version_cache: dict[str, tuple[int, datetime]] = {}
        self._token_version_cache_ttl_seconds = 30

    @staticmethod
    def _error_detail(message: str, error_code: str) -> dict:
        return {
            "message": message,
            "error_code": error_code,
            "request_id": str(uuid4()),
            "fields": [],
        }

    def _build_principal(self, db: Session, user: User) -> AuthPrincipal:
        role_ids = [item.role_id for item in db.scalars(select(UserRole).where(UserRole.user_id == user.id))]
        if not role_ids:
            permissions: list[str] = []
        else:
            permissions = db.scalars(
                select(Permission.code)
                .join(RolePermission, RolePermission.permission_id == Permission.id)
                .where(RolePermission.role_id.in_(role_ids))
            ).all()
        return AuthPrincipal(
            user_id=user.id,
            username=user.username,
            role_ids=role_ids,
            permissions=sorted(set(permissions)),
            org_id=user.org_id,
            token_version=user.token_version,
            must_change_password=user.must_change_password,
            exp=0,
        )

    def authenticate(self, db: Session, username: str, password: str) -> User:
        account = db.scalar(select(User).where(User.username == username))
        if (
            account is None
            or not account.is_active
            or not pwd_context.verify(password, account.password_hash)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._error_detail(
                    "Thông tin đăng nhập không hợp lệ.", "AUTH_INVALID_CREDENTIALS"
                ),
            )
        account.last_login = datetime.now(UTC)
        db.flush()
        return account

    def create_access_token(self, principal: AuthPrincipal) -> tuple[str, datetime]:
        expires_at = datetime.now(UTC) + timedelta(minutes=self._access_ttl_minutes)
        payload = {
            "user_id": principal.user_id,
            "username": principal.username,
            "role_ids": principal.role_ids,
            "permissions": principal.permissions,
            "org_id": str(principal.org_id),
            "tv": principal.token_version,
            "mcp": principal.must_change_password,
            "exp": expires_at,
        }
        token = jwt.encode(payload, self._secret_key, algorithm=self._algorithm)
        return token, expires_at

    def _hash_refresh_token(self, token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

    def issue_refresh_token(
        self,
        db: Session,
        user_id: str,
        *,
        request: Request | None = None,
        device_label: str | None = None,
        inherited_user_agent: str | None = None,
        inherited_ip: str | None = None,
        inherited_device_label: str | None = None,
    ) -> tuple[str, datetime]:
        raw_token = secrets.token_urlsafe(48)
        expires_at = datetime.now(UTC) + timedelta(days=self._refresh_ttl_days)
        user_agent = inherited_user_agent
        ip = inherited_ip
        if request is not None:
            user_agent = request.headers.get("user-agent")
            ip = request.client.host if request.client else None
        final_device_label = device_label or inherited_device_label
        db.add(
            RefreshToken(
                id=uuid4(),
                user_id=UUID(user_id),
                token_hash=self._hash_refresh_token(raw_token),
                user_agent=user_agent[:512] if user_agent else None,
                ip=ip[:64] if ip else None,
                device_label=final_device_label[:128] if final_device_label else None,
                last_used_at=datetime.now(UTC),
                expires_at=expires_at,
            )
        )
        db.flush()
        return raw_token, expires_at

    def set_refresh_cookie(self, response: Response, token: str, expires_at: datetime) -> None:
        response.set_cookie(
            key=self._refresh_cookie_name,
            value=token,
            httponly=True,
            secure=self._refresh_cookie_secure,
            samesite=self._refresh_cookie_samesite,
            expires=int(expires_at.timestamp()),
            path="/auth",
        )

    def clear_refresh_cookie(self, response: Response) -> None:
        response.delete_cookie(key=self._refresh_cookie_name, path="/auth")

    def rotate_refresh_token(self, db: Session, raw_token: str) -> tuple[AuthPrincipal, RefreshToken]:
        token_hash = self._hash_refresh_token(raw_token)
        entity = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        now = datetime.now(UTC)
        expires_at = entity.expires_at if entity is not None else None
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        if entity is None or entity.revoked_at is not None or (expires_at is not None and expires_at < now):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._error_detail("Refresh token không hợp lệ.", "UNAUTHORIZED"),
            )
        entity.revoked_at = now
        user = db.scalar(select(User).where(User.id == entity.user_id))
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._error_detail("Phiên đăng nhập không hợp lệ.", "UNAUTHORIZED"),
            )
        return self._build_principal(db, user), entity

    def revoke_refresh_token(self, db: Session, raw_token: str | None) -> None:
        if not raw_token:
            return
        token_hash = self._hash_refresh_token(raw_token)
        entity = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        if entity is not None and entity.revoked_at is None:
            entity.revoked_at = datetime.now(UTC)

    def list_active_sessions(
        self, db: Session, *, user_id: str, current_raw_token: str | None
    ) -> list[RefreshToken]:
        now = datetime.now(UTC)
        query = (
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.revoked_at.is_(None))
        )
        rows = db.scalars(query.order_by(RefreshToken.created_at.desc())).all()
        results: list[RefreshToken] = []
        for row in rows:
            expires_at = row.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=UTC)
            if expires_at >= now:
                results.append(row)
        return results

    def current_token_hash(self, raw_token: str | None) -> str | None:
        if not raw_token:
            return None
        return self._hash_refresh_token(raw_token)

    def revoke_session_by_id(self, db: Session, *, user_id: str, session_id: str) -> bool:
        token = db.scalar(
            select(RefreshToken).where(
                and_(RefreshToken.id == session_id, RefreshToken.user_id == user_id)
            )
        )
        if token is None:
            return False
        if token.revoked_at is None:
            token.revoked_at = datetime.now(UTC)
        return True

    def revoke_all_sessions_except_current(
        self, db: Session, *, user_id: str, current_raw_token: str | None
    ) -> int:
        now = datetime.now(UTC)
        current_hash = self.current_token_hash(current_raw_token)
        rows = db.scalars(
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.revoked_at.is_(None))
        ).all()
        revoked_count = 0
        for row in rows:
            if current_hash and row.token_hash == current_hash:
                continue
            row.revoked_at = now
            revoked_count += 1
        return revoked_count

    def admin_revoke_all_sessions_for_user(self, db: Session, *, user_id: str) -> int:
        now = datetime.now(UTC)
        rows = db.scalars(
            select(RefreshToken)
            .where(RefreshToken.user_id == user_id)
            .where(RefreshToken.revoked_at.is_(None))
        ).all()
        revoked_count = 0
        for row in rows:
            row.revoked_at = now
            revoked_count += 1

        user = db.scalar(select(User).where(User.id == user_id))
        if user is None:
            return revoked_count
        user.token_version += 1
        self.invalidate_user_token_version_cache(user.id)
        return revoked_count

    def decode_token(self, token: str) -> AuthPrincipal:
        try:
            payload = jwt.decode(token, self._secret_key, algorithms=[self._algorithm])
            if "tv" in payload and "token_version" not in payload:
                payload["token_version"] = payload["tv"]
            if "mcp" in payload and "must_change_password" not in payload:
                payload["must_change_password"] = payload["mcp"]
            return AuthPrincipal.model_validate(payload)
        except (JWTError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._error_detail(
                    "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.", "UNAUTHORIZED"
                ),
            ) from None

    def _get_user_token_version(self, db: Session, user_id: str) -> int:
        cached = self._token_version_cache.get(user_id)
        now = datetime.now(UTC)
        if cached and cached[1] > now:
            return cached[0]

        token_version = db.scalar(select(User.token_version).where(User.id == user_id))
        if token_version is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._error_detail("Phiên đăng nhập không hợp lệ.", "UNAUTHORIZED"),
            )
        self._token_version_cache[user_id] = (
            int(token_version),
            now + timedelta(seconds=self._token_version_cache_ttl_seconds),
        )
        return int(token_version)

    def invalidate_user_token_version_cache(self, user_id: str) -> None:
        self._token_version_cache.pop(user_id, None)

    def ensure_token_version_valid(self, db: Session, principal: AuthPrincipal) -> AuthPrincipal:
        current_token_version = self._get_user_token_version(db, principal.user_id)
        if principal.token_version < current_token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._error_detail("Phiên đăng nhập đã bị thu hồi.", "UNAUTHORIZED"),
            )
        # JWT still carries role_ids/permissions from issue time; reload from DB so RBAC
        # changes (role permissions, assignments) apply without waiting for a new token.
        return self.principal_from_user_id(db, principal.user_id)

    @property
    def refresh_cookie_name(self) -> str:
        return self._refresh_cookie_name

    def principal_from_user_id(self, db: Session, user_id: str) -> AuthPrincipal:
        user = db.scalar(select(User).where(User.id == user_id))
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=self._error_detail("Phiên đăng nhập không hợp lệ.", "UNAUTHORIZED"),
            )
        return self._build_principal(db, user)


auth_service = AuthService()
