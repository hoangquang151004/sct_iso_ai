from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.modules.documents.schemas import DocumentCreate, DocumentResponse

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("", response_model=list[DocumentResponse])
def list_documents() -> list[DocumentResponse]:
    return []


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document(payload: DocumentCreate) -> DocumentResponse:
    return DocumentResponse(
        id=uuid4(),
        org_id=payload.org_id,
        category_id=payload.category_id,
        doc_code=payload.doc_code,
        title=payload.title,
        doc_type=payload.doc_type,
        department=payload.department,
        review_period=payload.review_period,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: UUID) -> DocumentResponse:
    return DocumentResponse(
        id=document_id,
        org_id=uuid4(),
        category_id=uuid4(),
        doc_code="SOP-001",
        title="Quy trinh ve sinh",
        doc_type="SOP",
    )
