from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.modules.prp.schemas import PrpAuditCreate, PrpAuditResponse

router = APIRouter(prefix="/prp", tags=["PRP"])


@router.get("/audits", response_model=list[PrpAuditResponse])
def list_prp_audits() -> list[PrpAuditResponse]:
    return []


@router.post("/audits", response_model=PrpAuditResponse, status_code=status.HTTP_201_CREATED)
def create_prp_audit(payload: PrpAuditCreate) -> PrpAuditResponse:
    return PrpAuditResponse(
        id=uuid4(),
        org_id=payload.org_id,
        prp_program_id=payload.prp_program_id,
        area=payload.area,
        audit_date=payload.audit_date,
        notes=payload.notes,
    )


@router.get("/audits/{audit_id}", response_model=PrpAuditResponse)
def get_prp_audit(audit_id: UUID) -> PrpAuditResponse:
    return PrpAuditResponse(
        id=audit_id,
        org_id=uuid4(),
        prp_program_id=uuid4(),
        area="Production",
        audit_date="2026-01-01",  # type: ignore[arg-type]
    )
