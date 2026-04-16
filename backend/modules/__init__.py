from fastapi import APIRouter

from .users import users_router
from .documents import document_router
from .prp import prp_router
from .haccp import haccp_router
from .capas import capas_router
from .reports import report_router
from .scheduling import schedule_router

api_router = APIRouter()

api_router.include_router(users_router)
api_router.include_router(document_router)
api_router.include_router(prp_router)
api_router.include_router(haccp_router)
api_router.include_router(capas_router)
api_router.include_router(report_router)
api_router.include_router(schedule_router)

__all__ = ["api_router"]
