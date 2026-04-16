from uuid import UUID

from fastapi import APIRouter, Query, status

from modules.documents.schemas import (
    DocumentApprovalCreate,
    DocumentApprovalResponse,
    DocumentCategoryCreate,
    DocumentCategoryResponse,
    DocumentChangeLogCreate,
    DocumentChangeLogResponse,
    DocumentCreate,
    DocumentResponse,
    DocumentUpdate,
    DocumentVersionCreate,
    DocumentVersionResponse,
)
from modules.documents.service import document_service

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/categories", response_model=DocumentCategoryResponse, status_code=status.HTTP_201_CREATED, description="Tạo mới một danh mục tài liệu ISO")
def create_category(payload: DocumentCategoryCreate) -> DocumentCategoryResponse:
    result = document_service.create_category(payload)
    return result


@router.get("/categories", response_model=list[DocumentCategoryResponse], description="Lấy danh sách các danh mục tài liệu, hỗ trợ lọc theo tổ chức (org_id)")
def list_categories(org_id: UUID | None = Query(default=None)) -> list[DocumentCategoryResponse]:
    result = document_service.list_categories(org_id=org_id)
    return result


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED, description="Tạo mới một hồ sơ tài liệu trong hệ thống")
def create_document(payload: DocumentCreate) -> DocumentResponse:
    result = document_service.create_document(payload)
    return result


@router.get("", response_model=list[DocumentResponse], description="Lấy danh sách tài liệu với các bộ lọc: tổ chức, trạng thái, danh mục, phòng ban và loại tài liệu")
def list_documents(
    org_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    category_id: UUID | None = Query(default=None),
    department: str | None = Query(default=None),
    doc_type: str | None = Query(default=None),
) -> list[DocumentResponse]:
    result = document_service.list_documents(
        org_id=org_id,
        status_filter=status_filter,
        category_id=category_id,
        department=department,
        doc_type=doc_type,
    )
    return result


@router.get("/{document_id}", response_model=DocumentResponse, description="Lấy thông tin chi tiết của một tài liệu dựa trên ID")
def get_document(document_id: UUID) -> DocumentResponse:
    result = document_service.get_document(document_id)
    return result


@router.patch("/{document_id}", response_model=DocumentResponse, description="Cập nhật thông tin cơ bản của tài liệu")
def update_document(document_id: UUID, payload: DocumentUpdate) -> DocumentResponse:
    result = document_service.update_document(document_id, payload)
    return result


@router.post(
    "/{document_id}/versions",
    response_model=DocumentVersionResponse,
    status_code=status.HTTP_201_CREATED,
    description="Đăng ký một phiên bản mới cho tài liệu (kèm theo file hoặc đường dẫn)",
)
def create_document_version(document_id: UUID, payload: DocumentVersionCreate) -> DocumentVersionResponse:
    result = document_service.create_document_version(document_id, payload)
    return result


@router.get("/{document_id}/versions", response_model=list[DocumentVersionResponse], description="Lấy lịch sử tất cả các phiên bản của một tài liệu")
def list_document_versions(document_id: UUID) -> list[DocumentVersionResponse]:
    result = document_service.list_document_versions(document_id)
    return result


@router.post(
    "/{document_id}/approvals",
    response_model=DocumentApprovalResponse,
    status_code=status.HTTP_201_CREATED,
    description="Ghi nhận một bản ghi phê duyệt/xem duyệt cho tài liệu",
)
def create_document_approval(document_id: UUID, payload: DocumentApprovalCreate) -> DocumentApprovalResponse:
    result = document_service.create_document_approval(document_id, payload)
    return result


@router.get("/{document_id}/approvals", response_model=list[DocumentApprovalResponse], description="Lấy danh sách quá trình phê duyệt của tài liệu")
def list_document_approvals(document_id: UUID) -> list[DocumentApprovalResponse]:
    result = document_service.list_document_approvals(document_id)
    return result


@router.post(
    "/{document_id}/change-logs",
    response_model=DocumentChangeLogResponse,
    status_code=status.HTTP_201_CREATED,
    description="Thêm nhật ký thay đổi cho tài liệu để theo dõi các điều chỉnh",
)
def create_document_change_log(document_id: UUID, payload: DocumentChangeLogCreate) -> DocumentChangeLogResponse:
    result = document_service.create_document_change_log(document_id, payload)
    return result


@router.get("/{document_id}/change-logs", response_model=list[DocumentChangeLogResponse], description="Lấy danh sách nhật ký thay đổi của tài liệu")
def list_document_change_logs(document_id: UUID) -> list[DocumentChangeLogResponse]:
    result = document_service.list_document_change_logs(document_id)
    return result
