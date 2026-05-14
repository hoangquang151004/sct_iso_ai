from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from database.deps import get_db
from modules.auth.dependencies import get_current_principal
from modules.auth.schemas import AuthPrincipal
from .schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    HaccpPlanCreate, HaccpPlanUpdate, HaccpPlanApprove, HaccpPlanResponse,
    HaccpPlanVersionResponse, CreateNewVersionRequest,
    ProcessStepCreate, ProcessStepUpdate, ProcessStepResponse,
    HazardAnalysisCreate, HazardAnalysisUpdate, HazardAnalysisResponse,
    CCPCreate, CCPUpdate, CCPResponse,
    CCPMonitoringLogCreate, CCPMonitoringLogUpdate, CCPMonitoringLogResponse,
    DeviationHandleRequest,
    DeviationCapaNcResponse,
    HaccpVerificationCreate, HaccpVerificationUpdate, HaccpVerificationResponse,
    HaccpAssessmentCreate, HaccpAssessmentUpdate, HaccpAssessmentResponse,
    HaccpAssessmentItemUpdate, HaccpAssessmentItemResponse,
    HaccpAssessmentSubmitRequest,
)
from .service import (
    ProductService,
    HaccpPlanService,
    ProcessStepService,
    HazardAnalysisService,
    CCPService,
    CCPMonitoringLogService,
    HaccpVerificationService,
    HaccpAssessmentService,
)

haccp_router = APIRouter(prefix="/haccp", tags=["HACCP"])


# =============================================================================
# PRODUCT ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/products",
    response_model=list[ProductResponse],
    summary="Danh sách sản phẩm",
    description="Lấy danh sách sản phẩm thực phẩm với bộ lọc theo tổ chức, trạng thái và danh mục",
)
def list_products(
    org_id: UUID | None = None,
    is_active: bool | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
):
    return ProductService.list_products(db, org_id, is_active, category)


@haccp_router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo sản phẩm mới",
    description="Đăng ký sản phẩm thực phẩm mới trong hệ thống HACCP",
)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    # Override org_id from token to prevent foreign key errors
    from copy import deepcopy
    data = payload.model_dump()
    data["org_id"] = principal.org_id
    from .schemas import ProductCreate as PC
    fixed_payload = PC(**data)
    return ProductService.create_product(db, fixed_payload)


@haccp_router.get(
    "/products/{product_id}",
    response_model=ProductResponse,
    summary="Chi tiết sản phẩm",
    description="Lấy thông tin chi tiết của một sản phẩm thực phẩm theo ID",
)
def get_product(product_id: UUID, db: Session = Depends(get_db)):
    result = ProductService.get_product(db, product_id)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return result


@haccp_router.patch(
    "/products/{product_id}",
    response_model=ProductResponse,
    summary="Cập nhật sản phẩm",
    description="Cập nhật thông tin sản phẩm như mô tả, danh mục hoặc trạng thái",
)
def update_product(product_id: UUID, payload: ProductUpdate, db: Session = Depends(get_db)):
    result = ProductService.update_product(db, product_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    return result


@haccp_router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa sản phẩm",
    description="Xóa sản phẩm khỏi hệ thống HACCP",
)
def delete_product(product_id: UUID, db: Session = Depends(get_db)):
    if not ProductService.delete_product(db, product_id):
        raise HTTPException(status_code=404, detail="Product not found")


# =============================================================================
# HACCP PLAN ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/plans",
    response_model=list[HaccpPlanResponse],
    summary="Danh sách kế hoạch HACCP",
    description="Lấy danh sách kế hoạch HACCP với bộ lọc theo tổ chức, sản phẩm hoặc trạng thái (DRAFT/ACTIVE/ARCHIVED)",
)
def list_haccp_plans(
    org_id: UUID | None = None,
    product_id: UUID | None = None,
    plan_status: str | None = Query(None, alias="status", pattern="^(DRAFT|ACTIVE|ARCHIVED)$"),
    db: Session = Depends(get_db),
):
    return HaccpPlanService.list_haccp_plans(db, org_id, product_id, plan_status)


