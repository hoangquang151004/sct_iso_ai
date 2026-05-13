from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import Date, DateTime, String, cast, func, or_, select
from sqlalchemy.orm import Session

from database.models import (
    Alert,
    CAPA,
    CCP,
    CCPMonitoringLog,
    Document,
    HACCPPlan,
    KPISnapshot,
    NonConformity,
    PRPAudit,
    ReportConfig,
    ReportHistory,
)

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
        haccp_rate: float | None = None
        if log_total > 0:
            haccp_rate = round(100.0 * float(log_within) / float(log_total), 2)

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
            capa_ontime = round(100.0 * float(closed_in_bucket) / float(created_in_bucket), 2)

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


report_service = ReportService()
