# Agent Guide - SCT-ISO.AI

This guide is for agentic coding tools working in `D:\sct_iso_ai`.
Follow docs-first workflow, then run only the minimum commands needed.

## 1) Mandatory Read Order (Before Any Code)

1. `AGENTS.md` (this file)
2. `CONTEXT.md`
3. `docs/coding-conventions.md`
4. `docs/architecture.md`

Backend-specific follow-up:
- If editing backend, also read `backend/AGENTS.md`.

Frontend-specific follow-up:
- If editing frontend, also read `frontend/AGENTS.md`.
- Important rule from `frontend/AGENTS.md`: this Next.js version has breaking changes, so read relevant docs in `frontend/node_modules/next/dist/docs/` before making framework-level changes.

## 2) Current Directory Structure

Use the current repo layout as the source of truth. Do not introduce a new folder pattern unless the task explicitly requires it and the related docs are updated.

Top-level areas:
- `backend/` - FastAPI app, SQLAlchemy models, Alembic migrations, domain modules.
- `frontend/` - Next.js App Router app, client services, hooks, components, tests.
- `docs/` - architecture, API contracts, schema, security, testing, and coding conventions.
- `PROJECT_STATUS.md` - project status notes, if present.

Backend structure:
- App entry point: `backend/main.py`.
- API router aggregation: `backend/modules/__init__.py`.
- Domain modules: `backend/modules/<domain>/`.
- Common domain files: `router.py`, `schemas.py`, `service.py`, `__init__.py`.
- Extra domain routers are colocated in the same domain folder, for example `backend/modules/auth/sessions_router.py`.
- SQLAlchemy models: `backend/database/models.py`.
- Database helpers: `backend/db_session.py`, `backend/database/`.
- Alembic migrations: `backend/alembic/versions/`.
- Cross-cutting backend utilities: `backend/core/`.

Frontend structure:
- App Router routes and layouts: `frontend/src/app/`.
- Route page files: `frontend/src/app/<route>/page.tsx`.
- Many routes are still large `page.tsx` files; when splitting new route-only pieces, colocate them under `frontend/src/app/<route>/_components/`.
- Layout components: `frontend/src/components/layout/`.
- Shared cross-screen components: `frontend/src/components/shared/`.
- Base UI primitives: `frontend/src/components/ui/`.
- Existing feature-heavy root components live in `frontend/src/components/` (for example document modals and `haccp-wizard`); do not add new route-only components there.
- API client and typed API modules: `frontend/src/api/` (`api-client.ts`, error maps, API-specific hooks, `documents-api.ts`, `reports-api.ts`).
- Domain service modules: `frontend/src/services/`; these usually call `@/api/api-client`.
- App-wide hooks: `frontend/src/hooks/`.
- Shared frontend types: `frontend/src/types/` and existing broad shared types in `frontend/src/lib/types.ts`.
- Cross-cutting context, route config, helpers, exports, mock/demo data: `frontend/src/lib/`.
- Next.js middleware: `frontend/src/middleware.ts`.

## 3) Module Placement & Ownership

Before adding or changing code, identify the existing domain and place files beside the closest current implementation.

Backend module rules:
- Add API endpoints in `backend/modules/<domain>/router.py`, or a clearly named colocated router when the domain already uses one.
- Put request/response Pydantic schemas in `backend/modules/<domain>/schemas.py`.
- Put business logic in `backend/modules/<domain>/service.py` when logic is more than simple routing glue.
- Register new routers in `backend/modules/__init__.py`.
- Put persistent SQLAlchemy models in `backend/database/models.py`; do not create per-domain model files unless the architecture docs are updated.
- Put DB schema changes in Alembic migrations under `backend/alembic/versions/`.
- Follow the DB dependency pattern already used by the module being edited. The repo currently has more than one DB helper path, so do not rewrite all modules to a different helper as part of an unrelated task.
- Keep tenant scoping on `org_id`, RBAC permissions, and audit logging for auth/users/rbac/security-sensitive actions.

Frontend module rules:
- Add or update route screens in `frontend/src/app/<route>/page.tsx`.
- When a route page grows, extract new route-only pieces to `frontend/src/app/<route>/_components/` instead of `frontend/src/components/`.
- Put reusable shell/navigation components in `frontend/src/components/layout/`.
- Put reusable cross-screen behavior wrappers in `frontend/src/components/shared/`.
- Put reusable visual primitives in `frontend/src/components/ui/`.
- Put the shared API client, typed API modules, error maps, and API-specific hooks in `frontend/src/api/`.
- Put domain service wrappers in `frontend/src/services/` when following the current service pattern; check `frontend/src/services/index.ts` before importing from `@/services` because not every service is barrel-exported.
- Put app-wide hooks in `frontend/src/hooks/`.
- Put shared domain types in `frontend/src/types/`; only extend `frontend/src/lib/types.ts` when matching existing broad shared type usage.
- Put app context, route config, generic helpers, export helpers, and mock/demo data in `frontend/src/lib/`.
- Prefer the `@/...` import alias in frontend code.

## 4) Before Adding or Changing a Module

1. Classify the change: backend API, DB/model, security/auth, frontend UI flow, AI integration, or docs-only.
2. Read the required docs for that change type.
3. Inspect the closest existing module and copy its local structure before adding new files.
4. Check import boundaries: do not import directly across backend domain routers; use shared models, schemas, services, or dependencies.
5. Keep public contracts aligned across backend schemas, frontend types/services, and `docs/api-contracts.md`.
6. Update docs in the same change when behavior, API, DB schema, security rules, or user flows change.
7. Run the smallest relevant verification command, unless the change is docs-only.

