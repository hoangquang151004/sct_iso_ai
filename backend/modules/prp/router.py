from typing import List, Optional
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database import db_manager
from .service import PRPAuditService
from .schemas import (
    PRPAuditResponse,
    PRPChecklistTemplateCreate,
    PRPChecklistTemplateUpdate,
    PRPChecklistTemplateResponse,
    PRPAuditFullCreate,
    PRPProgramCreate,
    PRPProgramResponse,
    LocationResponse,
    PRPProgramUpdate,
    PRPScheduleRequest,
    PRPNCRequest,
    ISO22000_CLAUSES,
)


prp_router = APIRouter(prefix="/prp", tags=["PRP Audits"])


def get_prp_audit_service(db: Session = Depends(db_manager.get_db)):
    return PRPAuditService(db)


# --- MASTER DATA ENDPOINTS ---


@prp_router.get("/clauses", response_model=dict)
def get_iso_clauses():
    """Lấy danh sách các điều khoản ISO 22000 cho PRP."""
    return ISO22000_CLAUSES


@prp_router.get(
    "/programs",
    response_model=List[PRPProgramResponse],
    summary="Lấy danh sách chương trình PRP",
    description="Lấy danh sách các chương trình tiên quyết (PRP Programs) đang hoạt động.",
)
def list_programs(
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.get_all_programs()


@prp_router.get(
    "/programs/{program_id}",
    response_model=PRPProgramResponse,
    summary="Lấy chi tiết một chương trình.",
)
def get_prp_program(
    program_id: UUID, service: PRPAuditService = Depends(get_prp_audit_service)
):
    prog = service.get_program_by_id(program_id)
    if not prog:
        raise HTTPException(status_code=404, detail="Chương trình không tồn tại")
    return prog


@prp_router.get(
    "/programs/{program_id}/allowed-locations",
    response_model=List[LocationResponse],
    summary="Lấy danh sách khu vực được phép lập lịch",
    description="Lấy danh sách các khu vực đã được thiết kế form cho chương trình này.",
)
def get_allowed_locations(
    program_id: UUID,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.get_locations_with_templates(program_id)


@prp_router.patch(
    "/programs/{program_id}",
    response_model=PRPProgramResponse,
    summary="Cập nhật chương trình.",
)
def update_prp_program(
    program_id: UUID,
    payload: PRPProgramUpdate,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    prog = service.update_program(program_id, payload)
    if not prog:
        raise HTTPException(status_code=404, detail="Chương trình không tồn tại")
    return prog


@prp_router.post(
    "/programs",
    response_model=PRPProgramResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới chương trình PRP",
    description="Tạo một chương trình tiên quyết mới (ví dụ: SSOP, GHP).",
)
def create_prp_program(
    payload: PRPProgramCreate,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.create_program(payload)


@prp_router.get(
    "/locations",
    response_model=List[LocationResponse],
    summary="Lấy danh sách khu vực",
    description="Lấy danh sách các khu vực/địa điểm dùng cho bộ lọc và đánh giá.",
)
def list_locations(
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.get_all_locations()


@prp_router.post(
    "/templates",
    response_model=PRPChecklistTemplateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mẫu câu hỏi kiểm tra",
    description="ISO Manager tạo các hạng mục kiểm tra mẫu cho một chương trình PRP.",
)
def create_template(
    payload: PRPChecklistTemplateCreate,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.create_template(payload)


@prp_router.patch(
    "/templates/{template_id}",
    response_model=PRPChecklistTemplateResponse,
    summary="Cập nhật mẫu câu hỏi kiểm tra",
)
def update_template(
    template_id: UUID,
    payload: PRPChecklistTemplateUpdate,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    template = service.update_template(template_id, payload)
    if not template:
        raise HTTPException(status_code=404, detail="Hạng mục không tồn tại")
    return template


@prp_router.delete(
    "/templates/{template_id}",
    summary="Xóa một hạng mục checklist.",
)
def delete_prp_template(
    template_id: UUID,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    result = service.delete_template(template_id)
    if not result["success"]:
        if result.get("has_history"):
            raise HTTPException(status_code=409, detail=result["message"])
        raise HTTPException(status_code=404, detail=result["message"])

    return None


@prp_router.get(
    "/templates/location/{location_id}",
    response_model=List[PRPChecklistTemplateResponse],
    summary="Lấy danh sách mẫu câu hỏi theo khu vực",
    description="Lấy danh sách các hạng mục kiểm tra của một khu vực cụ thể.",
)
def get_templates_by_location(
    location_id: UUID,
    only_active: bool = Query(True, description="Chỉ lấy các câu hỏi đang hoạt động"),
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.get_templates_by_location(location_id, only_active=only_active)


# --- AUDIT ENDPOINTS ---


@prp_router.post(
    "/nc",
    summary="Tạo NC từ nguồn PRP",
)
def create_prp_nc(
    payload: PRPNCRequest,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.create_nc_from_audit(payload)


@prp_router.post(
    "/full",
    response_model=PRPAuditResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Lưu báo cáo đánh giá đầy đủ",
)
def create_full_audit(
    payload: PRPAuditFullCreate,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.create_full_audit(payload)


@prp_router.get(
    "/",
    response_model=List[PRPAuditResponse],
    summary="Danh sách đánh giá PRP",
    description="Lấy danh sách đánh giá, hỗ trợ lọc theo khu vực và ngày.",
)
def list_prp_audits(
    skip: int = 0,
    limit: int = 100,
    org_id: Optional[UUID] = Query(None),
    area_id: Optional[UUID] = Query(None, description="Lọc theo ID khu vực"),
    audit_date: Optional[date] = Query(None, description="Lọc theo ngày đánh giá"),
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = Query(None),
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.get_audits(
        skip=skip,
        limit=limit,
        org_id=org_id,
        area_id=area_id,
        audit_date=audit_date,
        month=month,
        year=year,
    )


@prp_router.post("/schedule", status_code=status.HTTP_201_CREATED)
def create_prp_schedule(
    req: PRPScheduleRequest, service: PRPAuditService = Depends(get_prp_audit_service)
):
    """Tạo lịch đánh giá định kỳ cho PRP."""
    count = service.create_audit_schedule(req)
    return {"message": f"Đã tạo thành công {count} sự kiện lịch", "count": count}


@prp_router.get("/upcoming-schedules")
def list_upcoming_schedules(
    org_id: UUID = Query(...), service: PRPAuditService = Depends(get_prp_audit_service)
):
    """Lấy danh sách các buổi đánh giá đã lên lịch sắp tới."""
    return service.get_upcoming_schedules(org_id=org_id)


@prp_router.get("/schedules")
def list_all_schedules(
    org_id: UUID = Query(...),
    status: Optional[str] = Query(
        None, description="Lọc theo trạng thái: SCHEDULED, COMPLETED, OVERDUE"
    ),
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    """Lấy toàn bộ danh sách lịch đánh giá và tiến độ thực hiện."""
    return service.get_all_audit_schedules(org_id=org_id, status=status)


@prp_router.get("/{audit_id}", response_model=PRPAuditResponse)
def get_prp_audit(
    audit_id: UUID, service: PRPAuditService = Depends(get_prp_audit_service)
):
    audit = service.get_audit_by_id(audit_id=audit_id)
    if not audit:
        raise HTTPException(status_code=404, detail="PRP Audit không tồn tại")
    return audit
