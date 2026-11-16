# Architecture

## Planning pipeline

```
settings + goals + commitments + module data
        │  shared/domain/planner/build.ts   (buildPlanInput)
        ▼
PlanInput { awake windows, fixed blocks, activity requests, rest/busy days, load cap }
        │  engine.ts  (generatePlan)  → validatePlan
        ▼
replan.ts (replan) → kept items + proposed items + diff  →  preview  →  user approves  →  saved
```

* **Fixed blocks** are commitment occurrences (with travel buffers) and user-locked items. Planning never moves them. Overlapping commitments are reported as conflicts, not hidden.
* **Activity requests** come from each module: meals and care routines (per day, fixed windows), workouts (count per week, spacing group, training-load points), sport skill work, study sessions (deadline-bounded, from `school/study.ts`), and meal prep.
* The engine places requests in priority order. Busy days get the shorter `minMinutes` version. Training load per day (practices + games + workouts) is capped. Hard training is kept off game days and the day before. Anything that doesn't fit becomes an `Unscheduled` entry with a reason and a suggestion.
* `validatePlan` checks hard constraints (no overlaps including travel; inside waking hours). The server refuses to save a plan that fails it.
* **Replanning** keeps past, completed, skipped and locked items verbatim. Missed sessions are carried over only for priority ≤ 2 and at most 2 per week, so nothing snowballs into a backlog. The result is a diff (added, moved, shortened, removed). It's stored as a proposal with the plan version and applied only after the user approves; a stale proposal is rejected.
* Input changes (settings, commitments, assignments, meals) mark the plan **stale**. The UI then offers a reviewed replan instead of silently rewriting.
* Times are local wall-clock minutes per local date, so "practice at 4pm" survives DST. `time.ts` handles time-zone/DST conversion (tested on spring-forward and fall-back days).

## Deterministic vs. generated

All schedules, conflicts, unit conversions, grocery totals, grade math and age rules are deterministic code. No AI provider is called in this version, and explanations are templates. If AI is added later, it should only rephrase or explain, and anything it proposes must pass through `validatePlan` before it's shown as actionable.

## Data isolation

`server/repos/store.ts` (`UserStore`) is the only data-access path for user records. It is constructed with the session's user ID, and every statement includes `user_id = ?`. Cross-user access is tested in `tests/api.test.ts`.

## Adding a module

1. Add its settings schema to `shared/schemas` and `SETTINGS_SCHEMAS`, and add it to `MODULES` / `AVAILABLE_MODULES`.
2. Put pure logic in `shared/domain/<module>/` with tests.
3. Emit `ActivityRequest`s from `build.ts` if it needs time in the plan.
4. Add routes (gated on the module being enabled) and a feature folder in `src/features/`. Reuse form components in `src/features/forms` for both onboarding and Settings.
