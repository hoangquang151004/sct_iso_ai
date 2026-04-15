from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CalendarEventBase(BaseModel):
    title: str
    event_type: str
    start_time: datetime
    end_time: datetime | None = None
    assigned_to: UUID | None = None
    priority: str = "MEDIUM"


class CalendarEventCreate(CalendarEventBase):
    org_id: UUID
    created_by: UUID


class CalendarEventResponse(CalendarEventBase):
    id: UUID
    org_id: UUID
    status: str = "SCHEDULED"
    is_all_day: bool = False
    is_recurring: bool = False

    model_config = ConfigDict(from_attributes=True)
