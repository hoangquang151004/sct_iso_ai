from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from db_session import get_db

from .schemas import (
    KpiSnapshotCreate,
    KpiSnapshotResponse,
    ReportConfigCreate,
    ReportConfigResponse,
    ReportConfigUpdate,
    ReportHistoryCreate,
    ReportHistoryResponse,
)
from .service import report_service

report_router = APIRouter(prefix="/reports", tags=["Reports"])


@report_router.post(
    "/configs",
    response_model=ReportConfigResponse,
    status_code=status.HTTP_201_CREATED,
    description="Tạo mới một cấu hình báo cáo hệ thống",
)
def create_report_config(
    payload: ReportConfigCreate,
    db: Session = Depends(get_db),
) -> ReportConfigResponse:
    return report_service.create_report_config(db, payload)


@report_router.get(
    "/configs",
    response_model=list[ReportConfigResponse],
    description="Lấy danh sách cấu hình báo cáo, hỗ trợ lọc theo loại và trạng thái",
)
def list_report_configs(
    org_id: UUID | None = Query(default=None),
    report_type: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ReportConfigResponse]:
    return report_service.list_report_configs(
        db=db,
        org_id=org_id,
        report_type=report_type,
        is_active=is_active,
    )


@report_router.get(
    "/configs/{config_id}",
    response_model=ReportConfigResponse,
    description="Lấy chi tiết cấu hình báo cáo theo ID",
)
def get_report_config(
    config_id: UUID,
    db: Session = Depends(get_db),
) -> ReportConfigResponse:
    return report_service.get_report_config(db, config_id)


@report_router.patch(
    "/configs/{config_id}",
    response_model=ReportConfigResponse,
    description="Cập nhật các tham số hoặc thông tin cấu hình báo cáo",
)
def update_report_config(
    config_id: UUID,
    payload: ReportConfigUpdate,
    db: Session = Depends(get_db),
) -> ReportConfigResponse:
    return report_service.update_report_config(db, config_id, payload)


@report_router.post(
    "/configs/{config_id}/history",
    response_model=ReportHistoryResponse,
    status_code=status.HTTP_201_CREATED,
    description="Ghi lại lịch sử thực hiện xuất báo cáo",
)
def create_report_history(
    config_id: UUID,
    payload: ReportHistoryCreate,
    db: Session = Depends(get_db),
) -> ReportHistoryResponse:
    return report_service.create_report_history(db, config_id, payload)


@report_router.get(
    "/configs/{config_id}/history",
    response_model=list[ReportHistoryResponse],
    description="Lấy danh sách lịch sử các lần xuất báo cáo của một cấu hình",
)
def list_report_history(
    config_id: UUID,
    db: Session = Depends(get_db),
) -> list[ReportHistoryResponse]:
    return report_service.list_report_history(db, config_id)


@report_router.post(
    "/kpi-snapshots",
    response_model=KpiSnapshotResponse,
    status_code=status.HTTP_201_CREATED,
    description="Ghi lại số liệu KPI tại một thời điểm nhất định",
)
def create_kpi_snapshot(
    payload: KpiSnapshotCreate,
    db: Session = Depends(get_db),
) -> KpiSnapshotResponse:
    return report_service.create_kpi_snapshot(db, payload)


@report_router.get(
    "/kpi-snapshots",
    response_model=list[KpiSnapshotResponse],
    description="Lấy danh sách các bản ghi KPI theo tổ chức và kỳ báo cáo",
)
def list_kpi_snapshots(
    org_id: UUID,
    period_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[KpiSnapshotResponse]:
    return report_service.list_kpi_snapshots(db=db, org_id=org_id, period_type=period_type)
