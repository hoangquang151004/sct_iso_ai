# Backend Agent Addendum

Read `../AGENTS.md` first, then apply backend-specific rules.

## Backend Rules

1. Follow naming and structure in `docs/coding-conventions.md`.
2. Use dependency injection for database access (`Depends(get_db)` pattern).
3. Keep request and response contracts aligned with `docs/api-contracts.md`.
4. Keep organization scoping with `org_id` for multi-tenant logic.
5. Do not import directly across domain routers; use shared models/schemas as documented.

## Backend Change Checklist

1. API change: update `docs/api-contracts.md`, `docs/api-error-codes.md`, and `docs/security-rules.md`.
2. DB model change: update `docs/database-schema.md` and `docs/coding-conventions.md`.
3. Security change: verify `docs/security-rules.md` and `docs/env-and-config.md`.
4. Test requirements: follow `docs/testing-strategy.md`.
