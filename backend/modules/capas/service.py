from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database.models import CAPA, NonConformity
from .schemas import CAPACreate, CAPAStatus, CAPAUpdate, NonConformityCreate


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

    def get_nc(self, nc_id: UUID) -> Optional[NonConformity]:
        """Lấy NonConformity theo ID."""
        return self.db.get(NonConformity, nc_id)

    def create_nc(self, payload: NonConformityCreate) -> NonConformity:
        """Tạo mới một điểm không phù hợp (NC) thủ công."""
        db_nc = NonConformity(
            **payload.model_dump(), status="OPEN", detected_at=datetime.now()
        )
        self.db.add(db_nc)
        self.db.commit()
        self.db.refresh(db_nc)
        return db_nc

    def get_ncs(
        self, org_id: UUID, status: Optional[str] = "OPEN", source: Optional[str] = None
    ) -> List[NonConformity]:
        """Lấy danh sách các lỗi (NC) chưa được xử lý của tổ chức, hỗ trợ lọc theo nguồn."""
        stmt = select(NonConformity).where(NonConformity.org_id == org_id)
        if status:
            stmt = stmt.where(NonConformity.status == status)
        if source:
            stmt = stmt.where(NonConformity.source == source)

        return list(
            self.db.scalars(stmt.order_by(NonConformity.detected_at.desc())).all()
        )

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

        # Nếu CAPA được đóng -> Tự động đóng NC liên quan
        if payload.status == CAPAStatus.CLOSED and db_capa.nc_id:
            db_nc = self.db.get(NonConformity, db_capa.nc_id)
            if db_nc:
                db_nc.status = "CLOSED"

        self.db.commit()
        self.db.refresh(db_capa)
        return db_capa

    def get_capa_kpi(self, org_id: UUID) -> Dict[str, Any]:
        """Thống kê KPI chi tiết cho Beta"""
        # Join với NonConformity để lấy nguồn gốc (source)
        stmt = (
            select(CAPA, NonConformity.source)
            .join(NonConformity, CAPA.nc_id == NonConformity.id, isouter=True)
            .where(CAPA.org_id == org_id)
        )
        results = self.db.execute(stmt).all()

        all_capas = [r[0] for r in results]
        sources = [r[1] for r in results if r[1]]

        source_dist = {}
        for s in sources:
            source_dist[s] = source_dist.get(s, 0) + 1

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
            "source_distribution": source_dist,
        }

    def get_kanban_board(self, org_id: UUID) -> Dict[str, List[Any]]:
        capas = self.db.scalars(select(CAPA).where(CAPA.org_id == org_id)).all()
        board = {s.value: [] for s in CAPAStatus}
        for c in capas:
            if c.status in board:
                board[c.status].append(c)
        return board

    def delete_capa(self, capa_id: UUID) -> bool:
        db_capa = self.db.get(CAPA, capa_id)
        if not db_capa:
            return False
        self.db.delete(db_capa)
        self.db.commit()
        return True
