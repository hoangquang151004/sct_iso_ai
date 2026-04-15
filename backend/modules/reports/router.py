from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.modules.reports.schemas import ReportConfigCreate, ReportConfigResponse

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/configs", response_model=list[ReportConfigResponse])
def list_report_configs() -> list[ReportConfigResponse]:
    return []


@router.post("/configs", response_model=ReportConfigResponse, status_code=status.HTTP_201_CREATED)
def create_report_config(payload: ReportConfigCreate) -> ReportConfigResponse:
    return ReportConfigResponse(
        id=uuid4(),
        org_id=payload.org_id,
        name=payload.name,
        report_type=payload.report_type,
        description=payload.description,
        schedule_type=payload.schedule_type,
        recipients=payload.recipients,
    )


@router.get("/configs/{config_id}", response_model=ReportConfigResponse)
def get_report_config(config_id: UUID) -> ReportConfigResponse:
    return ReportConfigResponse(
        id=config_id,
        org_id=uuid4(),
        name="Bao cao KPI thang",
        report_type="KPI",
    )
