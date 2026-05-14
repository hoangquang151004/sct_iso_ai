from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ReportConfigBase(BaseModel):
    name: str
    report_type: str
    description: str | None = None
    target_roles: list[str] = Field(default_factory=list)
    filter_config: dict = Field(default_factory=dict)
    schedule_type: str | None = None
    schedule_config: dict = Field(default_factory=dict)
    recipients: list[str] = Field(default_factory=list)
    output_format: list[str] = Field(default_factory=lambda: ["PDF"])
    is_active: bool = True


class ReportConfigCreate(ReportConfigBase):
    org_id: UUID
    created_by: UUID


class ReportConfigUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    target_roles: list[str] | None = None
    filter_config: dict | None = None
    schedule_type: str | None = None
    schedule_config: dict | None = None
    recipients: list[str] | None = None
    output_format: list[str] | None = None
    is_active: bool | None = None


class ReportConfigResponse(ReportConfigBase):
    id: UUID
    org_id: UUID
    created_by: UUID
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ReportHistoryBase(BaseModel):
    report_name: str | None = None
    period_from: datetime | None = None
    period_to: datetime | None = None
    parameters: dict = Field(default_factory=dict)
    file_url: str | None = None
    file_format: str | None = None
    sent_to: list[str] = Field(default_factory=list)
    status: str = "GENERATING"


class ReportHistoryCreate(ReportHistoryBase):
    generated_by: UUID


class ReportHistoryResponse(ReportHistoryBase):
    id: UUID
    config_id: UUID
    org_id: UUID
    generated_by: UUID
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class KpiSnapshotBase(BaseModel):
    snapshot_date: date
    period_type: str
    doc_total: int | None = None
    doc_approved: int | None = None
    doc_pending: int | None = None
    doc_overdue_review: int | None = None
    haccp_ccp_monitored_rate: float | None = None
    haccp_deviation_count: int | None = None
    prp_audit_compliance_rate: float | None = None
    prp_nc_open_count: int | None = None
    capa_ontime_closure_rate: float | None = None
    capa_open_count: int | None = None
    capa_overdue_count: int | None = None
    alert_critical_count: int | None = None
    alert_open_count: int | None = None


class KpiSnapshotCreate(KpiSnapshotBase):
    org_id: UUID


class KpiSnapshotResponse(KpiSnapshotBase):
    id: UUID
    org_id: UUID
    computed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ReportLocationResponse(BaseModel):
    """Khu vực / địa điểm (dùng lọc báo cáo nội bộ)."""

    id: UUID
    org_id: UUID
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class InternalSignalItem(BaseModel):
    level: str  # info | warning | danger
    message: str


class InternalAuditSummaryResponse(BaseModel):
    """Tóm tắt & thông báo đánh giá nội bộ (PRP theo khu vực; chỉ số HACCP/CAPA cấp tổ chức)."""

    location_id: UUID | None = None
    location_name: str
    period_days: int
    prp_audit_count: int
    prp_avg_compliance: float | None = None
    prp_low_compliance_sessions: int = 0
    open_nc_org_count: int = 0
    haccp_deviation_org_count: int = 0
    signals: list[InternalSignalItem] = Field(default_factory=list)


class KpiDrilldownRow(BaseModel):
    row_id: str
    title: str
    subtitle: str | None = None
    metric_primary: str
    metric_secondary: str | None = None
    severity: str = "ok"


class KpiDrilldownBlock(BaseModel):
    dimension: str
    rows: list[KpiDrilldownRow] = Field(default_factory=list)


class KpiDrilldownResponse(BaseModel):
    kpi_type: str
    headline_label: str
    headline_value: str
    period_days: int
    is_low_signal: bool
    ai_insights: list[str] = Field(default_factory=list)
    blocks: list[KpiDrilldownBlock] = Field(default_factory=list)
