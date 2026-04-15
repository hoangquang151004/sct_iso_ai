from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.modules.capa.schemas import CapaCreate, CapaResponse

router = APIRouter(prefix="/capa", tags=["CAPA"])


@router.get("", response_model=list[CapaResponse])
def list_capas() -> list[CapaResponse]:
    return []


@router.post("", response_model=CapaResponse, status_code=status.HTTP_201_CREATED)
def create_capa(payload: CapaCreate) -> CapaResponse:
    return CapaResponse(
        id=uuid4(),
        org_id=payload.org_id,
        nc_id=payload.nc_id,
        title=payload.title,
        capa_type=payload.capa_type,
        root_cause=payload.root_cause,
        due_date=payload.due_date,
        priority=payload.priority,
    )


@router.get("/{capa_id}", response_model=CapaResponse)
def get_capa(capa_id: UUID) -> CapaResponse:
    return CapaResponse(
        id=capa_id,
        org_id=uuid4(),
        nc_id=uuid4(),
        title="CAPA demo",
    )
