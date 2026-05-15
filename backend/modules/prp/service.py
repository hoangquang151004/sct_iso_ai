from typing import List, Optional
from uuid import UUID
from datetime import date, datetime, timedelta
import json
from fastapi import HTTPException, status
from sqlalchemy import select, extract
from sqlalchemy.orm import Session, joinedload

from database.models import (
    PRPAudit,
    PRPAuditDetail,
    PRPChecklistTemplate,
    PRPProgram,
    Location,
    CalendarEvent,
    NonConformity,
)
from core import calculate_prp_audit_rate
from .schemas import (
    PRPChecklistTemplateCreate,
    PRPAuditFullCreate,
    PRPProgramCreate,
    PRPProgramUpdate,
    PRPChecklistTemplateUpdate,
    PRPScheduleRequest,
    PRPScheduleFrequency,
    PRPNCRequest,
)
from core.event_bus import bus


class PRPAuditService:
    def __init__(self, db: Session):
        self.db = db

    # --- 1. PROGRAM MANAGEMENT ---
    def get_all_programs(self) -> List[PRPProgram]:
        stmt = select(PRPProgram).where(PRPProgram.is_active)
        return list(self.db.scalars(stmt).all())

    def get_program_by_id(self, program_id: UUID) -> Optional[PRPProgram]:
        return self.db.get(PRPProgram, program_id)

    def get_locations_with_templates(self, program_id: UUID) -> List[Location]:
        """Lấy danh sách các khu vực đã được thiết kế form cho một chương trình cụ thể."""
        stmt = (
            select(Location)
            .join(PRPChecklistTemplate, PRPChecklistTemplate.location_id == Location.id)
            .where(
                PRPChecklistTemplate.prp_program_id == program_id,
                PRPChecklistTemplate.is_active == True,
                Location.is_active == True,
            )
            .distinct()
        )
        return list(self.db.scalars(stmt).all())

    def create_program(self, payload: PRPProgramCreate) -> PRPProgram:
        """Tạo mới một chương trình PRP/SSOP/GHP."""
        db_prog = PRPProgram(**payload.model_dump())
        self.db.add(db_prog)
        self.db.commit()
        self.db.refresh(db_prog)
        return db_prog

    def update_program(
        self, program_id: UUID, payload: PRPProgramUpdate
    ) -> Optional[PRPProgram]:
        db_prog = self.get_program_by_id(program_id)
        if not db_prog:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_prog, key, value)

        self.db.commit()
        self.db.refresh(db_prog)
        return db_prog

    # --- 2. LOCATION MANAGEMENT ---
    def get_all_locations(self) -> List[Location]:
        """Lấy danh sách khu vực dùng cho bộ lọc."""
        stmt = select(Location).where(Location.is_active)
        return list(self.db.scalars(stmt).all())

    # --- 3. TEMPLATE (CHECKLIST) MANAGEMENT ---
    def create_template(
        self, payload: PRPChecklistTemplateCreate
    ) -> PRPChecklistTemplate:
        db_template = PRPChecklistTemplate(**payload.model_dump())
        self.db.add(db_template)
        self.db.commit()
        self.db.refresh(db_template)
        return db_template

    def get_templates_by_location(
        self, location_id: UUID, only_active: bool = True
    ) -> List[PRPChecklistTemplate]:
        """Lấy danh sách các hạng mục kiểm tra (checklist) cho một khu vực cụ thể."""
        stmt = select(PRPChecklistTemplate).where(
            PRPChecklistTemplate.location_id == location_id
        )
        if only_active:
            stmt = stmt.where(PRPChecklistTemplate.is_active)

        stmt = stmt.order_by(PRPChecklistTemplate.order_index)
        return list(self.db.scalars(stmt).all())

    def update_template(
        self, template_id: UUID, payload: PRPChecklistTemplateUpdate
    ) -> Optional[PRPChecklistTemplate]:
        """Cập nhật thông tin một hạng mục checklist."""
        db_template = self.db.get(PRPChecklistTemplate, template_id)
        if not db_template:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_template, key, value)

        self.db.commit()
        self.db.refresh(db_template)
        return db_template

    def delete_template(self, template_id: UUID) -> dict:
        """
        Xóa một hạng mục checklist.
        Nếu đã có báo cáo sử dụng: Không cho xóa, báo cho người dùng biết.
        Nếu chưa có báo cáo sử dụng: Xóa vĩnh viễn.
        """
        db_template = self.db.get(PRPChecklistTemplate, template_id)
        if not db_template:
            return {"success": False, "message": "Hạng mục không tồn tại"}

        # Đếm xem có bản ghi kết quả nào sử dụng template này không
        usage_stmt = select(PRPAuditDetail).where(
            PRPAuditDetail.checklist_id == template_id
        )
        usage_count = len(self.db.scalars(usage_stmt).all())

        if usage_count > 0:
            return {
                "success": False,
                "has_history": True,
                "message": "Câu hỏi này đã có báo cáo sử dụng. Bạn nên sử dụng chức năng 'Ẩn' thay vì xóa.",
            }

        self.db.delete(db_template)
        self.db.commit()
        return {
            "success": True,
            "has_history": False,
            "message": "Đã xóa vĩnh viễn câu hỏi mẫu.",
        }

    # --- 4. AUDIT MANAGEMENT ---
    def get_audits(
        self,
        skip: int = 0,
        limit: int = 100,
        org_id: Optional[UUID] = None,
        area_id: Optional[UUID] = None,
        audit_date: Optional[date] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> List[PRPAudit]:
        """Lấy danh sách Audit, lọc theo khu vực và ngày hoặc tháng/năm."""
        query = select(PRPAudit).options(
            joinedload(PRPAudit.area), joinedload(PRPAudit.prp_program)
        )

        if org_id:
            query = query.where(PRPAudit.org_id == org_id)
        if area_id:
            query = query.where(PRPAudit.area_id == area_id)

        if audit_date:
            query = query.where(PRPAudit.audit_date == audit_date)
        elif month and year:
            query = query.where(
                extract("month", PRPAudit.audit_date) == month,
                extract("year", PRPAudit.audit_date) == year,
            )
        elif year:
            query = query.where(extract("year", PRPAudit.audit_date) == year)

        query = query.order_by(PRPAudit.audit_date.desc())
        return list(self.db.scalars(query.offset(skip).limit(limit)).all())

    def get_audit_by_id(self, audit_id: UUID) -> Optional[PRPAudit]:
        """Lấy chi tiết một đợt audit kèm theo kết quả từng hạng mục."""
        stmt = (
            select(PRPAudit)
            .options(
                joinedload(PRPAudit.area),
                joinedload(PRPAudit.prp_program),
                joinedload(PRPAudit.details).joinedload(PRPAuditDetail.checklist),
            )
            .where(PRPAudit.id == audit_id)
        )
        return self.db.scalar(stmt)

    def create_full_audit(self, payload: PRPAuditFullCreate) -> PRPAudit:
        audit_data = payload.audit_data.model_dump()
        
        linked_event = None
        # Kiểm tra nếu lịch đã quá hạn thì không cho thực hiện
        if audit_data.get("calendar_event_id"):
            linked_event = self.db.get(CalendarEvent, audit_data["calendar_event_id"])
            if linked_event:
                if linked_event.status == "COMPLETED":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Lịch đánh giá này đã hoàn thành, không thể thực hiện lại."
                    )
                
                # Logic kiểm tra quá hạn (tương tự get_all_audit_schedules)
                now = datetime.now().astimezone()
                is_overdue = False
                if linked_event.status == "SCHEDULED":
                    # Nếu đã qua thời gian kết thúc
                    if linked_event.end_time and now > linked_event.end_time:
                        is_overdue = True
                    # Nếu không có end_time mà đã qua start_time
                    elif not linked_event.end_time and now > linked_event.start_time:
                        is_overdue = True
                
                if is_overdue:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Lịch đánh giá đã quá hạn, không thể thực hiện."
                    )

        # Tự động tính tỷ lệ tuân thủ nếu chưa có (backend tự tính lại cho chuẩn)
        if not audit_data.get("compliance_rate"):
            pass_count = sum(1 for d in payload.details if d.result.upper() == "PASS")
            total_count = len(payload.details)
            audit_data["compliance_rate"] = calculate_prp_audit_rate(pass_count, total_count)

        db_audit = PRPAudit(**audit_data)
        self.db.add(db_audit)
        self.db.flush()

        # Cập nhật trạng thái lịch nếu có liên kết
        if linked_event:
            linked_event.status = "COMPLETED"

        for detail_in in payload.details:
            detail_data = detail_in.model_dump()
            should_create_nc = detail_data.pop("create_nc", False)

            db_detail = PRPAuditDetail(audit_id=db_audit.id, **detail_data)
            self.db.add(db_detail)

            if should_create_nc:
                checklist = self.db.get(PRPChecklistTemplate, detail_in.checklist_id)
                q_text = (
                    checklist.question_text
                    if checklist
                    else "Hạng mục PRP không xác định"
                )

                nc = NonConformity(
                    org_id=db_audit.org_id,
                    source="PRP",
                    source_ref_id=db_detail.id,
                    title=f"Lỗi PRP: {q_text}",
                    description=detail_in.observation
                    or f"Phát hiện lỗi trong quá trình đánh giá PRP ngày {db_audit.audit_date}",
                    severity="MEDIUM",
                    status="WAITING",
                    detected_at=datetime.now(),
                )
                self.db.add(nc)

        self.db.commit()
        self.db.refresh(db_audit)

        if db_audit.overall_result == "FAILED":
            bus.emit(
                "PRP_AUDIT_FAILED",
                {
                    "audit_id": db_audit.id,
                    "org_id": db_audit.org_id,
                    "result": db_audit.overall_result,
                },
            )

        return db_audit

    def create_nc_from_audit(self, payload: PRPNCRequest) -> NonConformity:
        """Tạo một điểm lỗi NC mới từ nguồn PRP."""
        db_nc = NonConformity(
            org_id=payload.org_id,
            source="PRP",
            source_ref_id=payload.source_ref_id,
            title=payload.title,
            description=payload.description,
            severity=payload.severity,
            status="WAITING",
            detected_at=datetime.now(),
        )
        self.db.add(db_nc)
        self.db.commit()
        self.db.refresh(db_nc)
        return db_nc

    # --- 5. SCHEDULING MANAGEMENT ---
    def create_audit_schedule(self, req: PRPScheduleRequest) -> int:
        events = []
        current_date = req.start_date
        # Nếu không có ngày kết thúc, mặc định là ngày bắt đầu (chỉ tạo 1 lần)
        end_date = req.end_date or req.start_date

        # Giới hạn tạo lịch tối đa 1 năm để tránh lặp vô hạn hoặc quá nhiều dữ liệu
        max_end_date = req.start_date + timedelta(days=366)
        if end_date > max_end_date:
            end_date = max_end_date

        if req.frequency == PRPScheduleFrequency.ONCE:
            events.append(self._build_calendar_event(req, req.start_date))
        else:
            # Vòng lặp tạo lịch định kỳ
            while current_date <= end_date:
                should_add = False

                if req.frequency == PRPScheduleFrequency.DAILY:
                    should_add = True
                elif req.frequency == PRPScheduleFrequency.WEEKLY:
                    if (
                        req.day_of_week is not None
                        and current_date.weekday() == req.day_of_week
                    ):
                        should_add = True
                elif req.frequency == PRPScheduleFrequency.MONTHLY:
                    if (
                        req.day_of_month is not None
                        and current_date.day == req.day_of_month
                    ):
                        should_add = True

                if should_add:
                    events.append(self._build_calendar_event(req, current_date))

                current_date += timedelta(days=1)

        if events:
            self.db.add_all(events)
            self.db.commit()

        return len(events)

    def get_upcoming_schedules(self, org_id: UUID, limit: int = 10) -> List[dict]:
        """Lấy danh sách các lịch đánh giá PRP sắp tới và đang diễn ra."""
        stmt = (
            select(CalendarEvent)
            .where(
                CalendarEvent.org_id == org_id,
                CalendarEvent.event_type == "PRP_AUDIT",
                CalendarEvent.status == "SCHEDULED",
            )
            .order_by(CalendarEvent.start_time.asc())
            .limit(limit)
        )
        events = self.db.scalars(stmt).all()
        now = datetime.now().astimezone()

        results = []
        for e in events:
            display_status = e.status
            if e.status == "SCHEDULED":
                if now < e.start_time:
                    display_status = "SCHEDULED"
                elif e.end_time and e.start_time <= now <= e.end_time:
                    display_status = "IN_PROGRESS"
                else:
                    display_status = "OVERDUE"

            # Chỉ trả về các lịch Sắp tới hoặc Đang diễn ra
            if display_status in ["SCHEDULED", "IN_PROGRESS"]:
                results.append({
                    "id": e.id,
                    "title": e.title,
                    "start_time": e.start_time,
                    "end_time": e.end_time,
                    "status": display_status,
                    "description": e.description,
                })
        return results

    def get_all_audit_schedules(
        self, org_id: UUID, status: Optional[str] = None, limit: int = 100
    ) -> List[dict]:
        """Lấy toàn bộ danh sách lịch trình và tính toán trạng thái quá hạn."""
        stmt = (
            select(CalendarEvent)
            .where(
                CalendarEvent.org_id == org_id, CalendarEvent.event_type == "PRP_AUDIT"
            )
            .order_by(CalendarEvent.start_time.desc())
            .limit(limit)
        )
        events = self.db.scalars(stmt).all()
        now = datetime.now().astimezone()

        results = []
        for e in events:
            display_status = e.status
            
            # Logic tính toán trạng thái hiển thị linh hoạt
            if e.status == "SCHEDULED":
                if now < e.start_time:
                    display_status = "SCHEDULED" # Sắp tới
                elif e.end_time and e.start_time <= now <= e.end_time:
                    display_status = "IN_PROGRESS" # Đang diễn ra
                else:
                    display_status = "OVERDUE" # Đã quá hạn

            e_dict = {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "start_time": e.start_time,
                "end_time": e.end_time,
                "status": display_status,
                "assigned_to": e.assigned_to,
            }

            if status:
                if status == "OVERDUE":
                    if display_status != "OVERDUE":
                        continue
                elif status == "SCHEDULED":
                    if display_status != "SCHEDULED":
                        continue
                elif status == "IN_PROGRESS":
                    if display_status != "IN_PROGRESS":
                        continue
                elif e.status != status:
                    continue

            results.append(e_dict)

        return results

    def _build_calendar_event(
        self, req: PRPScheduleRequest, event_date: date
    ) -> CalendarEvent:
        description_data = {
            "prp_program_id": str(req.prp_program_id),
            "location_id": str(req.location_id),
            "source": "PRP_MODULE",
            "notes": req.description,
            "duration_minutes": req.duration_minutes,
        }

        title = req.title
        if not title:
            program = self.db.get(PRPProgram, req.prp_program_id)
            prog_name = program.name if program else "Chương trình PRP"
            title = f"Đánh giá {prog_name}"

        # Xử lý giờ bắt đầu nếu có
        start_dt = datetime.combine(event_date, datetime.min.time())
        if req.start_time:
            try:
                time_parts = datetime.strptime(req.start_time, "%H:%M").time()
                start_dt = datetime.combine(event_date, time_parts)
            except ValueError:
                pass # Giữ mặc định 00:00 nếu sai định dạng

        # Tính toán end_time dựa trên duration_minutes
        duration = req.duration_minutes or 60
        end_dt = start_dt + timedelta(minutes=duration)

        return CalendarEvent(
            org_id=req.org_id,
            title=title,
            description=json.dumps(description_data, ensure_ascii=False),
            event_type="PRP_AUDIT",
            start_time=start_dt,
            end_time=end_dt,
            status="SCHEDULED",
            assigned_to=req.assigned_to,
        )
