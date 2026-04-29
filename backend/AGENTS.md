# Backend Agent Addendum

Read `../AGENTS.md` first, then apply backend-specific rules.

## Backend Rules

1. Follow naming and structure in `docs/coding-conventions.md`.
2. Use dependency injection for database access (`Depends(get_db)` pattern).
3. Keep request and response contracts aligned with `docs/api-contracts.md`.
4. Keep organization scoping with `org_id` for multi-tenant logic.
5. Do not import directly across domain routers; use shared models/schemas as documented.

## Current Backend Structure

1. App entry point: `backend/main.py`.
2. API aggregation: `backend/modules/__init__.py`.
3. Domain modules: `backend/modules/<domain>/`.
4. Common domain files: `router.py`, `schemas.py`, `service.py`, `__init__.py`.
5. SQLAlchemy models: `backend/database/models.py`.
6. Migrations: `backend/alembic/versions/`.
7. Cross-cutting helpers: `backend/core/`, `backend/db_session.py`, and `backend/database/`.

When editing an existing module, follow that module's current DB dependency pattern. Do not switch a module between `db_session.get_db`, `database.deps.get_db`, or `db_manager.get_db` unless the task is specifically about DB session standardization.

## Backend Module Checklist

1. Put endpoints in the domain router and register new routers in `backend/modules/__init__.py`.
2. Put Pydantic request/response contracts in the domain `schemas.py`.
3. Put business logic and DB queries in the domain `service.py` when logic is not trivial.
4. Put persistent models in `backend/database/models.py` and create Alembic migrations for schema changes.
5. Add `require_permissions(...)`, `ensure_org_scope(...)`, and audit logging for auth/users/rbac/security-sensitive changes.
6. Keep error responses aligned with the structured error envelope and `docs/api-error-codes.md`.

## Backend Change Checklist

1. API change: update `docs/api-contracts.md`, `docs/api-error-codes.md`, and `docs/security-rules.md`.
2. DB model change: update `docs/database-schema.md` and `docs/coding-conventions.md`.
3. Security change: verify `docs/security-rules.md` and `docs/env-and-config.md`.
4. Test requirements: follow `docs/testing-strategy.md`.
