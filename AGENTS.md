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

## 2) Change Type -> Required Docs

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

## 3) Build, Lint, Test Commands

Run from repo root unless noted.

### 3.1 Backend setup and run

- Install deps: `pip install -r backend/requirements.txt`
- Start API (dev): `uvicorn main:app --reload` (run in `backend/`)
- Apply migrations: `alembic upgrade head` (run in `backend/`)

### 3.2 Backend tests (pytest)

- All backend tests: `pytest -q --maxfail=1` (in `backend/`)
- Verbose with stdout: `pytest -vv -s` (in `backend/`)
- Single test file: `pytest tests/test_users_api.py -q` (in `backend/`)
- Single test case: `pytest tests/test_users_api.py::test_list_users_success -q` (in `backend/`)
- Filter by keyword: `pytest -k "users and not sessions" -q` (in `backend/`)

Notes:
- `backend/pytest.ini` uses `testpaths = tests` and `python_files = test_*.py`.
- Integration tests expect PostgreSQL and env vars (see `.github/workflows/backend-tests.yml`).

### 3.3 Frontend commands

- Install deps: `npm ci` (in `frontend/`)
- Dev server: `npm run dev` (in `frontend/`)
- Build: `npm run build` (in `frontend/`)
- Lint: `npm run lint` (in `frontend/`)
- Unit tests: `npm run test` (in `frontend/`)
- E2E tests: `npm run e2e` (in `frontend/`)

### 3.4 Run a single frontend test

- Single Vitest file: `npx vitest run src/path/to/file.test.ts`
- Single Vitest test name: `npx vitest run -t "renders role matrix"`
- Single Playwright spec: `npx playwright test e2e/login_redirect.spec.ts`
- Single Playwright test title: `npx playwright test -g "redirects to login"`

## 4) Code Style and Conventions

### 4.1 Naming

- Python files/functions/variables: `snake_case`.
- Python classes/Pydantic schemas: `PascalCase`.
- DB table names: plural `snake_case`.
- Keep org key naming consistent as `org_id`.

### 4.2 Imports and module boundaries

- Keep imports grouped: stdlib, third-party, local.
- Prefer absolute imports from project roots (`modules.*`, `core.*`, etc.).
- Backend routers must inject DB via `Depends(get_db)`; do not create sessions directly.
- Do not import directly across domain routers; use shared models/schemas (`modules.auth.rbac_models`, shared schema modules).
- Avoid circular imports between modules.

### 4.3 Typing and schemas

- Use explicit type hints in Python and TypeScript.
- Avoid `any` in TypeScript unless justified.
- Use Pydantic request/response schemas for API contracts.
- Keep response shapes aligned with `docs/api-contracts.md`.
- UUIDs are serialized as strings in JSON-facing layers.

### 4.4 Formatting

- Follow existing formatting in touched files; do not reformat unrelated code.
- Keep functions focused and side effects explicit.
- Add comments only for non-obvious logic or business constraints.

### 4.5 Error handling

- Raise structured HTTP errors with stable `error_code` values.
- Follow existing error envelope pattern:
  - `detail.message`
  - `detail.error_code`
  - `detail.request_id`
  - `detail.fields`
- Use appropriate status codes (`401`, `403`, `404`, `409`, `422`, `429`).
- Never leak secrets, tokens, or sensitive internals in error messages.

### 4.6 Security and multi-tenant rules

- Never hardcode secrets or environment URLs.
- Enforce tenant scoping with `org_id` checks (for example `ensure_org_scope`).
- Respect RBAC permissions at endpoint and UI levels.
- Keep audit logging for auth/users/rbac management actions.

## 5) Testing Expectations by Change Type

- Backend API/service changes:
  - Run targeted pytest file(s) first.
  - Then run broader backend suite when practical.
- Frontend UI/flow changes:
  - Run targeted Vitest tests.
  - Run relevant Playwright spec for critical flows.
- Auth, sessions, or RBAC changes:
  - Prioritize `users`, `rbac`, `sessions`, and permission-matrix tests.

Reference: `docs/testing-strategy.md`.

## 6) Docs Sync Rules (Before Merge)

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

## 7) Repository Rule Files (Cursor/Copilot)

As of this update, these files were checked:
- `.cursor/rules/` (not found)
- `.cursorrules` (not found)
- `.github/copilot-instructions.md` (not found)

If any of them are added later, treat them as mandatory and merge their instructions into this workflow.

## 8) Prompt Templates

Reusable prompt templates live in `.github/prompts/`.
