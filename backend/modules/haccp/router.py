from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.modules.haccp.schemas import HaccpPlanCreate, HaccpPlanResponse

router = APIRouter(prefix="/haccp", tags=["HACCP"])


@router.get("/plans", response_model=list[HaccpPlanResponse])
def list_haccp_plans() -> list[HaccpPlanResponse]:
    return []


@router.post("/plans", response_model=HaccpPlanResponse, status_code=status.HTTP_201_CREATED)
def create_haccp_plan(payload: HaccpPlanCreate) -> HaccpPlanResponse:
    return HaccpPlanResponse(
        id=uuid4(),
        org_id=payload.org_id,
        product_id=payload.product_id,
        name=payload.name,
        version=payload.version,
        scope=payload.scope,
    )


@router.get("/plans/{plan_id}", response_model=HaccpPlanResponse)
def get_haccp_plan(plan_id: UUID) -> HaccpPlanResponse:
    return HaccpPlanResponse(
        id=plan_id,
        org_id=uuid4(),
        product_id=uuid4(),
        name="HACCP plan demo",
        version="1.0",
    )
