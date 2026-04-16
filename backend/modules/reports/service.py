from datetime import datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from .schemas import (
    KpiSnapshotCreate,
    KpiSnapshotResponse,
    ReportConfigCreate,
    ReportConfigResponse,
    ReportConfigUpdate,
    ReportHistoryCreate,
    ReportHistoryResponse,
)


class ReportService:
    def __init__(self) -> None:
        self._report_configs: dict[UUID, ReportConfigResponse] = {}
        self._report_history: dict[UUID, list[ReportHistoryResponse]] = {}
        self._kpi_snapshots: dict[UUID, list[KpiSnapshotResponse]] = {}

    def _get_report_config_or_404(self, config_id: UUID) -> ReportConfigResponse:
        result = self._report_configs.get(config_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Report config not found"
            )
        return result

    def create_report_config(self, payload: ReportConfigCreate) -> ReportConfigResponse:
        result = ReportConfigResponse(
            id=uuid4(),
            org_id=payload.org_id,
            created_by=payload.created_by,
            name=payload.name,
            report_type=payload.report_type,
            description=payload.description,
            target_roles=payload.target_roles,
            filter_config=payload.filter_config,
            schedule_type=payload.schedule_type,
            schedule_config=payload.schedule_config,
            recipients=payload.recipients,
            output_format=payload.output_format,
            is_active=payload.is_active,
            created_at=datetime.utcnow(),
        )
        self._report_configs[result.id] = result
        self._report_history[result.id] = []
        self._kpi_snapshots.setdefault(result.org_id, [])
        return result

    def list_report_configs(
        self,
        org_id: UUID | None = None,
        report_type: str | None = None,
        is_active: bool | None = None,
    ) -> list[ReportConfigResponse]:
        result = list(self._report_configs.values())
        if org_id is not None:
            result = [item for item in result if item.org_id == org_id]
        if report_type is not None:
            result = [item for item in result if item.report_type == report_type]
        if is_active is not None:
            result = [item for item in result if item.is_active == is_active]
        return result

    def get_report_config(self, config_id: UUID) -> ReportConfigResponse:
        result = self._get_report_config_or_404(config_id)
        return result

    def update_report_config(
        self, config_id: UUID, payload: ReportConfigUpdate
    ) -> ReportConfigResponse:
        current = self._get_report_config_or_404(config_id)
        result = current.model_copy(update=payload.model_dump(exclude_unset=True))
        self._report_configs[config_id] = result
        return result

    def create_report_history(
        self, config_id: UUID, payload: ReportHistoryCreate
    ) -> ReportHistoryResponse:
        config = self._get_report_config_or_404(config_id)
        result = ReportHistoryResponse(
            id=uuid4(),
            config_id=config_id,
            org_id=config.org_id,
            report_name=payload.report_name,
            period_from=payload.period_from,
            period_to=payload.period_to,
            parameters=payload.parameters,
            file_url=payload.file_url,
            file_format=payload.file_format,
            generated_by=payload.generated_by,
            sent_to=payload.sent_to,
            status=payload.status,
            created_at=datetime.utcnow(),
        )
        self._report_history.setdefault(config_id, []).append(result)
        return result

    def list_report_history(self, config_id: UUID) -> list[ReportHistoryResponse]:
        self._get_report_config_or_404(config_id)
        result = self._report_history.get(config_id, [])
        return result

    def create_kpi_snapshot(self, payload: KpiSnapshotCreate) -> KpiSnapshotResponse:
        result = KpiSnapshotResponse(
            id=uuid4(),
            org_id=payload.org_id,
            snapshot_date=payload.snapshot_date,
            period_type=payload.period_type,
            doc_total=payload.doc_total,
            doc_approved=payload.doc_approved,
            doc_pending=payload.doc_pending,
            doc_overdue_review=payload.doc_overdue_review,
            haccp_ccp_monitored_rate=payload.haccp_ccp_monitored_rate,
            haccp_deviation_count=payload.haccp_deviation_count,
            prp_audit_compliance_rate=payload.prp_audit_compliance_rate,
            prp_nc_open_count=payload.prp_nc_open_count,
            capa_ontime_closure_rate=payload.capa_ontime_closure_rate,
            capa_open_count=payload.capa_open_count,
            capa_overdue_count=payload.capa_overdue_count,
            alert_critical_count=payload.alert_critical_count,
            alert_open_count=payload.alert_open_count,
            computed_at=datetime.utcnow(),
        )
        self._kpi_snapshots.setdefault(payload.org_id, []).append(result)
        return result

    def list_kpi_snapshots(
        self, org_id: UUID, period_type: str | None = None
    ) -> list[KpiSnapshotResponse]:
        result = self._kpi_snapshots.get(org_id, [])
        if period_type is not None:
            result = [item for item in result if item.period_type == period_type]
        return result


report_service = ReportService()
