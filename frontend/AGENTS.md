# Frontend Agent Addendum

Read `../AGENTS.md` first, then apply the frontend-specific rule below.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Current Frontend Structure

1. App Router routes and layouts live in `frontend/src/app/`.
2. Route pages use `frontend/src/app/<route>/page.tsx`.
3. Route-only components should be colocated in `frontend/src/app/<route>/_components/` when splitting a page.
4. Layout and navigation components live in `frontend/src/components/layout/`.
5. Cross-screen wrappers and shared behavior live in `frontend/src/components/shared/`.
6. Base UI primitives live in `frontend/src/components/ui/`.
7. Domain service modules live in `frontend/src/services/`.
8. Typed API helpers, error maps, and API-specific hooks live in `frontend/src/api/`.
9. App-wide hooks live in `frontend/src/hooks/`.
10. Shared domain types live in `frontend/src/types/`; broad existing shared types may remain in `frontend/src/lib/types.ts`.
11. Context, route config, export helpers, and mock/demo data live in `frontend/src/lib/`.

## Frontend Module Checklist

1. Follow the closest existing route/service/hook/type pattern before adding a new folder.
2. Prefer the `@/...` import alias configured by `frontend/tsconfig.json`.
3. Use `services/` for domain API calls when matching current service modules.
4. Use `api/` for typed API helpers, error maps, and API-specific hooks when matching current `src/api` files.
5. Keep reusable UI out of route folders only when it is used by more than one screen.
6. Keep frontend contracts aligned with backend schemas and `docs/api-contracts.md`.
