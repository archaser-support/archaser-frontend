# 04 — Deferred AR drain phase

**Status:** ready-for-agent
**Priority:** normal
**Blocked by:** [03-live-steps-and-counts](03-live-steps-and-counts.md)
**User stories:** 15, 16
**PRD:** `.cursor/plans/backfill-progress-session-machine.prd.md`

## What to build

When the bound sync-run is finished but connector config still reports pending AR post-ingest customers, set session phase to `deferred_drain`. Only AR-related progress steps may look live/queued; other steps stay Done/Not started from the finished run. When the pending count hits zero, move to `finished`. Reset/Clear still forces `cleared`.

## Acceptance criteria

- [ ] Finished run + pending AR customers above zero → `deferred_drain` (not full-pipeline Running).
- [ ] Only AR replay / related drain steps can show live progress in that phase.
- [ ] Queue zero → `finished`.
- [ ] Reset/Preview from deferred_drain still clears the panel.

## How to test

1. After a backfill that leaves customers on the AR post-ingest queue, open Backfill progress. Expect deferred-drain behavior: AR steps may still update; earlier import steps stay Done; header/actions are not “full Running import”.
2. Wait or drain until pending customers are zero. Expect finished.
3. From a deferred-drain state, Reset or Preview. Expect cleared panel.
