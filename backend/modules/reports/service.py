import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4
from fastapi import HTTPException, status
from sqlalchemy import Date, DateTime, String, and_, case, cast, func, or_, select
from sqlalchemy.orm import Session


from database.models import (
    Alert,
    CAPA,
    CCP,
    CCPMonitoringLog,
    Document,
    HACCPPlan,
    IoTDevice,
    KPISnapshot,
    Location,
    NonConformity,
    PRPAudit,
    ReportConfig,
    ReportHistory,
)
from .schemas import (
    InternalAuditSummaryResponse,
    InternalSignalItem,
    KpiDrilldownBlock,
    KpiDrilldownRow,
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
from core.compliance import (
    calculate_capa_ontime_rate,
    calculate_percentage,
    calculate_prp_average,
    count_low_compliance_sessions,
    estimate_capa_ontime_rate_fallback,
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
    @staticmethod
    def _month_start_utc(year: int, month: int) -> datetime:
        return datetime(year, month, 1, tzinfo=timezone.utc)
    @staticmethod
    def _next_month_start_utc(year: int, month: int) -> datetime:
        if month == 12:
            return datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        return datetime(year, month + 1, 1, tzinfo=timezone.utc)
    @staticmethod
    def _ym_le(a: tuple[int, int], b: tuple[int, int]) -> bool:
        return a[0] < b[0] or (a[0] == b[0] and a[1] <= b[1])

    @staticmethod
    def _expand_months(start: tuple[int, int], end: tuple[int, int]) -> list[tuple[int, int]]:
        out: list[tuple[int, int]] = []
        y, m = start
        while ReportService._ym_le((y, m), end):
            out.append((y, m))
            if m == 12:
                y += 1
                m = 1
            else:
                m += 1
        return out

    def _distinct_activity_months(self, db: Session, org_id: UUID) -> set[tuple[int, int]]:
        months: set[tuple[int, int]] = set()

        def add_rows(rows: list[tuple]) -> None:
            for row in rows:
                if row[0] is None or row[1] is None:
                    continue
                months.add((int(row[0]), int(row[1])))

        q_prp = (
            select(
                func.extract("year", PRPAudit.audit_date),
                func.extract("month", PRPAudit.audit_date),
            )
            .where(PRPAudit.org_id == org_id)
            .distinct()
        )
        add_rows(list(db.execute(q_prp).all()))

        q_capa = (
            select(
                func.extract("year", CAPA.created_at),
                func.extract("month", CAPA.created_at),
            )
            .where(CAPA.org_id == org_id)
            .distinct()
        )
        add_rows(list(db.execute(q_capa).all()))

        q_doc = (
            select(
                func.extract("year", Document.created_at),
                func.extract("month", Document.created_at),
            )
            .where(Document.org_id == org_id)
            .distinct()
        )
        add_rows(list(db.execute(q_doc).all()))

        q_ccp = (
            select(
                func.extract("year", CCPMonitoringLog.recorded_at),
                func.extract("month", CCPMonitoringLog.recorded_at),
            )
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .where(HACCPPlan.org_id == org_id)
            .distinct()
        )
        add_rows(list(db.execute(q_ccp).all()))

        return months

    def _distinct_activity_days(self, db: Session, org_id: UUID) -> set[date]:
        days: set[date] = set()

        def add_date_rows(rows: list[date | None]) -> None:
            for d in rows:
                if d is not None:
                    days.add(d)

        add_date_rows(
            list(
                db.execute(
                    select(PRPAudit.audit_date).where(PRPAudit.org_id == org_id).distinct()
                ).scalars()
            )
        )
        add_date_rows(
            list(
                db.execute(
                    select(cast(CAPA.created_at, Date))
                    .where(CAPA.org_id == org_id)
                    .distinct()
                ).scalars()
            )
        )
        add_date_rows(
            list(
                db.execute(
                    select(cast(Document.created_at, Date))
                    .where(Document.org_id == org_id)
                    .distinct()
                ).scalars()
            )
        )
        add_date_rows(
            list(
                db.execute(
                    select(cast(CCPMonitoringLog.recorded_at, Date))
                    .select_from(CCPMonitoringLog)
                    .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
                    .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
                    .where(HACCPPlan.org_id == org_id)
                    .distinct()
                ).scalars()
            )
        )
        return days

    def _to_utc_date(self, dt: datetime) -> date:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc).date()
        return dt.astimezone(timezone.utc).date()

    def _distinct_activity_weeks(self, db: Session, org_id: UUID) -> set[date]:
        """Thứ Hai đầu tuần (UTC) có hoạt động."""
        weeks: set[date] = set()
        ts = DateTime(timezone=True)

        def add_trunc(rows: list[datetime | None]) -> None:
            for raw in rows:
                if raw is None:
                    continue
                d = self._to_utc_date(raw)
                monday = d - timedelta(days=d.weekday())
                weeks.add(monday)

        for row in db.execute(
            select(func.date_trunc("week", cast(PRPAudit.audit_date, ts)))
            .where(PRPAudit.org_id == org_id)
            .distinct()
        ).scalars():
            add_trunc([row])

        for row in db.execute(
            select(func.date_trunc("week", CAPA.created_at))
            .where(CAPA.org_id == org_id)
            .distinct()
        ).scalars():
            add_trunc([row])

        for row in db.execute(
            select(func.date_trunc("week", Document.created_at))
            .where(Document.org_id == org_id)
            .distinct()
        ).scalars():
            add_trunc([row])

        for row in db.execute(
            select(func.date_trunc("week", CCPMonitoringLog.recorded_at))
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .where(HACCPPlan.org_id == org_id)
            .distinct()
        ).scalars():
            add_trunc([row])

        return weeks

    def _distinct_activity_years(self, db: Session, org_id: UUID) -> set[int]:
        years: set[int] = set()

        def add_years(stmt) -> None:
            for v in db.execute(stmt).scalars():
                if v is not None:
                    years.add(int(v))

        add_years(
            select(func.extract("year", PRPAudit.audit_date))
            .where(PRPAudit.org_id == org_id)
            .distinct()
        )
        add_years(select(func.extract("year", CAPA.created_at)).where(CAPA.org_id == org_id).distinct())
        add_years(
            select(func.extract("year", Document.created_at))
            .where(Document.org_id == org_id)
            .distinct()
        )
        add_years(
            select(func.extract("year", CCPMonitoringLog.recorded_at))
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .where(HACCPPlan.org_id == org_id)
            .distinct()
        )
        return years

    def _expand_dates(self, start: date, end: date) -> list[date]:
        out: list[date] = []
        d = start
        while d <= end:
            out.append(d)
            d += timedelta(days=1)
        return out

    def _expand_weeks(self, start_monday: date, end_monday: date) -> list[date]:
        out: list[date] = []
        d = start_monday
        while d <= end_monday:
            out.append(d)
            d += timedelta(days=7)
        return out

    def _expand_years(self, y0: int, y1: int) -> list[int]:
        return list(range(y0, y1 + 1))

    def _build_kpi_snapshot_row(
        self,
        db: Session,
        org_id: UUID,
        *,
        snapshot_date: date,
        period_start: datetime,
        period_end_excl: datetime,
        period_type: str,
    ) -> KpiSnapshotResponse:
        bucket_end_date = (period_end_excl - timedelta(days=1)).date()

        doc_total = db.scalar(
            select(func.count())
            .select_from(Document)
            .where(Document.org_id == org_id, Document.created_at < period_end_excl)
        ) or 0
        doc_approved = db.scalar(
            select(func.count())
            .select_from(Document)
            .where(
                Document.org_id == org_id,
                Document.created_at < period_end_excl,
                or_(
                    Document.status == "APPROVED",
                    Document.approved_at.isnot(None),
                ),
            )
        ) or 0
        doc_pending = db.scalar(
            select(func.count())
            .select_from(Document)
            .where(
                Document.org_id == org_id,
                Document.created_at < period_end_excl,
                Document.approved_at.is_(None),
                ~Document.status.in_(["APPROVED", "REJECTED"]),
            )
        ) or 0
        doc_overdue_review = db.scalar(
            select(func.count())
            .select_from(Document)
            .where(
                Document.org_id == org_id,
                Document.created_at < period_end_excl,
                Document.next_review_at.isnot(None),
                Document.next_review_at < period_end_excl,
                Document.approved_at.is_(None),
                Document.status != "REJECTED",
            )
        ) or 0

        prp_avg = db.scalar(
            select(func.avg(PRPAudit.compliance_rate)).where(
                PRPAudit.org_id == org_id,
                PRPAudit.audit_date >= snapshot_date,
                PRPAudit.audit_date < period_end_excl.date(),
            )
        )
        prp_rate = float(prp_avg) if prp_avg is not None else None

        prp_nc_open = db.scalar(
            select(func.count())
            .select_from(NonConformity)
            .where(
                NonConformity.org_id == org_id,
                NonConformity.detected_at < period_end_excl,
                NonConformity.status.in_(["OPEN", "WAITING"]),
            )
        ) or 0

        log_total = db.scalar(
            select(func.count())
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .where(
                HACCPPlan.org_id == org_id,
                CCPMonitoringLog.recorded_at >= period_start,
                CCPMonitoringLog.recorded_at < period_end_excl,
            )
        ) or 0
        log_within = db.scalar(
            select(func.count())
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .where(
                HACCPPlan.org_id == org_id,
                CCPMonitoringLog.recorded_at >= period_start,
                CCPMonitoringLog.recorded_at < period_end_excl,
                CCPMonitoringLog.is_within_limit.is_(True),
            )
        ) or 0
        haccp_dev = db.scalar(
            select(func.count())
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .where(
                HACCPPlan.org_id == org_id,
                CCPMonitoringLog.recorded_at >= period_start,
                CCPMonitoringLog.recorded_at < period_end_excl,
                or_(
                    CCPMonitoringLog.is_within_limit.is_(False),
                    CCPMonitoringLog.deviation_severity.isnot(None),
                ),
            )
        ) or 0
        haccp_rate = calculate_percentage(float(log_within), float(log_total), decimal_places=2)

        capa_open = db.scalar(
            select(func.count())
            .select_from(CAPA)
            .where(
                CAPA.org_id == org_id,
                CAPA.created_at < period_end_excl,
                ~CAPA.status.in_(["CLOSED", "REJECTED"]),
            )
        ) or 0
        capa_overdue = db.scalar(
            select(func.count())
            .select_from(CAPA)
            .where(
                CAPA.org_id == org_id,
                CAPA.created_at < period_end_excl,
                ~CAPA.status.in_(["CLOSED", "REJECTED"]),
                CAPA.due_date.isnot(None),
                CAPA.due_date < bucket_end_date,
            )
        ) or 0
        closed_in_bucket = db.scalar(
            select(func.count())
            .select_from(CAPA)
            .where(
                CAPA.org_id == org_id,
                CAPA.status == "CLOSED",
                CAPA.created_at >= period_start,
                CAPA.created_at < period_end_excl,
            )
        ) or 0
        created_in_bucket = db.scalar(
            select(func.count())
            .select_from(CAPA)
            .where(
                CAPA.org_id == org_id,
                CAPA.created_at >= period_start,
                CAPA.created_at < period_end_excl,
            )
        ) or 0
        capa_ontime: float | None = None
        if created_in_bucket > 0:
            capa_ontime = calculate_capa_ontime_rate(
                int(closed_in_bucket), int(created_in_bucket)
            )

        alert_crit = db.scalar(
            select(func.count())
            .select_from(Alert)
            .where(
                Alert.org_id == org_id,
                Alert.created_at >= period_start,
                Alert.created_at < period_end_excl,
                Alert.severity == "CRITICAL",
            )
        ) or 0
        alert_open = db.scalar(
            select(func.count())
            .select_from(Alert)
            .where(
                Alert.org_id == org_id,
                Alert.created_at >= period_start,
                Alert.created_at < period_end_excl,
                Alert.status == "OPEN",
            )
        ) or 0

        return KpiSnapshotResponse(
            id=uuid4(),
            org_id=org_id,
            snapshot_date=snapshot_date,
            period_type=period_type,
            doc_total=int(doc_total),
            doc_approved=int(doc_approved),
            doc_pending=int(doc_pending),
            doc_overdue_review=int(doc_overdue_review),
            haccp_ccp_monitored_rate=haccp_rate,
            haccp_deviation_count=int(haccp_dev),
            prp_audit_compliance_rate=prp_rate,
            prp_nc_open_count=int(prp_nc_open),
            capa_ontime_closure_rate=capa_ontime,
            capa_open_count=int(capa_open),
            capa_overdue_count=int(capa_overdue),
            alert_critical_count=int(alert_crit),
            alert_open_count=int(alert_open),
            computed_at=datetime.now(timezone.utc),
        )

    def _computed_kpi_snapshots(self, db: Session, org_id: UUID, period_type: str) -> list[KpiSnapshotResponse]:
        today = datetime.now(timezone.utc).date()
        out: list[KpiSnapshotResponse] = []

        if period_type == "daily":
            days = self._distinct_activity_days(db, org_id)
            if not days:
                days = {today}
            d_min, d_max = min(days), max(days | {today})
            if (d_max - d_min).days > 120:
                d_min = d_max - timedelta(days=120)
            timeline = self._expand_dates(d_min, d_max)
            if len(timeline) > 120:
                timeline = timeline[-120:]
            for d in timeline:
                start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
                end = start + timedelta(days=1)
                out.append(
                    self._build_kpi_snapshot_row(
                        db,
                        org_id,
                        snapshot_date=d,
                        period_start=start,
                        period_end_excl=end,
                        period_type="daily",
                    )
                )

        elif period_type == "weekly":
            weeks = self._distinct_activity_weeks(db, org_id)
            if not weeks:
                mon = today - timedelta(days=today.weekday())
                weeks = {mon}
            w_min, w_max = min(weeks), max(weeks | {today - timedelta(days=today.weekday())})
            timeline = self._expand_weeks(w_min, w_max)
            if len(timeline) > 80:
                timeline = timeline[-80:]
            for mon in timeline:
                start = datetime(mon.year, mon.month, mon.day, tzinfo=timezone.utc)
                end = start + timedelta(days=7)
                out.append(
                    self._build_kpi_snapshot_row(
                        db,
                        org_id,
                        snapshot_date=mon,
                        period_start=start,
                        period_end_excl=end,
                        period_type="weekly",
                    )
                )

        elif period_type == "yearly":
            years = self._distinct_activity_years(db, org_id)
            if not years:
                years = {today.year}
            y_min, y_max = min(years), max(years | {today.year})
            for y in self._expand_years(y_min, y_max)[-20:]:
                start = datetime(y, 1, 1, tzinfo=timezone.utc)
                end = datetime(y + 1, 1, 1, tzinfo=timezone.utc)
                out.append(
                    self._build_kpi_snapshot_row(
                        db,
                        org_id,
                        snapshot_date=date(y, 1, 1),
                        period_start=start,
                        period_end_excl=end,
                        period_type="yearly",
                    )
                )

        else:
            months = self._distinct_activity_months(db, org_id)
            cur = (today.year, today.month)
            if not months:
                months = {cur}
            start_m = min(months)
            end_m = max(months | {cur})
            timeline = self._expand_months(start_m, end_m)
            if len(timeline) > 60:
                timeline = timeline[-60:]
            for y, m in timeline:
                month_start = date(y, m, 1)
                start_dt = self._month_start_utc(y, m)
                end_dt = self._next_month_start_utc(y, m)
                out.append(
                    self._build_kpi_snapshot_row(
                        db,
                        org_id,
                        snapshot_date=month_start,
                        period_start=start_dt,
                        period_end_excl=end_dt,
                        period_type="monthly",
                    )
                )

        return out
    
    def list_kpi_snapshots(
        self, db: Session, org_id: UUID, period_type: str | None = None
    ) -> list[KpiSnapshotResponse]:
        pt = (period_type or "monthly").strip().lower()
        if pt in ("daily", "weekly", "monthly", "yearly"):
            return self._computed_kpi_snapshots(db, org_id, pt)
        stmt = select(KPISnapshot).where(cast(KPISnapshot.org_id, String) == str(org_id))
        stmt = stmt.where(KPISnapshot.period_type == period_type)
        rows = db.execute(stmt.order_by(KPISnapshot.snapshot_date.asc())).scalars().all()
        return [KpiSnapshotResponse.model_validate(item) for item in rows]

    def list_locations_for_org(self, db: Session, org_id: UUID) -> list[ReportLocationResponse]:
        stmt = (
            select(Location)
            .where(Location.org_id == org_id, Location.is_active.is_(True))
            .order_by(Location.name.asc())
        )
        rows = db.execute(stmt).scalars().all()
        return [ReportLocationResponse.model_validate(r) for r in rows]

    def internal_audit_summary(
        self,
        db: Session,
        org_id: UUID,
        location_id: UUID | None,
        period_days: int,
    ) -> InternalAuditSummaryResponse:
        """Tóm tắt PRP theo khu vực (area_id); NC & lệch CCP là cấp tổ chức."""
        period_days = max(7, min(730, period_days))
        since = date.today() - timedelta(days=period_days)
        start_dt = datetime.combine(since, datetime.min.time(), tzinfo=timezone.utc)

        loc_name = "Tất cả khu vực"
        if location_id is not None:
            loc = db.get(Location, location_id)
            if loc is None or loc.org_id != org_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Khu vực không tồn tại hoặc không thuộc tổ chức này",
                )
            loc_name = loc.name

        stmt = select(PRPAudit).where(
            PRPAudit.org_id == org_id,
            PRPAudit.audit_date >= since,
        )
        if location_id is not None:
            stmt = stmt.where(PRPAudit.area_id == location_id)
        audits = list(db.execute(stmt).scalars().all())

        rates = [float(a.compliance_rate) for a in audits if a.compliance_rate is not None]
        prp_avg = calculate_prp_average(rates)
        low_sessions = count_low_compliance_sessions(rates, 70.0)

        open_nc = (
            db.scalar(
                select(func.count())
                .select_from(NonConformity)
                .where(
                    NonConformity.org_id == org_id,
                    NonConformity.status.in_(["OPEN", "WAITING"]),
                )
            )
            or 0
        )

        haccp_dev = (
            db.scalar(
                select(func.count())
                .select_from(CCPMonitoringLog)
                .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
                .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
                .where(
                    HACCPPlan.org_id == org_id,
                    CCPMonitoringLog.recorded_at >= start_dt,
                    or_(
                        CCPMonitoringLog.is_within_limit.is_(False),
                        CCPMonitoringLog.deviation_severity.isnot(None),
                    ),
                )
            )
            or 0
        )

        signals: list[InternalSignalItem] = []
        if location_id is not None and len(audits) == 0:
            signals.append(
                InternalSignalItem(
                    level="warning",
                    message=(
                        f"Chưa có phiên đánh giá PRP ghi nhận cho khu vực này trong "
                        f"{period_days} ngày gần nhất."
                    ),
                )
            )
        elif len(audits) == 0:
            signals.append(
                InternalSignalItem(
                    level="info",
                    message=(
                        f"Chưa có phiên PRP trong phạm vi {period_days} ngày "
                        "(hoặc chưa nhập biên bản)."
                    ),
                )
            )

        if prp_avg is not None and prp_avg < 75:
            signals.append(
                InternalSignalItem(
                    level="danger",
                    message=(
                        f"Tuân thủ PRP trung bình trong kỳ: {prp_avg:.1f}% (dưới 75%). "
                        "Ưu tiên rà soát và hành động khắc phục."
                    ),
                )
            )
        elif prp_avg is not None and prp_avg < 85:
            signals.append(
                InternalSignalItem(
                    level="warning",
                    message=(
                        f"Tuân thủ PRP trung bình: {prp_avg:.1f}% — theo dõi xu hướng các kỳ tới."
                    ),
                )
            )

        if low_sessions >= 2:
            signals.append(
                InternalSignalItem(
                    level="warning",
                    message=(
                        f"Có {low_sessions} phiên PRP dưới 70% trong kỳ — dấu hiệu lặp lại, "
                        "nên phân tích nguyên nhân gốc (ISO 22000 / kiểm tra nội bộ)."
                    ),
                )
            )

        if open_nc > 0:
            signals.append(
                InternalSignalItem(
                    level="info",
                    message=(
                        f"Đang có {open_nc} không phù hợp (NC) mở trên toàn tổ chức — "
                        "đối chiếu với biên bản PRP / HACCP review."
                    ),
                )
            )

        if haccp_dev > 0:
            signals.append(
                InternalSignalItem(
                    level="warning" if haccp_dev > 5 else "info",
                    message=(
                        f"Trong {period_days} ngày qua có {haccp_dev} lần ghi nhận lệch CCP "
                        "(toàn tổ chức; chưa lọc theo khu vực trong dữ liệu CCP)."
                    ),
                )
            )

        if not signals:
            signals.append(
                InternalSignalItem(
                    level="info",
                    message=(
                        "Chưa có cảnh báo tự động từ ngưỡng — duy trì theo dõi định kỳ "
                        "ISO 22000, PRP audit và HACCP review."
                    ),
                )
            )

        return InternalAuditSummaryResponse(
            location_id=location_id,
            location_name=loc_name,
            period_days=period_days,
            prp_audit_count=len(audits),
            prp_avg_compliance=round(prp_avg, 2) if prp_avg is not None else None,
            prp_low_compliance_sessions=low_sessions,
            open_nc_org_count=int(open_nc),
            haccp_deviation_org_count=int(haccp_dev),
            signals=signals,
        )

    @staticmethod
    def _ccp_deviation_predicate():
        return or_(
            CCPMonitoringLog.is_within_limit.is_(False),
            CCPMonitoringLog.deviation_severity.isnot(None),
        )

    @staticmethod
    def _parse_drill_snapshot(period_type: str, cursor: str) -> tuple[date, date] | None:
        """Trả về (start_date inclusive, end_date exclusive) theo chu kỳ báo cáo."""
        pt = (period_type or "").strip().lower()
        cur = (cursor or "").strip()
        if pt == "daily":
            m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", cur)
            if not m:
                return None
            try:
                start_d = date(int(m[1]), int(m[2]), int(m[3]))
            except ValueError:
                return None
            return start_d, start_d + timedelta(days=1)
        if pt == "weekly":
            m = re.fullmatch(r"(\d{4})-W(\d{2})", cur)
            if not m:
                return None
            y, w = int(m[1]), int(m[2])
            try:
                mon = date.fromisocalendar(y, w, 1)
            except ValueError:
                return None
            return mon, mon + timedelta(days=7)
        if pt == "monthly":
            m = re.fullmatch(r"(\d{4})-(\d{2})", cur)
            if not m:
                return None
            y, mo = int(m[1]), int(m[2])
            if mo < 1 or mo > 12:
                return None
            start_d = date(y, mo, 1)
            if mo == 12:
                end_exc = date(y + 1, 1, 1)
            else:
                end_exc = date(y, mo + 1, 1)
            return start_d, end_exc
        if pt == "yearly":
            m = re.fullmatch(r"(\d{4})", cur)
            if not m:
                return None
            y = int(m[1])
            return date(y, 1, 1), date(y + 1, 1, 1)
        return None

    @dataclass(frozen=True)
    class _DrillTimeWindow:
        start_date: date
        end_date_exclusive: date
        start_dt_utc: datetime
        end_dt_exclusive_utc: datetime
        span_days: int
        as_of_date: date

    def _resolve_kpi_drill_window(
        self,
        period_type: str | None,
        cursor: str | None,
        period_days: int,
    ) -> "_DrillTimeWindow":
        today = date.today()
        pd = max(1, min(730, period_days))
        pt = (period_type or "").strip().lower() or None
        cur = (cursor or "").strip() or None

        if pt or cur:
            if not pt or not cur:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Khi dùng chu kỳ báo cáo, cần cả period_type và cursor.",
                )
            allowed = {"daily", "weekly", "monthly", "yearly"}
            if pt not in allowed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="period_type phải là daily, weekly, monthly hoặc yearly.",
                )
            bounds = self._parse_drill_snapshot(pt, cur)
            if bounds is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="cursor không khớp định dạng cho period_type đã chọn.",
                )
            start_d, end_exc = bounds
        else:
            start_d = today - timedelta(days=pd)
            end_exc = today + timedelta(days=1)

        start_dt = datetime.combine(start_d, datetime.min.time(), tzinfo=timezone.utc)
        end_dt = datetime.combine(end_exc, datetime.min.time(), tzinfo=timezone.utc)
        span_days = max(1, (end_exc - start_d).days)
        last_day_in_window = end_exc - timedelta(days=1)
        as_of = min(today, last_day_in_window)
        return ReportService._DrillTimeWindow(
            start_date=start_d,
            end_date_exclusive=end_exc,
            start_dt_utc=start_dt,
            end_dt_exclusive_utc=end_dt,
            span_days=span_days,
            as_of_date=as_of,
        )

    def kpi_drilldown(
        self,
        db: Session,
        org_id: UUID,
        kpi_type: str,
        period_days: int,
        period_type: str | None = None,
        cursor: str | None = None,
    ) -> KpiDrilldownResponse:
        win = self._resolve_kpi_drill_window(period_type, cursor, period_days)
        kt = (kpi_type or "").strip().lower()
        if kt not in ("prp", "haccp", "capa"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="kpi_type phải là prp, haccp hoặc capa",
            )
        if kt == "prp":
            return self._drilldown_prp(
                db,
                org_id,
                win.start_date,
                win.end_date_exclusive,
                win.span_days,
            )
        if kt == "haccp":
            return self._drilldown_haccp(
                db,
                org_id,
                win.start_dt_utc,
                win.end_dt_exclusive_utc,
                win.span_days,
            )
        return self._drilldown_capa(
            db,
            org_id,
            win.start_dt_utc,
            win.end_dt_exclusive_utc,
            win.span_days,
            win.as_of_date,
        )

    def _drilldown_prp(
        self,
        db: Session,
        org_id: UUID,
        start_d: date,
        end_exc_d: date,
        span_days: int,
    ) -> KpiDrilldownResponse:
        audits = list(
            db.execute(
                select(PRPAudit).where(
                    PRPAudit.org_id == org_id,
                    PRPAudit.audit_date >= start_d,
                    PRPAudit.audit_date < end_exc_d,
                )
            ).scalars().all()
        )
        rates = [float(a.compliance_rate) for a in audits if a.compliance_rate is not None]
        prp_avg = calculate_prp_average(rates)
        headline = f"{prp_avg:.1f}%" if prp_avg is not None else "—"
        is_low = prp_avg is not None and prp_avg < 75.0

        loc_label = func.coalesce(Location.name, "Chưa gán khu vực")
        loc_rows = db.execute(
            select(
                loc_label,
                func.count(PRPAudit.id),
                func.avg(PRPAudit.compliance_rate),
            )
            .select_from(PRPAudit)
            .outerjoin(Location, PRPAudit.area_id == Location.id)
            .where(
                PRPAudit.org_id == org_id,
                PRPAudit.audit_date >= start_d,
                PRPAudit.audit_date < end_exc_d,
            )
            .group_by(loc_label)
            .order_by(func.avg(PRPAudit.compliance_rate).asc().nulls_last())
        ).all()

        by_loc: list[KpiDrilldownRow] = []
        for name, cnt, avg_rate in loc_rows:
            nm = str(name)
            ar = float(avg_rate) if avg_rate is not None else None
            metric_p = f"{ar:.1f}%" if ar is not None else "—"
            sev = "danger" if ar is not None and ar < 70 else ("warn" if ar is not None and ar < 85 else "ok")
            by_loc.append(
                KpiDrilldownRow(
                    row_id=f"loc-{nm}",
                    title=nm,
                    subtitle=f"{int(cnt)} phiên PRP",
                    metric_primary=metric_p,
                    metric_secondary="TB tuân thủ",
                    severity=sev,
                )
            )

        recent = sorted(audits, key=lambda a: a.audit_date, reverse=True)[:25]
        by_session: list[KpiDrilldownRow] = []
        for a in recent:
            area_nm = "—"
            if a.area_id:
                loc = db.get(Location, a.area_id)
                if loc and loc.org_id == org_id:
                    area_nm = loc.name
            cr = float(a.compliance_rate) if a.compliance_rate is not None else None
            metric_p = f"{cr:.1f}%" if cr is not None else "—"
            sev = "danger" if cr is not None and cr < 70 else ("warn" if cr is not None and cr < 85 else "ok")
            by_session.append(
                KpiDrilldownRow(
                    row_id=str(a.id),
                    title=f"Phiên PRP {a.audit_date.isoformat()}",
                    subtitle=area_nm,
                    metric_primary=metric_p,
                    metric_secondary="Tuân thủ phiên",
                    severity=sev,
                )
            )

        ai: list[str] = []
        if is_low:
            ai.append(
                "Tuân thủ PRP trung bình thấp: ưu tiên rà soát khu vực điểm thấp và đối chiếu checklist với thực tế "
                "(5M, vệ sinh, bảo trì thiết bị)."
            )
            ai.append(
                "Nếu nhiều phiên liên tiếp dưới 70%, cân nhắc đào tạo lại và cập nhật PRP program theo rủi ro."
            )
        low_sess = count_low_compliance_sessions(rates, 70.0)
        if low_sess >= 2:
            ai.append(
                f"Có {low_sess} phiên dưới 70% trong kỳ — nên phân tích nguyên nhân gốc (RCA) và mở CAPA nếu lặp lại."
            )
        if not ai:
            ai.append("Duy trì audit PRP định kỳ; theo dõi biến động điểm theo khu vực.")

        return KpiDrilldownResponse(
            kpi_type="prp",
            headline_label="Tuân thủ PRP (TB trong kỳ)",
            headline_value=headline,
            period_days=span_days,
            is_low_signal=is_low,
            ai_insights=ai,
            blocks=[
                KpiDrilldownBlock(dimension="Theo khu vực", rows=by_loc),
                KpiDrilldownBlock(dimension="Theo phiên / biên bản gần nhất", rows=by_session),
            ],
        )

    def _drilldown_haccp(
        self,
        db: Session,
        org_id: UUID,
        start_dt: datetime,
        end_dt_exclusive: datetime,
        span_days: int,
    ) -> KpiDrilldownResponse:
        dev_pred = self._ccp_deviation_predicate()
        time_bounds = and_(
            CCPMonitoringLog.recorded_at >= start_dt,
            CCPMonitoringLog.recorded_at < end_dt_exclusive,
        )
        total_logs = int(
            db.scalar(
                select(func.count())
                .select_from(CCPMonitoringLog)
                .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
                .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
                .where(HACCPPlan.org_id == org_id, time_bounds),
            )
            or 0
        )
        dev_logs = int(
            db.scalar(
                select(func.count())
                .select_from(CCPMonitoringLog)
                .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
                .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
                .where(
                    HACCPPlan.org_id == org_id,
                    time_bounds,
                    dev_pred,
                )
            )
            or 0
        )
        headline_pct: float | None = None
        if total_logs == 0:
            headline = "—"
            is_low = False
        else:
            pct = calculate_percentage(
                float(total_logs - dev_logs), float(total_logs), decimal_places=2
            )
            headline_pct = float(pct) if pct is not None else None
            headline = f"{headline_pct:.1f}%" if headline_pct is not None else "—"
            is_low = (headline_pct is not None and headline_pct < 80.0) or dev_logs >= 5

        batch_key = func.coalesce(
            func.nullif(func.trim(CCPMonitoringLog.batch_number), ""),
            "(Không số lô)",
        )
        batch_q = (
            select(
                batch_key.label("batch"),
                func.count(CCPMonitoringLog.id),
                func.sum(case((dev_pred, 1), else_=0)),
            )
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .where(HACCPPlan.org_id == org_id, time_bounds)
            .group_by(batch_key)
            .order_by(func.sum(case((dev_pred, 1), else_=0)).desc())
            .limit(30)
        )
        by_batch: list[KpiDrilldownRow] = []
        for bname, cnt, devc in db.execute(batch_q).all():
            dc = int(devc or 0)
            ic = int(cnt or 0)
            sev = "danger" if dc >= 3 else ("warn" if dc >= 1 else "ok")
            by_batch.append(
                KpiDrilldownRow(
                    row_id=f"batch-{bname}",
                    title=str(bname),
                    subtitle="CCP monitoring",
                    metric_primary=f"{dc} lệch / {ic} bản ghi",
                    metric_secondary="Trong kỳ",
                    severity=sev,
                )
            )

        dev_join = or_(
            IoTDevice.device_code == CCPMonitoringLog.iot_device_id,
            cast(IoTDevice.id, String) == CCPMonitoringLog.iot_device_id,
        )
        dev_on = and_(IoTDevice.org_id == org_id, dev_join)
        device_label = func.coalesce(
            IoTDevice.name, IoTDevice.device_code, CCPMonitoringLog.iot_device_id, "Không gán thiết bị"
        )
        dev_q = (
            select(
                device_label.label("dev"),
                func.count(CCPMonitoringLog.id),
                func.sum(case((dev_pred, 1), else_=0)),
            )
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .outerjoin(IoTDevice, dev_on)
            .where(HACCPPlan.org_id == org_id, time_bounds)
            .group_by(device_label)
            .order_by(func.sum(case((dev_pred, 1), else_=0)).desc())
            .limit(25)
        )
        by_device: list[KpiDrilldownRow] = []
        for dname, cnt, devc in db.execute(dev_q).all():
            dc = int(devc or 0)
            ic = int(cnt or 0)
            sev = "danger" if dc >= 3 else ("warn" if dc >= 1 else "ok")
            by_device.append(
                KpiDrilldownRow(
                    row_id=f"dev-{dname}",
                    title=str(dname),
                    subtitle="Nguồn log CCP / IoT",
                    metric_primary=f"{dc} lệch / {ic} bản ghi",
                    metric_secondary="Trong kỳ",
                    severity=sev,
                )
            )

        area_key = func.coalesce(func.nullif(func.trim(IoTDevice.location), ""), "Chưa gán khu vực (thiết bị)")
        area_q = (
            select(
                area_key.label("area"),
                func.count(CCPMonitoringLog.id),
                func.sum(case((dev_pred, 1), else_=0)),
            )
            .select_from(CCPMonitoringLog)
            .join(CCP, CCPMonitoringLog.ccp_id == CCP.id)
            .join(HACCPPlan, CCP.haccp_plan_id == HACCPPlan.id)
            .outerjoin(IoTDevice, dev_on)
            .where(HACCPPlan.org_id == org_id, time_bounds)
            .group_by(area_key)
            .order_by(func.sum(case((dev_pred, 1), else_=0)).desc())
            .limit(20)
        )
        by_area: list[KpiDrilldownRow] = []
        for aname, cnt, devc in db.execute(area_q).all():
            dc = int(devc or 0)
            ic = int(cnt or 0)
            sev = "danger" if dc >= 3 else ("warn" if dc >= 1 else "ok")
            by_area.append(
                KpiDrilldownRow(
                    row_id=f"area-{aname}",
                    title=str(aname),
                    subtitle="Theo vị trí thiết bị ghi nhận",
                    metric_primary=f"{dc} lệch / {ic} bản ghi",
                    metric_secondary="Trong kỳ",
                    severity=sev,
                )
            )

        ai: list[str] = []
        if is_low and headline_pct is not None:
            ai.append(
                f"Tỷ lệ bản ghi trong giới hạn ~{headline_pct:.1f}% — ưu tiên CCP/lô có nhiều lệch; kiểm tra hiệu chuẩn thiết bị đo."
            )
        if dev_logs > 0:
            ai.append(
                f"{dev_logs} bản ghi lệch trong {span_days} ngày — xử lý theo lô và thiết bị đứng đầu bảng; mở CAPA nếu lặp lại."
            )
        if not ai:
            ai.append("Ghi log đầy đủ số lô và thiết bị để drill-down chính xác hơn.")

        return KpiDrilldownResponse(
            kpi_type="haccp",
            headline_label="Tuân thủ HACCP (ước tính từ log CCP)",
            headline_value=headline,
            period_days=span_days,
            is_low_signal=is_low,
            ai_insights=ai,
            blocks=[
                KpiDrilldownBlock(dimension="Theo lô / mã lô (batch_number)", rows=by_batch),
                KpiDrilldownBlock(dimension="Theo thiết bị / nguồn ghi", rows=by_device),
                KpiDrilldownBlock(dimension="Theo khu vực (theo thiết bị IoT)", rows=by_area),
            ],
        )

    def _drilldown_capa(
        self,
        db: Session,
        org_id: UUID,
        start_dt: datetime,
        end_dt_exclusive: datetime,
        span_days: int,
        as_of_date: date,
    ) -> KpiDrilldownResponse:
        open_statuses = ("OPEN", "IN_PROGRESS", "WAITING", "PENDING")
        time_bounds_capa = and_(
            CAPA.created_at >= start_dt,
            CAPA.created_at < end_dt_exclusive,
        )
        capas = list(
            db.execute(
                select(CAPA).where(
                    CAPA.org_id == org_id,
                    time_bounds_capa,
                )
            ).scalars().all()
        )
        open_cnt = sum(1 for c in capas if (c.status or "").upper() in open_statuses)
        overdue = sum(
            1
            for c in capas
            if c.due_date is not None
            and c.due_date < as_of_date
            and (c.status or "").upper() in open_statuses
        )
        closed_cnt = sum(
            1 for c in capas if (c.status or "").upper() in ("CLOSED", "DONE", "COMPLETED")
        )
        if closed_cnt + overdue > 0:
            ontime_pct = calculate_capa_ontime_rate(closed_cnt, closed_cnt + overdue)
        elif not capas:
            ontime_pct = None
        else:
            ontime_pct = estimate_capa_ontime_rate_fallback(overdue)

        headline = f"{ontime_pct:.1f}%" if ontime_pct is not None else "—"
        is_low = overdue > 0 or open_cnt > 8 or (ontime_pct is not None and ontime_pct < 80.0)

        status_expr = func.upper(CAPA.status)
        st_rows = db.execute(
            select(status_expr, func.count(CAPA.id))
            .where(CAPA.org_id == org_id, time_bounds_capa)
            .group_by(status_expr)
            .order_by(func.count(CAPA.id).desc())
        ).all()
        by_status: list[KpiDrilldownRow] = []
        for stv, cnt in st_rows:
            sev = "warn" if str(stv).upper() in open_statuses and int(cnt) > 3 else "ok"
            by_status.append(
                KpiDrilldownRow(
                    row_id=f"st-{stv}",
                    title=str(stv),
                    subtitle="CAPA trong kỳ",
                    metric_primary=f"{int(cnt)} hồ sơ",
                    severity=sev,
                )
            )

        overdue_rows = sorted(
            [
                c
                for c in capas
                if c.due_date and c.due_date < as_of_date and (c.status or "").upper() in open_statuses
            ],
            key=lambda c: c.due_date or as_of_date,
        )[:20]
        by_capa: list[KpiDrilldownRow] = []
        for c in overdue_rows:
            title = c.title[:120] + ("…" if len(c.title) > 120 else "")
            by_capa.append(
                KpiDrilldownRow(
                    row_id=str(c.id),
                    title=title,
                    subtitle=f"Hạn {c.due_date.isoformat() if c.due_date else '—'} · {c.status}",
                    metric_primary="Quá hạn",
                    metric_secondary=c.capa_code or "",
                    severity="danger",
                )
            )

        ai: list[str] = []
        if overdue > 0:
            ai.append(
                f"{overdue} CAPA quá hạn — họp ưu tiên, phân công owner và rà soát tài nguyên xử lý."
            )
        if open_cnt > 5:
            ai.append("Nhiều CAPA mở: gom nhóm theo nguồn NC (PRP vs CCP) để xử lý hệ thống.")
        if not ai:
            ai.append("Theo dõi đóng CAPA đúng hạn; liên kết rõ với NC và biên bản review.")

        return KpiDrilldownResponse(
            kpi_type="capa",
            headline_label="CAPA đúng hạn (ước tính trong kỳ)",
            headline_value=headline,
            period_days=span_days,
            is_low_signal=is_low,
            ai_insights=ai,
            blocks=[
                KpiDrilldownBlock(dimension="Theo trạng thái", rows=by_status),
                KpiDrilldownBlock(dimension="CAPA quá hạn (ưu tiên)", rows=by_capa),
            ],
        )


report_service = ReportService()
