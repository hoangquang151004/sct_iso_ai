from uuid import UUID

from fastapi import APIRouter, Query, status

from modules.reports.schemas import (
    KpiSnapshotCreate,
    KpiSnapshotResponse,
    ReportConfigCreate,
    ReportConfigResponse,
    ReportConfigUpdate,
    ReportHistoryCreate,
    ReportHistoryResponse,
)
from modules.reports.service import report_service

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("/configs", response_model=ReportConfigResponse, status_code=status.HTTP_201_CREATED)
def create_report_config(payload: ReportConfigCreate) -> ReportConfigResponse:
    result = report_service.create_report_config(payload)
    return result


@router.get("/configs", response_model=list[ReportConfigResponse])
def list_report_configs(
    org_id: UUID | None = Query(default=None),
    report_type: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
) -> list[ReportConfigResponse]:
    result = report_service.list_report_configs(
        org_id=org_id,
        report_type=report_type,
        is_active=is_active,
    )
    return result


@router.get("/configs/{config_id}", response_model=ReportConfigResponse)
def get_report_config(config_id: UUID) -> ReportConfigResponse:
    result = report_service.get_report_config(config_id)
    return result


@router.patch("/configs/{config_id}", response_model=ReportConfigResponse)
def update_report_config(config_id: UUID, payload: ReportConfigUpdate) -> ReportConfigResponse:
    result = report_service.update_report_config(config_id, payload)
    return result


@router.post(
    "/configs/{config_id}/history",
    response_model=ReportHistoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_report_history(config_id: UUID, payload: ReportHistoryCreate) -> ReportHistoryResponse:
    result = report_service.create_report_history(config_id, payload)
    return result


@router.get("/configs/{config_id}/history", response_model=list[ReportHistoryResponse])
def list_report_history(config_id: UUID) -> list[ReportHistoryResponse]:
    result = report_service.list_report_history(config_id)
    return result


@router.post("/kpi-snapshots", response_model=KpiSnapshotResponse, status_code=status.HTTP_201_CREATED)
def create_kpi_snapshot(payload: KpiSnapshotCreate) -> KpiSnapshotResponse:
    result = report_service.create_kpi_snapshot(payload)
    return result


@router.get("/kpi-snapshots", response_model=list[KpiSnapshotResponse])
def list_kpi_snapshots(
    org_id: UUID,
    period_type: str | None = Query(default=None),
) -> list[KpiSnapshotResponse]:
    result = report_service.list_kpi_snapshots(org_id=org_id, period_type=period_type)
    return result
