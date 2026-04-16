from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database.models import CAPA
from .schemas import CAPACreate, CAPAStatus, CAPAUpdate


class CAPAService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_capa_code(self, org_id: UUID) -> str:
        """Tự động tạo mã CAPA-YYYY-XXXX"""
        year = datetime.now().year
        count = (
            self.db.scalar(select(func.count(CAPA.id)).where(CAPA.org_id == org_id))
            or 0
        )
        return f"CAPA-{year}-{(count + 1):04d}"

    def get_capas(self, skip: int = 0, limit: int = 100, org_id: Optional[UUID] = None):
        query = select(CAPA)
        if org_id:
            query = query.where(CAPA.org_id == org_id)
        return self.db.scalars(
            query.order_by(CAPA.created_at.desc()).offset(skip).limit(limit)
        ).all()

    def create_capa(self, payload: CAPACreate) -> CAPA:
        data = payload.model_dump()
        if not data.get("capa_code"):
            data["capa_code"] = self._generate_capa_code(payload.org_id)

        db_capa = CAPA(**data)
        self.db.add(db_capa)
        self.db.commit()
        self.db.refresh(db_capa)
        return db_capa

    def update_capa(self, capa_id: UUID, payload: CAPAUpdate) -> Optional[CAPA]:
        db_capa = self.db.get(CAPA, capa_id)
        if not db_capa:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_capa, key, value)

        self.db.commit()
        self.db.refresh(db_capa)
        return db_capa

    def get_capa_kpi(self, org_id: UUID) -> Dict[str, Any]:
        """Thống kê KPI chi tiết cho Beta"""
        base_query = select(CAPA).where(CAPA.org_id == org_id)
        all_capas = self.db.scalars(base_query).all()

        now = datetime.now().date()
        return {
            "total": len(all_capas),
            "open": len([c for c in all_capas if c.status == CAPAStatus.OPEN]),
            "in_progress": len(
                [c for c in all_capas if c.status == CAPAStatus.IN_PROGRESS]
            ),
            "verifying": len(
                [c for c in all_capas if c.status == CAPAStatus.VERIFYING]
            ),
            "closed": len([c for c in all_capas if c.status == CAPAStatus.CLOSED]),
            "overdue": len(
                [
                    c
                    for c in all_capas
                    if c.status != CAPAStatus.CLOSED and c.due_date and c.due_date < now
                ]
            ),
        }

    def get_kanban_board(self, org_id: UUID) -> Dict[str, List[Any]]:
        capas = self.db.scalars(select(CAPA).where(CAPA.org_id == org_id)).all()
        board = {s.value: [] for s in CAPAStatus}
        for c in capas:
            if c.status in board:
                board[c.status].append(c)
        return board
