# Brainstorm — Phase 1 Free Ideation

Project: sisRUA Unified
Topic: Sprint 2 candidate directions after orchestration bootstrap

## Kira (Product Designer)
1. Guided job wizard with plain-language validations and progress expectations.
2. "Engineering confidence" panel: explainability card for each generated artifact.
3. Operator mode presets by concessionaria profile to reduce setup friction.

## Milo (Visual Director)
1. High-density operations dashboard with readable hierarchy (industrial UI, no clutter).
2. Visual provenance timeline for generated outputs (what rule version created what).
3. Status semantics redesign (queued/running/blocked/succeeded/needs review).

## Nova (Frontend Engineer)
1. Unified job submission form with schema-driven validation and reusable field components.
2. Robust polling/subscription status client with cancellable requests and retry states.
3. Error diagnosis surface with structured backend codes mapped to user actions.

## Sage (Backend Engineer)
1. Job Dossier persistence abstraction for status durability across restarts.
2. Idempotency key strategy for duplicate job submission protection.
3. Provenance envelope API contract to standardize auditability payloads.

## Ivy (QA Engineer)
1. Risk-based E2E suite for job happy path + top 5 failure modes.
2. Contract tests for backend status transitions and error code invariants.
3. QA evidence bundle format for each sprint (test matrix + bug references).

## Remy (Producer)
1. Narrow Sprint 2 to reliability only: status durability + idempotency + status UI.
2. Defer visual redesign until critical reliability issues are measurable.
3. Tie every scope item to a test and explicit acceptance criterion before implementation.