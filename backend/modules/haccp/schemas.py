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
    org_id: UUID


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
    org_id: UUID
    created_by: UUID


class HaccpPlanUpdate(BaseModel):
    product_id: UUID | None = None
    name: str | None = Field(None, max_length=255)
    version: str | None = Field(None, max_length=20)
    scope: str | None = None
    status: str | None = Field(None, pattern="^(DRAFT|ACTIVE|ARCHIVED)$")


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
    haccp_plan_id: UUID


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
    step_id: UUID


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
    haccp_plan_id: UUID
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


class CCPMonitoringLogCreate(CCPMonitoringLogBase):
    ccp_id: UUID
    recorded_by: UUID


class CCPMonitoringLogUpdate(BaseModel):
    batch_number: str | None = Field(None, max_length=100)
    shift: str | None = Field(None, max_length=50)
    measured_value: float | None = None
    unit: str | None = Field(None, max_length=20)
    is_within_limit: bool | None = None
    deviation_note: str | None = None
    verified_by: UUID | None = None


class CCPMonitoringLogResponse(CCPMonitoringLogBase):
    id: UUID
    ccp_id: UUID
    recorded_by: UUID
    recorded_at: datetime
    verified_by: UUID | None = None
    verified_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


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
    conducted_by: UUID
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

