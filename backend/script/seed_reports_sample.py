from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import text

from db_session import SessionLocal
from database.models import KPISnapshot, ReportConfig, ReportHistory


def _resolve_org_user_ids(org_id_arg: str | None, user_id_arg: str | None) -> tuple[str, str]:
    with SessionLocal() as db:
        org_id = org_id_arg
        user_id = user_id_arg

        if not org_id:
            org_row = db.execute(
                text('SELECT id FROM sct_iso.organizations ORDER BY created_at ASC LIMIT 1')
            ).first()
            if org_row is None:
                raise RuntimeError(
                    "Không tìm thấy organization. Hãy chạy bootstrap hoặc truyền --org-id."
                )
            org_id = str(org_row[0])

        if not user_id:
            user_row = db.execute(
                text(
                    "SELECT id FROM sct_iso.users "
                    "WHERE org_id = :org_id ORDER BY created_at ASC LIMIT 1"
                ),
                {"org_id": org_id},
            ).first()
            if user_row is None:
                raise RuntimeError(
                    "Không tìm thấy user thuộc organization này. Hãy truyền --user-id."
                )
            user_id = str(user_row[0])

        return org_id, user_id


def _build_month_start_list(months: int) -> list[date]:
    now = datetime.now(timezone.utc)
    first_day_this_month = date(now.year, now.month, 1)
    out: list[date] = []
    year = first_day_this_month.year
    month = first_day_this_month.month
    for _ in range(months):
        out.append(date(year, month, 1))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    out.reverse()
    return out


def seed_reports_data(org_id: str, user_id: str, months: int = 6) -> None:
    month_points = _build_month_start_list(months)
    now = datetime.now(timezone.utc)
    marker_name = "Sample Report KPI Monthly"

    with SessionLocal() as db:
        try:
            existing_cfg = db.execute(
                text(
                    "SELECT id FROM sct_iso.report_configs "
                    "WHERE org_id = :org_id AND name = :name LIMIT 1"
                ),
                {"org_id": org_id, "name": marker_name},
            ).first()

            if existing_cfg:
                config_id = str(existing_cfg[0])
            else:
                config = ReportConfig(
                    id=str(uuid4()),
                    org_id=org_id,
                    created_by=user_id,
                    name=marker_name,
                    report_type="kpi",
                    description="Dữ liệu mẫu để test trang Reports",
                    target_roles=["admin", "iso_manager", "qa_qc"],
                    filter_config={"period_type": "monthly"},
                    schedule_type="monthly",
                    schedule_config={"day_of_month": 1, "hour": 8},
                    recipients=["qa@example.com", "iso@example.com"],
                    output_format=["PDF", "CSV"],
                    is_active=True,
                )
                db.add(config)
                config_id = config.id

            db.execute(
                text("DELETE FROM sct_iso.report_history WHERE config_id = :config_id"),
                {"config_id": config_id},
            )
            db.execute(
                text(
                    "DELETE FROM sct_iso.kpi_snapshots "
                    "WHERE org_id = :org_id AND period_type = 'monthly' AND snapshot_date >= :from_dt"
                ),
                {"org_id": org_id, "from_dt": month_points[0]},
            )

            for idx, month_start in enumerate(month_points, start=1):
                doc_total = 80 + idx * 7
                doc_approved = int(doc_total * 0.86)
                doc_pending = doc_total - doc_approved

                snapshot = KPISnapshot(
                    id=str(uuid4()),
                    org_id=org_id,
                    snapshot_date=month_start,
                    period_type="monthly",
                    doc_total=doc_total,
                    doc_approved=doc_approved,
                    doc_pending=doc_pending,
                    doc_overdue_review=max(0, 6 - idx),
                    haccp_ccp_monitored_rate=Decimal(str(min(99.9, 88 + idx * 1.7))),
                    haccp_deviation_count=max(0, 5 - idx),
                    prp_audit_compliance_rate=Decimal(str(min(99.9, 89 + idx * 1.4))),
                    prp_nc_open_count=max(0, 4 - idx),
                    capa_ontime_closure_rate=Decimal(str(min(99.9, 85 + idx * 2.0))),
                    capa_open_count=max(0, 7 - idx),
                    capa_overdue_count=max(0, 3 - idx),
                    alert_critical_count=max(0, 2 - idx),
                    alert_open_count=max(0, 6 - idx),
                )
                db.add(snapshot)

                history = ReportHistory(
                    id=str(uuid4()),
                    config_id=config_id,
                    org_id=org_id,
                    report_name=f"KPI Monthly {month_start.strftime('%m/%Y')}",
                    period_from=datetime(
                        month_start.year, month_start.month, 1, tzinfo=timezone.utc
                    ),
                    period_to=datetime(
                        month_start.year, month_start.month, 28, tzinfo=timezone.utc
                    )
                    + timedelta(days=4),
                    parameters={"period_type": "monthly"},
                    file_url=f"/reports/sample/kpi-{month_start.strftime('%Y-%m')}.pdf",
                    file_format="PDF",
                    generated_by=user_id,
                    sent_to=["qa@example.com", "iso@example.com"],
                    status="DONE",
                    created_at=now - timedelta(days=(months - idx) * 30),
                )
                db.add(history)

            db.commit()
        except Exception:
            db.rollback()
            raise


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed dữ liệu mẫu Reports (report_configs, report_history, kpi_snapshots)."
    )
    parser.add_argument("--org-id", dest="org_id", default=None, help="Org ID muốn seed dữ liệu")
    parser.add_argument("--user-id", dest="user_id", default=None, help="User ID tạo dữ liệu mẫu")
    parser.add_argument(
        "--months",
        dest="months",
        type=int,
        default=6,
        help="Số tháng dữ liệu KPI mẫu (mặc định: 6)",
    )
    args = parser.parse_args()

    if args.months < 1:
        raise ValueError("--months phải >= 1")

    org_id, user_id = _resolve_org_user_ids(args.org_id, args.user_id)
    seed_reports_data(org_id=org_id, user_id=user_id, months=args.months)

    print("Seed reports sample thành công.")
    print(f"org_id={org_id}")
    print(f"user_id={user_id}")
    print(f"months={args.months}")


if __name__ == "__main__":
    main()
