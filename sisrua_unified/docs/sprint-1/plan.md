# Sprint 1 — AI Team Orchestration Bootstrap

> Sprint Goal: establish durable multi-chat execution flow with explicit planning, progress recovery, and QA sign-off protocol.
> Branch: feature/sprint-1
> Estimated effort: 0.5-1 day

## Prioritized Task List

| #   | Task                       | Owner                                  | Est | Description                                                                         |
| --- | -------------------------- | -------------------------------------- | --- | ----------------------------------------------------------------------------------- |
| 1   | Create project brief       | Remy                                   | 1h  | Create `PROJECT_BRIEF.md` with required 14 sections and repo-specific branch policy |
| 2   | Create sprint tracker docs | Remy                                   | 45m | Add `plan.md`, `progress.md`, `done.md` for Sprint 1                                |
| 3   | Run structured brainstorm  | Kira + Nova + Sage + Milo + Ivy + Remy | 1h  | Generate ideation, debate, concepts, vote, and summary artifacts                    |
| 4   | Add QA sign-off template   | Ivy                                    | 20m | Add `docs/qa/sprint-1-signoff.md` with execution checklist                          |
| 5   | Validate handoff quality   | Remy                                   | 20m | Ensure Section 12-14 workflows are executable and consistent                        |

## Work Schedule

### Phase 1: Foundation Docs

- Build and validate `PROJECT_BRIEF.md`
- Confirm branch model (`dev` active integration, `master` default)
- Commit checkpoint after phase

### Phase 2: Sprint Tracking

- Create sprint `plan`, `progress`, and `done` artifacts
- Add context recovery prompt in progress tracker
- Commit checkpoint after phase

### Phase 3: Brainstorm + QA Readiness

- Produce full brainstorm set with at least 2 real disagreements
- Add QA sign-off template
- Final review and commit

## Success Criteria

- [ ] `PROJECT_BRIEF.md` contains all required sections 1-14
- [ ] `docs/sprint-1/plan.md` defines tasks, owners, success criteria, and exclusions
- [ ] `docs/sprint-1/progress.md` is ready for ongoing updates
- [ ] `docs/sprint-1/done.md` exists for end-of-sprint handoff
- [ ] Brainstorm artifacts exist in `docs/brainstorm/`
- [ ] `docs/qa/sprint-1-signoff.md` exists and is usable
- [ ] Handoff and bug tracking conventions are explicit and actionable

## What's NOT in This Sprint

| Feature                        | Reason                                   |
| ------------------------------ | ---------------------------------------- |
| Product feature implementation | Sprint is process/bootstrap only         |
| Infra pipeline refactor        | Out of scope for orchestration bootstrap |
| Database schema changes        | No domain changes required               |

## Agent Prompt

> Read PROJECT_BRIEF.md, then read docs/sprint-1/plan.md. Execute Sprint 1.
>
> First: git pull origin dev && git checkout -b feature/sprint-1
>
> Close GitHub Issues in commits: "fix: description (Fixes #NN)"
> Update docs/sprint-1/progress.md after each phase.
> When done, push and create PR: git push origin feature/sprint-1
> Follow Sections 12-14 of PROJECT_BRIEF.md.
