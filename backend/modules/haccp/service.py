"""
HACCP Module Service Layer — kết nối PostgreSQL thật qua SQLAlchemy.
"""
from datetime import date, datetime, time, timedelta, timezone
import json
from uuid import UUID, uuid4
from typing import List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session

from database.models import (
    Product as ProductModel,
    HACCPPlan,
    HACCPPlanVersion,
    ProcessStep as ProcessStepModel,
    HazardAnalysis as HazardAnalysisModel,
    CCP as CCPModel,
    CCPMonitoringLog,
    HaccpVerification as HaccpVerificationModel,
    HaccpAssessment as HaccpAssessmentModel,
    HaccpAssessmentItem as HaccpAssessmentItemModel,
    User,
    NonConformity,
    CAPA,
    CalendarEvent,
    Location,
)
from .schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    HaccpPlanCreate, HaccpPlanUpdate, HaccpPlanResponse,
    HaccpPlanVersionResponse, CreateNewVersionRequest,
    ProcessStepCreate, ProcessStepUpdate, ProcessStepResponse,
    HazardAnalysisCreate, HazardAnalysisUpdate, HazardAnalysisResponse,
    CCPCreate, CCPUpdate, CCPResponse,
    CCPMonitoringLogCreate, CCPMonitoringLogUpdate, CCPMonitoringLogResponse,
    HaccpVerificationCreate, HaccpVerificationUpdate, HaccpVerificationResponse,
    HaccpAssessmentCreate, HaccpAssessmentUpdate, HaccpAssessmentResponse,
    HaccpAssessmentItemCreate, HaccpAssessmentItemUpdate, HaccpAssessmentItemResponse,
    HaccpAssessmentManualItemCreate,
    HaccpAssessmentSubmitRequest,
    HaccpScheduleRequest,
    HaccpScheduleFrequency,
)


HACCP_SCHEDULE_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _haccp_calendar_event_description_meta(description: str | None) -> dict:
    if not description:
        return {}
    try:
        return json.loads(description) if isinstance(description, str) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def _haccp_plan_id_from_calendar_event(ev: CalendarEvent) -> UUID | None:
    meta = _haccp_calendar_event_description_meta(ev.description)
    raw = meta.get("haccp_plan_id")
    if not raw:
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def _haccp_schedule_batch_id_from_calendar_event(ev: CalendarEvent) -> str | None:
    meta = _haccp_calendar_event_description_meta(ev.description)
    raw = meta.get("schedule_batch_id")
    if not raw:
        return None
    return str(raw)


def _schedule_effective_end(ev: CalendarEvent) -> datetime:
    if ev.end_time is not None:
        return ev.end_time
    return ev.start_time + timedelta(hours=2)


def _schedule_display_status(ev: CalendarEvent, now: datetime) -> str:
    if ev.status == "COMPLETED":
        return "COMPLETED"
    if ev.status == "OVERDUE":
        return "OVERDUE"
    if ev.status == "SCHEDULED":
        if now > _schedule_effective_end(ev):
            return "OVERDUE"
        return "SCHEDULED"
    return ev.status


def _is_schedule_deletable(ev: CalendarEvent, now: datetime) -> bool:
    return _schedule_display_status(ev, now) == "SCHEDULED"


def _ensure_assessment_fill_allowed(db: Session, assessment: HaccpAssessmentModel) -> None:
    """Chỉ cho phép điền / gửi phiếu khi đã đến giờ bắt đầu của lịch gắn kèm."""
    if not assessment.calendar_event_id:
        return
    ev = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.id == assessment.calendar_event_id,
            CalendarEvent.org_id == assessment.org_id,
        )
        .first()
    )
    if not ev:
        return
    now = datetime.now(timezone.utc)
    if ev.start_time > now:
        raise ValueError(
            "Chưa đến thời gian bắt đầu kiểm tra. Chỉ được điền phiếu khi đã đến giờ bắt đầu của lịch."
        )


