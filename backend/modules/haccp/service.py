"""
HACCP Module Service Layer — kết nối PostgreSQL thật qua SQLAlchemy.
"""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from typing import List, Optional

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
    User,
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
            print(f"[CCP Update] ID={ccp_id}, Data={update_data}")
            for k, v in update_data.items():
                setattr(obj, k, v)
            db.commit()
            db.refresh(obj)
            result = CCPResponse.model_validate(obj)
            print(f"[CCP Update] Success: {result}")
            return result
        except Exception as e:
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
            # Deviation management fields
            deviation_severity=payload.deviation_severity,
            deviation_status="NEW" if payload.is_within_limit == False else None,
        )
        db.add(obj)
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
        for k, v in updates.items():
            setattr(obj, k, v)
        db.commit()
        db.refresh(obj)
        return CCPMonitoringLogResponse.model_validate(obj)

    @staticmethod
    def list_ccp_deviations(
        db: Session,
        org_id: UUID | None = None,
        status: str | None = None,
        severity: str | None = None,
        limit: int = 100,
    ) -> List[CCPMonitoringLogResponse]:
        q = db.query(CCPMonitoringLog).filter(CCPMonitoringLog.is_within_limit == False)  # noqa: E712
        if status:
            q = q.filter(CCPMonitoringLog.deviation_status == status)
        if severity:
            q = q.filter(CCPMonitoringLog.deviation_severity == severity)
        rows = q.order_by(CCPMonitoringLog.recorded_at.desc()).limit(limit).all()
        return [CCPMonitoringLogResponse.model_validate(r) for r in rows]

    @staticmethod
    def handle_deviation(
        db: Session,
        log_id: UUID,
        payload,
    ) -> CCPMonitoringLogResponse | None:
        """Xử lý một độ lệch: cập nhật trạng thái, mức độ, hành động khắc phục"""
        obj = db.query(CCPMonitoringLog).filter(CCPMonitoringLog.id == log_id).first()
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
    def get_deviation_stats(
        db: Session,
        org_id: UUID | None = None,
    ) -> dict:
        """Thống kê độ lệch theo trạng thái và mức độ"""
        from sqlalchemy import func

        # Stats by status
        status_counts = db.query(
            CCPMonitoringLog.deviation_status,
            func.count(CCPMonitoringLog.id).label('count')
        ).filter(
            CCPMonitoringLog.is_within_limit == False  # noqa: E712
        ).group_by(CCPMonitoringLog.deviation_status).all()

        # Stats by severity
        severity_counts = db.query(
            CCPMonitoringLog.deviation_severity,
            func.count(CCPMonitoringLog.id).label('count')
        ).filter(
            CCPMonitoringLog.is_within_limit == False  # noqa: E712
        ).group_by(CCPMonitoringLog.deviation_severity).all()

        return {
            "by_status": {s: c for s, c in status_counts if s},
            "by_severity": {s: c for s, c in severity_counts if s},
            "total": sum(c for _, c in status_counts),
            "pending": sum(c for s, c in status_counts if s in ["NEW", "INVESTIGATING", "CORRECTIVE_ACTION"])
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
