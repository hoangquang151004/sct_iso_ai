from typing import Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database.models import CAPA, NonConformity
from core import calculate_capa_ontime_rate, is_capa_overdue
from .schemas import CAPACreate, CAPAStatus, CAPAUpdate, NCUpdate


class CAPAService:
    def __init__(self, db: Session):
        self.db = db

    # --- 1. UTILITY ---
    def _generate_capa_code(self, org_id: UUID) -> str:
        """Tự động tạo mã CAPA-YYYY-XXXX"""
        year = datetime.now().year
        count = (
            self.db.scalar(select(func.count(CAPA.id)).where(CAPA.org_id == org_id))
            or 0
        )
        return f"CAPA-{year}-{(count + 1):04d}"

    # --- 2. NON-CONFORMITY (NC) MANAGEMENT ---
    def get_nc(self, nc_id: UUID) -> Optional[NonConformity]:
        """Lấy NonConformity theo ID."""
        return self.db.get(NonConformity, nc_id)

    def check_existing_ncs(self, source_ref_ids: List[UUID]) -> List[UUID]:
        """Kiểm tra xem các source_ref_ids đã có NC nào được tạo chưa."""
        stmt = select(NonConformity.source_ref_id).where(
            NonConformity.source_ref_id.in_(source_ref_ids)
        )
        return list(self.db.scalars(stmt).all())

    def update_nc(self, nc_id: UUID, payload: NCUpdate) -> Optional[NonConformity]:
        db_nc = self.get_nc(nc_id)
        if not db_nc:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(db_nc, key):
                # Handle Enum values if any
                val_to_save = value.value if hasattr(value, "value") else value
                setattr(db_nc, key, val_to_save)

        self.db.commit()
        self.db.refresh(db_nc)
        return db_nc

    def get_ncs(
        self,
        org_id: UUID,
        status: Optional[str] = "WAITING",
        source: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Lấy danh sách các lỗi (NC) kèm theo thông tin trạng thái CAPA nếu có."""
        stmt = (
            select(
                NonConformity,
                CAPA.id.label("capa_id"),
                CAPA.status.label("capa_status"),
            )
            .outerjoin(CAPA, NonConformity.id == CAPA.nc_id)
            .where(NonConformity.org_id == org_id)
        )

        # Xử lý lọc thông minh kết hợp cả hai bảng
        if status:
            status_list = status.split(",")
            conditions = []
            for s in status_list:
                if s == "WAITING":
                    conditions.append(NonConformity.status == "WAITING")
                elif s == "OPEN":
                    conditions.append((NonConformity.status == "OPEN") & (CAPA.status == "OPEN"))
                elif s == "IN_PROGRESS":
                    conditions.append((NonConformity.status == "OPEN") & (CAPA.status == "IN_PROGRESS"))
                elif s == "VERIFYING":
                    conditions.append((NonConformity.status == "OPEN") & (CAPA.status == "VERIFYING"))
                elif s == "CLOSED":
                    conditions.append(NonConformity.status == "CLOSED")
                else:
                    conditions.append(NonConformity.status == s)

            from sqlalchemy import or_
            stmt = stmt.where(or_(*conditions))

        if source:
            stmt = stmt.where(NonConformity.source == source)

        results = self.db.execute(stmt.order_by(NonConformity.detected_at.desc())).all()

        final_ncs = []
        for row in results:
            nc_dict = {
                c.name: getattr(row.NonConformity, c.name)
                for c in row.NonConformity.__table__.columns
            }
            nc_dict["capa_id"] = row.capa_id
            nc_dict["capa_status"] = row.capa_status
            final_ncs.append(nc_dict)

        return final_ncs

    # --- 3. CAPA MANAGEMENT ---
    def create_capa(self, payload: CAPACreate) -> CAPA:
        data = payload.model_dump(exclude={"severity"})
        if not data.get("capa_code"):
            data["capa_code"] = self._generate_capa_code(payload.org_id)

        db_capa = CAPA(**data)
        self.db.add(db_capa)

        # Chuyển trạng thái NC sang OPEN và cập nhật mức độ nếu có
        if db_capa.nc_id:
            db_nc = self.db.get(NonConformity, db_capa.nc_id)
            if db_nc:
                db_nc.status = "OPEN"
                if payload.severity:
                    db_nc.severity = payload.severity

        self.db.commit()
        self.db.refresh(db_capa)
        return db_capa

    def update_capa(self, capa_id: UUID, payload: CAPAUpdate) -> Optional[CAPA]:
        db_capa = self.db.get(CAPA, capa_id)
        if not db_capa:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            val_to_save = value.value if hasattr(value, "value") else value
            setattr(db_capa, key, val_to_save)

        # Đồng bộ trạng thái sang bảng NonConformity (NC) nếu có liên kết
        if db_capa.nc_id:
            db_nc = self.db.get(NonConformity, db_capa.nc_id)
            if db_nc:
                if db_capa.status == "CLOSED":
                    db_nc.status = "CLOSED"
                else:
                    db_nc.status = "OPEN"

        self.db.commit()
        self.db.refresh(db_capa)
        return db_capa

    # --- 4. ANALYTICS & BOARD ---
    def get_capa_kpi(self, org_id: UUID) -> Dict[str, Any]:
        """Thống kê KPI chi tiết cho Beta"""
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
        closed_count = len([c for c in all_capas if c.status == CAPAStatus.CLOSED])
        overdue_count = len([c for c in all_capas if is_capa_overdue(c.due_date, c.status, now)])
        
        return {
            "total": len(all_capas),
            "open": len([c for c in all_capas if c.status == CAPAStatus.OPEN]),
            "in_progress": len([c for c in all_capas if c.status == CAPAStatus.IN_PROGRESS]),
            "verifying": len([c for c in all_capas if c.status == CAPAStatus.VERIFYING]),
            "closed": closed_count,
            "overdue": overdue_count,
            "ontime_rate": calculate_capa_ontime_rate(closed_count, closed_count + overdue_count),
            "source_distribution": source_dist,
        }

    def get_kanban_board(self, org_id: UUID) -> Dict[str, List[Dict[str, Any]]]:
        stmt = (
            select(CAPA, NonConformity.severity)
            .outerjoin(NonConformity, CAPA.nc_id == NonConformity.id)
            .where(CAPA.org_id == org_id)
        )
        results = self.db.execute(stmt).all()
        
        board = {"OPEN": [], "IN_PROGRESS": [], "VERIFYING": [], "CLOSED": []}
        for row in results:
            capa = row.CAPA
            severity = row.severity
            
            # Map to dict to include severity
            capa_dict = {
                c.name: getattr(capa, c.name)
                for c in capa.__table__.columns
            }
            capa_dict["severity"] = severity
            
            status_val = capa.status
            if status_val in board:
                board[status_val].append(capa_dict)
        return board
