from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# PRODUCT SCHEMAS
# =============================================================================
class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    code: str | None = Field(None, max_length=100)
    category: str | None = Field(None, max_length=100)
    description: str | None = None
    is_active: bool = True


class ProductCreate(ProductBase):
    org_id: UUID | None = None


class ProductUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    code: str | None = Field(None, max_length=100)
    category: str | None = Field(None, max_length=100)
    description: str | None = None
    is_active: bool | None = None


class ProductResponse(ProductBase):
    id: UUID
    org_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# HACCP PLAN SCHEMAS
# =============================================================================
class HaccpPlanBase(BaseModel):
    product_id: UUID | None = None
    name: str = Field(..., max_length=255)
    version: str = Field(default="1.0", max_length=20)
    scope: str | None = None


class HaccpPlanCreate(HaccpPlanBase):
    org_id: UUID | None = None
    created_by: UUID | None = None


class HaccpPlanUpdate(BaseModel):
    product_id: UUID | None = None
    name: str | None = Field(None, max_length=255)
    version: str | None = Field(None, max_length=20)
    scope: str | None = None
    status: str | None = Field(None, pattern="^(DRAFT|ACTIVE|ARCHIVED)$")


class HaccpPlanApprove(BaseModel):
    approved_by: UUID | None = None


class HaccpPlanResponse(HaccpPlanBase):
    id: UUID
    org_id: UUID
    status: str = "DRAFT"
    created_by: UUID
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# HACCP PLAN VERSION SCHEMAS
# =============================================================================
class HaccpPlanVersionResponse(BaseModel):
    id: UUID
    plan_id: UUID
    version: str
    name: str
    scope: str | None = None
    product_id: UUID | None = None
    status: str
    created_by: UUID | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HaccpPlanVersionCreate(BaseModel):
    version: str
    name: str
    scope: str | None = None
    product_id: UUID | None = None
    created_by: UUID | None = None  # Will be filled from token


class CreateNewVersionRequest(BaseModel):
    """Request to create a new version from current ACTIVE plan"""
    new_version: str = Field(..., pattern=r"^\d+\.\d+$", description="Version format: x.y (e.g., 2.0, 1.1)")
    updated_by: UUID | None = None
    name: str | None = Field(None, max_length=255, description="Tên kế hoạch mới (nếu muốn thay đổi)")
    scope: str | None = Field(None, description="Phạm vi kế hoạch mới (nếu muốn thay đổi)")
    product_id: UUID | None = Field(None, description="Sản phẩm mới (nếu muốn thay đổi)")


# =============================================================================
# PROCESS STEP SCHEMAS
# =============================================================================
class ProcessStepBase(BaseModel):
    step_order: int
    name: str = Field(..., max_length=255)
    description: str | None = None
    step_type: str | None = Field(None, max_length=50)
    is_ccp: bool = False
    parent_step_id: UUID | None = None


class ProcessStepCreate(ProcessStepBase):
    haccp_plan_id: UUID | None = None


class ProcessStepUpdate(BaseModel):
    step_order: int | None = None
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    step_type: str | None = Field(None, max_length=50)
    is_ccp: bool | None = None
    parent_step_id: UUID | None = None


class ProcessStepResponse(ProcessStepBase):
    id: UUID
    haccp_plan_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# HAZARD ANALYSIS SCHEMAS
# =============================================================================
class HazardAnalysisBase(BaseModel):
    hazard_type: str = Field(..., pattern="^(BIOLOGICAL|CHEMICAL|PHYSICAL)$")
    hazard_name: str = Field(..., max_length=255)
    description: str | None = None
    likelihood: int = Field(..., ge=1, le=5)
    severity: int = Field(..., ge=1, le=5)
    control_measure: str | None = None
    is_significant: bool = False
    ai_suggestion: str | None = None


class HazardAnalysisCreate(HazardAnalysisBase):
    step_id: UUID | None = None


class HazardAnalysisUpdate(BaseModel):
    hazard_type: str | None = Field(None, pattern="^(BIOLOGICAL|CHEMICAL|PHYSICAL)$")
    hazard_name: str | None = Field(None, max_length=255)
    description: str | None = None
    likelihood: int | None = Field(None, ge=1, le=5)
    severity: int | None = Field(None, ge=1, le=5)
    control_measure: str | None = None
    is_significant: bool | None = None
    ai_suggestion: str | None = None


