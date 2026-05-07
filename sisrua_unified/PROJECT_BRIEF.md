# PROJECT_BRIEF.md — sisRUA Unified

> Last updated: 2026-05-06 | Sprint 1 | Status: In Progress

## 1. Project Overview

sisRUA Unified is an engineering platform for geospatial processing and DXF 2.5D artifact generation with enterprise-oriented governance, security, and traceability. It combines a React frontend, an Express backend, and a Python geoprocessing engine to transform spatial inputs into technical outputs used by operations and planning teams. The product target is reliable industrial execution with reproducible technical evidence, not ad-hoc GIS scripting.

## 2. Concept / Product Description

The product flow is request-driven: users submit geospatial processing requests through the web application, backend services validate and orchestrate processing jobs, and the Python engine performs domain-heavy calculations and artifact generation. Output quality is controlled by deterministic rules, technical parity checks, and provenance metadata.

Key capabilities:

- DXF 2.5D generation from spatial datasets and engineering rules.
- Backend-first processing with asynchronous job orchestration.
- Security and audit readiness (sanitization, logs, policy-driven checks).
- Docker-first operations for reproducible local and deployment environments.
- Progressive enterprise roadmap (reliability, compliance, observability, IAM, multi-tenant hardening).

## 3. Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Processing Engine: Python (geoprocessing and CAD artifact generation)
- Queue/Async: Google Cloud Tasks (production-oriented path)
- Containerization: Docker + docker compose
- Testing: Vitest, Playwright, backend unit/integration scripts, pytest (Python scope)
- CI/CD: GitHub Actions workflows

## 4. Architecture

```text
┌──────────────────────────────────────────────────────┐
│                    Frontend (Vite)                  │
│ src/* UI, forms, map/grid interactions, job submit  │
└───────────────────────────┬──────────────────────────┘
                            │ HTTP/JSON
┌───────────────────────────▼──────────────────────────┐
│                  Backend API (Express)              │
│ server/index.ts, services/*, validation, auth, jobs │
└───────────────┬──────────────────────┬───────────────┘
                │                      │
                │ async task enqueue   │ local/worker exec
                │                      │
┌───────────────▼──────────────┐   ┌───▼────────────────────────────┐
│ Google Cloud Tasks (prod)    │   │ Python Engine (py_engine/*)    │
│ queue + webhook callbacks     │   │ geoprocessing + DXF 2.5D       │
└───────────────┬──────────────┘   └───┬────────────────────────────┘
                │                      │
                └──────────┬───────────┘
                           ▼
┌──────────────────────────────────────────────────────┐
│ Artifacts + Status + Logs + Provenance Metadata     │
└──────────────────────────────────────────────────────┘
```

## 5. Key Files Map

| Area             | Path                                    | Contents                                        |
| ---------------- | --------------------------------------- | ----------------------------------------------- |
| Frontend root    | `src/`                                  | React UI, state, presentation logic             |
| Backend root     | `server/`                               | API routes, services, orchestration, validation |
| Python engine    | `py_engine/`                            | Geoprocessing logic and DXF output pipeline     |
| Architecture doc | `ARCHITECTURE.md`                       | Queue strategy, deployment/runtime model        |
| Roadmap          | `docs/STRATEGIC_ROADMAP_2026.md`        | Non-negotiables, maturity tiers, priorities     |
| Tests            | `tests/`, `e2e/`, `server/**/__tests__` | Unit/integration/E2E coverage                   |
| Sprint docs      | `docs/sprint-1/`                        | Plan, progress, done                            |
| QA docs          | `docs/qa/`                              | Sprint sign-off records                         |

## 6. Team Roles

| Agent             | Name | Role                                                          |
| ----------------- | ---- | ------------------------------------------------------------- |
| Producer          | Remy | Sprint planning, coordination, issue triage, merge management |
| Frontend Engineer | Nova | UI architecture, client state, component implementation       |
| Backend Engineer  | Sage | API design, security, persistence, job orchestration          |
| Visual Director   | Milo | UI polish, accessibility consistency, visual system quality   |
| QA Engineer       | Ivy  | Test strategy, execution, regression reporting, sign-off      |
| Product Designer  | Kira | UX flows, scope-fit feature framing, usability priorities     |
| DevOps Engineer   | Dash | CI/CD hardening, release automation, deployment safeguards    |

