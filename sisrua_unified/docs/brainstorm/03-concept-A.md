# Concept A — Reliability Core First

## Description
Implement durable job status persistence, idempotent submission handling, and deterministic status transitions end-to-end.

## Pros
- Maximizes risk reduction for production-like usage.
- Direct alignment with enterprise roadmap reliability priorities.
- Strong foundation for later UX and provenance improvements.

## Cons
- Limited visible UX improvements in short term.
- Might feel incremental to non-technical stakeholders.

## Estimated Effort
Medium (1 sprint)

## Suggested Scope
- Backend status persistence abstraction
- Idempotency key contract + duplicate suppression
- Frontend status flow alignment with new backend state model
- Contract tests + risk-based E2E