class HazardAnalysisResponse(HazardAnalysisBase):
    id: UUID
    step_id: UUID
    risk_score: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# CCP (CRITICAL CONTROL POINT) SCHEMAS
# =============================================================================
class CCPBase(BaseModel):
    ccp_code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    critical_limit: str
    monitoring_method: str | None = Field(None, max_length=255)
    monitoring_frequency: str | None = Field(None, max_length=100)
    monitoring_device: str | None = Field(None, max_length=255)
    responsible_user: UUID | None = None
    corrective_action: str | None = None
    verification_procedure: str | None = None
    ai_suggestion: str | None = None


class CCPCreate(CCPBase):
    haccp_plan_id: UUID | None = None
    step_id: UUID | None = None
    hazard_id: UUID | None = None


class CCPUpdate(BaseModel):
    ccp_code: str | None = Field(None, max_length=50)
    name: str | None = Field(None, max_length=255)
    critical_limit: str | None = None
    monitoring_method: str | None = Field(None, max_length=255)
    monitoring_frequency: str | None = Field(None, max_length=100)
    monitoring_device: str | None = Field(None, max_length=255)
    responsible_user: UUID | None = None
    corrective_action: str | None = None
    verification_procedure: str | None = None
    ai_suggestion: str | None = None
    step_id: UUID | None = None
    hazard_id: UUID | None = None


class CCPResponse(CCPBase):
    id: UUID
    haccp_plan_id: UUID
    step_id: UUID | None = None
    hazard_id: UUID | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# CCP MONITORING LOG SCHEMAS
# =============================================================================
class CCPMonitoringLogBase(BaseModel):
    batch_number: str | None = Field(None, max_length=100)
    shift: str | None = Field(None, max_length=50)
    measured_value: float | None = None
    unit: str | None = Field(None, max_length=20)
    is_within_limit: bool | None = None
    deviation_note: str | None = None
    iot_device_id: str | None = Field(None, max_length=100)
    # Deviation management fields
    deviation_severity: str | None = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    deviation_status: str | None = Field(
        None,
        pattern="^(NEW|PENDING_CAPA|CAPA_OPEN|CAPA_IN_PROGRESS|CAPA_CLOSED|CAPA_REJECTED|INVESTIGATING|CORRECTIVE_ACTION|RESOLVED|CLOSED)$",
    )
    corrective_action: str | None = None
    root_cause: str | None = None
    resolution_note: str | None = None


class CCPMonitoringLogCreate(CCPMonitoringLogBase):
    ccp_id: UUID
    recorded_by: UUID | None = None


class CCPMonitoringLogUpdate(BaseModel):
    batch_number: str | None = Field(None, max_length=100)
    shift: str | None = Field(None, max_length=50)
    measured_value: float | None = None
    unit: str | None = Field(None, max_length=20)
    is_within_limit: bool | None = None
    deviation_note: str | None = None
    verified_by: UUID | None = None
    # Deviation management update fields
    deviation_severity: str | None = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    deviation_status: str | None = Field(
        None,
        pattern="^(NEW|PENDING_CAPA|CAPA_OPEN|CAPA_IN_PROGRESS|CAPA_CLOSED|CAPA_REJECTED|INVESTIGATING|CORRECTIVE_ACTION|RESOLVED|CLOSED)$",
    )
    corrective_action: str | None = None
    root_cause: str | None = None
    resolution_note: str | None = None
    handled_by: UUID | None = None


class CCPMonitoringLogResponse(CCPMonitoringLogBase):
    id: UUID
    ccp_id: UUID
    recorded_by: UUID | None = None
    recorded_at: datetime
    verified_by: UUID | None = None
    verified_at: datetime | None = None
    # Deviation management response fields
    handled_by: UUID | None = None
    handled_at: datetime | None = None
    # Giá trị legacy trong DB có thể không khớp pattern ở Base — response chấp nhận mọi chuỗi.
    deviation_severity: str | None = None
    deviation_status: str | None = None

    model_config = ConfigDict(from_attributes=True)


