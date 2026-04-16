from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# CALENDAR EVENT SCHEMAS
# =============================================================================
class CalendarEventBase(BaseModel):
    title: str = Field(..., max_length=500)
    description: str | None = None
    event_type: str = Field(..., max_length=100)
    start_time: datetime
    end_time: datetime | None = None
    is_all_day: bool = False
    # Module linking fields
    document_id: UUID | None = None
    prp_schedule_id: UUID | None = None
    capa_id: UUID | None = None
    haccp_plan_id: UUID | None = None
    # Recurrence
    is_recurring: bool = False
    recurrence_rule: str | None = Field(None, max_length=255)
    recurrence_end: date | None = None
    # Assignment
    assigned_to: UUID | None = None
    participant_ids: list[UUID] | None = None
    # Status & AI
    status: str = Field(default="SCHEDULED", pattern="^(SCHEDULED|COMPLETED|CANCELLED|OVERDUE)$")
    priority: str = Field(default="MEDIUM", pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    ai_generated: bool = False


class CalendarEventCreate(CalendarEventBase):
    org_id: UUID
    created_by: UUID


class CalendarEventUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    description: str | None = None
    event_type: str | None = Field(None, max_length=100)
    start_time: datetime | None = None
    end_time: datetime | None = None
    is_all_day: bool | None = None
    # Module linking
    document_id: UUID | None = None
    prp_schedule_id: UUID | None = None
    capa_id: UUID | None = None
    haccp_plan_id: UUID | None = None
    # Recurrence
    is_recurring: bool | None = None
    recurrence_rule: str | None = Field(None, max_length=255)
    recurrence_end: date | None = None
    # Assignment
    assigned_to: UUID | None = None
    participant_ids: list[UUID] | None = None
    # Status
    status: str | None = Field(None, pattern="^(SCHEDULED|COMPLETED|CANCELLED|OVERDUE)$")
    priority: str | None = Field(None, pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")


class CalendarEventResponse(CalendarEventBase):
    id: UUID
    org_id: UUID
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# REMINDER CONFIG SCHEMAS
# =============================================================================
class ReminderConfigBase(BaseModel):
    remind_before: int = Field(..., description="Number of minutes/hours/days before event")
    remind_unit: str = Field(default="DAY", pattern="^(MINUTE|HOUR|DAY)$")
    channels: list[str] = Field(default_factory=lambda: ["APP"])
    recipient_ids: list[UUID] | None = None
    is_sent: bool = False
    sent_at: datetime | None = None


class ReminderConfigCreate(ReminderConfigBase):
    event_id: UUID


class ReminderConfigUpdate(BaseModel):
    remind_before: int | None = None
    remind_unit: str | None = Field(None, pattern="^(MINUTE|HOUR|DAY)$")
    channels: list[str] | None = None
    recipient_ids: list[UUID] | None = None


class ReminderConfigResponse(ReminderConfigBase):
    id: UUID
    event_id: UUID

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# NOTIFICATION LOG SCHEMAS
# =============================================================================
class NotificationLogBase(BaseModel):
    channel: str = Field(..., pattern="^(APP|EMAIL|SMS|ZALO)$")
    title: str | None = Field(None, max_length=500)
    message: str | None = None
    is_read: bool = False
    read_at: datetime | None = None
    sent_at: datetime
    status: str = Field(default="SENT", pattern="^(SENT|DELIVERED|FAILED)$")


class NotificationLogCreate(NotificationLogBase):
    org_id: UUID
    user_id: UUID | None = None
    event_id: UUID | None = None
    alert_id: UUID | None = None


class NotificationLogUpdate(BaseModel):
    is_read: bool | None = None
    read_at: datetime | None = None
    status: str | None = Field(None, pattern="^(SENT|DELIVERED|FAILED)$")


class NotificationLogResponse(NotificationLogBase):
    id: UUID
    org_id: UUID
    user_id: UUID | None = None
    event_id: UUID | None = None
    alert_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# PRP AUDIT SCHEDULE SCHEMAS
# =============================================================================
class PRPAuditScheduleBase(BaseModel):
    prp_program_id: UUID | None = None
    title: str = Field(..., max_length=255)
    area: str | None = Field(None, max_length=100)
    frequency: str | None = Field(None, pattern="^(DAILY|WEEKLY|MONTHLY|QUARTERLY)$")
    scheduled_date: date
    assigned_to: UUID | None = None
    status: str = Field(default="SCHEDULED", pattern="^(SCHEDULED|IN_PROGRESS|COMPLETED|OVERDUE)$")


class PRPAuditScheduleCreate(PRPAuditScheduleBase):
    org_id: UUID
    created_by: UUID


class PRPAuditScheduleUpdate(BaseModel):
    prp_program_id: UUID | None = None
    title: str | None = Field(None, max_length=255)
    area: str | None = Field(None, max_length=100)
    frequency: str | None = Field(None, pattern="^(DAILY|WEEKLY|MONTHLY|QUARTERLY)$")
    scheduled_date: date | None = None
    assigned_to: UUID | None = None
    status: str | None = Field(None, pattern="^(SCHEDULED|IN_PROGRESS|COMPLETED|OVERDUE)$")


class PRPAuditScheduleResponse(PRPAuditScheduleBase):
    id: UUID
    org_id: UUID
    created_by: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# CALENDAR VIEW SCHEMAS (for dashboard/views)
# =============================================================================
class CalendarEventFilter(BaseModel):
    """Filter for calendar events"""
    org_id: UUID | None = None
    user_id: UUID | None = None
    event_type: str | None = None
    status: str | None = None
    priority: str | None = None
    date_from: date | None = None
    date_to: date | None = None


class CalendarEventSummary(BaseModel):
    """Summary of calendar events for dashboard"""
    total_events: int
    overdue_count: int
    today_count: int
    upcoming_count: int
    by_priority: dict[str, int]
    by_status: dict[str, int]


class NotificationUnreadCount(BaseModel):
    """Count of unread notifications"""
    total_unread: int
    by_channel: dict[str, int]
    critical_count: int
