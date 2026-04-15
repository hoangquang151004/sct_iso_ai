from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, status

from app.modules.scheduling.schemas import CalendarEventCreate, CalendarEventResponse

router = APIRouter(prefix="/scheduling", tags=["Scheduling"])


@router.get("/events", response_model=list[CalendarEventResponse])
def list_events() -> list[CalendarEventResponse]:
    return []


@router.post("/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
def create_event(payload: CalendarEventCreate) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=uuid4(),
        org_id=payload.org_id,
        title=payload.title,
        event_type=payload.event_type,
        start_time=payload.start_time,
        end_time=payload.end_time,
        assigned_to=payload.assigned_to,
        priority=payload.priority,
    )


@router.get("/events/{event_id}", response_model=CalendarEventResponse)
def get_event(event_id: UUID) -> CalendarEventResponse:
    return CalendarEventResponse(
        id=event_id,
        org_id=uuid4(),
        title="Reminder review document",
        event_type="DOCUMENT_REVIEW",
        start_time=datetime.utcnow(),
    )
