from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from database import db_manager
from .service import PRPAuditService
from .schemas import PRPAuditCreate, PRPAuditUpdate, PRPAuditResponse


prp_router = APIRouter(prefix="/prp", tags=["PRP Audits"])


def get_prp_audit_service(db: Session = Depends(db_manager.get_db)):
    return PRPAuditService(db)


@prp_router.get(
    "/",
    response_model=List[PRPAuditResponse],
    description="""
### Lấy danh sách đánh giá PRP
Trả về danh sách các bản ghi đánh giá PRP trong hệ thống.
Hỗ trợ phân trang thông qua hai tham số `skip` và `limit`.
""",
)
def list_prp_audits(
    skip: int = 0,
    limit: int = 100,
    org_id: Optional[UUID] = Query(None),
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    return service.get_audits(skip=skip, limit=limit, org_id=org_id)


@prp_router.post(
    "/",
    response_model=PRPAuditResponse,
    status_code=status.HTTP_201_CREATED,
    description="""
### Tạo mới đánh giá PRP
Khởi tạo một bản ghi đánh giá PRP mới dựa trên dữ liệu cung cấp trong request body.
Dữ liệu trả về bao gồm thông tin chi tiết của bản ghi vừa tạo kèm theo ID duy nhất.
""",
)
def create_prp_audit(
    payload: PRPAuditCreate, service: PRPAuditService = Depends(get_prp_audit_service)
):
    return service.create_audit(payload=payload)


@prp_router.get(
    "/{audit_id}",
    response_model=PRPAuditResponse,
    description="""
### Chi tiết đánh giá PRP
Truy xuất toàn bộ thông tin của một bản ghi đánh giá PRP cụ thể thông qua mã định danh `audit_id` (UUID).
""",
)
def get_prp_audit(
    audit_id: UUID, service: PRPAuditService = Depends(get_prp_audit_service)
):
    audit = service.get_audit_by_id(audit_id=audit_id)
    if not audit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="PRP Audit không tồn tại"
        )
    return audit


@prp_router.patch(
    "/{audit_id}",
    response_model=PRPAuditResponse,
    description="""
### Cập nhật đánh giá PRP
Cập nhật một hoặc nhiều trường thông tin của bản ghi đánh giá PRP hiện có. 
Chỉ những trường được gửi trong request body sẽ được thay đổi.
""",
)
def update_prp_audit(
    audit_id: UUID,
    payload: PRPAuditUpdate,
    service: PRPAuditService = Depends(get_prp_audit_service),
):
    audit = service.update_audit(audit_id=audit_id, payload=payload)
    if not audit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="PRP Audit không tồn tại"
        )
    return audit


@prp_router.delete(
    "/{audit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    description="""
### Xóa đánh giá PRP
Loại bỏ hoàn toàn bản ghi đánh giá PRP khỏi hệ thống dựa trên `audit_id`. Hành động này không thể hoàn tác.
""",
)
def delete_prp_audit(
    audit_id: UUID, service: PRPAuditService = Depends(get_prp_audit_service)
):
    success = service.delete_audit(audit_id=audit_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="PRP Audit không tồn tại"
        )
    return None
