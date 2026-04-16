from datetime import datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from modules.users.schemas import UserCreate, UserResponse


class UserService:
    def __init__(self) -> None:
        self._users: dict[UUID, UserResponse] = {}

    def _get_user_or_404(self, user_id: UUID) -> UserResponse:
        result = self._users.get(user_id)
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return result

    def _ensure_unique_fields(self, payload: UserCreate) -> None:
        for item in self._users.values():
            if item.email.lower() == payload.email.lower():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
            if item.username.lower() == payload.username.lower():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")

    def create_user(self, payload: UserCreate) -> UserResponse:
        self._ensure_unique_fields(payload)
        now = datetime.utcnow()
        result = UserResponse(
            id=uuid4(),
            org_id=payload.org_id,
            role_id=payload.role_id,
            username=payload.username,
            email=payload.email,
            full_name=payload.full_name,
            department=payload.department,
            position=payload.position,
            phone=payload.phone,
            avatar_url=payload.avatar_url,
            is_active=payload.is_active,
            last_login=None,
            created_at=now,
            updated_at=now,
        )
        self._users[result.id] = result
        return result

    def list_users(
        self,
        org_id: UUID | None = None,
        role_id: UUID | None = None,
        is_active: bool | None = None,
        department: str | None = None,
    ) -> list[UserResponse]:
        result = list(self._users.values())
        if org_id is not None:
            result = [item for item in result if item.org_id == org_id]
        if role_id is not None:
            result = [item for item in result if item.role_id == role_id]
        if is_active is not None:
            result = [item for item in result if item.is_active == is_active]
        if department is not None:
            result = [item for item in result if item.department == department]
        return result

    def get_user(self, user_id: UUID) -> UserResponse:
        result = self._get_user_or_404(user_id)
        return result


user_service = UserService()
