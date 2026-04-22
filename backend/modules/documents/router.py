import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from db_session import get_db

from .schemas import (
    DocumentApprovalCreate,
    DocumentApprovalResponse,
    DocumentCategoryCreate,
    DocumentCategoryResponse,
    DocumentChangeLogCreate,
    DocumentChangeLogResponse,
    DocumentCreate,
    DocumentResponse,
    DocumentUiContextResponse,
    DocumentUpdate,
    DocumentVersionCreate,
    DocumentVersionResponse,
)
from .service import document_service

document_router = APIRouter(prefix="/documents", tags=["Documents"])


@document_router.post(
    "/ui-context/sync",
    response_model=DocumentUiContextResponse,
    description="Đồng bộ org_id và user_id mặc định cho UI Document Control",
)
def sync_ui_context(db: Session = Depends(get_db)) -> DocumentUiContextResponse:
    return document_service.sync_ui_context_session(db)


@document_router.post(
    "/categories",
    response_model=DocumentCategoryResponse,
    status_code=status.HTTP_201_CREATED,
    description="Tạo mới một danh mục tài liệu ISO",
)
def create_category(
    payload: DocumentCategoryCreate,
    db: Session = Depends(get_db),
) -> DocumentCategoryResponse:
    return document_service.create_category(db, payload)


@document_router.get(
    "/categories",
    response_model=list[DocumentCategoryResponse],
    description="Lấy danh sách các danh mục tài liệu, hỗ trợ lọc theo tổ chức (org_id)",
)
def list_categories(
    org_id: UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[DocumentCategoryResponse]:
    return document_service.list_categories(db, org_id=org_id)


@document_router.post(
    "",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    description="Tạo mới một hồ sơ tài liệu trong hệ thống",
)
async def create_document(
    org_id: UUID = Form(...),
    created_by: UUID = Form(...),
    title: str = Form(...),
    doc_type: str = Form(...),
    language: str = Form("vi"),
    department: str | None = Form(default=None),
    review_period: int = Form(12),
    initial_version: str = Form("1.0"),
    tags_json: str = Form("[]"),
    ai_summary: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    tags = json.loads(tags_json) if tags_json else []
    payload = DocumentCreate(
        org_id=org_id,
        created_by=created_by,
        title=title,
        doc_type=doc_type,
        language=language,
        department=department,
        review_period=review_period,
        initial_version=initial_version,
        tags=tags,
        ai_summary=ai_summary,
    )
    upload_bytes = await file.read() if file is not None else None
    upload_filename = file.filename if file is not None else None
    upload_content_type = file.content_type if file is not None else None
    return document_service.create_document(
        db,
        payload,
        upload_bytes=upload_bytes,
        upload_filename=upload_filename,
        upload_content_type=upload_content_type,
    )


@document_router.get(
    "",
    response_model=list[DocumentResponse],
    description="Lấy danh sách tài liệu với các bộ lọc: tổ chức, trạng thái, danh mục, phòng ban và loại tài liệu",
)
def list_documents(
    org_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    category_id: UUID | None = Query(default=None),
    department: str | None = Query(default=None),
    doc_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[DocumentResponse]:
    return document_service.list_documents(
        db,
        org_id=org_id,
        status_filter=status_filter,
        category_id=category_id,
        department=department,
        doc_type=doc_type,
    )


@document_router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    description="Lấy thông tin chi tiết của một tài liệu dựa trên ID",
)
def get_document(document_id: UUID, db: Session = Depends(get_db)) -> DocumentResponse:
    return document_service.get_document(db, document_id)


@document_router.patch(
    "/{document_id}",
    response_model=DocumentResponse,
    description="Cập nhật thông tin cơ bản của tài liệu",
)
def update_document(
    document_id: UUID,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
) -> DocumentResponse:
    return document_service.update_document(db, document_id, payload)


@document_router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    description="Xóa một tài liệu theo ID và org_id",
)
def delete_document(
    document_id: UUID,
    org_id: UUID = Query(...),
    db: Session = Depends(get_db),
) -> None:
    document_service.delete_document(db, document_id, org_id)


@document_router.post(
    "/{document_id}/versions",
    response_model=DocumentVersionResponse,
    status_code=status.HTTP_201_CREATED,
    description="Đăng ký một phiên bản mới cho tài liệu (kèm theo file hoặc đường dẫn)",
)
def create_document_version(
    document_id: UUID,
    payload: DocumentVersionCreate,
    db: Session = Depends(get_db),
) -> DocumentVersionResponse:
    return document_service.create_document_version(db, document_id, payload)


@document_router.get(
    "/{document_id}/versions",
    response_model=list[DocumentVersionResponse],
    description="Lấy lịch sử tất cả các phiên bản của một tài liệu",
)
def list_document_versions(
    document_id: UUID,
    db: Session = Depends(get_db),
) -> list[DocumentVersionResponse]:
    return document_service.list_document_versions(db, document_id)


@document_router.post(
    "/{document_id}/approvals",
    response_model=DocumentApprovalResponse,
    status_code=status.HTTP_201_CREATED,
    description="Ghi nhận một bản ghi phê duyệt/xem duyệt cho tài liệu",
)
def create_document_approval(
    document_id: UUID,
    payload: DocumentApprovalCreate,
    db: Session = Depends(get_db),
) -> DocumentApprovalResponse:
    return document_service.create_document_approval(db, document_id, payload)


@document_router.get(
    "/{document_id}/approvals",
    response_model=list[DocumentApprovalResponse],
    description="Lấy danh sách quá trình phê duyệt của tài liệu",
)
def list_document_approvals(
    document_id: UUID,
    db: Session = Depends(get_db),
) -> list[DocumentApprovalResponse]:
    return document_service.list_document_approvals(db, document_id)


@document_router.post(
    "/{document_id}/change-logs",
    response_model=DocumentChangeLogResponse,
    status_code=status.HTTP_201_CREATED,
    description="Thêm nhật ký thay đổi cho tài liệu để theo dõi các điều chỉnh",
)
def create_document_change_log(
    document_id: UUID,
    payload: DocumentChangeLogCreate,
    db: Session = Depends(get_db),
) -> DocumentChangeLogResponse:
    return document_service.create_document_change_log(db, document_id, payload)


@document_router.get(
    "/{document_id}/change-logs",
    response_model=list[DocumentChangeLogResponse],
    description="Lấy danh sách nhật ký thay đổi của tài liệu",
)
def list_document_change_logs(
    document_id: UUID,
    db: Session = Depends(get_db),
) -> list[DocumentChangeLogResponse]:
    return document_service.list_document_change_logs(db, document_id)
