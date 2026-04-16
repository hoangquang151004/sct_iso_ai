from uuid import UUID

from fastapi import APIRouter, status, Query, HTTPException

from modules.haccp.schemas import (
    # Product
    ProductCreate, ProductUpdate, ProductResponse,
    # HACCP Plan
    HaccpPlanCreate, HaccpPlanUpdate, HaccpPlanResponse,
    # Process Step
    ProcessStepCreate, ProcessStepUpdate, ProcessStepResponse,
    # Hazard Analysis
    HazardAnalysisCreate, HazardAnalysisUpdate, HazardAnalysisResponse,
    # CCP
    CCPCreate, CCPUpdate, CCPResponse,
    # CCP Monitoring
    CCPMonitoringLogCreate, CCPMonitoringLogUpdate, CCPMonitoringLogResponse,
    # Verification
    HaccpVerificationCreate, HaccpVerificationUpdate, HaccpVerificationResponse,
)
from app.modules.haccp.service import (
    ProductService,
    HaccpPlanService,
    ProcessStepService,
    HazardAnalysisService,
    CCPService,
    CCPMonitoringLogService,
    HaccpVerificationService,
)

router = APIRouter(prefix="/haccp", tags=["HACCP"])


# =============================================================================
# PRODUCT ENDPOINTS
# =============================================================================
@router.get("/products", response_model=list[ProductResponse])
def list_products(
    org_id: UUID | None = None,
    is_active: bool | None = None,
    category: str | None = None,
) -> list[ProductResponse]:
    """List all products with optional filters."""
    return ProductService.list_products(org_id, is_active, category)


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate) -> ProductResponse:
    """Create a new product."""
    return ProductService.create_product(payload)


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: UUID) -> ProductResponse:
    """Get a product by ID."""
    result = ProductService.get_product(product_id)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return result


