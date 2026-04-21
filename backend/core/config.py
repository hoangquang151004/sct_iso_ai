from __future__ import annotations

import logging
from functools import lru_cache
from typing import Literal

from pydantic import ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

AppEnv = Literal["dev", "test", "staging", "prod"]
SameSite = Literal["lax", "strict", "none"]


class Settings(BaseSettings):
    app_env: AppEnv = "dev"
    database_url: str
    jwt_secret_key: str = "dev-only-secret-key-change-me-please-change"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 7
    refresh_token_cookie_name: str = "refresh_token"
    refresh_cookie_secure: bool | None = None
    refresh_cookie_samesite: SameSite = "lax"
    login_rate_limit: str | None = None
    refresh_rate_limit: str | None = None
    cors_allowed_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    auth_bootstrap_org_id: str = "11111111-1111-1111-1111-111111111111"
    auth_bootstrap_admin_username: str = "admin"
    auth_bootstrap_admin_password: str = "admin12345"
    auth_bootstrap_iso_manager_username: str = "iso_manager"
    auth_bootstrap_iso_manager_password: str = "isomanager12345"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("DATABASE_URL must not be empty.")
        return value

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_allowed_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, list):
            return value
        origins = [item.strip() for item in value.split(",") if item.strip()]
        return origins or ["http://localhost:3000", "http://127.0.0.1:3000"]

    @model_validator(mode="after")
    def validate_runtime_constraints(self) -> "Settings":
        if self.refresh_cookie_secure is None:
            self.refresh_cookie_secure = self.app_env in {"staging", "prod"}

        if self.app_env in {"staging", "prod"} and not self.refresh_cookie_secure:
            raise ValueError(
                "REFRESH_COOKIE_SECURE must be true when APP_ENV is staging or prod."
            )

        if self.refresh_cookie_samesite == "none" and not self.refresh_cookie_secure:
            raise ValueError(
                "REFRESH_COOKIE_SECURE must be true when REFRESH_COOKIE_SAMESITE is none."
            )

        if self.app_env != "dev" and self.jwt_secret_key == "dev-only-secret-key-change-me-please-change":
            raise ValueError(
                "JWT_SECRET_KEY must be explicitly set when APP_ENV is not dev."
            )

        if self.app_env != "dev":
            forbidden_defaults = {
                "AUTH_BOOTSTRAP_ORG_ID": (
                    self.auth_bootstrap_org_id,
                    "11111111-1111-1111-1111-111111111111",
                ),
                "AUTH_BOOTSTRAP_ADMIN_USERNAME": (
                    self.auth_bootstrap_admin_username,
                    "admin",
                ),
                "AUTH_BOOTSTRAP_ADMIN_PASSWORD": (
                    self.auth_bootstrap_admin_password,
                    "admin12345",
                ),
                "AUTH_BOOTSTRAP_ISO_MANAGER_USERNAME": (
                    self.auth_bootstrap_iso_manager_username,
                    "iso_manager",
                ),
                "AUTH_BOOTSTRAP_ISO_MANAGER_PASSWORD": (
                    self.auth_bootstrap_iso_manager_password,
                    "isomanager12345",
                ),
            }
            invalid_fields = [
                env_name
                for env_name, (current_value, default_value) in forbidden_defaults.items()
                if current_value == default_value
            ]
            if invalid_fields:
                raise ValueError(
                    f"Default bootstrap credentials are not allowed outside dev: {', '.join(invalid_fields)}"
                )

        return self


@lru_cache
def get_settings() -> Settings:
    try:
        settings = Settings()
    except ValidationError as exc:
        raise RuntimeError(f"Invalid application configuration: {exc}") from exc

    if settings.app_env == "dev" and settings.jwt_secret_key == "dev-only-secret-key-change-me-please-change":
        logger.warning(
            "JWT_SECRET_KEY is using the development default. Set a strong secret before deploying."
        )
    return settings


settings = get_settings()
