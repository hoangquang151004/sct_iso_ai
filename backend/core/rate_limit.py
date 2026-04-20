from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from core.config import settings


def _resolve_rate_limit(configured: str | None, fallback: str) -> str:
    if settings.app_env == "test":
        return "1000/minute"
    return configured or fallback


login_rate_limit = _resolve_rate_limit(settings.login_rate_limit, "10/minute")
refresh_rate_limit = _resolve_rate_limit(settings.refresh_rate_limit, "30/minute")
limiter = Limiter(key_func=get_remote_address)
