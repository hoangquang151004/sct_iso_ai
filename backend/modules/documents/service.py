from datetime import datetime
from uuid import UUID, uuid4

from fastapi import HTTPException, status

from .schemas import (
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


class DocumentService:
    def __init__(self) -> None:
        self._categories: dict[UUID, DocumentCategoryResponse] = {}
        self._documents: dict[UUID, DocumentResponse] = {}
        self._versions: dict[UUID, list[DocumentVersionResponse]] = {}
        self._approvals: dict[UUID, list[DocumentApprovalResponse]] = {}
        self._change_logs: dict[UUID, list[DocumentChangeLogResponse]] = {}

    def _get_document_or_404(self, document_id: UUID) -> DocumentResponse:
        result = self._documents.get(document_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )
        return result

    def create_category(
        self, payload: DocumentCategoryCreate
    ) -> DocumentCategoryResponse:
        result = DocumentCategoryResponse(
            id=uuid4(),
            org_id=payload.org_id,
            name=payload.name,
            code=payload.code,
            parent_id=payload.parent_id,
            standard=payload.standard,
            department=payload.department,
            description=payload.description,
            created_at=datetime.utcnow(),
        )
        self._categories[result.id] = result
        return result

    def list_categories(
        self, org_id: UUID | None = None
    ) -> list[DocumentCategoryResponse]:
        result = list(self._categories.values())
        if org_id is not None:
            result = [item for item in result if item.org_id == org_id]
        return result

    def create_document(self, payload: DocumentCreate) -> DocumentResponse:
        now = datetime.utcnow()
        result = DocumentResponse(
            id=uuid4(),
            org_id=payload.org_id,
            created_by=payload.created_by,
            category_id=payload.category_id,
            doc_code=payload.doc_code,
            title=payload.title,
            doc_type=payload.doc_type,
            language=payload.language,
            department=payload.department,
            review_period=payload.review_period,
            tags=payload.tags,
            ai_summary=payload.ai_summary,
            current_version="1.0",
            status="DRAFT",
            created_at=now,
            updated_at=now,
        )
        self._documents[result.id] = result
        self._versions[result.id] = []
        self._approvals[result.id] = []
        self._change_logs[result.id] = []
        return result

    def list_documents(
        self,
        org_id: UUID | None = None,
        status_filter: str | None = None,
        category_id: UUID | None = None,
        department: str | None = None,
        doc_type: str | None = None,
    ) -> list[DocumentResponse]:
        result = list(self._documents.values())
        if org_id is not None:
            result = [item for item in result if item.org_id == org_id]
        if status_filter is not None:
            result = [item for item in result if item.status == status_filter]
        if category_id is not None:
            result = [item for item in result if item.category_id == category_id]
        if department is not None:
            result = [item for item in result if item.department == department]
        if doc_type is not None:
            result = [item for item in result if item.doc_type == doc_type]
        return result

    def get_document(self, document_id: UUID) -> DocumentResponse:
        result = self._get_document_or_404(document_id)
        return result

    def update_document(
        self, document_id: UUID, payload: DocumentUpdate
    ) -> DocumentResponse:
        current = self._get_document_or_404(document_id)
        result = current.model_copy(update=payload.model_dump(exclude_unset=True))
        result.updated_at = datetime.utcnow()
        self._documents[document_id] = result
        return result

    def create_document_version(
        self, document_id: UUID, payload: DocumentVersionCreate
    ) -> DocumentVersionResponse:
        current = self._get_document_or_404(document_id)
        now = datetime.utcnow()
        result = DocumentVersionResponse(
            id=uuid4(),
            document_id=document_id,
            version=payload.version,
            file_url=payload.file_url,
            file_type=payload.file_type,
            file_size=payload.file_size,
            change_summary=payload.change_summary,
            change_reason=payload.change_reason,
            created_by=payload.created_by,
            created_at=now,
        )
        self._versions.setdefault(document_id, []).append(result)
        self._documents[document_id] = current.model_copy(
            update={"current_version": payload.version, "updated_at": now}
        )
        return result

    def list_document_versions(
        self, document_id: UUID
    ) -> list[DocumentVersionResponse]:
        self._get_document_or_404(document_id)
        result = self._versions.get(document_id, [])
        return result

    def create_document_approval(
        self, document_id: UUID, payload: DocumentApprovalCreate
    ) -> DocumentApprovalResponse:
        self._get_document_or_404(document_id)
        result = DocumentApprovalResponse(
            id=uuid4(),
            document_id=document_id,
            version_id=payload.version_id,
            approver_id=payload.approver_id,
            step_order=payload.step_order,
            status=payload.status,
            comment=payload.comment,
            approved_at=datetime.utcnow() if payload.status == "APPROVED" else None,
            created_at=datetime.utcnow(),
        )
        self._approvals.setdefault(document_id, []).append(result)
        return result

    def list_document_approvals(
        self, document_id: UUID
    ) -> list[DocumentApprovalResponse]:
        self._get_document_or_404(document_id)
        result = self._approvals.get(document_id, [])
        return result

    def create_document_change_log(
        self, document_id: UUID, payload: DocumentChangeLogCreate
    ) -> DocumentChangeLogResponse:
        self._get_document_or_404(document_id)
        result = DocumentChangeLogResponse(
            id=uuid4(),
            document_id=document_id,
            version_from=payload.version_from,
            version_to=payload.version_to,
            changed_by=payload.changed_by,
            change_type=payload.change_type,
            change_detail=payload.change_detail,
            ai_change_summary=payload.ai_change_summary,
            changed_at=datetime.utcnow(),
        )
        self._change_logs.setdefault(document_id, []).append(result)
        return result

    def list_document_change_logs(
        self, document_id: UUID
    ) -> list[DocumentChangeLogResponse]:
        self._get_document_or_404(document_id)
        result = self._change_logs.get(document_id, [])
        return result


document_service = DocumentService()
