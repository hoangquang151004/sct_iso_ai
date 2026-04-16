# SCT Review - Docs Consistency First

Use this prompt when reviewing code changes in SCT-ISO.AI.

## Review Priorities

1. Functional bugs and regressions.
2. Security risks.
3. Contract/schema mismatches.
4. Missing tests.
5. Missing documentation updates.

## Required Context

Always consult:

1. AGENTS.md
2. CONTEXT.md
3. docs/coding-conventions.md
4. docs/security-rules.md
5. docs/testing-strategy.md
6. docs/docs-review-checklist.md

Add type-specific docs from AGENTS.md based on touched files.

## Output Format

1. Findings first, ordered by severity.
2. Each finding includes affected file and impact.
3. List missing tests or docs updates explicitly.
4. If no findings, state that and include residual risk/testing gaps.

## Docs Sync Check

Verify synchronized updates:

1. API change -> api-contracts, api-error-codes, security-rules.
2. DB change -> database-schema, coding-conventions.
3. Flow change -> user-flows, testing-strategy, known-issues.
4. Architecture change -> architecture, decisions, tech-stack.
