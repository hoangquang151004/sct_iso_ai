from uuid import UUID

from fastapi import APIRouter, Query, status

from .schemas import UserCreate, UserResponse
from .service import user_service

users_router = APIRouter(prefix="/users", tags=["Users"])


@users_router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate) -> UserResponse:
    result = user_service.create_user(payload)
    return result


@users_router.get("", response_model=list[UserResponse])
def list_users(
    org_id: UUID | None = Query(default=None),
    role_id: UUID | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    department: str | None = Query(default=None),
) -> list[UserResponse]:
    result = user_service.list_users(
        org_id=org_id,
        role_id=role_id,
        is_active=is_active,
        department=department,
    )
    return result


@users_router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: UUID) -> UserResponse:
    result = user_service.get_user(user_id)
    return result
