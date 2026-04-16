from datetime import date
from uuid import UUID

from fastapi import APIRouter, status, Query, HTTPException

from .schemas import (
    # Calendar Events
    CalendarEventCreate,
    CalendarEventUpdate,
    CalendarEventResponse,
    CalendarEventFilter,
    CalendarEventSummary,
    # Reminders
    ReminderConfigCreate,
    ReminderConfigUpdate,
    ReminderConfigResponse,
    # Notifications
    NotificationLogCreate,
    NotificationLogUpdate,
    NotificationLogResponse,
    NotificationUnreadCount,
    # PRP Audit Schedules
    PRPAuditScheduleCreate,
    PRPAuditScheduleUpdate,
    PRPAuditScheduleResponse,
)
from .service import (
    CalendarEventService,
    ReminderConfigService,
    NotificationLogService,
    PRPAuditScheduleService,
)

schedule_router = APIRouter(prefix="/scheduling", tags=["Scheduling"])


# =============================================================================
# CALENDAR EVENT ENDPOINTS
# =============================================================================
@schedule_router.get("/events", response_model=list[CalendarEventResponse])
def list_events(
    org_id: UUID | None = None,
    assigned_to: UUID | None = None,
    event_type: str | None = None,
    status: str | None = Query(
        None, pattern="^(SCHEDULED|COMPLETED|CANCELLED|OVERDUE)$"
    ),
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(100, ge=1, le=1000),
) -> list[CalendarEventResponse]:
    """List calendar events with optional filters."""
    return CalendarEventService.list_events(
        org_id, assigned_to, event_type, status, date_from, date_to, limit
    )


@schedule_router.post(
    "/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED
)
def create_event(payload: CalendarEventCreate) -> CalendarEventResponse:
    """Create a new calendar event."""
    return CalendarEventService.create_event(payload)


@schedule_router.get("/events/{event_id}", response_model=CalendarEventResponse)
def get_event(event_id: UUID) -> CalendarEventResponse:
    """Get a calendar event by ID."""
    result = CalendarEventService.get_event(event_id)
    if not result:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    return result


@schedule_router.patch("/events/{event_id}", response_model=CalendarEventResponse)
def update_event(event_id: UUID, payload: CalendarEventUpdate) -> CalendarEventResponse:
    """Update a calendar event."""
    result = CalendarEventService.update_event(event_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    return result


@schedule_router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: UUID) -> None:
    """Delete a calendar event."""
    success = CalendarEventService.delete_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Calendar event not found")


@schedule_router.post(
    "/events/{event_id}/complete", response_model=CalendarEventResponse
)
def complete_event(event_id: UUID) -> CalendarEventResponse:
    """Mark a calendar event as completed."""
    result = CalendarEventService.complete_event(event_id)
    if not result:
        raise HTTPException(status_code=404, detail="Calendar event not found")
    return result


@schedule_router.get("/events/summary/dashboard", response_model=CalendarEventSummary)
def get_event_summary(
    org_id: UUID,
    user_id: UUID | None = None,
) -> CalendarEventSummary:
    """Get calendar event summary for dashboard."""
    return CalendarEventService.get_event_summary(org_id, user_id)


# =============================================================================
# REMINDER CONFIG ENDPOINTS
# =============================================================================
@schedule_router.get(
    "/events/{event_id}/reminders", response_model=list[ReminderConfigResponse]
)
def list_reminders(event_id: UUID) -> list[ReminderConfigResponse]:
    """List all reminder configs for an event."""
    return ReminderConfigService.list_reminders(event_id)


