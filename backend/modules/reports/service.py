from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import String, cast, select
from sqlalchemy.orm import Session

from database.models import KPISnapshot, ReportConfig, ReportHistory

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
    def _get_report_config_or_404(self, db: Session, config_id: UUID) -> ReportConfig:
        result = db.execute(
            select(ReportConfig).where(cast(ReportConfig.id, String) == str(config_id)).limit(1)
        ).scalar_one_or_none()
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report config not found",
            )
        return result

    def create_report_config(self, db: Session, payload: ReportConfigCreate) -> ReportConfigResponse:
        model = ReportConfig(
            org_id=str(payload.org_id),
            created_by=str(payload.created_by),
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
        )
        db.add(model)
        db.commit()
        return ReportConfigResponse.model_validate(model)

    def list_report_configs(
        self,
        db: Session,
        org_id: UUID | None = None,
        report_type: str | None = None,
        is_active: bool | None = None,
    ) -> list[ReportConfigResponse]:
        stmt = select(ReportConfig)
        if org_id is not None:
            stmt = stmt.where(cast(ReportConfig.org_id, String) == str(org_id))
        if report_type is not None:
            stmt = stmt.where(ReportConfig.report_type == report_type)
        if is_active is not None:
            stmt = stmt.where(ReportConfig.is_active == is_active)
        rows = db.execute(stmt.order_by(ReportConfig.created_at.desc())).scalars().all()
        return [ReportConfigResponse.model_validate(item) for item in rows]

    def get_report_config(self, db: Session, config_id: UUID) -> ReportConfigResponse:
        return ReportConfigResponse.model_validate(self._get_report_config_or_404(db, config_id))

    def update_report_config(
        self, db: Session, config_id: UUID, payload: ReportConfigUpdate
    ) -> ReportConfigResponse:
        current = self._get_report_config_or_404(db, config_id)
        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(current, field, value)
        db.add(current)
        db.commit()
        return ReportConfigResponse.model_validate(current)

    def create_report_history(
        self, db: Session, config_id: UUID, payload: ReportHistoryCreate
    ) -> ReportHistoryResponse:
        config = self._get_report_config_or_404(db, config_id)
        model = ReportHistory(
            config_id=str(config_id),
            org_id=str(config.org_id),
            report_name=payload.report_name,
            period_from=payload.period_from,
            period_to=payload.period_to,
            parameters=payload.parameters,
            file_url=payload.file_url,
            file_format=payload.file_format,
            generated_by=str(payload.generated_by),
            sent_to=payload.sent_to,
            status=payload.status,
        )
        db.add(model)
        db.commit()
        return ReportHistoryResponse.model_validate(model)

    def list_report_history(self, db: Session, config_id: UUID) -> list[ReportHistoryResponse]:
        self._get_report_config_or_404(db, config_id)
        rows = db.execute(
            select(ReportHistory)
            .where(cast(ReportHistory.config_id, String) == str(config_id))
            .order_by(ReportHistory.created_at.desc())
        ).scalars().all()
        return [ReportHistoryResponse.model_validate(item) for item in rows]

    def create_kpi_snapshot(self, db: Session, payload: KpiSnapshotCreate) -> KpiSnapshotResponse:
        model = KPISnapshot(
            org_id=str(payload.org_id),
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
        )
        db.add(model)
        db.commit()
        return KpiSnapshotResponse.model_validate(model)

    def list_kpi_snapshots(
        self, db: Session, org_id: UUID, period_type: str | None = None
    ) -> list[KpiSnapshotResponse]:
        stmt = select(KPISnapshot).where(cast(KPISnapshot.org_id, String) == str(org_id))
        if period_type is not None:
            stmt = stmt.where(KPISnapshot.period_type == period_type)
        rows = db.execute(stmt.order_by(KPISnapshot.snapshot_date.asc())).scalars().all()
        return [KpiSnapshotResponse.model_validate(item) for item in rows]


report_service = ReportService()
