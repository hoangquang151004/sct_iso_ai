from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import PRPAudit
from .schemas import PRPAuditCreate, PRPAuditUpdate


class PRPAuditService:
    def __init__(self, db: Session):
        self.db = db

    def get_audits(self, skip: int = 0, limit: int = 100, org_id: Optional[UUID] = None) -> List[PRPAudit]:
        """Lấy danh sách các PRP Audit."""
        query = select(PRPAudit)
        if org_id:
            query = query.where(PRPAudit.org_id == org_id)
        return list(self.db.scalars(query.offset(skip).limit(limit)).all())

    def get_audit_by_id(self, audit_id: UUID) -> Optional[PRPAudit]:
        """Lấy chi tiết một PRP Audit theo ID."""
        return self.db.get(PRPAudit, audit_id)

    def create_audit(self, payload: PRPAuditCreate) -> PRPAudit:
        """Tạo mới một PRP Audit."""
        db_audit = PRPAudit(**payload.model_dump())
        self.db.add(db_audit)
        self.db.commit()
        self.db.refresh(db_audit)
        return db_audit

    def update_audit(
        self, audit_id: UUID, payload: PRPAuditUpdate
    ) -> Optional[PRPAudit]:
        """Cập nhật thông tin PRP Audit."""
        # Tái sử dụng hàm get_audit_by_id trong cùng class
        db_audit = self.get_audit_by_id(audit_id)
        if not db_audit:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_audit, key, value)

        self.db.commit()
        self.db.refresh(db_audit)
        return db_audit

    def delete_audit(self, audit_id: UUID) -> bool:
        """Xóa một PRP Audit."""
        db_audit = self.get_audit_by_id(audit_id)
        if not db_audit:
            return False

        self.db.delete(db_audit)
        self.db.commit()
        return True
