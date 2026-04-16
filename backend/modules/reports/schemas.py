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