@haccp_router.post(
    "/plans",
    response_model=HaccpPlanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo kế hoạch HACCP mới",
    description="Tạo kế hoạch HACCP mới cho sản phẩm thực phẩm, bao gồm phạm vi và sơ đồ quy trình",
)
def create_haccp_plan(
    payload: HaccpPlanCreate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    # Override org_id and created_by from token
    data = payload.model_dump()
    data["org_id"] = principal.org_id
    data["created_by"] = principal.user_id
    from .schemas import HaccpPlanCreate as HPC
    fixed_payload = HPC(**data)
    return HaccpPlanService.create_haccp_plan(db, fixed_payload)


@haccp_router.get(
    "/plans/{plan_id}",
    response_model=HaccpPlanResponse,
    summary="Chi tiết kế hoạch HACCP",
    description="Lấy chi tiết kế hoạch HACCP bao gồm quy trình sản xuất và phân tích mối nguy",
)
def get_haccp_plan(plan_id: UUID, db: Session = Depends(get_db)):
    result = HaccpPlanService.get_haccp_plan(db, plan_id)
    if not result:
        raise HTTPException(status_code=404, detail="HACCP plan not found")
    return result


@haccp_router.patch(
    "/plans/{plan_id}",
    response_model=HaccpPlanResponse,
    summary="Cập nhật kế hoạch HACCP",
    description="Cập nhật thông tin kế hoạch HACCP (chỉ kế hoạch DRAFT mới có thể sửa đổi)",
)
def update_haccp_plan(plan_id: UUID, payload: HaccpPlanUpdate, db: Session = Depends(get_db)):
    result = HaccpPlanService.update_haccp_plan(db, plan_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="HACCP plan not found")
    return result


@haccp_router.delete(
    "/plans/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa kế hoạch HACCP",
    description="Xóa kế hoạch HACCP (chỉ kế hoạch DRAFT mới có thể xóa)",
)
def delete_haccp_plan(plan_id: UUID, db: Session = Depends(get_db)):
    if not HaccpPlanService.delete_haccp_plan(db, plan_id):
        raise HTTPException(status_code=404, detail="HACCP plan not found")


@haccp_router.post(
    "/plans/{plan_id}/approve",
    response_model=HaccpPlanResponse,
    summary="Phê duyệt kế hoạch HACCP",
    description="Phê duyệt kế hoạch HACCP, chuyển trạng thái từ DRAFT sang ACTIVE để thực thi",
)
def approve_haccp_plan(plan_id: UUID, payload: HaccpPlanApprove, db: Session = Depends(get_db)):
    result = HaccpPlanService.approve_haccp_plan(db, plan_id, payload.approved_by)
    if not result:
        raise HTTPException(status_code=404, detail="HACCP plan not found")
    return result


# =============================================================================
# HACCP PLAN VERSION ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/plans/{plan_id}/versions",
    response_model=list[HaccpPlanVersionResponse],
    summary="Lịch sử phiên bản kế hoạch",
    description="Lấy lịch sử các phiên bản của kế hoạch HACCP",
)
def list_plan_versions(plan_id: UUID, db: Session = Depends(get_db)):
    return HaccpPlanService.list_plan_versions(db, plan_id)


@haccp_router.get(
    "/plans/versions/{version_id}",
    response_model=HaccpPlanVersionResponse,
    summary="Chi tiết phiên bản",
    description="Lấy thông tin chi tiết của một phiên bản kế hoạch",
)
def get_plan_version(version_id: UUID, db: Session = Depends(get_db)):
    result = HaccpPlanService.get_plan_version(db, version_id)
    if not result:
        raise HTTPException(status_code=404, detail="Plan version not found")
    return result