## 5) Change Type -> Required Docs

- API or endpoint change:
  - `docs/api-contracts.md`
  - `docs/security-rules.md`
  - `docs/api-error-codes.md`
- Database/model/schema change:
  - `docs/database-schema.md`
  - `docs/coding-conventions.md`
- Security/auth/configuration change:
  - `docs/security-rules.md`
  - `docs/env-and-config.md`
- UI or user-flow behavior change:
  - `docs/user-flows.md`
  - `docs/testing-strategy.md`
- AI behavior/integration change:
  - `docs/ai-layer.md`
  - `docs/architecture.md`
- Documentation-only change:
  - `docs/docs-review-checklist.md`

## 6) Build, Lint, Test Commands

Run from repo root unless noted.

### 6.1 Backend setup and run

- Install deps: `pip install -r backend/requirements.txt`
- Start API (dev): `uvicorn main:app --reload` (run in `backend/`)
- Apply migrations: `alembic upgrade head` (run in `backend/`)

### 6.2 Backend tests (pytest)

- All backend tests: `pytest -q --maxfail=1` (in `backend/`)
- Verbose with stdout: `pytest -vv -s` (in `backend/`)
- Single test file: `pytest tests/test_users_api.py -q` (in `backend/`)
- Single test case: `pytest tests/test_users_api.py::test_list_users_success -q` (in `backend/`)
- Filter by keyword: `pytest -k "users and not sessions" -q` (in `backend/`)

Notes:
- `backend/pytest.ini` uses `testpaths = tests` and `python_files = test_*.py`.
- Integration tests expect PostgreSQL and env vars (see `.github/workflows/backend-tests.yml`).

### 6.3 Frontend commands

- Install deps: `npm ci` (in `frontend/`)
- Dev server: `npm run dev` (in `frontend/`)
- Build: `npm run build` (in `frontend/`)
- Lint: `npm run lint` (in `frontend/`)
- Unit tests: `npm run test` (in `frontend/`)
- E2E tests: `npm run e2e` (in `frontend/`)

### 6.4 Run a single frontend test

- Single Vitest file: `npx vitest run src/path/to/file.test.ts`
- Single Vitest test name: `npx vitest run -t "renders role matrix"`
- Single Playwright spec: `npx playwright test e2e/login_redirect.spec.ts`
- Single Playwright test title: `npx playwright test -g "redirects to login"`

## 7) Code Style and Conventions

### 7.1 Naming

- Python files/functions/variables: `snake_case`.
- Python classes/Pydantic schemas: `PascalCase`.
- DB table names: plural `snake_case`.
- Keep org key naming consistent as `org_id`.

### 7.2 Imports and module boundaries

- Keep imports grouped: stdlib, third-party, local.
- Prefer absolute imports from project roots (`modules.*`, `core.*`, etc.).
- Backend routers must inject DB via `Depends(get_db)`; do not create sessions directly.
- Do not import directly across domain routers; use shared models, shared schemas, services, or dependencies.
- Avoid circular imports between modules.

### 7.3 Typing and schemas

- Use explicit type hints in Python and TypeScript.
- Avoid `any` in TypeScript unless justified.
- Use Pydantic request/response schemas for API contracts.
- Keep response shapes aligned with `docs/api-contracts.md`.
- UUIDs are serialized as strings in JSON-facing layers.

### 7.4 Formatting

- Follow existing formatting in touched files; do not reformat unrelated code.
- Keep functions focused and side effects explicit.
- Add comments only for non-obvious logic or business constraints.

### 7.5 Error handling

- Raise structured HTTP errors with stable `error_code` values.
- Follow existing error envelope pattern:
  - `detail.message`
  - `detail.error_code`
  - `detail.request_id`
  - `detail.fields`
- Use appropriate status codes (`401`, `403`, `404`, `409`, `422`, `429`).
- Never leak secrets, tokens, or sensitive internals in error messages.

### 7.6 Security and multi-tenant rules

- Never hardcode secrets or environment URLs.
- Enforce tenant scoping with `org_id` checks (for example `ensure_org_scope`).
- Respect RBAC permissions at endpoint and UI levels.
- Keep audit logging for auth/users/rbac management actions.

## 8) Testing Expectations by Change Type

- Backend API/service changes:
  - Run targeted pytest file(s) first.
  - Then run broader backend suite when practical.
- Frontend UI/flow changes:
  - Run targeted Vitest tests.
  - Run relevant Playwright spec for critical flows.
- Auth, sessions, or RBAC changes:
  - Prioritize `users`, `rbac`, `sessions`, and permission-matrix tests.

Reference: `docs/testing-strategy.md`.

## 9) Docs Sync Rules (Before Merge)

Always apply `docs/docs-review-checklist.md`.

- API changes -> update:
  - `docs/api-contracts.md`
  - `docs/api-error-codes.md`
  - `docs/security-rules.md`
- DB changes -> update:
  - `docs/database-schema.md`
  - `docs/coding-conventions.md`
- User-flow changes -> update:
  - `docs/user-flows.md`
  - `docs/testing-strategy.md`
  - `docs/known-issues.md` (if relevant)
- Architecture/stack changes -> update:
  - `docs/architecture.md`
  - `docs/tech-stack.md`
  - `docs/decisions.md` (if decision-level)

## 10) Repository Rule Files (Cursor/Copilot)

As of this update, these files were checked:
- `.cursor/rules/` (not found)
- `.cursorrules` (not found)
- `.github/copilot-instructions.md` (not found)

If any of them are added later, treat them as mandatory and merge their instructions into this workflow.

## 11) Prompt Templates

Reusable prompt templates live in `.github/prompts/`.