# =============================================================================
# PRODUCT SERVICE
# =============================================================================
class ProductService:
    @staticmethod
    def list_products(
        db: Session,
        org_id: UUID | None = None,
        is_active: bool | None = None,
        category: str | None = None,
    ) -> List[ProductResponse]:
        q = db.query(ProductModel)
        if org_id:
            q = q.filter(ProductModel.org_id == org_id)
        if is_active is not None:
            q = q.filter(ProductModel.is_active == is_active)
        if category:
            q = q.filter(ProductModel.category == category)
        return [ProductResponse.model_validate(p) for p in q.all()]

    @staticmethod
    def create_product(db: Session, payload: ProductCreate) -> ProductResponse:
        obj = ProductModel(
            id=uuid4(),
            org_id=payload.org_id,
            name=payload.name,
            code=payload.code,
            category=payload.category,
            description=payload.description,
            is_active=payload.is_active,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return ProductResponse.model_validate(obj)

    @staticmethod
    def get_product(db: Session, product_id: UUID) -> ProductResponse | None:
        obj = db.query(ProductModel).filter(ProductModel.id == product_id).first()
        return ProductResponse.model_validate(obj) if obj else None

    @staticmethod
    def update_product(db: Session, product_id: UUID, payload: ProductUpdate) -> ProductResponse | None:
        obj = db.query(ProductModel).filter(ProductModel.id == product_id).first()
        if not obj:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return ProductResponse.model_validate(obj)

    @staticmethod
    def delete_product(db: Session, product_id: UUID) -> bool:
        obj = db.query(ProductModel).filter(ProductModel.id == product_id).first()
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True


# =============================================================================
# HACCP PLAN SERVICE
# =============================================================================
class HaccpPlanService:
    @staticmethod
    def list_haccp_plans(
        db: Session,
        org_id: UUID | None = None,
        product_id: UUID | None = None,
        status: str | None = None,
    ) -> List[HaccpPlanResponse]:
        q = db.query(HACCPPlan)
        if org_id:
            q = q.filter(HACCPPlan.org_id == org_id)
        if product_id:
            q = q.filter(HACCPPlan.product_id == product_id)
        if status:
            q = q.filter(HACCPPlan.status == status)
        return [HaccpPlanResponse.model_validate(p) for p in q.order_by(HACCPPlan.created_at.desc()).all()]

    @staticmethod
    def create_haccp_plan(db: Session, payload: HaccpPlanCreate) -> HaccpPlanResponse:
        obj = HACCPPlan(
            id=uuid4(),
            org_id=payload.org_id,
            product_id=payload.product_id,
            name=payload.name,
            version=payload.version,
            scope=payload.scope,
            status="DRAFT",
            created_by=payload.created_by,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return HaccpPlanResponse.model_validate(obj)

    @staticmethod
    def get_haccp_plan(db: Session, plan_id: UUID) -> HaccpPlanResponse | None:
        obj = db.query(HACCPPlan).filter(HACCPPlan.id == plan_id).first()
        return HaccpPlanResponse.model_validate(obj) if obj else None

    @staticmethod
    def update_haccp_plan(db: Session, plan_id: UUID, payload: HaccpPlanUpdate) -> HaccpPlanResponse | None:
        obj = db.query(HACCPPlan).filter(HACCPPlan.id == plan_id).first()
        if not obj:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return HaccpPlanResponse.model_validate(obj)

    @staticmethod
    def delete_haccp_plan(db: Session, plan_id: UUID) -> bool:
        obj = db.query(HACCPPlan).filter(HACCPPlan.id == plan_id).first()
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True

    @staticmethod
    def approve_haccp_plan(db: Session, plan_id: UUID, approved_by: UUID | None = None) -> HaccpPlanResponse | None:
        obj = db.query(HACCPPlan).filter(HACCPPlan.id == plan_id).first()
        if not obj:
            return None
        obj.status = "ACTIVE"
        if approved_by:
            obj.approved_by = approved_by
        obj.approved_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(obj)
        return HaccpPlanResponse.model_validate(obj)

    @staticmethod
    def create_version_snapshot(db: Session, plan_id: UUID, created_by: UUID | None = None) -> HACCPPlanVersion | None:
        """Save current plan state as a version snapshot"""
        obj = db.query(HACCPPlan).filter(HACCPPlan.id == plan_id).first()
        if not obj:
            return None

        # Validate created_by exists in users table, if not set to None
        if created_by:
            user_exists = db.query(User).filter(User.id == created_by).first()
            if not user_exists:
                print(f"[SERVICE] User {created_by} not found, setting created_by to None")
                created_by = None

        version = HACCPPlanVersion(
            id=uuid4(),
            plan_id=plan_id,
            version=obj.version,
            name=obj.name,
            scope=obj.scope,
            product_id=obj.product_id,
            status="ARCHIVED",
            created_by=created_by,
        )
        db.add(version)
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def create_new_version_from_active(
        db: Session,
        plan_id: UUID,
        payload: CreateNewVersionRequest
    ) -> HaccpPlanResponse | None:
        """Create a new version from an ACTIVE plan - archives current and creates new draft"""
        print(f"[SERVICE] Starting create_new_version_from_active for plan {plan_id}")

        obj = db.query(HACCPPlan).filter(HACCPPlan.id == plan_id).first()
        if not obj:
            return None

        # Only ACTIVE plans can be versioned
        if obj.status != "ACTIVE":
            raise ValueError("Only ACTIVE plans can create new versions")

        # Save current state as archived version
        HaccpPlanService.create_version_snapshot(db, plan_id, payload.updated_by)

        # Update plan with new version info
        obj.version = payload.new_version
        obj.status = "DRAFT"
        obj.approved_by = None
        obj.approved_at = None
        obj.updated_at = datetime.now(timezone.utc)

        # Apply optional field updates if provided
        if payload.name is not None and payload.name.strip() != "":
            obj.name = payload.name
        if payload.scope is not None:
            new_scope = payload.scope if payload.scope.strip() != "" else None
            obj.scope = new_scope
        if payload.product_id is not None:
            obj.product_id = payload.product_id

        db.commit()
        db.refresh(obj)
        return HaccpPlanResponse.model_validate(obj)

    @staticmethod
    def list_plan_versions(db: Session, plan_id: UUID) -> List[HaccpPlanVersionResponse]:
        """Get all versions of a plan"""
        versions = (
            db.query(HACCPPlanVersion)
            .filter(HACCPPlanVersion.plan_id == plan_id)
            .order_by(HACCPPlanVersion.created_at.desc())
            .all()
        )
        return [HaccpPlanVersionResponse.model_validate(v) for v in versions]

    @staticmethod
    def get_plan_version(db: Session, version_id: UUID) -> HaccpPlanVersionResponse | None:
        """Get a specific version by ID"""
        version = db.query(HACCPPlanVersion).filter(HACCPPlanVersion.id == version_id).first()
        return HaccpPlanVersionResponse.model_validate(version) if version else None


# =============================================================================
# PROCESS STEP SERVICE
# =============================================================================
class ProcessStepService:
    @staticmethod
    def list_process_steps(db: Session, haccp_plan_id: UUID) -> List[ProcessStepResponse]:
        rows = (
            db.query(ProcessStepModel)
            .filter(ProcessStepModel.haccp_plan_id == haccp_plan_id)
            .order_by(ProcessStepModel.step_order)
            .all()
        )
        return [ProcessStepResponse.model_validate(r) for r in rows]

    @staticmethod
    def create_process_step(db: Session, payload: ProcessStepCreate) -> ProcessStepResponse:
        obj = ProcessStepModel(
            id=uuid4(),
            haccp_plan_id=payload.haccp_plan_id,
            step_order=payload.step_order,
            name=payload.name,
            description=payload.description,
            step_type=payload.step_type,
            is_ccp=payload.is_ccp,
            parent_step_id=payload.parent_step_id,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return ProcessStepResponse.model_validate(obj)

    @staticmethod
    def get_process_step(db: Session, step_id: UUID) -> ProcessStepResponse | None:
        obj = db.query(ProcessStepModel).filter(ProcessStepModel.id == step_id).first()
        return ProcessStepResponse.model_validate(obj) if obj else None

    @staticmethod
    def update_process_step(db: Session, step_id: UUID, payload: ProcessStepUpdate) -> ProcessStepResponse | None:
        obj = db.query(ProcessStepModel).filter(ProcessStepModel.id == step_id).first()
        if not obj:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return ProcessStepResponse.model_validate(obj)

    @staticmethod
    def delete_process_step(db: Session, step_id: UUID) -> bool:
        obj = db.query(ProcessStepModel).filter(ProcessStepModel.id == step_id).first()
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True


# =============================================================================
# HAZARD ANALYSIS SERVICE
# =============================================================================
class HazardAnalysisService:
    @staticmethod
    def list_hazards(db: Session, step_id: UUID) -> List[HazardAnalysisResponse]:
        rows = db.query(HazardAnalysisModel).filter(HazardAnalysisModel.step_id == step_id).all()
        return [HazardAnalysisResponse.model_validate(r) for r in rows]

    @staticmethod
    def create_hazard(db: Session, payload: HazardAnalysisCreate) -> HazardAnalysisResponse:
        risk = payload.likelihood * payload.severity
        obj = HazardAnalysisModel(
            id=uuid4(),
            step_id=payload.step_id,
            hazard_type=payload.hazard_type,
            hazard_name=payload.hazard_name,
            description=payload.description,
            likelihood=payload.likelihood,
            severity=payload.severity,
            risk_score=risk,
            control_measure=payload.control_measure,
            is_significant=payload.is_significant or risk >= 12,
            ai_suggestion=payload.ai_suggestion,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return HazardAnalysisResponse.model_validate(obj)

    @staticmethod
    def get_hazard(db: Session, hazard_id: UUID) -> HazardAnalysisResponse | None:
        obj = db.query(HazardAnalysisModel).filter(HazardAnalysisModel.id == hazard_id).first()
        return HazardAnalysisResponse.model_validate(obj) if obj else None

    @staticmethod
    def update_hazard(db: Session, hazard_id: UUID, payload: HazardAnalysisUpdate) -> HazardAnalysisResponse | None:
        obj = db.query(HazardAnalysisModel).filter(HazardAnalysisModel.id == hazard_id).first()
        if not obj:
            return None
        updates = payload.model_dump(exclude_unset=True)
        for k, v in updates.items():
            setattr(obj, k, v)
        # Recalculate risk_score
        obj.risk_score = obj.likelihood * obj.severity
        db.commit()
        db.refresh(obj)
        return HazardAnalysisResponse.model_validate(obj)

    @staticmethod
    def delete_hazard(db: Session, hazard_id: UUID) -> bool:
        obj = db.query(HazardAnalysisModel).filter(HazardAnalysisModel.id == hazard_id).first()
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True


# =============================================================================
# CCP SERVICE
# =============================================================================
class CCPService:
    @staticmethod
    def list_ccps(db: Session, haccp_plan_id: UUID) -> List[CCPResponse]:
        rows = db.query(CCPModel).filter(CCPModel.haccp_plan_id == haccp_plan_id).all()
        return [CCPResponse.model_validate(r) for r in rows]

    @staticmethod
    def create_ccp(db: Session, payload: CCPCreate) -> CCPResponse:
        # Lấy thông tin kế hoạch để biết org_id
        plan = db.query(HACCPPlan).filter(HACCPPlan.id == payload.haccp_plan_id).first()
        if not plan:
            raise ValueError("Kế hoạch không tồn tại.")

        # Kiểm tra tính duy nhất của mã CCP trong TOÀN BỘ tổ chức
        existing = db.query(CCPModel).join(HACCPPlan).filter(
            HACCPPlan.org_id == plan.org_id,
            CCPModel.ccp_code == payload.ccp_code
        ).first()
        
        if existing:
            existing_plan = db.query(HACCPPlan).filter(HACCPPlan.id == existing.haccp_plan_id).first()
            raise ValueError(f"Mã CCP '{payload.ccp_code}' đã tồn tại trong kế hoạch '{existing_plan.name}'.")

        obj = CCPModel(
            id=uuid4(),
            haccp_plan_id=payload.haccp_plan_id,
            step_id=payload.step_id,
            hazard_id=payload.hazard_id,
            ccp_code=payload.ccp_code,
            name=payload.name,
            critical_limit=payload.critical_limit,
            monitoring_method=payload.monitoring_method,
            monitoring_frequency=payload.monitoring_frequency,
            monitoring_device=payload.monitoring_device,
            responsible_user=payload.responsible_user,
            corrective_action=payload.corrective_action,
            verification_procedure=payload.verification_procedure,
            ai_suggestion=payload.ai_suggestion,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return CCPResponse.model_validate(obj)

    @staticmethod
    def get_ccp(db: Session, ccp_id: UUID) -> CCPResponse | None:
        obj = db.query(CCPModel).filter(CCPModel.id == ccp_id).first()
        return CCPResponse.model_validate(obj) if obj else None

    @staticmethod
    def update_ccp(db: Session, ccp_id: UUID, payload: CCPUpdate) -> CCPResponse | None:
        obj = db.query(CCPModel).filter(CCPModel.id == ccp_id).first()
        if not obj:
            return None
        try:
            update_data = payload.model_dump(exclude_unset=True)
            
            # Kiểm tra tính duy nhất nếu thay đổi ccp_code (toàn bộ tổ chức)
            if "ccp_code" in update_data:
                plan = db.query(HACCPPlan).filter(HACCPPlan.id == obj.haccp_plan_id).first()
                existing = db.query(CCPModel).join(HACCPPlan).filter(
                    HACCPPlan.org_id == plan.org_id,
                    CCPModel.ccp_code == update_data["ccp_code"],
                    CCPModel.id != ccp_id
                ).first()
                if existing:
                    existing_plan = db.query(HACCPPlan).filter(HACCPPlan.id == existing.haccp_plan_id).first()
                    raise ValueError(f"Mã CCP '{update_data['ccp_code']}' đã tồn tại trong kế hoạch '{existing_plan.name}'.")

            print(f"[CCP Update] ID={ccp_id}, Data={update_data}")
            for k, v in update_data.items():
                setattr(obj, k, v)
            db.commit()
            db.refresh(obj)
            result = CCPResponse.model_validate(obj)
            print(f"[CCP Update] Success: {result}")
            return result
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            import traceback
            print(f"[CCP Update] Error after commit: {e}")
            print(traceback.format_exc())
            raise

    @staticmethod
    def delete_ccp(db: Session, ccp_id: UUID) -> bool:
        obj = db.query(CCPModel).filter(CCPModel.id == ccp_id).first()
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True


# =============================================================================
# CCP MONITORING LOG SERVICE
# =============================================================================
class CCPMonitoringLogService:
    @staticmethod
    def list_ccp_logs(
        db: Session,
        ccp_id: UUID,
        batch_number: str | None = None,
        shift: str | None = None,
        limit: int = 100,
    ) -> List[CCPMonitoringLogResponse]:
        q = db.query(CCPMonitoringLog).filter(CCPMonitoringLog.ccp_id == ccp_id)
        if batch_number:
            q = q.filter(CCPMonitoringLog.batch_number == batch_number)
        if shift:
            q = q.filter(CCPMonitoringLog.shift == shift)
        rows = q.order_by(CCPMonitoringLog.recorded_at.desc()).limit(limit).all()
        return [CCPMonitoringLogResponse.model_validate(r) for r in rows]

    @staticmethod
    def create_ccp_log(db: Session, payload: CCPMonitoringLogCreate) -> CCPMonitoringLogResponse:
        obj = CCPMonitoringLog(
            id=uuid4(),
            ccp_id=payload.ccp_id,
            batch_number=payload.batch_number,
            shift=payload.shift,
            measured_value=payload.measured_value,
            unit=payload.unit,
            is_within_limit=payload.is_within_limit,
            deviation_note=payload.deviation_note,
            recorded_by=payload.recorded_by,
            iot_device_id=payload.iot_device_id,
            deviation_severity=payload.deviation_severity,
            deviation_status=None,
        )
        db.add(obj)
        db.flush()

        # Chỉ đánh dấu độ lệch mới. NC/CAPA chỉ được tạo khi người dùng bấm "Gửi CAPA".
        if not payload.is_within_limit:
            obj.deviation_status = "NEW"

        db.commit()
        db.refresh(obj)
        return CCPMonitoringLogResponse.model_validate(obj)

    @staticmethod
    def get_ccp_log(db: Session, log_id: UUID) -> CCPMonitoringLogResponse | None:
        obj = db.query(CCPMonitoringLog).filter(CCPMonitoringLog.id == log_id).first()
        return CCPMonitoringLogResponse.model_validate(obj) if obj else None

    @staticmethod
    def update_ccp_log(db: Session, log_id: UUID, payload: CCPMonitoringLogUpdate) -> CCPMonitoringLogResponse | None:
        obj = db.query(CCPMonitoringLog).filter(CCPMonitoringLog.id == log_id).first()
        if not obj:
            return None
        updates = payload.model_dump(exclude_unset=True)
        if "verified_by" in updates and updates["verified_by"]:
            obj.verified_at = datetime.now(timezone.utc)
        old_limit_status = obj.is_within_limit
        for k, v in updates.items():
            setattr(obj, k, v)
            
        db.flush()

        # Khi chuyển từ đạt sang không đạt, chỉ đánh dấu độ lệch mới.
        # NC/CAPA được tạo riêng khi người dùng bấm "Gửi CAPA".
        if (
            old_limit_status is True
            and obj.is_within_limit is False
            and "deviation_status" not in updates
        ):
            obj.deviation_status = "NEW"

        db.commit()
        db.refresh(obj)
        return CCPMonitoringLogResponse.model_validate(obj)

    @staticmethod
    def list_all_logs(
        db: Session,
        org_id: UUID | None = None,
        plan_id: UUID | None = None,
        limit: int = 500,
    ) -> List[CCPMonitoringLogResponse]:
        """Lấy tất cả nhật ký giám sát CCP, lọc theo plan hoặc org nếu có."""
        q = db.query(CCPMonitoringLog).join(CCPModel, CCPMonitoringLog.ccp_id == CCPModel.id)

        if plan_id:
            q = q.filter(CCPModel.haccp_plan_id == plan_id)
        elif org_id:
            q = q.join(HACCPPlan, CCPModel.haccp_plan_id == HACCPPlan.id)
            q = q.filter(HACCPPlan.org_id == org_id)

        rows = q.order_by(CCPMonitoringLog.recorded_at.desc()).limit(limit).all()
        return [CCPMonitoringLogResponse.model_validate(r) for r in rows]

    @staticmethod
    def _filter_deviations_by_recorded_at(
        q,
        recorded_from: date | None,
        recorded_to: date | None,
    ):
        if recorded_from is not None:
            start = datetime.combine(recorded_from, time.min, tzinfo=timezone.utc)
            q = q.filter(CCPMonitoringLog.recorded_at >= start)
        if recorded_to is not None:
            end_exclusive = datetime.combine(
                recorded_to + timedelta(days=1), time.min, tzinfo=timezone.utc
            )
            q = q.filter(CCPMonitoringLog.recorded_at < end_exclusive)
        return q

    @staticmethod
    def list_ccp_deviations(
        db: Session,
        org_id: UUID,
        status: str | None = None,
        severity: str | None = None,
        plan_id: UUID | None = None,
        ccp_id: UUID | None = None,
        search: str | None = None,
        has_capa_nc: bool | None = None,
        recorded_from: date | None = None,
        recorded_to: date | None = None,
        limit: int = 100,
    ) -> List[CCPMonitoringLogResponse]:
        CCPMonitoringLogService.sync_haccp_deviation_statuses_for_org(db, org_id)
        q = (
            db.query(CCPMonitoringLog)
            .join(CCPModel, CCPMonitoringLog.ccp_id == CCPModel.id)
            .join(HACCPPlan, CCPModel.haccp_plan_id == HACCPPlan.id)
            .filter(
                CCPMonitoringLog.is_within_limit == False,  # noqa: E712
                HACCPPlan.org_id == org_id,
            )
        )
        q = CCPMonitoringLogService._filter_deviations_by_recorded_at(
            q, recorded_from, recorded_to
        )
        if plan_id:
            q = q.filter(HACCPPlan.id == plan_id)
        if ccp_id:
            q = q.filter(CCPMonitoringLog.ccp_id == ccp_id)
        if status:
            q = q.filter(CCPMonitoringLog.deviation_status == status)
        if severity:
            q = q.filter(CCPMonitoringLog.deviation_severity == severity)
        if search and search.strip():
            term = f"%{search.strip()}%"
            q = q.filter(
                or_(
                    CCPMonitoringLog.batch_number.ilike(term),
                    CCPMonitoringLog.deviation_note.ilike(term),
                    CCPModel.name.ilike(term),
                    CCPModel.ccp_code.ilike(term),
                )
            )
        if has_capa_nc is True:
            q = q.filter(
                exists().where(
                    NonConformity.source_ref_id == CCPMonitoringLog.id,
                    NonConformity.source == "HACCP",
                    NonConformity.org_id == org_id,
                )
            )
        elif has_capa_nc is False:
            q = q.filter(
                ~exists().where(
                    NonConformity.source_ref_id == CCPMonitoringLog.id,
                    NonConformity.source == "HACCP",
                    NonConformity.org_id == org_id,
                )
            )
        rows = q.order_by(CCPMonitoringLog.recorded_at.desc()).limit(limit).all()
        return [CCPMonitoringLogResponse.model_validate(r) for r in rows]

    @staticmethod
    def handle_deviation(
        db: Session,
        log_id: UUID,
        org_id: UUID,
        payload,
    ) -> CCPMonitoringLogResponse | None:
        """Xử lý một độ lệch: cập nhật trạng thái, mức độ, hành động khắc phục (trong phạm vi org)."""
        obj = (
            db.query(CCPMonitoringLog)
            .join(CCPModel, CCPMonitoringLog.ccp_id == CCPModel.id)
            .join(HACCPPlan, CCPModel.haccp_plan_id == HACCPPlan.id)
            .filter(CCPMonitoringLog.id == log_id, HACCPPlan.org_id == org_id)
            .first()
        )
        if not obj:
            return None

        updates = payload.model_dump(exclude_unset=True)

        # Tự động cập nhật thời gian xử lý nếu có người xử lý
        if "handled_by" in updates and updates["handled_by"]:
            obj.handled_at = datetime.now(timezone.utc)

        for k, v in updates.items():
            setattr(obj, k, v)

        db.commit()
        db.refresh(obj)
        return CCPMonitoringLogResponse.model_validate(obj)

    @staticmethod
    def sync_haccp_log_deviation_status_from_nc(db: Session, nc: NonConformity) -> bool:
        """
        Đồng bộ deviation_status trên CCPMonitoringLog theo NC + CAPA (nguồn HACCP).
        Không commit — gọi trước commit của luồng nghiệp vụ.
        Trả về True nếu trạng thái log có thay đổi.
        """
        if nc.source != "HACCP" or nc.source_ref_id is None:
            return False
        log = db.query(CCPMonitoringLog).filter(CCPMonitoringLog.id == nc.source_ref_id).first()
        if not log or log.is_within_limit is not False:
            return False
        old_status = log.deviation_status
        capa = (
            db.query(CAPA)
            .filter(CAPA.nc_id == nc.id)
            .order_by(CAPA.created_at.desc())
            .first()
        )
        if capa:
            cs = capa.status
            capa_status = cs.value if hasattr(cs, "value") else str(cs)
            if capa_status == "OPEN":
                log.deviation_status = "CAPA_OPEN"
            elif capa_status in ("IN_PROGRESS", "VERIFYING"):
                log.deviation_status = "CAPA_IN_PROGRESS"
            elif capa_status == "CLOSED":
                log.deviation_status = "CAPA_CLOSED"
            elif capa_status == "REJECTED":
                log.deviation_status = "CAPA_REJECTED"
            else:
                log.deviation_status = "CAPA_OPEN"
        else:
            if nc.status == "WAITING":
                log.deviation_status = "PENDING_CAPA"
            elif nc.status == "OPEN":
                log.deviation_status = "PENDING_CAPA"
            elif nc.status == "CLOSED":
                log.deviation_status = "CAPA_CLOSED"
            elif nc.status == "REJECTED":
                log.deviation_status = "CAPA_REJECTED"
            else:
                log.deviation_status = "PENDING_CAPA"
        return log.deviation_status != old_status

    @staticmethod
    def sync_haccp_deviation_statuses_for_org(db: Session, org_id: UUID) -> None:
        """Sửa các trạng thái dẫn xuất HACCP bị cũ trước khi trả danh sách/thống kê."""
        ncs = (
            db.query(NonConformity)
            .filter(NonConformity.org_id == org_id, NonConformity.source == "HACCP")
            .all()
        )
        changed = False
        for nc in ncs:
            changed = CCPMonitoringLogService.sync_haccp_log_deviation_status_from_nc(db, nc) or changed
        if changed:
            db.commit()

    @staticmethod
    def ensure_nc_for_deviation_capa(
        db: Session,
        log_id: UUID,
        org_id: UUID,
    ) -> tuple[NonConformity, bool] | None:
        """
        Đảm bảo có bản ghi NC (WAITING) cho nhật ký độ lệch CCP để module CAPA xử lý.
        Trả về (nc, created) hoặc None nếu không tìm thấy log trong phạm vi org.
        Raises ValueError('not_deviation') nếu log không phải độ lệch.
        """
        obj = (
            db.query(CCPMonitoringLog)
            .join(CCPModel, CCPMonitoringLog.ccp_id == CCPModel.id)
            .join(HACCPPlan, CCPModel.haccp_plan_id == HACCPPlan.id)
            .filter(CCPMonitoringLog.id == log_id, HACCPPlan.org_id == org_id)
            .first()
        )
        if not obj:
            return None
        if obj.is_within_limit is not False:
            raise ValueError("not_deviation")

        existing = (
            db.query(NonConformity)
            .filter(
                NonConformity.source_ref_id == log_id,
                NonConformity.source == "HACCP",
                NonConformity.org_id == org_id,
            )
            .first()
        )
        if existing:
            CCPMonitoringLogService.sync_haccp_log_deviation_status_from_nc(db, existing)
            db.commit()
            db.refresh(obj)
            return (existing, False)

        unit = obj.unit or ""
        measured = obj.measured_value
        title = f"Độ lệch CCP: {measured} {unit}".strip()
        if len(title) > 500:
            title = title[:497] + "..."

        nc = NonConformity(
            id=uuid4(),
            org_id=org_id,
            source="HACCP",
            source_ref_id=log_id,
            title=title,
            description=obj.deviation_note,
            severity=obj.deviation_severity or "HIGH",
            status="WAITING",
            detected_by=obj.recorded_by,
        )
        db.add(nc)
        db.flush()
        CCPMonitoringLogService.sync_haccp_log_deviation_status_from_nc(db, nc)
        db.commit()
        db.refresh(nc)
        db.refresh(obj)
        return (nc, True)

    @staticmethod
    def get_deviation_stats(
        db: Session,
        org_id: UUID,
        recorded_from: date | None = None,
        recorded_to: date | None = None,
    ) -> dict:
        """Thống kê độ lệch theo trạng thái và mức độ trong một tổ chức (có thể lọc theo ngày ghi nhận)."""
        from sqlalchemy import func

        CCPMonitoringLogService.sync_haccp_deviation_statuses_for_org(db, org_id)

        def _deviation_base():
            q = (
                db.query(CCPMonitoringLog)
                .join(CCPModel, CCPMonitoringLog.ccp_id == CCPModel.id)
                .join(HACCPPlan, CCPModel.haccp_plan_id == HACCPPlan.id)
                .filter(
                    CCPMonitoringLog.is_within_limit == False,  # noqa: E712
                    HACCPPlan.org_id == org_id,
                )
            )
            return CCPMonitoringLogService._filter_deviations_by_recorded_at(
                q, recorded_from, recorded_to
            )

        status_counts = (
            _deviation_base()
            .with_entities(
                CCPMonitoringLog.deviation_status,
                func.count(CCPMonitoringLog.id).label("count"),
            )
            .group_by(CCPMonitoringLog.deviation_status)
            .all()
        )

        severity_counts = (
            _deviation_base()
            .with_entities(
                CCPMonitoringLog.deviation_severity,
                func.count(CCPMonitoringLog.id).label("count"),
            )
            .group_by(CCPMonitoringLog.deviation_severity)
            .all()
        )

        _pending_statuses = frozenset(
            {
                "NEW",
                "PENDING_CAPA",
                "CAPA_OPEN",
                "CAPA_IN_PROGRESS",
                "INVESTIGATING",
                "CORRECTIVE_ACTION",
            }
        )
        return {
            "by_status": {s: c for s, c in status_counts if s},
            "by_severity": {s: c for s, c in severity_counts if s},
            "total": sum(c for _, c in status_counts),
            "pending": sum(c for s, c in status_counts if s in _pending_statuses),
        }


# =============================================================================
# HACCP VERIFICATION SERVICE
# =============================================================================
class HaccpVerificationService:
    @staticmethod
    def list_verifications(db: Session, haccp_plan_id: UUID) -> List[HaccpVerificationResponse]:
        rows = (
            db.query(HaccpVerificationModel)
            .filter(HaccpVerificationModel.haccp_plan_id == haccp_plan_id)
            .order_by(HaccpVerificationModel.conducted_at.desc())
            .all()
        )
        return [HaccpVerificationResponse.model_validate(r) for r in rows]

    @staticmethod
    def create_verification(db: Session, payload: HaccpVerificationCreate) -> HaccpVerificationResponse:
        obj = HaccpVerificationModel(
            id=uuid4(),
            haccp_plan_id=payload.haccp_plan_id,
            verification_type=payload.verification_type,
            period_from=payload.period_from,
            period_to=payload.period_to,
            result=payload.result,
            conclusion=payload.conclusion,
            conducted_by=payload.conducted_by,
            approved_by=payload.approved_by,
            report_url=payload.report_url,
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return HaccpVerificationResponse.model_validate(obj)

    @staticmethod
    def get_verification(db: Session, verification_id: UUID) -> HaccpVerificationResponse | None:
        obj = db.query(HaccpVerificationModel).filter(HaccpVerificationModel.id == verification_id).first()
        return HaccpVerificationResponse.model_validate(obj) if obj else None

    @staticmethod
    def update_verification(db: Session, verification_id: UUID, payload: HaccpVerificationUpdate) -> HaccpVerificationResponse | None:
        obj = db.query(HaccpVerificationModel).filter(HaccpVerificationModel.id == verification_id).first()
        if not obj:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return HaccpVerificationResponse.model_validate(obj)


# =============================================================================
# HACCP ASSESSMENT SERVICE (Phiếu đánh giá HACCP)
# =============================================================================
class HaccpAssessmentService:
    @staticmethod
    def list_assessments(
        db: Session,
        org_id: UUID | None = None,
        haccp_plan_id: UUID | None = None,
        status: str | None = None,
    ) -> List[HaccpAssessmentResponse]:
        q = db.query(HaccpAssessmentModel)
        if org_id:
            q = q.filter(HaccpAssessmentModel.org_id == org_id)
        if haccp_plan_id:
            q = q.filter(HaccpAssessmentModel.haccp_plan_id == haccp_plan_id)
        if status:
            q = q.filter(HaccpAssessmentModel.status == status)
        q = q.order_by(HaccpAssessmentModel.created_at.desc())
        rows = q.all()
        return [HaccpAssessmentResponse.model_validate(r) for r in rows]

    @staticmethod
    def get_assessment(db: Session, assessment_id: UUID) -> HaccpAssessmentResponse | None:
        obj = db.query(HaccpAssessmentModel).filter(HaccpAssessmentModel.id == assessment_id).first()
        if not obj:
            return None
        return HaccpAssessmentResponse.model_validate(obj)

    @staticmethod
    def create_assessment(db: Session, payload: HaccpAssessmentCreate) -> HaccpAssessmentResponse:
        if not payload.org_id:
            raise ValueError("Thiếu org_id.")
        event_id = payload.calendar_event_id
        ev = (
            db.query(CalendarEvent)
            .filter(
                CalendarEvent.id == event_id,
                CalendarEvent.org_id == payload.org_id,
                CalendarEvent.event_type == "HACCP_ASSESSMENT",
            )
            .first()
        )
        if not ev:
            raise ValueError("Lịch đánh giá không tồn tại hoặc không thuộc tổ chức của bạn.")
        if ev.status != "SCHEDULED":
            raise ValueError("Lịch này không còn ở trạng thái chờ thực hiện (đã hoàn thành hoặc không hợp lệ).")
        ev_plan_id = _haccp_plan_id_from_calendar_event(ev)
        if not ev_plan_id or ev_plan_id != payload.haccp_plan_id:
            raise ValueError("Kế hoạch HACCP của phiếu phải trùng với kế hoạch gắn trên lịch đánh giá đã chọn.")
        dup = (
            db.query(HaccpAssessmentModel)
            .filter(
                HaccpAssessmentModel.calendar_event_id == event_id,
                HaccpAssessmentModel.status.in_(["DRAFT", "SUBMITTED", "REVIEWED"]),
            )
            .first()
        )
        if dup:
            raise ValueError(
                "Đã có phiếu đánh giá liên kết với lịch này. Hoàn thành hoặc xóa phiếu nháp hiện có trước khi tạo mới."
            )

        obj = HaccpAssessmentModel(
            id=uuid4(),
            org_id=payload.org_id,
            haccp_plan_id=payload.haccp_plan_id,
            calendar_event_id=event_id,
            title=payload.title,
            assessment_date=payload.assessment_date,
            status="DRAFT",
            overall_result=payload.overall_result,
            overall_note=payload.overall_note,
            submitted_by=payload.submitted_by,
        )
        db.add(obj)
        db.flush()

        if payload.items:
            for item in payload.items:
                db.add(HaccpAssessmentItemModel(
                    id=uuid4(),
                    assessment_id=obj.id,
                    item_type=item.item_type,
                    ref_id=item.ref_id,
                    question=item.question,
                    expected_value=item.expected_value,
                    actual_value=item.actual_value,
                    result=item.result,
                    note=item.note,
                    evidence_url=item.evidence_url,
                    order_index=item.order_index,
                ))

        db.commit()
        db.refresh(obj)
        return HaccpAssessmentResponse.model_validate(obj)

    @staticmethod
    def update_assessment(db: Session, assessment_id: UUID, payload: HaccpAssessmentUpdate) -> HaccpAssessmentResponse | None:
        obj = db.query(HaccpAssessmentModel).filter(HaccpAssessmentModel.id == assessment_id).first()
        if not obj:
            return None
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return HaccpAssessmentResponse.model_validate(obj)

    @staticmethod
    def _sync_ccp_deviations_from_assessment(
        db: Session,
        assessment: HaccpAssessmentModel,
        submitted_by: UUID,
    ) -> int:
        """Tạo nhật ký độ lệch (is_within_limit=False) cho mỗi hạng mục CCP không đạt trên phiếu đã gửi."""
        created = 0
        assessment_line = f"Phiếu đánh giá: {assessment.title} (ID {assessment.id})"
        for item in assessment.items or []:
            if item.item_type != "CCP" or item.result != "FAIL" or not item.ref_id:
                continue
            ccp = db.query(CCPModel).filter(CCPModel.id == item.ref_id).first()
            if not ccp or ccp.haccp_plan_id != assessment.haccp_plan_id:
                continue

            measured: float | None = None
            raw = (item.actual_value or "").strip().replace(",", ".")
            if raw:
                try:
                    measured = float(raw)
                except ValueError:
                    pass

            note_parts: list[str] = []
            if (item.note or "").strip():
                note_parts.append(item.note.strip())
            note_parts.append(assessment_line)
            if item.question:
                note_parts.append(f"Tiêu chí: {item.question}")

            log = CCPMonitoringLog(
                id=uuid4(),
                ccp_id=item.ref_id,
                batch_number=(item.batch_number or "").strip() or None,
                measured_value=measured,
                is_within_limit=False,
                deviation_note="\n".join(note_parts),
                recorded_by=submitted_by,
                deviation_status="NEW",
            )
            db.add(log)
            created += 1
        return created

    @staticmethod
    def submit_assessment(
        db: Session,
        assessment_id: UUID,
        payload: HaccpAssessmentSubmitRequest,
        submitted_by: UUID,
    ) -> tuple[HaccpAssessmentResponse | None, int]:
        obj = db.query(HaccpAssessmentModel).filter(HaccpAssessmentModel.id == assessment_id).first()
        if not obj:
            return None, 0
        _ensure_assessment_fill_allowed(db, obj)
        obj.status = "SUBMITTED"
        obj.overall_result = payload.overall_result
        obj.overall_note = payload.overall_note
        obj.submitted_by = submitted_by

        # --- AI Generation Mock ---
        # Analyze items to generate an evaluation and development direction
        items = obj.items
        pass_count = sum(1 for item in items if item.result == "PASS")
        fail_count = sum(1 for item in items if item.result == "FAIL")
        total = len(items)

        eval_lines = []
        eval_lines.append(f"**Kết quả phân tích tự động:** Đạt {pass_count}/{total} tiêu chí.")
        
        if fail_count > 0:
            eval_lines.append(f"⚠️ Phát hiện {fail_count} tiêu chí không đạt.")
            failed_items = [item.question for item in items if item.result == "FAIL"]
            for fi in failed_items[:3]:
                eval_lines.append(f"- {fi}")
            if len(failed_items) > 3:
                eval_lines.append(f"- ... và {len(failed_items) - 3} tiêu chí khác.")
            
            eval_lines.append("\n**Hướng phát triển (Đề xuất của AI):**")
            eval_lines.append("1. Tiến hành rà soát nguyên nhân gốc rễ cho các tiêu chí không đạt.")
            eval_lines.append("2. Lên kế hoạch khắc phục (CAPA) và phân công người chịu trách nhiệm.")
            eval_lines.append("3. Tăng cường đào tạo nhân viên tại các công đoạn có tỷ lệ sai sót cao.")
        else:
            eval_lines.append("✅ Tất cả các tiêu chí đều đạt. Hệ thống HACCP đang vận hành tốt.")
            eval_lines.append("\n**Hướng phát triển (Đề xuất của AI):**")
            eval_lines.append("1. Duy trì hệ thống giám sát hiện tại.")
            eval_lines.append("2. Cân nhắc số hóa toàn bộ quá trình ghi chép để giảm thiểu sai sót thủ công.")
            eval_lines.append("3. Rà soát định kỳ hồ sơ để tối ưu hóa tần suất giám sát CCP.")
        
        obj.ai_evaluation = "\n".join(eval_lines)
        # --------------------------

        deviations_created = HaccpAssessmentService._sync_ccp_deviations_from_assessment(
            db, obj, submitted_by
        )

        if getattr(obj, "calendar_event_id", None):
            ev_done = (
                db.query(CalendarEvent)
                .filter(CalendarEvent.id == obj.calendar_event_id, CalendarEvent.org_id == obj.org_id)
                .first()
            )
            if ev_done and ev_done.status == "SCHEDULED":
                submit_now = datetime.now(timezone.utc)
                deadline = _schedule_effective_end(ev_done)
                ev_done.status = "COMPLETED" if submit_now <= deadline else "OVERDUE"

        db.commit()
        db.refresh(obj)
        return HaccpAssessmentResponse.model_validate(obj), deviations_created

    @staticmethod
    def update_assessment_item(db: Session, item_id: UUID, payload: HaccpAssessmentItemUpdate) -> HaccpAssessmentItemResponse | None:
        obj = db.query(HaccpAssessmentItemModel).filter(HaccpAssessmentItemModel.id == item_id).first()
        if not obj:
            return None
        assessment = (
            db.query(HaccpAssessmentModel)
            .filter(HaccpAssessmentModel.id == obj.assessment_id)
            .first()
        )
        if assessment:
            _ensure_assessment_fill_allowed(db, assessment)
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return HaccpAssessmentItemResponse.model_validate(obj)

    @staticmethod
    def _insert_assessment_item_row(
        db: Session,
        assessment_id: UUID,
        payload: HaccpAssessmentManualItemCreate,
    ) -> HaccpAssessmentItemResponse:
        max_order = (
            db.query(func.max(HaccpAssessmentItemModel.order_index))
            .filter(HaccpAssessmentItemModel.assessment_id == assessment_id)
            .scalar()
        )
        next_order = (max_order if max_order is not None else -1) + 1
        ev = payload.expected_value.strip() if payload.expected_value else None
        row = HaccpAssessmentItemModel(
            id=uuid4(),
            assessment_id=assessment_id,
            item_type=payload.item_type,
            ref_id=payload.ref_id,
            question=payload.question.strip(),
            expected_value=ev,
            order_index=next_order,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return HaccpAssessmentItemResponse.model_validate(row)

    @staticmethod
    def add_assessment_manual_item_for_org(
        db: Session,
        assessment_id: UUID,
        org_id: UUID,
        payload: HaccpAssessmentManualItemCreate,
    ) -> tuple[str, HaccpAssessmentItemResponse | None]:
        assessment = (
            db.query(HaccpAssessmentModel)
            .filter(
                HaccpAssessmentModel.id == assessment_id,
                HaccpAssessmentModel.org_id == org_id,
            )
            .first()
        )
        if not assessment:
            return ("not_found", None)
        if assessment.status != "DRAFT":
            return ("not_draft", None)
        try:
            _ensure_assessment_fill_allowed(db, assessment)
        except ValueError:
            return ("not_started", None)
        item = HaccpAssessmentService._insert_assessment_item_row(db, assessment_id, payload)
        return ("ok", item)

    @staticmethod
    def delete_assessment_item_if_draft_for_org(
        db: Session,
        item_id: UUID,
        org_id: UUID,
    ) -> bool:
        item = db.query(HaccpAssessmentItemModel).filter(HaccpAssessmentItemModel.id == item_id).first()
        if not item:
            return False
        assessment = (
            db.query(HaccpAssessmentModel)
            .filter(
                HaccpAssessmentModel.id == item.assessment_id,
                HaccpAssessmentModel.org_id == org_id,
            )
            .first()
        )
        if not assessment or assessment.status != "DRAFT":
            return False
        db.delete(item)
        db.commit()
        return True

    @staticmethod
    def delete_assessment(db: Session, assessment_id: UUID) -> bool:
        obj = db.query(HaccpAssessmentModel).filter(HaccpAssessmentModel.id == assessment_id).first()
        if not obj:
            return False
        db.delete(obj)
        db.commit()
        return True

    @staticmethod
    def create_haccp_schedule(db: Session, req: HaccpScheduleRequest) -> int:
        events = []
        current_date = req.start_date
        end_date = req.end_date or req.start_date
        schedule_batch_id = str(uuid4())

        max_end_date = req.start_date + timedelta(days=366)
        if end_date > max_end_date:
            end_date = max_end_date

        if req.frequency == HaccpScheduleFrequency.ONCE:
            events.append(
                HaccpAssessmentService._build_calendar_event(
                    db, req, req.start_date, schedule_batch_id=schedule_batch_id
                )
            )
        else:
            while current_date <= end_date:
                should_add = False
                if req.frequency == HaccpScheduleFrequency.DAILY:
                    should_add = True
                elif req.frequency == HaccpScheduleFrequency.WEEKLY:
                    if req.day_of_week is not None and current_date.weekday() == req.day_of_week:
                        should_add = True
                elif req.frequency == HaccpScheduleFrequency.MONTHLY:
                    if req.day_of_month is not None and current_date.day == req.day_of_month:
                        should_add = True

                if should_add:
                    events.append(
                        HaccpAssessmentService._build_calendar_event(
                            db, req, current_date, schedule_batch_id=schedule_batch_id
                        )
                    )
                current_date += timedelta(days=1)

        if events:
            db.add_all(events)
            db.commit()
        return len(events)

    @staticmethod
    def get_upcoming_haccp_schedules(db: Session, org_id: UUID, limit: int = 20) -> List[CalendarEvent]:
        from sqlalchemy import select

        now = datetime.now(timezone.utc)
        stmt = (
            select(CalendarEvent)
            .where(
                CalendarEvent.org_id == org_id,
                CalendarEvent.event_type == "HACCP_ASSESSMENT",
                CalendarEvent.status == "SCHEDULED",
            )
            .order_by(CalendarEvent.start_time.asc())
            .limit(limit * 3)
        )
        candidates = list(db.scalars(stmt).all())
        upcoming: List[CalendarEvent] = []
        for ev in candidates:
            if _schedule_display_status(ev, now) == "SCHEDULED":
                upcoming.append(ev)
            if len(upcoming) >= limit:
                break
        return upcoming

    @staticmethod
    def delete_haccp_schedule_event(db: Session, org_id: UUID, event_id: UUID) -> dict:
        now = datetime.now(timezone.utc)
        ev = (
            db.query(CalendarEvent)
            .filter(
                CalendarEvent.id == event_id,
                CalendarEvent.org_id == org_id,
                CalendarEvent.event_type == "HACCP_ASSESSMENT",
            )
            .first()
        )
        if not ev:
            raise ValueError("Không tìm thấy lịch đánh giá.")
        if not _is_schedule_deletable(ev, now):
            display = _schedule_display_status(ev, now)
            if display == "COMPLETED":
                raise ValueError("Không thể xóa lịch đã hoàn thành.")
            raise ValueError("Không thể xóa lịch quá hạn.")

        batch_id = _haccp_schedule_batch_id_from_calendar_event(ev)
        to_delete: list[CalendarEvent] = [ev]
        if batch_id:
            siblings = (
                db.query(CalendarEvent)
                .filter(
                    CalendarEvent.org_id == org_id,
                    CalendarEvent.event_type == "HACCP_ASSESSMENT",
                )
                .all()
            )
            to_delete = [
                s
                for s in siblings
                if _haccp_schedule_batch_id_from_calendar_event(s) == batch_id
                and _is_schedule_deletable(s, now)
            ]
            if not any(s.id == ev.id for s in to_delete):
                to_delete = [ev]

        deleted_ids = {e.id for e in to_delete}
        skipped_locked_count = 0
        if batch_id:
            for s in siblings if batch_id else []:
                if _haccp_schedule_batch_id_from_calendar_event(s) == batch_id and s.id not in deleted_ids:
                    if not _is_schedule_deletable(s, now):
                        skipped_locked_count += 1

        for item in to_delete:
            db.delete(item)
        db.commit()
        return {"deleted_count": len(to_delete), "skipped_locked_count": skipped_locked_count}

    @staticmethod
    def list_haccp_schedules(db: Session, org_id: UUID, status: Optional[str] = None, limit: int = 100) -> List[dict]:
        from sqlalchemy import select
        stmt = (
            select(CalendarEvent)
            .where(CalendarEvent.org_id == org_id, CalendarEvent.event_type == "HACCP_ASSESSMENT")
            .order_by(CalendarEvent.start_time.desc())
            .limit(limit)
        )
        events = db.scalars(stmt).all()
        now = datetime.now(timezone.utc)
        plan_ids: set[UUID] = set()
        for e in events:
            pid = _haccp_plan_id_from_calendar_event(e)
            if pid:
                plan_ids.add(pid)
        plan_name_by_id: dict[str, str] = {}
        if plan_ids:
            for p in db.query(HACCPPlan).filter(HACCPPlan.id.in_(plan_ids)).all():
                plan_name_by_id[str(p.id)] = p.name

        results: List[dict] = []
        for e in events:
            display_status = _schedule_display_status(e, now)

            ev_plan_uuid = _haccp_plan_id_from_calendar_event(e)
            pid_str = str(ev_plan_uuid) if ev_plan_uuid else None
            batch_id = _haccp_schedule_batch_id_from_calendar_event(e)

            e_dict = {
                "id": str(e.id),
                "title": e.title,
                "description": e.description,
                "start_time": e.start_time,
                "end_time": e.end_time,
                "status": display_status,
                "assigned_to": str(e.assigned_to) if e.assigned_to else None,
                "haccp_plan_id": pid_str,
                "plan_name": plan_name_by_id.get(pid_str) if pid_str else None,
                "schedule_batch_id": batch_id,
                "can_delete": _is_schedule_deletable(e, now),
            }

            if status:
                if status == "OVERDUE":
                    if display_status != "OVERDUE":
                        continue
                elif status == "SCHEDULED":
                    if display_status != "SCHEDULED":
                        continue
                elif status == "COMPLETED":
                    if display_status != "COMPLETED":
                        continue
                else:
                    continue

            results.append(e_dict)
        return results

    @staticmethod
    def _event_start_utc_from_local_date_time(event_date: date, hhmm: str) -> datetime:
        hour = int(hhmm[:2])
        minute = int(hhmm[3:5])
        local_dt = datetime.combine(event_date, time(hour, minute), tzinfo=HACCP_SCHEDULE_TZ)
        return local_dt.astimezone(timezone.utc)

    @staticmethod
    def _build_calendar_event(
        db: Session,
        req: HaccpScheduleRequest,
        event_date: date,
        *,
        schedule_batch_id: str,
    ) -> CalendarEvent:
        description_data = {
            "haccp_plan_id": str(req.haccp_plan_id),
            "location_id": str(req.location_id),
            "source": "HACCP_MODULE",
            "notes": req.description,
            "assessment_time_local": req.assessment_time_local,
            "assessment_end_time_local": req.assessment_end_time_local,
            "timezone": "Asia/Ho_Chi_Minh",
            "schedule_batch_id": schedule_batch_id,
        }
        title = req.title
        if not title:
            plan = db.query(HACCPPlan).filter(HACCPPlan.id == req.haccp_plan_id).first()
            plan_name = plan.name if plan else "Kế hoạch HACCP"
            title = f"Đánh giá {plan_name}"

        start_utc = HaccpAssessmentService._event_start_utc_from_local_date_time(
            event_date, req.assessment_time_local
        )
        end_utc = HaccpAssessmentService._event_start_utc_from_local_date_time(
            event_date, req.assessment_end_time_local
        )

        return CalendarEvent(
            id=uuid4(),
            org_id=req.org_id,
            title=title,
            description=json.dumps(description_data, ensure_ascii=False),
            event_type="HACCP_ASSESSMENT",
            start_time=start_utc,
            end_time=end_utc,
            status="SCHEDULED",
            assigned_to=req.assigned_to,
        )
