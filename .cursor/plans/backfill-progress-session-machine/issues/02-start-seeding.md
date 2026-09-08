# 02 — Start seeding without fake Running

**Status:** done
**Priority:** high
**Blocked by:** [01-session-idle-clear-reload](01-session-idle-clear-reload.md)
**User stories:** 3, 4, 5, 6, 19, 20, 27
**PRD:** `.cursor/plans/backfill-progress-session-machine.prd.md`

## What to build

On Start / Resume, move the session to `seeding` with a planned step list derived from enabled entities and whether clear-before-import was sent. Show Not started / Waiting with zero counts. Do not show a Record deletion spinner until the live run reports purge running or `active_step` is purge. When the real execution id appears in sync-runs, transition to `running` and bind that run. Stop/cancel must leave seeding/fake Running and settle to a finished or cleared state consistent with the sync-run.

## Acceptance criteria

- [x] Start with clear-before-import enters `seeding` including Record deletion in planned steps, counters at zero, deletion not Running until live purge/`active_step`.
- [x] Start without clear-before-import does not plan a Record deletion step in seeding.
- [x] No `pending-backfill` (or equivalent) SyncRunSummary is required for the panel to show seeding.
- [x] When sync-runs shows the new RUNNING execution, phase becomes `running` and rows bind to that run.
- [x] Resume uses the same session machine (no second progress model).

## How to test

1. Enable delete-before-import for an entity, Start backfill, watch the first 1–2 seconds. Expect planned steps with zeros; Record deletion hourglass/Not started — not a spinner — until purge progress appears.
2. Start without delete toggles. Expect no Record deletion row during seeding.
3. Confirm after Start succeeds the panel tracks the real execution id (Stop appears only for a real live run).
4. Cancel/Stop a run; expect the panel leaves seeding and shows a non-running outcome.