@router.patch("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: UUID, payload: ProductUpdate) -> ProductResponse:
    """Update a product."""
    result = ProductService.update_product(product_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return result


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: UUID) -> None:
    """Delete a product (soft delete via is_active=False)."""
    success = ProductService.delete_product(product_id)
    if not success:
        raise HTTPException(status_code=404, detail="Product not found")


# =============================================================================
# HACCP PLAN ENDPOINTS
# =============================================================================
@router.get("/plans", response_model=list[HaccpPlanResponse])
def list_haccp_plans(
    org_id: UUID | None = None,
    product_id: UUID | None = None,
    status: str | None = Query(None, pattern="^(DRAFT|ACTIVE|ARCHIVED)$"),
) -> list[HaccpPlanResponse]:
    """List all HACCP plans with optional filters."""
    return HaccpPlanService.list_haccp_plans(org_id, product_id, status)


@router.post("/plans", response_model=HaccpPlanResponse, status_code=status.HTTP_201_CREATED)
def create_haccp_plan(payload: HaccpPlanCreate) -> HaccpPlanResponse:
    """Create a new HACCP plan."""
    return HaccpPlanService.create_haccp_plan(payload)


@router.get("/plans/{plan_id}", response_model=HaccpPlanResponse)
def get_haccp_plan(plan_id: UUID) -> HaccpPlanResponse:
    """Get a HACCP plan by ID."""
    result = HaccpPlanService.get_haccp_plan(plan_id)
    if not result:
        raise HTTPException(status_code=404, detail="HACCP plan not found")
    return result


@router.patch("/plans/{plan_id}", response_model=HaccpPlanResponse)
def update_haccp_plan(plan_id: UUID, payload: HaccpPlanUpdate) -> HaccpPlanResponse:
    """Update a HACCP plan."""
    result = HaccpPlanService.update_haccp_plan(plan_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="HACCP plan not found")
    return result


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_haccp_plan(plan_id: UUID) -> None:
    """Delete a HACCP plan."""
    success = HaccpPlanService.delete_haccp_plan(plan_id)
    if not success:
        raise HTTPException(status_code=404, detail="HACCP plan not found")


@router.post("/plans/{plan_id}/approve", response_model=HaccpPlanResponse)
def approve_haccp_plan(plan_id: UUID, approved_by: UUID) -> HaccpPlanResponse:
    """Approve a HACCP plan."""
    result = HaccpPlanService.approve_haccp_plan(plan_id, approved_by)
    if not result:
        raise HTTPException(status_code=404, detail="HACCP plan not found")
    return result


# =============================================================================
# PROCESS STEP ENDPOINTS
# =============================================================================
@router.get("/plans/{plan_id}/steps", response_model=list[ProcessStepResponse])
def list_process_steps(plan_id: UUID) -> list[ProcessStepResponse]:
    """List all process steps for a HACCP plan."""
    return ProcessStepService.list_process_steps(plan_id)


@router.post("/plans/{plan_id}/steps", response_model=ProcessStepResponse, status_code=status.HTTP_201_CREATED)
def create_process_step(plan_id: UUID, payload: ProcessStepCreate) -> ProcessStepResponse:
    """Create a new process step."""
    return ProcessStepService.create_process_step(payload)


@router.get("/steps/{step_id}", response_model=ProcessStepResponse)
def get_process_step(step_id: UUID) -> ProcessStepResponse:
    """Get a process step by ID."""
    result = ProcessStepService.get_process_step(step_id)
    if not result:
        raise HTTPException(status_code=404, detail="Process step not found")
    return result


@router.patch("/steps/{step_id}", response_model=ProcessStepResponse)
def update_process_step(step_id: UUID, payload: ProcessStepUpdate) -> ProcessStepResponse:
    """Update a process step."""
    result = ProcessStepService.update_process_step(step_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Process step not found")
    return result


@router.delete("/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_process_step(step_id: UUID) -> None:
    """Delete a process step."""
    success = ProcessStepService.delete_process_step(step_id)
    if not success:
        raise HTTPException(status_code=404, detail="Process step not found")


# =============================================================================
# HAZARD ANALYSIS ENDPOINTS
# =============================================================================
@router.get("/steps/{step_id}/hazards", response_model=list[HazardAnalysisResponse])
def list_hazards(step_id: UUID) -> list[HazardAnalysisResponse]:
    """List all hazard analyses for a process step."""
    return HazardAnalysisService.list_hazards(step_id)


@router.post("/steps/{step_id}/hazards", response_model=HazardAnalysisResponse, status_code=status.HTTP_201_CREATED)
def create_hazard(step_id: UUID, payload: HazardAnalysisCreate) -> HazardAnalysisResponse:
    """Create a new hazard analysis."""
    return HazardAnalysisService.create_hazard(payload)


@router.get("/hazards/{hazard_id}", response_model=HazardAnalysisResponse)
def get_hazard(hazard_id: UUID) -> HazardAnalysisResponse:
    """Get a hazard analysis by ID."""
    result = HazardAnalysisService.get_hazard(hazard_id)
    if not result:
        raise HTTPException(status_code=404, detail="Hazard analysis not found")
    return result


@router.patch("/hazards/{hazard_id}", response_model=HazardAnalysisResponse)
def update_hazard(hazard_id: UUID, payload: HazardAnalysisUpdate) -> HazardAnalysisResponse:
    """Update a hazard analysis."""
    result = HazardAnalysisService.update_hazard(hazard_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Hazard analysis not found")
    return result


@router.delete("/hazards/{hazard_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hazard(hazard_id: UUID) -> None:
    """Delete a hazard analysis."""
    success = HazardAnalysisService.delete_hazard(hazard_id)
    if not success:
        raise HTTPException(status_code=404, detail="Hazard analysis not found")


# =============================================================================
# CCP ENDPOINTS
# =============================================================================
@router.get("/plans/{plan_id}/ccps", response_model=list[CCPResponse])
def list_ccps(plan_id: UUID) -> list[CCPResponse]:
    """List all CCPs for a HACCP plan."""
    return CCPService.list_ccps(plan_id)


@router.post("/plans/{plan_id}/ccps", response_model=CCPResponse, status_code=status.HTTP_201_CREATED)
def create_ccp(plan_id: UUID, payload: CCPCreate) -> CCPResponse:
    """Create a new CCP."""
    return CCPService.create_ccp(payload)


@router.get("/ccps/{ccp_id}", response_model=CCPResponse)
def get_ccp(ccp_id: UUID) -> CCPResponse:
    """Get a CCP by ID."""
    result = CCPService.get_ccp(ccp_id)
    if not result:
        raise HTTPException(status_code=404, detail="CCP not found")
    return result


@router.patch("/ccps/{ccp_id}", response_model=CCPResponse)
def update_ccp(ccp_id: UUID, payload: CCPUpdate) -> CCPResponse:
    """Update a CCP."""
    result = CCPService.update_ccp(ccp_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="CCP not found")
    return result


@router.delete("/ccps/{ccp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ccp(ccp_id: UUID) -> None:
    """Delete a CCP."""
    success = CCPService.delete_ccp(ccp_id)
    if not success:
        raise HTTPException(status_code=404, detail="CCP not found")


# =============================================================================
# CCP MONITORING LOG ENDPOINTS
# =============================================================================
@router.get("/ccps/{ccp_id}/logs", response_model=list[CCPMonitoringLogResponse])
def list_ccp_logs(
    ccp_id: UUID,
    batch_number: str | None = None,
    shift: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
) -> list[CCPMonitoringLogResponse]:
    """List monitoring logs for a CCP."""
    return CCPMonitoringLogService.list_ccp_logs(ccp_id, batch_number, shift, limit)


@router.post("/ccps/{ccp_id}/logs", response_model=CCPMonitoringLogResponse, status_code=status.HTTP_201_CREATED)
def create_ccp_log(ccp_id: UUID, payload: CCPMonitoringLogCreate) -> CCPMonitoringLogResponse:
    """Create a new CCP monitoring log."""
    return CCPMonitoringLogService.create_ccp_log(payload)


@router.get("/logs/{log_id}", response_model=CCPMonitoringLogResponse)
def get_ccp_log(log_id: UUID) -> CCPMonitoringLogResponse:
    """Get a CCP monitoring log by ID."""
    result = CCPMonitoringLogService.get_ccp_log(log_id)
    if not result:
        raise HTTPException(status_code=404, detail="CCP monitoring log not found")
    return result


@router.patch("/logs/{log_id}", response_model=CCPMonitoringLogResponse)
def update_ccp_log(log_id: UUID, payload: CCPMonitoringLogUpdate) -> CCPMonitoringLogResponse:
    """Update a CCP monitoring log."""
    result = CCPMonitoringLogService.update_ccp_log(log_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="CCP monitoring log not found")
    return result


@router.get("/deviations", response_model=list[CCPMonitoringLogResponse])
def list_ccp_deviations(
    org_id: UUID | None = None,
    limit: int = Query(100, ge=1, le=1000),
) -> list[CCPMonitoringLogResponse]:
    """List all CCP deviations (logs where is_within_limit = False)."""
    return CCPMonitoringLogService.list_ccp_deviations(org_id, limit)


# =============================================================================
# HACCP VERIFICATION ENDPOINTS
# =============================================================================
@router.get("/plans/{plan_id}/verifications", response_model=list[HaccpVerificationResponse])
def list_verifications(plan_id: UUID) -> list[HaccpVerificationResponse]:
    """List all verifications for a HACCP plan."""
    return HaccpVerificationService.list_verifications(plan_id)


@router.post("/plans/{plan_id}/verifications", response_model=HaccpVerificationResponse, status_code=status.HTTP_201_CREATED)
def create_verification(plan_id: UUID, payload: HaccpVerificationCreate) -> HaccpVerificationResponse:
    """Create a new HACCP verification."""
    return HaccpVerificationService.create_verification(payload)


@router.get("/verifications/{verification_id}", response_model=HaccpVerificationResponse)
def get_verification(verification_id: UUID) -> HaccpVerificationResponse:
    """Get a HACCP verification by ID."""
    result = HaccpVerificationService.get_verification(verification_id)
    if not result:
        raise HTTPException(status_code=404, detail="HACCP verification not found")
    return result


@router.patch("/verifications/{verification_id}", response_model=HaccpVerificationResponse)
def update_verification(verification_id: UUID, payload: HaccpVerificationUpdate) -> HaccpVerificationResponse:
    """Update a HACCP verification."""
    result = HaccpVerificationService.update_verification(verification_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="HACCP verification not found")
    return result
