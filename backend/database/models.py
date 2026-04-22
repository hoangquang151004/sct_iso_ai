from __future__ import annotations
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    String, Boolean, DateTime, Date, ForeignKey, Text, func, 
    Integer, Numeric, ARRAY, BigInteger
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB, INET
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class với cấu hình schema mặc định là sct_iso."""
    __table_args__ = {"schema": "sct_iso"}


# =============================================================================
# MODULE 5.1.7: QUẢN LÝ NGƯỜI DÙNG
# =============================================================================

class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    email: Mapped[Optional[str]] = mapped_column(String(100))
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    users: Mapped[List["User"]] = relationship(back_populates="organization")


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    permissions: Mapped[Dict[str, Any]] = mapped_column(JSONB, server_default='{}')
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    role_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.roles.id"))
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    department: Mapped[Optional[str]] = mapped_column(String(100))
    position: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    organization: Mapped["Organization"] = relationship(back_populates="users")
    role: Mapped[Optional["Role"]] = relationship()


class UserActivityLog(Base):
    __tablename__ = "user_activity_logs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    module: Mapped[Optional[str]] = mapped_column(String(100))
    target_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True))
    target_table: Mapped[Optional[str]] = mapped_column(String(100))
    detail: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    ip_address: Mapped[Optional[str]] = mapped_column(INET)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# MODULE 5.1.1: QUẢN LÝ TÀI LIỆU
# =============================================================================

class DocumentCategory(Base):
    __tablename__ = "document_categories"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50))
    parent_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.document_categories.id"))
    standard: Mapped[Optional[str]] = mapped_column(String(50))
    department: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    category_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.document_categories.id"))
    doc_code: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    current_version: Mapped[str] = mapped_column(String(20), default="1.0")
    status: Mapped[str] = mapped_column(String(50), default="DRAFT")
    language: Mapped[str] = mapped_column(String(10), default="vi")
    department: Mapped[Optional[str]] = mapped_column(String(100))
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    approved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    review_period: Mapped[int] = mapped_column(Integer, default=12)
    next_review_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    tags: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DocumentVersion(Base):
    __tablename__ = "document_versions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.documents.id", ondelete="CASCADE"))
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    file_url: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[Optional[str]] = mapped_column(String(20))
    file_size: Mapped[Optional[int]] = mapped_column(BigInteger)
    change_summary: Mapped[Optional[str]] = mapped_column(Text)
    change_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# MODULE 5.1.2: HACCP
# =============================================================================

class Product(Base):
    __tablename__ = "products"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(100), unique=True)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HACCPPlan(Base):
    __tablename__ = "haccp_plans"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    product_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.products.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    status: Mapped[str] = mapped_column(String(50), default="DRAFT")
    scope: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    approved_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ProcessStep(Base):
    __tablename__ = "process_steps"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    haccp_plan_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.haccp_plans.id", ondelete="CASCADE"))
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    step_type: Mapped[Optional[str]] = mapped_column(String(50))
    is_ccp: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_step_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.process_steps.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HazardAnalysis(Base):
    __tablename__ = "hazard_analyses"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    step_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.process_steps.id", ondelete="CASCADE"))
    hazard_type: Mapped[str] = mapped_column(String(50), nullable=False)
    hazard_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    likelihood: Mapped[int] = mapped_column(Integer)
    severity: Mapped[int] = mapped_column(Integer)
    # risk_score is generated in DB, usually we use fetched_value() or computed in SQLAlchemy 2.0
    risk_score: Mapped[int] = mapped_column(Integer, insert_default=None, server_default=None) 
    control_measure: Mapped[Optional[str]] = mapped_column(Text)
    is_significant: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_suggestion: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CCP(Base):
    __tablename__ = "ccps"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    haccp_plan_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.haccp_plans.id", ondelete="CASCADE"))
    step_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.process_steps.id"))
    hazard_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.hazard_analyses.id"))
    ccp_code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    critical_limit: Mapped[str] = mapped_column(Text, nullable=False)
    monitoring_method: Mapped[Optional[str]] = mapped_column(String(255))
    monitoring_frequency: Mapped[Optional[str]] = mapped_column(String(100))
    monitoring_device: Mapped[Optional[str]] = mapped_column(String(255))
    responsible_user: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    corrective_action: Mapped[Optional[str]] = mapped_column(Text)
    verification_procedure: Mapped[Optional[str]] = mapped_column(Text)
    ai_suggestion: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CCPMonitoringLog(Base):
    __tablename__ = "ccp_monitoring_logs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    ccp_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.ccps.id", ondelete="CASCADE"))
    batch_number: Mapped[Optional[str]] = mapped_column(String(100))
    shift: Mapped[Optional[str]] = mapped_column(String(50))
    measured_value: Mapped[Optional[float]] = mapped_column(Numeric(10, 3))
    unit: Mapped[Optional[str]] = mapped_column(String(20))
    is_within_limit: Mapped[Optional[bool]] = mapped_column(Boolean)
    deviation_note: Mapped[Optional[str]] = mapped_column(Text)
    recorded_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    verified_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    iot_device_id: Mapped[Optional[str]] = mapped_column(String(100))


# =============================================================================
# MODULE 5.1.3: PRP AUDIT
# =============================================================================

class PRPProgram(Base):
    __tablename__ = "prp_programs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50))
    category: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    standard_ref: Mapped[Optional[str]] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    templates: Mapped[List["PRPChecklistTemplate"]] = relationship(back_populates="program", cascade="all, delete-orphan")


class PRPChecklistTemplate(Base):
    """Lưu trữ các hạng mục kiểm tra (câu hỏi) cho từng chương trình PRP."""
    __tablename__ = "prp_checklist_templates"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    prp_program_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.prp_programs.id", ondelete="CASCADE"))
    document_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.documents.id")) # Liên kết tài liệu ISO
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    requirement: Mapped[Optional[str]] = mapped_column(Text) # Yêu cầu đạt
    order_index: Mapped[int] = mapped_column(Integer, default=0) # Thứ tự hiển thị
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    program: Mapped["PRPProgram"] = relationship(back_populates="templates")


class PRPAudit(Base):
    __tablename__ = "prp_audits"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    prp_program_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.prp_programs.id"))
    area: Mapped[Optional[str]] = mapped_column(String(100))
    audit_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    compliance_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    overall_result: Mapped[Optional[str]] = mapped_column(String(50))
    auditor_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    prp_program: Mapped[Optional["PRPProgram"]] = relationship()
    details: Mapped[List["PRPAuditDetail"]] = relationship(back_populates="audit", cascade="all, delete-orphan")


class PRPAuditDetail(Base):
    """Lưu trữ kết quả đánh giá chi tiết cho từng hạng mục của một phiên audit."""
    __tablename__ = "prp_audit_details"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    audit_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.prp_audits.id", ondelete="CASCADE"))
    checklist_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.prp_checklist_templates.id"))
    result: Mapped[str] = mapped_column(String(20), nullable=False) # e.g., 'PASS', 'FAIL', 'NA'
    score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    observation: Mapped[Optional[str]] = mapped_column(Text)
    evidence_url: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    audit: Mapped["PRPAudit"] = relationship(back_populates="details")
    checklist: Mapped["PRPChecklistTemplate"] = relationship()


# =============================================================================
# MODULE 5.1.4: CAPA
# =============================================================================

class NonConformity(Base):
    __tablename__ = "non_conformities"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    nc_code: Mapped[Optional[str]] = mapped_column(String(100))
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    source_ref_id: Mapped[Optional[UUID]] = mapped_column(PG_UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="OPEN")
    detected_by: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CAPA(Base):
    __tablename__ = "capas"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    nc_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.non_conformities.id"))
    capa_code: Mapped[Optional[str]] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    root_cause: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="OPEN")
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    assigned_to: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# MODULE 5.1.5: IoT & AI
# =============================================================================

class IoTDevice(Base):
    __tablename__ = "iot_devices"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    device_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255))
    device_type: Mapped[Optional[str]] = mapped_column(String(100))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="OPEN")
    device_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.iot_devices.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AIAnalysisResult(Base):
    __tablename__ = "ai_analysis_results"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    analysis_type: Mapped[str] = mapped_column(String(100), nullable=False)
    input_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    result: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    insight_text: Mapped[Optional[str]] = mapped_column(Text)
    confidence: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# MODULE 5.1.8: LỊCH & THÔNG BÁO
# =============================================================================

class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), default="SCHEDULED")
    assigned_to: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id: Mapped[UUID] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    user_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("sct_iso.users.id"))
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(500))
    message: Mapped[Optional[str]] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# =============================================================================
# MODULE 5.1.6: BÁO CÁO & KPI
# =============================================================================

class ReportConfig(Base):
    __tablename__ = "report_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    org_id: Mapped[str] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    created_by: Mapped[str] = mapped_column(ForeignKey("sct_iso.users.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    target_roles: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    filter_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    schedule_type: Mapped[Optional[str]] = mapped_column(String(50))
    schedule_config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    recipients: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    output_format: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReportHistory(Base):
    __tablename__ = "report_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    config_id: Mapped[str] = mapped_column(ForeignKey("sct_iso.report_configs.id", ondelete="CASCADE"))
    org_id: Mapped[str] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    report_name: Mapped[Optional[str]] = mapped_column(String(255))
    period_from: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    period_to: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    parameters: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    file_url: Mapped[Optional[str]] = mapped_column(Text)
    file_format: Mapped[Optional[str]] = mapped_column(String(20))
    generated_by: Mapped[str] = mapped_column(ForeignKey("sct_iso.users.id"))
    sent_to: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    status: Mapped[str] = mapped_column(String(50), default="GENERATING")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KPISnapshot(Base):
    __tablename__ = "kpi_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    org_id: Mapped[str] = mapped_column(ForeignKey("sct_iso.organizations.id", ondelete="CASCADE"))
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # KPI Fields
    doc_total: Mapped[Optional[int]] = mapped_column(Integer)
    doc_approved: Mapped[Optional[int]] = mapped_column(Integer)
    doc_pending: Mapped[Optional[int]] = mapped_column(Integer)
    doc_overdue_review: Mapped[Optional[int]] = mapped_column(Integer)
    haccp_ccp_monitored_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    haccp_deviation_count: Mapped[Optional[int]] = mapped_column(Integer)
    prp_audit_compliance_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    prp_nc_open_count: Mapped[Optional[int]] = mapped_column(Integer)
    capa_ontime_closure_rate: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    capa_open_count: Mapped[Optional[int]] = mapped_column(Integer)
    capa_overdue_count: Mapped[Optional[int]] = mapped_column(Integer)
    alert_critical_count: Mapped[Optional[int]] = mapped_column(Integer)
    alert_open_count: Mapped[Optional[int]] = mapped_column(Integer)

    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())