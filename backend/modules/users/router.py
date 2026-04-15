from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.modules.users.schemas import UserCreate, UserResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserResponse])
def list_users() -> list[UserResponse]:
    return []


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate) -> UserResponse:
    return UserResponse(
        id=uuid4(),
        org_id=payload.org_id,
        role_id=payload.role_id,
        username=payload.username,
        email=payload.email,
        full_name=payload.full_name,
        department=payload.department,
        position=payload.position,
        phone=payload.phone,
        is_active=True,
        last_login=None,
    )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: UUID) -> UserResponse:
    return UserResponse(
        id=user_id,
        org_id=uuid4(),
        role_id=uuid4(),
        username="demo.user",
        email="demo@example.com",
        full_name="Demo User",
        department="QA",
        position="Manager",
        phone=None,
        is_active=True,
        last_login=None,
    )
