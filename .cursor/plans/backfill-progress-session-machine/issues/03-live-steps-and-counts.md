# 03 — Live steps from backend + same-run counts

**Status:** ready-for-agent
**Priority:** high
**Blocked by:** [02-start-seeding](02-start-seeding.md)
**User stories:** 7, 8, 9, 18, 24, 25, 29
**PRD:** `.cursor/plans/backfill-progress-session-machine.prd.md`

## What to build

While `phase` is `running` / `finishing`, drive step Running/Done/Waiting from backend `active_step` and per-step `status` only — drop client frontier heuristics and `expectDeletingStep` after bind. Prefer bound-run `entity_stats` for counts; use `sync_states` checkpoints only when they belong to the same live execution. Harden backend progress patches so purge, entity types, link-payments, and AR tail keys expose reliable `status`, and clear or advance `active_step` when a step completes.

Frontend primary; create the same branch name in the backend repo when touching progress patches.

## Acceptance criteria

- [ ] Only one step shows Running at a time, matching `active_step` / status.
- [ ] After bind, client does not keep Record deletion Running via expect-purge flags.
- [ ] Counts for cleared/seeding stay zero; live counts prefer entity_stats; checkpoints only for same-run.
- [ ] Backend patches set per-step status for the pipeline keys used by the panel; finished steps do not stick via stale `active_step`.

## How to test

1. Start a backfill (with or without purge). Confirm the Running step tracks the server (e.g. moves from Record deletion to Payment/Invoice) without stuck deletion.
2. Reload mid-import. Expect re-attach to RUNNING and correct active step/counts (not all zeros unless the server has no stats yet).
3. Confirm earlier steps show Done with this-run counts; later steps Waiting until reached.
