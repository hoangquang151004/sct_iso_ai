from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import db_manager

from .schemas import (
    CAPACreate,
    CAPAResponse,
    CAPAUpdate,
    KanbanBoardResponse,
    KPIResponse,
)
from .service import CAPAService


def get_db():
    yield from db_manager.get_db()


capas_router = APIRouter(prefix="/capa", tags=["CAPA Management"])


def get_capa_service(db: Session = Depends(get_db)) -> CAPAService:
    return CAPAService(db)


@capas_router.post("/", response_model=CAPAResponse, status_code=status.HTTP_201_CREATED)
def create_capa(payload: CAPACreate, service: CAPAService = Depends(get_capa_service)):
    return service.create_capa(payload)


@capas_router.get("/kpi/{org_id}", response_model=KPIResponse)
def get_kpi(org_id: UUID, service: CAPAService = Depends(get_capa_service)):
    return service.get_capa_kpi(org_id)


@capas_router.get("/board/{org_id}", response_model=KanbanBoardResponse)
def get_board(org_id: UUID, service: CAPAService = Depends(get_capa_service)):
    return {"columns": service.get_kanban_board(org_id)}


@capas_router.patch("/{capa_id}", response_model=CAPAResponse)
def update_capa(
    capa_id: UUID, payload: CAPAUpdate, service: CAPAService = Depends(get_capa_service)
):
    result = service.update_capa(capa_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="CAPA not found")
    return result
