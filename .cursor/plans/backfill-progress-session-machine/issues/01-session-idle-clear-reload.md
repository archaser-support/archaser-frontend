# 01 — Session machine: idle, clear, reload

**Status:** ready-for-agent
**Priority:** high
**Blocked by:** —
**User stories:** 1, 2, 10, 11, 12, 13, 14, 17, 21, 22, 23, 26, 28, 31, 32
**PRD:** `.cursor/plans/backfill-progress-session-machine.prd.md`

## What to build

Introduce the canonical progress session (`phase` + optional `executionId`) and a single resolver seam. Wire Billing Integration so:

- Idle shows the last finished sync-run only (or empty after clear)—never a planned Record deletion row from delete-before-import toggles alone.
- Reset backfill, Run preview, and orphan execution ids missing from fetched sync-runs move the session to `cleared` (empty / zero counts, no bound id).
- Reload trusts the server: RUNNING in sync-runs → `running`; otherwise idle/cleared/finished per resolver — never invent Running from sessionStorage alone.
- Remove (or stop using) fake sync-run placeholders and peer flags for this path.

Prototype shape:

```text
phase: idle | seeding | running | finishing | deferred_drain | finished | cleared
```

## Acceptance criteria

- [ ] One resolver owns panel phase + bound run for idle / cleared / reload.
- [ ] Delete-before-import toggles on with no live run do not show Record deletion as Running.
- [ ] Reset and Preview clear the panel (zeros / empty) and drop the bound execution.
- [ ] Stale sessionStorage execution missing after sync-runs fetch does not create a fake Running run.
- [ ] Start remains enabled when the panel is idle or cleared (no placeholder busy).

## How to test

1. Open Admin → Account → Billing Integration → Backfill progress with delete-before-import on and no live import. Expect last finished run or empty — not Record deletion Running.
2. In DevTools, set a stale `billing-backfill-progress:{accountId}` execution id, reload. Expect idle/cleared — not a spinner on Record deletion.
3. Click Reset backfill (confirm). Expect cleared empty / zeroed steps.
4. Run Preview. Expect the same cleared panel behavior.
