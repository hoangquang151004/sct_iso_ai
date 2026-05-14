from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from db_session import get_db

from .schemas import (
    InternalAuditSummaryResponse,
    KpiDrilldownResponse,
    KpiSnapshotCreate,
    KpiSnapshotResponse,
    ReportConfigCreate,
    ReportConfigResponse,
    ReportConfigUpdate,
    ReportHistoryCreate,
    ReportHistoryResponse,
    ReportLocationResponse,
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


@report_router.get(
    "/locations",
    response_model=list[ReportLocationResponse],
    description="Danh sách khu vực (locations) của tổ chức — dùng lọc báo cáo đánh giá nội bộ",
)
def list_report_locations(
    org_id: UUID,
    db: Session = Depends(get_db),
) -> list[ReportLocationResponse]:
    return report_service.list_locations_for_org(db, org_id)


@report_router.get(
    "/internal-audit-summary",
    response_model=InternalAuditSummaryResponse,
    description="Tóm tắt & thông báo đánh giá nội bộ theo khu vực (PRP) và chỉ số cấp tổ chức",
)
def get_internal_audit_summary(
    org_id: UUID,
    location_id: UUID | None = Query(default=None),
    period_days: int = Query(default=120, ge=7, le=730),
    db: Session = Depends(get_db),
) -> InternalAuditSummaryResponse:
    return report_service.internal_audit_summary(
        db, org_id, location_id, period_days
    )


@report_router.get(
    "/kpi-drilldown",
    response_model=KpiDrilldownResponse,
    description="Drill-down KPI: phân rã theo khu vực, lô, thiết bị (PRP / HACCP / CAPA)",
)
def get_kpi_drilldown(
    org_id: UUID,
    kpi_type: str = Query(..., description="prp | haccp | capa"),
    period_days: int = Query(default=120, ge=7, le=730),
    db: Session = Depends(get_db),
) -> KpiDrilldownResponse:
    return report_service.kpi_drilldown(db, org_id, kpi_type.strip().lower(), period_days)
