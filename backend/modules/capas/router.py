from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database import db_manager

from .schemas import (
    CAPACreate,
    CAPAResponse,
    CAPAUpdate,
    KanbanBoardResponse,
    KPIResponse,
    NonConformityResponse,
    NCUpdate,
)
from .service import CAPAService


def get_db():
    yield from db_manager.get_db()


capas_router = APIRouter(prefix="/capa", tags=["CAPA Management"])


def get_capa_service(db: Session = Depends(get_db)) -> CAPAService:
    return CAPAService(db)


@capas_router.get(
    "/ncs",
    response_model=List[NonConformityResponse],
    summary="Danh sách điểm không phù hợp (NC)",
    description="Lấy danh sách các điểm NC đang chờ xử lý (WAITING) của tổ chức để theo dõi và tạo CAPA.",
)
def list_ncs(
    org_id: UUID = Query(...),
    status: Optional[str] = Query("WAITING"),
    source: Optional[str] = Query(None, description="Lọc theo nguồn: PRP, HACCP, v.v."),
    service: CAPAService = Depends(get_capa_service),
):
    return service.get_ncs(org_id=org_id, status=status, source=source)


@capas_router.get(
    "/nc/check",
    response_model=List[UUID],
    summary="Kiểm tra NC đã tồn tại",
)
def check_ncs(
    source_ref_ids: List[UUID] = Query(...),
    service: CAPAService = Depends(get_capa_service),
):
    return service.check_existing_ncs(source_ref_ids)


# Removed create_manual_nc - NCs must be created through source modules (PRP/HACCP)
@capas_router.post(
    "/",
    response_model=CAPAResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới CAPA",
    description="Tạo mới một hành động khắc phục (CAPA) từ một điểm không phù hợp (NC) đã xác định.",
)
def create_capa(payload: CAPACreate, service: CAPAService = Depends(get_capa_service)):
    if payload.nc_id:
        if not service.get_nc(payload.nc_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NonConformity với ID {payload.nc_id} không tồn tại.",
            )
    return service.create_capa(payload)


@capas_router.get(
    "/kpi/{org_id}",
    response_model=KPIResponse,
    summary="Thống kê KPI",
    description="Lấy các chỉ số thống kê tổng quát về tình trạng CAPA của tổ chức (Tổng số, Đang xử lý, Quá hạn...).",
)
def get_kpi(org_id: UUID, service: CAPAService = Depends(get_capa_service)):
    return service.get_capa_kpi(org_id)


@capas_router.get(
    "/board/{org_id}",
    response_model=KanbanBoardResponse,
    summary="Dữ liệu bảng Kanban",
    description="Lấy danh sách CAPA được phân loại theo trạng thái để hiển thị lên giao diện Kanban.",
)
def get_board(org_id: UUID, service: CAPAService = Depends(get_capa_service)):
    return {"columns": service.get_kanban_board(org_id)}


@capas_router.patch(
    "/nc/{nc_id}",
    response_model=NonConformityResponse,
    summary="Cập nhật điểm không phù hợp (NC)",
)
def update_nc(
    nc_id: UUID,
    payload: NCUpdate,
    service: CAPAService = Depends(get_capa_service),
):
    db_nc = service.update_nc(nc_id, payload)
    if not db_nc:
        raise HTTPException(status_code=404, detail="NC not found")
    return db_nc


@capas_router.patch(
    "/{capa_id}",
    response_model=CAPAResponse,
    summary="Cập nhật CAPA",
    description="Cập nhật thông tin chi tiết hoặc thay đổi trạng thái xử lý của một bản ghi CAPA.",
)
def update_capa(
    capa_id: UUID, payload: CAPAUpdate, service: CAPAService = Depends(get_capa_service)
):
    result = service.update_capa(capa_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="CAPA not found")
    return result
