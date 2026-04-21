import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, select
from typing import Sequence
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database.models import (
    Document,
    DocumentCategory,
    DocumentVersion,
    Organization,
    User,
)

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
    DocumentUiContextResponse,
)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

DOC_TYPE_CODE_PREFIX = {"Manual": "MAN", "SOP": "SOP", "WI": "WI", "Form": "FORM"}


class DocumentService:
    def __init__(self) -> None:
        self._approvals: dict[UUID, list[DocumentApprovalResponse]] = {}
        self._change_logs: dict[UUID, list[DocumentChangeLogResponse]] = {}

    def sync_ui_context_session(self, db: Session) -> DocumentUiContextResponse:
        """Lấy org + user đầu tiên trong DB; nếu trống thì tạo bản ghi tối thiểu cho dev."""
        org = db.execute(
            select(Organization).order_by(Organization.created_at.asc()).limit(1)
        ).scalar_one_or_none()
        if org is None:
            org = Organization(
                name="Tổ chức mặc định",
                code="SCT_DEV",
                industry=None,
                address=None,
                phone=None,
                email=None,
                logo_url=None,
                is_active=True,
            )
            db.add(org)
            db.commit()
            db.refresh(org)

        user = db.execute(
            select(User)
            .where(User.org_id == org.id)
            .order_by(User.created_at.asc())
            .limit(1)
        ).scalar_one_or_none()
        if user is None:
            suffix = str(org.id).replace("-", "")[:8]
            username = f"sct_dev_{suffix}"
            email = f"{username}@local.invalid"
            user = User(
                org_id=org.id,
                role_id=None,
                username=username,
                email=email,
                password_hash="!dev-not-for-login!",
                full_name="Người dùng UI dev",
                department=None,
                position=None,
                phone=None,
                avatar_url=None,
                is_active=True,
            )
            db.add(user)
            try:
                db.commit()
                db.refresh(user)
            except IntegrityError:
                db.rollback()
                user = db.execute(
                    select(User)
                    .where(User.org_id == org.id)
                    .order_by(User.created_at.asc())
                    .limit(1)
                ).scalar_one_or_none()
                if user is None:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Không thể tạo user mặc định (trùng khóa duy nhất).",
                    ) from None

        return DocumentUiContextResponse(org_id=org.id, user_id=user.id)

    def _get_document_or_404(self, db: Session, document_id: UUID) -> Document:
        result = db.get(Document, document_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )
        return result

    def _attachment_for_documents(
        self, db: Session, documents: Sequence[Document]
    ) -> dict[UUID, tuple[str | None, str | None]]:
        docs = list(documents)
        if not docs:
            return {}
        ids = [d.id for d in docs]
        rows = db.execute(
            select(DocumentVersion).where(DocumentVersion.document_id.in_(ids))
        ).scalars().all()
        by_doc: dict[UUID, list[DocumentVersion]] = {}
        for v in rows:
            by_doc.setdefault(v.document_id, []).append(v)
        epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
        out: dict[UUID, tuple[str | None, str | None]] = {}
        for d in docs:
            lst = by_doc.get(d.id, [])
            if not lst:
                out[d.id] = (None, None)
                continue
            match = next((v for v in lst if v.version == d.current_version), None)
            chosen = match or max(lst, key=lambda v: v.created_at or epoch)
            out[d.id] = (chosen.file_url, chosen.file_type)
        return out

    def _enrich_document_response(
        self, db: Session, document: Document
    ) -> DocumentResponse:
        m = self._attachment_for_documents(db, [document])
        url, ft = m.get(document.id, (None, None))
        return DocumentResponse.model_validate(document).model_copy(
            update={"attachment_url": url, "attachment_file_type": ft}
        )

    def create_category(
        self, db: Session, payload: DocumentCategoryCreate
    ) -> DocumentCategoryResponse:
        category = DocumentCategory(
            org_id=payload.org_id,
            name=payload.name,
            code=payload.code,
            parent_id=payload.parent_id,
            standard=payload.standard,
            department=payload.department,
            description=payload.description,
        )
        db.add(category)
        db.commit()
        db.refresh(category)
        return DocumentCategoryResponse.model_validate(category)

    def list_categories(
        self, db: Session, org_id: UUID | None = None
    ) -> list[DocumentCategoryResponse]:
        statement = select(DocumentCategory)
        if org_id is not None:
            statement = statement.where(DocumentCategory.org_id == org_id)
        result = db.execute(statement.order_by(DocumentCategory.created_at.desc())).scalars()
        return [
            DocumentCategoryResponse.model_validate(item)
            for item in result.all()
        ]

    @staticmethod
    def _safe_upload_filename(name: str) -> str:
        base = name.replace("\\", "/").split("/")[-1]
        base = re.sub(r"[^a-zA-Z0-9._-]", "_", base).strip("._") or "file"
        return base[:120]

    @staticmethod
    def _upload_root() -> Path:
        return Path(__file__).resolve().parents[2] / "uploads"

    def _ensure_default_category(self, db: Session, org_id: UUID) -> UUID:
        cat = db.execute(
            select(DocumentCategory)
            .where(
                DocumentCategory.org_id == org_id,
                DocumentCategory.code == "AUTO",
            )
            .limit(1)
        ).scalar_one_or_none()
        if cat is not None:
            return cat.id
        cat = db.execute(
            select(DocumentCategory)
            .where(DocumentCategory.org_id == org_id)
            .order_by(DocumentCategory.created_at.asc())
            .limit(1)
        ).scalar_one_or_none()
        if cat is not None:
            return cat.id
        cat = DocumentCategory(
            org_id=org_id,
            name="Tài liệu chung",
            code="AUTO",
            standard=None,
            department=None,
            description="Tự tạo khi thêm tài liệu không chọn danh mục",
        )
        db.add(cat)
        db.commit()
        db.refresh(cat)
        return cat.id

    def _next_doc_code(self, db: Session, org_id: UUID, doc_type: str) -> str:
        prefix = DOC_TYPE_CODE_PREFIX.get(doc_type, "DOC")
        count = db.execute(
            select(func.count())
            .select_from(Document)
            .where(Document.org_id == org_id, Document.doc_type == doc_type)
        ).scalar_one()
        return f"{prefix}-{int(count) + 1:05d}"

    def _persist_upload(
        self,
        document_id: UUID,
        raw: bytes,
        filename: str,
        content_type: str | None,
    ) -> str:
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Tệp vượt quá {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
            )
        safe = self._safe_upload_filename(filename)
        rel_dir = Path("documents") / str(document_id)
        dest_dir = self._upload_root() / rel_dir
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / safe
        dest_path.write_bytes(raw)
        public_path = f"/uploads/{rel_dir.as_posix()}/{safe}"
        return public_path

    def create_document(
        self,
        db: Session,
        payload: DocumentCreate,
        *,
        upload_bytes: bytes | None = None,
        upload_filename: str | None = None,
        upload_content_type: str | None = None,
    ) -> DocumentResponse:
        category_id = self._ensure_default_category(db, payload.org_id)
        doc_code = self._next_doc_code(db, payload.org_id, payload.doc_type)
        ver = (payload.initial_version or "1.0").strip()[:20] or "1.0"

        document = Document(
            org_id=payload.org_id,
            created_by=payload.created_by,
            category_id=category_id,
            doc_code=doc_code,
            title=payload.title,
            doc_type=payload.doc_type,
            language=payload.language,
            department=payload.department,
            review_period=payload.review_period,
            tags=payload.tags,
            ai_summary=payload.ai_summary,
            current_version=ver,
            status="DRAFT",
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        self._approvals.setdefault(document.id, [])
        self._change_logs.setdefault(document.id, [])

        if upload_bytes and upload_filename:
            file_url = self._persist_upload(
                document.id, upload_bytes, upload_filename, upload_content_type
            )
            ext = upload_filename.rsplit(".", 1)[-1].lower() if "." in upload_filename else None
            version = DocumentVersion(
                document_id=document.id,
                version=ver,
                file_url=file_url,
                file_type=ext,
                file_size=len(upload_bytes),
                change_summary="Tạo mới",
                change_reason=None,
                created_by=payload.created_by,
            )
            db.add(version)
            document.current_version = ver
            document.updated_at = datetime.now(timezone.utc)
            db.add(document)
            db.commit()
            db.refresh(document)

        return self._enrich_document_response(db, document)

    def list_documents(
        self,
        db: Session,
        org_id: UUID | None = None,
        status_filter: str | None = None,
        category_id: UUID | None = None,
        department: str | None = None,
        doc_type: str | None = None,
    ) -> list[DocumentResponse]:
        statement = select(Document)
        if org_id is not None:
            statement = statement.where(Document.org_id == org_id)
        if status_filter is not None:
            statement = statement.where(Document.status == status_filter)
        if category_id is not None:
            statement = statement.where(Document.category_id == category_id)
        if department is not None:
            statement = statement.where(Document.department == department)
        if doc_type is not None:
            statement = statement.where(Document.doc_type == doc_type)
        result = db.execute(statement.order_by(Document.created_at.desc())).scalars()
        items = list(result.all())
        att = self._attachment_for_documents(db, items)
        return [
            DocumentResponse.model_validate(d).model_copy(
                update={
                    "attachment_url": att.get(d.id, (None, None))[0],
                    "attachment_file_type": att.get(d.id, (None, None))[1],
                }
            )
            for d in items
        ]

    def get_document(self, db: Session, document_id: UUID) -> DocumentResponse:
        result = self._get_document_or_404(db, document_id)
        return self._enrich_document_response(db, result)

    def delete_document(
        self, db: Session, document_id: UUID, org_id: UUID
    ) -> None:
        doc = self._get_document_or_404(db, document_id)
        if doc.org_id != org_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found",
            )
        db.delete(doc)
        db.commit()
        self._approvals.pop(document_id, None)
        self._change_logs.pop(document_id, None)

    def update_document(
        self, db: Session, document_id: UUID, payload: DocumentUpdate
    ) -> DocumentResponse:
        current = self._get_document_or_404(db, document_id)
        data = payload.model_dump(exclude_unset=True)

        if "status" in data and data["status"] is not None:
            st = str(data["status"]).strip().upper()
            data["status"] = st
            if st == "APPROVED":
                if data.get("approved_at") is None and current.approved_at is None:
                    data["approved_at"] = datetime.now(timezone.utc)
                if data.get("approved_by") is None and current.approved_by is not None:
                    data["approved_by"] = current.approved_by
            elif st == "REJECTED":
                data["approved_at"] = None
                data["approved_by"] = None
            elif st in ("PENDING_REVIEW", "DRAFT"):
                data["approved_at"] = None
                data["approved_by"] = None

        for field, value in data.items():
            setattr(current, field, value)
        current.updated_at = datetime.now(timezone.utc)
        db.add(current)
        db.commit()
        db.refresh(current)
        return self._enrich_document_response(db, current)

    def create_document_version(
        self, db: Session, document_id: UUID, payload: DocumentVersionCreate
    ) -> DocumentVersionResponse:
        current = self._get_document_or_404(db, document_id)
        version = DocumentVersion(
            document_id=document_id,
            version=payload.version,
            file_url=payload.file_url,
            file_type=payload.file_type,
            file_size=payload.file_size,
            change_summary=payload.change_summary,
            change_reason=payload.change_reason,
            created_by=payload.created_by,
        )
        db.add(version)
        current.current_version = payload.version
        current.updated_at = datetime.now(timezone.utc)
        db.add(current)
        db.commit()
        db.refresh(version)
        return DocumentVersionResponse.model_validate(version)

    def list_document_versions(
        self, db: Session, document_id: UUID
    ) -> list[DocumentVersionResponse]:
        self._get_document_or_404(db, document_id)
        statement = (
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document_id)
            .order_by(DocumentVersion.created_at.desc())
        )
        result = db.execute(statement).scalars()
        return [DocumentVersionResponse.model_validate(item) for item in result.all()]

    def create_document_approval(
        self, db: Session, document_id: UUID, payload: DocumentApprovalCreate
    ) -> DocumentApprovalResponse:
        self._get_document_or_404(db, document_id)
        result = DocumentApprovalResponse(
            id=uuid4(),
            document_id=document_id,
            version_id=payload.version_id,
            approver_id=payload.approver_id,
            step_order=payload.step_order,
            status=payload.status,
            comment=payload.comment,
            approved_at=datetime.now(timezone.utc) if payload.status == "APPROVED" else None,
            created_at=datetime.now(timezone.utc),
        )
        self._approvals.setdefault(document_id, []).append(result)
        return result

    def list_document_approvals(
        self, db: Session, document_id: UUID
    ) -> list[DocumentApprovalResponse]:
        self._get_document_or_404(db, document_id)
        result = self._approvals.get(document_id, [])
        return result

    def create_document_change_log(
        self, db: Session, document_id: UUID, payload: DocumentChangeLogCreate
    ) -> DocumentChangeLogResponse:
        self._get_document_or_404(db, document_id)
        result = DocumentChangeLogResponse(
            id=uuid4(),
            document_id=document_id,
            version_from=payload.version_from,
            version_to=payload.version_to,
            changed_by=payload.changed_by,
            change_type=payload.change_type,
            change_detail=payload.change_detail,
            ai_change_summary=payload.ai_change_summary,
            changed_at=datetime.now(timezone.utc),
        )
        self._change_logs.setdefault(document_id, []).append(result)
        return result

    def list_document_change_logs(
        self, db: Session, document_id: UUID
    ) -> list[DocumentChangeLogResponse]:
        self._get_document_or_404(db, document_id)
        result = self._change_logs.get(document_id, [])
        return result


document_service = DocumentService()