## 7. Sprint Status

| Sprint | Name                               | Status      | Scope                                                                   |
| ------ | ---------------------------------- | ----------- | ----------------------------------------------------------------------- |
| 0      | Foundations and Hardening Baseline | Done        | Architecture baseline, tooling, docs, security and test scaffolding     |
| 1      | Orchestration Bootstrap            | In Progress | Team workflow docs, sprint protocol, context survival, QA gate template |

## 8. Current State (rewrite every sprint)

What works:

- End-to-end project structure exists for frontend, backend, and Python engine.
- Docker-first local execution path is documented and available.
- Strategic roadmap and architecture references are present and detailed.
- Multiple test commands and quality/security scripts are available in package scripts.

What does not work yet:

- No team orchestration files existed prior to Sprint 1 (no shared PROJECT_BRIEF, no sprint trackers).
- Cross-chat context handoff was informal and vulnerable to context loss.
- QA sign-off protocol was not documented in a dedicated sprint artifact.

What is next:

- Execute Sprint 1 workflow using docs in `docs/sprint-1/`.
- Start Sprint 2 with prioritized implementation issues and QA-linked acceptance criteria.
- Enforce bug tracking through GitHub Issues and fix-by-reference commits.

## 9. Security Rules

1. Secrets must only exist in environment variables or secret managers. Never commit credentials.
2. Sanitize and validate every external input at API boundaries.
3. Keep heavy business logic in backend/Python layers (thin frontend policy).
4. Preserve traceability of technical outputs (rule/version/provenance metadata).
5. Use least-privilege access in CI/CD and pin critical workflow dependencies.

## 10. How to Run Locally

```bash
npm --prefix sisrua_unified install
npm --prefix sisrua_unified run dev
```

Alternative (docker-first):

```bash
cd sisrua_unified
docker compose up
```

Useful service URLs (default local):

- App: http://localhost:8080 (docker mode)
- Frontend dev: http://localhost:3000
- Backend dev: http://localhost:3001

## 11. How to Deploy

Primary path uses GitHub Actions + Cloud Run deployment workflows referenced in repository docs.

High-level steps:

1. Validate build/tests locally.
2. Ensure required deployment secrets and env vars are configured.
3. Run CI workflow and review security/build gates.
4. Deploy through controlled branch strategy and release workflow.
5. Verify runtime health and queue/task connectivity post-deploy.

## 12. Cross-Chat Handoff Protocol

Before ending any sprint-focused chat:

1. Update `docs/sprint-N/progress.md` with exact task status and blockers.
2. Update Section 7 and Section 8 in this file.
3. Write or append `docs/sprint-N/done.md` with build output, unresolved items, changed files, and manual steps.
4. If bugs were found, file GitHub Issues and reference issue numbers in progress/done files.

Cold-start recovery prompt:

```text
Read PROJECT_BRIEF.md and docs/sprint-N/progress.md.
Continue from where it left off.
```

## 13. Bug & Fix Tracking

GitHub Issues are the single source of truth for bugs and fixes.

Rules:

- QA files one issue per bug with reproducible steps and severity label (`blocker`, `major`, `minor`).
- Dev references issues in commits (example: `fix: sanitize request payload (Fixes #123)`).
- Do not batch unrelated bug fixes in one commit.
- QA closes issues only after verification.

Artifacts:

- QA sign-off file: `docs/qa/sprint-N-signoff.md`
- Sprint execution logs: `docs/sprint-N/progress.md`, `docs/sprint-N/done.md`

## 14. Multi-Repo Setup

Each team uses a separate clone and branch to avoid index collisions and chat-context interference.

Suggested local clones:

- `sisTOPOGRAFIA-dev`
- `sisTOPOGRAFIA-qa`
- `sisTOPOGRAFIA-devops` (as needed)

Branch strategy for this repository:

- Base branch for active integration: `dev`
- Default branch (long-lived): `master`
- Feature branches: `feature/sprint-N`, `feature/qa-N`, `feature/devops-N`

Commands:

```bash
git pull origin dev
git checkout -b feature/sprint-1
```

Merge policy:

- Use regular merge commits (no rebase of shared feature branches).
- Do not force-push shared branches.
- Merge feature branches to `dev`; promote to `master` only via controlled release process.
