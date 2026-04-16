# SCT Implement - Docs First

Use this prompt when implementing code in SCT-ISO.AI.

## Goal

Implement the requested change while enforcing project documentation constraints.

## Step 1 - Classify Change

Identify change type:

- API/endpoint
- DB/model/schema
- Security/auth/config
- UI/user flow
- AI behavior/integration
- Docs-only

## Step 2 - Read Required Docs

Always read first:

1. AGENTS.md
2. CONTEXT.md
3. docs/coding-conventions.md
4. docs/architecture.md

Then read type-specific docs from AGENTS.md.

## Step 3 - Pre-Code Declaration

Before editing, provide:

1. Docs reviewed.
2. Constraints to preserve (for example org_id, error envelope, input validation, secret handling).
3. Required tests from docs/testing-strategy.md.
4. Docs that must be updated with this change.

## Step 4 - Implement

Apply minimal, targeted changes.
Do not break implemented behavior by mixing in roadmap-only assumptions.

## Step 5 - Validate

1. Run relevant tests/checks.
2. Confirm documentation sync by docs/docs-review-checklist.md.
3. Report exactly what changed and what docs were updated.