# Schema đặc biệt cho việc xử lý độ lệch
class DeviationHandleRequest(BaseModel):
    """Request schema để xử lý một độ lệch"""
    deviation_status: str = Field(
        ...,
        pattern="^(NEW|PENDING_CAPA|CAPA_OPEN|CAPA_IN_PROGRESS|CAPA_CLOSED|CAPA_REJECTED|INVESTIGATING|CORRECTIVE_ACTION|RESOLVED|CLOSED)$",
    )
    deviation_severity: str | None = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    corrective_action: str | None = None
    root_cause: str | None = None
    resolution_note: str | None = None
    handled_by: UUID | None = None


class DeviationCapaNcResponse(BaseModel):
    """Kết quả gửi độ lệch CCP sang hàng đợi NC/CAPA."""

    nc_id: UUID
    created: bool = Field(..., description="True nếu vừa tạo NC mới; False nếu NC đã tồn tại")
    title: str
    status: str


# =============================================================================
# HACCP VERIFICATION SCHEMAS
# =============================================================================
class HaccpVerificationBase(BaseModel):
    verification_type: str | None = Field(None, pattern="^(VERIFICATION|VALIDATION)$")
    period_from: date | None = None
    period_to: date | None = None
    result: str | None = None
    conclusion: str | None = Field(None, pattern="^(PASSED|FAILED|NEEDS_IMPROVEMENT)$")
    report_url: str | None = None


class HaccpVerificationCreate(HaccpVerificationBase):
    haccp_plan_id: UUID
    conducted_by: UUID | None = None
    approved_by: UUID | None = None


class HaccpVerificationUpdate(BaseModel):
    verification_type: str | None = Field(None, pattern="^(VERIFICATION|VALIDATION)$")
    period_from: date | None = None
    period_to: date | None = None
    result: str | None = None
    conclusion: str | None = Field(None, pattern="^(PASSED|FAILED|NEEDS_IMPROVEMENT)$")
    report_url: str | None = None
    approved_by: UUID | None = None


class HaccpVerificationResponse(HaccpVerificationBase):
    id: UUID
    haccp_plan_id: UUID
    conducted_by: UUID
    approved_by: UUID | None = None
    conducted_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# HACCP ASSESSMENT SCHEMAS (Phiếu đánh giá HACCP)
# =============================================================================
class HaccpAssessmentItemBase(BaseModel):
    item_type: str = Field(..., pattern="^(PROCESS_STEP|CCP|GENERAL)$")
    ref_id: UUID | None = None
    question: str
    expected_value: str | None = None
    actual_value: str | None = None
    result: str | None = Field(None, pattern="^(PASS|FAIL|NA|)$")
    note: str | None = None
    evidence_url: str | None = None
    order_index: int = 0


class HaccpAssessmentItemCreate(HaccpAssessmentItemBase):
    pass


class HaccpAssessmentItemUpdate(BaseModel):
    actual_value: str | None = None
    result: str | None = Field(None, pattern="^(PASS|FAIL|NA|)$")
    note: str | None = None
    evidence_url: str | None = None


class HaccpAssessmentItemResponse(HaccpAssessmentItemBase):
    id: UUID
    assessment_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HaccpAssessmentBase(BaseModel):
    title: str = Field(..., max_length=255)
    assessment_date: date | None = None
    overall_result: str | None = Field(None, pattern="^(PASS|FAIL|NEEDS_IMPROVEMENT|)$")
    overall_note: str | None = None
    ai_evaluation: str | None = None


class HaccpAssessmentCreate(HaccpAssessmentBase):
    haccp_plan_id: UUID
    items: list[HaccpAssessmentItemCreate] | None = None
    org_id: UUID | None = None
    submitted_by: UUID | None = None


class HaccpAssessmentUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    assessment_date: date | None = None
    overall_result: str | None = Field(None, pattern="^(PASS|FAIL|NEEDS_IMPROVEMENT|)$")
    overall_note: str | None = None
    status: str | None = Field(None, pattern="^(DRAFT|SUBMITTED|REVIEWED|CLOSED)$")
    reviewed_by: UUID | None = None


class HaccpAssessmentSubmitRequest(BaseModel):
    overall_result: str = Field(..., pattern="^(PASS|FAIL|NEEDS_IMPROVEMENT)$")
    overall_note: str | None = None


class HaccpAssessmentResponse(HaccpAssessmentBase):
    id: UUID
    org_id: UUID
    haccp_plan_id: UUID
    status: str
    submitted_by: UUID | None = None
    reviewed_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    items: list[HaccpAssessmentItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