@haccp_router.post(
    "/plans/{plan_id}/versions",
    response_model=HaccpPlanResponse,
    summary="Tạo phiên bản mới",
    description="Tạo phiên bản mới từ kế hoạch ACTIVE - lưu version cũ và chuyển sang DRAFT để chỉnh sửa",
)
def create_new_version(
    plan_id: UUID,
    payload: CreateNewVersionRequest,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    try:
        print(f"[API] Creating new version for plan {plan_id} with payload: {payload.model_dump()}")
        # Override updated_by from token
        data = payload.model_dump()
        data["updated_by"] = principal.user_id
        from .schemas import CreateNewVersionRequest as CNVR
        fixed_payload = CNVR(**data)
        result = HaccpPlanService.create_new_version_from_active(db, plan_id, fixed_payload)
        if not result:
            raise HTTPException(status_code=404, detail="HACCP plan not found")
        print(f"[API] Version created successfully: {result}")
        return result
    except ValueError as e:
        print(f"[API] ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[API] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# =============================================================================
# PROCESS STEP ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/plans/{plan_id}/steps",
    response_model=list[ProcessStepResponse],
    summary="Danh sách bước quy trình",
    description="Lấy danh sách các bước quy trình sản xuất trong kế hoạch HACCP",
)
def list_process_steps(plan_id: UUID, db: Session = Depends(get_db)):
    return ProcessStepService.list_process_steps(db, plan_id)


@haccp_router.post(
    "/plans/{plan_id}/steps",
    response_model=ProcessStepResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm bước quy trình",
    description="Thêm bước quy trình mới vào sơ đồ sản xuất của kế hoạch HACCP",
)
def create_process_step(
    plan_id: UUID,
    payload: ProcessStepCreate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    return ProcessStepService.create_process_step(db, payload)


@haccp_router.get(
    "/steps/{step_id}",
    response_model=ProcessStepResponse,
    summary="Chi tiết bước quy trình",
    description="Lấy thông tin chi tiết của một bước quy trình sản xuất",
)
def get_process_step(step_id: UUID, db: Session = Depends(get_db)):
    result = ProcessStepService.get_process_step(db, step_id)
    if not result:
        raise HTTPException(status_code=404, detail="Process step not found")
    return result


@haccp_router.patch(
    "/steps/{step_id}",
    response_model=ProcessStepResponse,
    summary="Cập nhật bước quy trình",
    description="Cập nhật thông tin bước quy trình như mô tả và thứ tự thực hiện",
)
def update_process_step(step_id: UUID, payload: ProcessStepUpdate, db: Session = Depends(get_db)):
    result = ProcessStepService.update_process_step(db, step_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Process step not found")
    return result


@haccp_router.delete(
    "/steps/{step_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa bước quy trình",
    description="Xóa bước quy trình khỏi sơ đồ sản xuất của kế hoạch HACCP",
)
def delete_process_step(step_id: UUID, db: Session = Depends(get_db)):
    if not ProcessStepService.delete_process_step(db, step_id):
        raise HTTPException(status_code=404, detail="Process step not found")


# =============================================================================
# HAZARD ANALYSIS ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/steps/{step_id}/hazards",
    response_model=list[HazardAnalysisResponse],
    summary="Danh sách mối nguy",
    description="Lấy danh sách phân tích mối nguy cho một bước quy trình sản xuất",
)
def list_hazards(step_id: UUID, db: Session = Depends(get_db)):
    return HazardAnalysisService.list_hazards(db, step_id)


@haccp_router.post(
    "/steps/{step_id}/hazards",
    response_model=HazardAnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo phân tích mối nguy",
    description="Tạo phân tích mối nguy (sinh học/hóa học/vật lý) và xác định điểm kiểm soát tới hạn (CCP)",
)
def create_hazard(
    step_id: UUID,
    payload: HazardAnalysisCreate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    return HazardAnalysisService.create_hazard(db, payload)


@haccp_router.get(
    "/hazards/{hazard_id}",
    response_model=HazardAnalysisResponse,
    summary="Chi tiết mối nguy",
    description="Lấy chi tiết phân tích mối nguy bao gồm kết quả cây quyết định CCP",
)
def get_hazard(hazard_id: UUID, db: Session = Depends(get_db)):
    result = HazardAnalysisService.get_hazard(db, hazard_id)
    if not result:
        raise HTTPException(status_code=404, detail="Hazard analysis not found")
    return result


@haccp_router.patch(
    "/hazards/{hazard_id}",
    response_model=HazardAnalysisResponse,
    summary="Cập nhật mối nguy",
    description="Cập nhật phân tích mối nguy hoặc xác định lại điểm CCP",
)
def update_hazard(hazard_id: UUID, payload: HazardAnalysisUpdate, db: Session = Depends(get_db)):
    result = HazardAnalysisService.update_hazard(db, hazard_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Hazard analysis not found")
    return result


@haccp_router.delete(
    "/hazards/{hazard_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa mối nguy",
    description="Xóa phân tích mối nguy khỏi bước quy trình sản xuất",
)
def delete_hazard(hazard_id: UUID, db: Session = Depends(get_db)):
    if not HazardAnalysisService.delete_hazard(db, hazard_id):
        raise HTTPException(status_code=404, detail="Hazard analysis not found")


# =============================================================================
# CCP ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/plans/{plan_id}/ccps",
    response_model=list[CCPResponse],
    summary="Danh sách CCP",
    description="Lấy danh sách các điểm kiểm soát tới hạn (CCP) trong kế hoạch HACCP",
)
def list_ccps(plan_id: UUID, db: Session = Depends(get_db)):
    return CCPService.list_ccps(db, plan_id)


@haccp_router.post(
    "/plans/{plan_id}/ccps",
    response_model=CCPResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo CCP mới",
    description="Định nghĩa điểm kiểm soát tới hạn (CCP) mới với giới hạn tới hạn và phương pháp giám sát",
)
def create_ccp(
    plan_id: UUID,
    payload: CCPCreate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    try:
        return CCPService.create_ccp(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@haccp_router.get(
    "/ccps/{ccp_id}",
    response_model=CCPResponse,
    summary="Chi tiết CCP",
    description="Lấy chi tiết CCP bao gồm giới hạn tới hạn, giám sát và hành động khắc phục",
)
def get_ccp(ccp_id: UUID, db: Session = Depends(get_db)):
    result = CCPService.get_ccp(db, ccp_id)
    if not result:
        raise HTTPException(status_code=404, detail="CCP not found")
    return result


@haccp_router.patch(
    "/ccps/{ccp_id}",
    response_model=CCPResponse,
    summary="Cập nhật CCP",
    description="Cập nhật thông tin CCP như giới hạn tới hạn hoặc quy trình giám sát",
)
def update_ccp(ccp_id: UUID, payload: CCPUpdate, db: Session = Depends(get_db)):
    try:
        result = CCPService.update_ccp(db, ccp_id, payload)
        if not result:
            raise HTTPException(status_code=404, detail="CCP not found")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@haccp_router.delete(
    "/ccps/{ccp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa CCP",
    description="Xóa điểm kiểm soát tới hạn (CCP) khỏi kế hoạch HACCP",
)
def delete_ccp(ccp_id: UUID, db: Session = Depends(get_db)):
    if not CCPService.delete_ccp(db, ccp_id):
        raise HTTPException(status_code=404, detail="CCP not found")


# =============================================================================
# CCP MONITORING LOG ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/ccps/{ccp_id}/logs",
    response_model=list[CCPMonitoringLogResponse],
    summary="Nhật ký giám sát CCP",
    description="Lấy nhật ký giám sát CCP với bộ lọc theo lô sản xuất và ca làm việc",
)
def list_ccp_logs(
    ccp_id: UUID,
    batch_number: str | None = None,
    shift: str | None = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    return CCPMonitoringLogService.list_ccp_logs(db, ccp_id, batch_number, shift, limit)


@haccp_router.post(
    "/ccps/{ccp_id}/logs",
    response_model=CCPMonitoringLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo nhật ký giám sát",
    description="Ghi nhận kết quả giám sát CCP cho một lô sản xuất, bao gồm độ lệch và hành động khắc phục",
)
def create_ccp_log(
    ccp_id: UUID,
    payload: CCPMonitoringLogCreate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    # Override recorded_by from token
    data = payload.model_dump()
    data["recorded_by"] = principal.user_id
    from .schemas import CCPMonitoringLogCreate as CMLC
    fixed_payload = CMLC(**data)
    return CCPMonitoringLogService.create_ccp_log(db, fixed_payload)


@haccp_router.get(
    "/logs",
    response_model=list[CCPMonitoringLogResponse],
    summary="Danh sách nhật ký giám sát tổng hợp",
    description="Lấy toàn bộ nhật ký giám sát CCP, lọc tùy chọn theo kế hoạch hoặc tổ chức",
)
def list_all_logs(
    org_id: UUID | None = None,
    plan_id: UUID | None = None,
    limit: int = Query(500, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    return CCPMonitoringLogService.list_all_logs(db, org_id, plan_id, limit)


@haccp_router.get(
    "/logs/{log_id}",
    response_model=CCPMonitoringLogResponse,
    summary="Chi tiết nhật ký giám sát",
    description="Lấy chi tiết một bản ghi giám sát CCP",
)
def get_ccp_log(log_id: UUID, db: Session = Depends(get_db)):
    result = CCPMonitoringLogService.get_ccp_log(db, log_id)
    if not result:
        raise HTTPException(status_code=404, detail="Log not found")
    return result


@haccp_router.patch(
    "/logs/{log_id}",
    response_model=CCPMonitoringLogResponse,
    summary="Cập nhật nhật ký giám sát",
    description="Cập nhật thông tin nhật ký giám sát CCP",
)
def update_ccp_log(log_id: UUID, payload: CCPMonitoringLogUpdate, db: Session = Depends(get_db)):
    result = CCPMonitoringLogService.update_ccp_log(db, log_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Log not found")
    return result


# =============================================================================
# DEVIATION ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/deviations",
    response_model=list[CCPMonitoringLogResponse],
    summary="Danh sách độ lệch CCP",
    description="Lấy danh sách các độ lệch CCP (deviations) cần xử lý trong tổ chức",
)
def list_ccp_deviations(
    status: str | None = Query(
        None,
        pattern="^(NEW|PENDING_CAPA|CAPA_OPEN|CAPA_IN_PROGRESS|CAPA_CLOSED|CAPA_REJECTED|INVESTIGATING|CORRECTIVE_ACTION|RESOLVED|CLOSED)$",
    ),
    severity: str | None = Query(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$"),
    plan_id: UUID | None = Query(None, description="Lọc theo kế hoạch HACCP"),
    ccp_id: UUID | None = Query(None, description="Lọc theo CCP"),
    search: str | None = Query(None, max_length=200, description="Tìm theo lô, ghi chú lệch, tên/mã CCP"),
    has_capa_nc: bool | None = Query(
        None,
        description="True: đã có NC gửi CAPA; False: chưa có NC; bỏ qua: tất cả",
    ),
    recorded_from: date | None = Query(None, description="Từ ngày ghi nhận (recorded_at), bao gồm"),
    recorded_to: date | None = Query(None, description="Đến ngày ghi nhận (recorded_at), bao gồm"),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    if recorded_from is not None and recorded_to is not None and recorded_from > recorded_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="recorded_from không được sau recorded_to.",
        )
    return CCPMonitoringLogService.list_ccp_deviations(
        db,
        principal.org_id,
        status,
        severity,
        plan_id,
        ccp_id,
        search,
        has_capa_nc,
        recorded_from,
        recorded_to,
        limit,
    )


@haccp_router.get(
    "/deviations/stats",
    summary="Thống kê độ lệch CCP",
    description="Thống kê độ lệch CCP theo trạng thái và mức độ nghiêm trọng",
)
def get_deviation_stats(
    recorded_from: date | None = Query(None, description="Từ ngày ghi nhận (recorded_at), bao gồm"),
    recorded_to: date | None = Query(None, description="Đến ngày ghi nhận (recorded_at), bao gồm"),
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    """Lấy thống kê độ lệch: số lượng theo trạng thái và mức độ nghiêm trọng (theo tổ chức đăng nhập)."""
    if recorded_from is not None and recorded_to is not None and recorded_from > recorded_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="recorded_from không được sau recorded_to.",
        )
    return CCPMonitoringLogService.get_deviation_stats(
        db, principal.org_id, recorded_from, recorded_to
    )


@haccp_router.patch(
    "/deviations/{log_id}/handle",
    response_model=CCPMonitoringLogResponse,
    summary="Xử lý độ lệch CCP",
    description="Xử lý một độ lệch CCP - cập nhật trạng thái, mức độ nghiêm trọng, hành động khắc phục",
)
def handle_ccp_deviation(
    log_id: UUID,
    payload: DeviationHandleRequest,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    """Endpoint để xử lý độ lệch CCP: cập nhật trạng thái, phân loại mức độ, ghi nhận hành động khắc phục"""
    result = CCPMonitoringLogService.handle_deviation(db, log_id, principal.org_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Deviation not found")
    return result


@haccp_router.post(
    "/deviations/{log_id}/capa-nc",
    response_model=DeviationCapaNcResponse,
    summary="Gửi độ lệch CCP sang CAPA (NC)",
    description=(
        "Tạo bản ghi không phù hợp (NC) nguồn HACCP trỏ tới nhật ký độ lệch nếu chưa có, "
        "để bộ phận CAPA tiếp nhận xử lý."
    ),
)
def request_capa_nc_for_deviation(
    log_id: UUID,
    response: Response,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    try:
        out = CCPMonitoringLogService.ensure_nc_for_deviation_capa(
            db, log_id, principal.org_id
        )
    except ValueError as exc:
        if str(exc) == "not_deviation":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nhật ký không phải độ lệch (is_within_limit phải là false).",
            ) from exc
        raise
    if not out:
        raise HTTPException(status_code=404, detail="Deviation not found")
    nc, created = out
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return DeviationCapaNcResponse(
        nc_id=nc.id,
        created=created,
        title=nc.title,
        status=nc.status,
    )


# =============================================================================
# HACCP VERIFICATION ENDPOINTS
# =============================================================================
@haccp_router.get(
    "/plans/{plan_id}/verifications",
    response_model=list[HaccpVerificationResponse],
    summary="Danh sách thẩm tra HACCP",
    description="Lấy danh sách các lần thẩm tra/xác nhận của kế hoạch HACCP",
)
def list_verifications(plan_id: UUID, db: Session = Depends(get_db)):
    return HaccpVerificationService.list_verifications(db, plan_id)


@haccp_router.post(
    "/plans/{plan_id}/verifications",
    response_model=HaccpVerificationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo thẩm tra HACCP",
    description="Ghi nhận kết quả thẩm tra hoặc xác nhận hiệu lực của kế hoạch HACCP",
)
def create_verification(
    plan_id: UUID,
    payload: HaccpVerificationCreate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    # Override conducted_by from token
    data = payload.model_dump()
    data["conducted_by"] = principal.user_id
    from .schemas import HaccpVerificationCreate as HVC
    fixed_payload = HVC(**data)
    return HaccpVerificationService.create_verification(db, fixed_payload)


@haccp_router.get(
    "/verifications/{verification_id}",
    response_model=HaccpVerificationResponse,
    summary="Chi tiết thẩm tra HACCP",
    description="Lấy chi tiết kết quả thẩm tra HACCP",
)
def get_verification(verification_id: UUID, db: Session = Depends(get_db)):
    result = HaccpVerificationService.get_verification(db, verification_id)
    if not result:
        raise HTTPException(status_code=404, detail="Verification not found")
    return result


@haccp_router.patch(
    "/verifications/{verification_id}",
    response_model=HaccpVerificationResponse,
    summary="Cập nhật thẩm tra HACCP",
    description="Cập nhật kết quả hoặc kết luận thẩm tra HACCP",
)
def update_verification(verification_id: UUID, payload: HaccpVerificationUpdate, db: Session = Depends(get_db)):
    result = HaccpVerificationService.update_verification(db, verification_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Verification not found")
    return result


# =============================================================================
# HACCP ASSESSMENT ENDPOINTS (Phiếu đánh giá HACCP)
# =============================================================================
@haccp_router.get(
    "/assessments",
    response_model=list[HaccpAssessmentResponse],
    summary="Danh sách phiếu đánh giá HACCP",
    description="Lấy danh sách phiếu đánh giá với bộ lọc theo tổ chức, kế hoạch và trạng thái",
)
def list_assessments(
    org_id: UUID | None = None,
    haccp_plan_id: UUID | None = None,
    status: str | None = Query(None, pattern="^(DRAFT|SUBMITTED|REVIEWED|CLOSED)$"),
    db: Session = Depends(get_db),
):
    return HaccpAssessmentService.list_assessments(db, org_id, haccp_plan_id, status)


@haccp_router.post(
    "/assessments",
    response_model=HaccpAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo phiếu đánh giá HACCP",
    description="Tạo phiếu đánh giá HACCP mới với các hạng mục đánh giá",
)
def create_assessment(
    payload: HaccpAssessmentCreate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    data = payload.model_dump()
    data["org_id"] = principal.org_id
    data["submitted_by"] = principal.user_id
    from .schemas import HaccpAssessmentCreate as HAC
    fixed_payload = HAC(**data)
    return HaccpAssessmentService.create_assessment(db, fixed_payload)


@haccp_router.get(
    "/assessments/{assessment_id}",
    response_model=HaccpAssessmentResponse,
    summary="Chi tiết phiếu đánh giá",
    description="Lấy chi tiết phiếu đánh giá HACCP kèm các hạng mục",
)
def get_assessment(assessment_id: UUID, db: Session = Depends(get_db)):
    result = HaccpAssessmentService.get_assessment(db, assessment_id)
    if not result:
        raise HTTPException(status_code=404, detail="Phiếu đánh giá không tồn tại")
    return result


@haccp_router.patch(
    "/assessments/{assessment_id}",
    response_model=HaccpAssessmentResponse,
    summary="Cập nhật phiếu đánh giá",
    description="Cập nhật thông tin phiếu đánh giá HACCP",
)
def update_assessment(assessment_id: UUID, payload: HaccpAssessmentUpdate, db: Session = Depends(get_db)):
    result = HaccpAssessmentService.update_assessment(db, assessment_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Phiếu đánh giá không tồn tại")
    return result


@haccp_router.post(
    "/assessments/{assessment_id}/submit",
    response_model=HaccpAssessmentResponse,
    summary="Gửi phiếu đánh giá",
    description="Gửi phiếu đánh giá HACCP sau khi hoàn thành khảo sát",
)
def submit_assessment(
    assessment_id: UUID,
    payload: HaccpAssessmentSubmitRequest,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(get_current_principal),
):
    result = HaccpAssessmentService.submit_assessment(db, assessment_id, payload, principal.user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Phiếu đánh giá không tồn tại")
    return result


@haccp_router.patch(
    "/assessment-items/{item_id}",
    response_model=HaccpAssessmentItemResponse,
    summary="Cập nhật hạng mục đánh giá",
    description="Cập nhật kết quả đánh giá cho một hạng mục cụ thể",
)
def update_assessment_item(item_id: UUID, payload: HaccpAssessmentItemUpdate, db: Session = Depends(get_db)):
    result = HaccpAssessmentService.update_assessment_item(db, item_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Hạng mục không tồn tại")
    return result


@haccp_router.delete(
    "/assessments/{assessment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa phiếu đánh giá",
    description="Xóa phiếu đánh giá HACCP (chỉ khi trạng thái DRAFT)",
)
def delete_assessment(assessment_id: UUID, db: Session = Depends(get_db)):
    obj = HaccpAssessmentService.get_assessment(db, assessment_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Phiếu đánh giá không tồn tại")
    if obj.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Chỉ có thể xóa phiếu ở trạng thái DRAFT")
    HaccpAssessmentService.delete_assessment(db, assessment_id)
    return None
