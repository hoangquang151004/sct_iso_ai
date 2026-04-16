# Agent Guide - SCT-ISO.AI

This file defines the default workflow for coding agents in this repository.

## 1. Mandatory Read Order (Before Any Code)

1. `CONTEXT.md`
2. `docs/coding-conventions.md`
3. `docs/architecture.md`

## 2. Change Type -> Required Docs

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

## 3. Pre-Coding Checklist

Before writing code, state:

1. Which docs were reviewed for this specific change.
2. Which constraints apply (for example: `org_id`, error envelope, security rules).
3. Which tests are required by `docs/testing-strategy.md`.
4. Which docs may need updates after code changes.

## 4. Required Implementation Rules

1. Keep behavior aligned with implemented state vs roadmap state in docs.
2. Do not hardcode secrets or sensitive configuration values.
3. For backend request bodies, use schema validation.
4. Keep naming conventions consistent with `docs/coding-conventions.md`.
5. For multi-tenant data access, preserve organization scoping with `org_id`.

## 5. Before Merge

Apply `docs/docs-review-checklist.md`, especially the synchronized update rules:

1. API changes: update API contracts, error codes, and security docs.
2. DB changes: update database schema and conventions docs.
3. Flow changes: update user flows and testing strategy.
4. Architecture changes: update architecture, decisions, and tech stack docs.

## 6. Prompt Templates

Reusable prompt templates are stored in `.github/prompts/`.