@schedule_router.post(
    "/events/{event_id}/reminders",
    response_model=ReminderConfigResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_reminder(
    event_id: UUID, payload: ReminderConfigCreate
) -> ReminderConfigResponse:
    """Create a reminder config for an event."""
    return ReminderConfigService.create_reminder(payload)


@schedule_router.get("/reminders/{reminder_id}", response_model=ReminderConfigResponse)
def get_reminder(reminder_id: UUID) -> ReminderConfigResponse:
    """Get a reminder config by ID."""
    result = ReminderConfigService.get_reminder(reminder_id)
    if not result:
        raise HTTPException(status_code=404, detail="Reminder config not found")
    return result


@schedule_router.patch(
    "/reminders/{reminder_id}", response_model=ReminderConfigResponse
)
def update_reminder(
    reminder_id: UUID, payload: ReminderConfigUpdate
) -> ReminderConfigResponse:
    """Update a reminder config."""
    result = ReminderConfigService.update_reminder(reminder_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="Reminder config not found")
    return result


@schedule_router.delete(
    "/reminders/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_reminder(reminder_id: UUID) -> None:
    """Delete a reminder config."""
    success = ReminderConfigService.delete_reminder(reminder_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reminder config not found")


# =============================================================================
# NOTIFICATION LOG ENDPOINTS
# =============================================================================
@schedule_router.get("/notifications", response_model=list[NotificationLogResponse])
def list_notifications(
    org_id: UUID | None = None,
    user_id: UUID | None = None,
    is_read: bool | None = None,
    channel: str | None = Query(None, pattern="^(APP|EMAIL|SMS|ZALO)$"),
    limit: int = Query(50, ge=1, le=500),
) -> list[NotificationLogResponse]:
    """List notifications with optional filters."""
    return NotificationLogService.list_notifications(
        org_id, user_id, is_read, channel, limit
    )


@schedule_router.post(
    "/notifications",
    response_model=NotificationLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_notification(payload: NotificationLogCreate) -> NotificationLogResponse:
    """Create a notification log (typically called by background tasks)."""
    return NotificationLogService.create_notification(payload)


@schedule_router.get(
    "/notifications/{notification_id}", response_model=NotificationLogResponse
)
def get_notification(notification_id: UUID) -> NotificationLogResponse:
    """Get a notification log by ID."""
    result = NotificationLogService.get_notification(notification_id)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return result


@schedule_router.patch(
    "/notifications/{notification_id}/read", response_model=NotificationLogResponse
)
def mark_notification_read(notification_id: UUID) -> NotificationLogResponse:
    """Mark a notification as read."""
    result = NotificationLogService.mark_notification_read(notification_id)
    if not result:
        raise HTTPException(status_code=404, detail="Notification not found")
    return result


@schedule_router.post(
    "/notifications/mark-all-read", status_code=status.HTTP_204_NO_CONTENT
)
def mark_all_notifications_read(
    user_id: UUID,
    org_id: UUID,
) -> None:
    """Mark all notifications as read for a user."""
    NotificationLogService.mark_all_notifications_read(user_id, org_id)


@schedule_router.get(
    "/notifications/unread-count", response_model=NotificationUnreadCount
)
def get_unread_notification_count(
    user_id: UUID,
    org_id: UUID,
) -> NotificationUnreadCount:
    """Get count of unread notifications for a user."""
    return NotificationLogService.get_unread_count(user_id, org_id)


# =============================================================================
# PRP AUDIT SCHEDULE ENDPOINTS
# =============================================================================
@schedule_router.get(
    "/prp-audit-schedules", response_model=list[PRPAuditScheduleResponse]
)
def list_prp_audit_schedules(
    org_id: UUID | None = None,
    assigned_to: UUID | None = None,
    status: str | None = Query(
        None, pattern="^(SCHEDULED|IN_PROGRESS|COMPLETED|OVERDUE)$"
    ),
    frequency: str | None = Query(None, pattern="^(DAILY|WEEKLY|MONTHLY|QUARTERLY)$"),
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[PRPAuditScheduleResponse]:
    """List PRP audit schedules with optional filters."""
    return PRPAuditScheduleService.list_schedules(
        org_id, assigned_to, status, frequency, date_from, date_to
    )


@schedule_router.post(
    "/prp-audit-schedules",
    response_model=PRPAuditScheduleResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_prp_audit_schedule(
    payload: PRPAuditScheduleCreate,
) -> PRPAuditScheduleResponse:
    """Create a new PRP audit schedule."""
    return PRPAuditScheduleService.create_schedule(payload)


@schedule_router.get(
    "/prp-audit-schedules/{schedule_id}", response_model=PRPAuditScheduleResponse
)
def get_prp_audit_schedule(schedule_id: UUID) -> PRPAuditScheduleResponse:
    """Get a PRP audit schedule by ID."""
    result = PRPAuditScheduleService.get_schedule(schedule_id)
    if not result:
        raise HTTPException(status_code=404, detail="PRP audit schedule not found")
    return result


@schedule_router.patch(
    "/prp-audit-schedules/{schedule_id}", response_model=PRPAuditScheduleResponse
)
def update_prp_audit_schedule(
    schedule_id: UUID, payload: PRPAuditScheduleUpdate
) -> PRPAuditScheduleResponse:
    """Update a PRP audit schedule."""
    result = PRPAuditScheduleService.update_schedule(schedule_id, payload)
    if not result:
        raise HTTPException(status_code=404, detail="PRP audit schedule not found")
    return result


@schedule_router.delete(
    "/prp-audit-schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_prp_audit_schedule(schedule_id: UUID) -> None:
    """Delete a PRP audit schedule."""
    success = PRPAuditScheduleService.delete_schedule(schedule_id)
    if not success:
        raise HTTPException(status_code=404, detail="PRP audit schedule not found")


@schedule_router.post(
    "/prp-audit-schedules/{schedule_id}/complete",
    response_model=PRPAuditScheduleResponse,
)
def complete_prp_audit_schedule(schedule_id: UUID) -> PRPAuditScheduleResponse:
    """Mark a PRP audit schedule as completed."""
    result = PRPAuditScheduleService.complete_schedule(schedule_id)
    if not result:
        raise HTTPException(status_code=404, detail="PRP audit schedule not found")
    return result
