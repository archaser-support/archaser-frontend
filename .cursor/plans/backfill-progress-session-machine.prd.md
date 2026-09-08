---
name: backfill-progress-session-machine
overview: Replace ad-hoc backfill progress flags and fake sync runs with one explicit session phase machine so steps clear correctly and idle never looks like a live import.
source: grill-me session (admin billing backfill progress / Record deletion stuck Running)
clickup_task_url: https://app.clickup.com/t/869ey85u5
isProject: false
---

# Backfill progress session machine

## Problem Statement

On the account Billing Integration Settings page, the Backfill progress panel often looks like an import is running or half finished when nothing is importing. Record deletion can show a spinner or hourglass, old Payment/Invoice Done counts can appear next to Waiting tail steps, and a page reload can resurrect a fake “pending” run from browser storage. Analysts cannot trust the panel, and Start / Reset / Preview do not share one clear rule for wiping or binding steps.

## Solution

Introduce a single **backfill progress session** with an explicit phase (`idle`, `seeding`, `running`, `finishing`, `deferred_drain`, `finished`, `cleared`). The panel reads only that session plus the bound sync-run (and config for deferred AR drain). Fake sync-run ids and peer React flags go away. Idle shows the last real finished run (or empty after clear)—never a planned Record deletion row from delete-before-import toggles. Start enters `seeding` with a planned step list and zero counts (no fake Running spinner). Live step Running/Done comes from the backend `active_step` and per-step status. Reset, Preview, and orphaned executions move the session to `cleared` (empty / zeroed steps). Small backend hardening ensures each pipeline step reports status so the UI does not need client frontier heuristics.

## User Stories

1. As an analyst, I want the progress panel to show idle or last finished results when no import is running, so that I am not misled into thinking work is in progress.
2. As an analyst, I want Record deletion to appear only when Start actually requested clear-before-import (or the live run reports purge), so that delete toggles alone do not invent a live or waiting deletion step.
3. As an analyst, I want delete-before-import toggles to still affect the Start confirm dialog and Start payload, so that purge behavior is unchanged at Start time.
4. As an analyst, I want Start to show the planned step list immediately with Not started / Waiting and zero counts, so that I see what will run without a fake spinner.
5. As an analyst, I want Record deletion to spin only when the live run reports purge running (or `active_step` is purge), so that “0 deleted” with a spinner never appears with no server process.
6. As an analyst, I want the panel to switch to the real execution as soon as Start returns an execution id and sync-runs shows it, so that seeding is brief.
7. As an analyst, I want only one step to look Running at a time while the import is live, driven by the backend, so that steps do not stick or jump from client guesses.
8. As an analyst, I want earlier steps to show Done with correct counts for this run, so that I can track pipeline progress.
9. As an analyst, I want later steps to show Waiting until the backend reaches them, so that the full pipeline is visible without looking finished.
10. As an analyst, I want Reload during a live import to re-attach to the RUNNING sync-run from the server, so that progress continues after refresh.
11. As an analyst, I want Reload when nothing is running and no finished run is bound to show idle or cleared—not a resurrected fake Running run from sessionStorage.
12. As an analyst, I want Reset backfill to clear the progress panel (empty or all Not started with zeros) and drop the bound execution, so that the UI matches a reset account.
13. As an analyst, I want Run preview to clear the progress panel the same way, so that preview does not leave a half-finished looking step list.
14. As an analyst, I want an execution that aged out of sync-runs to clear the client session automatically, so that orphan storage cannot keep the panel in a fake live state.
15. As an analyst, I want a finished run with pending AR post-ingest customers to show a distinct deferred-drain state where only AR-related steps can still look live, so that I understand worker drain without treating the whole pipeline as Running.
16. As an analyst, I want deferred drain to become finished when the pending AR queue hits zero, so that the panel settles.
17. As an analyst, I want cleared and seeding phases to always show zero counts, so that old sync_state checkpoints never paint Done bars on an idle or just-started panel.
18. As an analyst, I want live counts to prefer the bound run’s entity_stats, and use sync_state checkpoints only when they belong to the same live execution, so that mid-run reloads do not flash zeros unnecessarily and do not mix prior runs.
19. As an analyst, I want Stop / cancel to move the session to a non-running finished or clearing state consistent with the sync-run outcome, so that Stop does not leave seeding or fake Running.
20. As an analyst, I want Resume to bind the live or resumed execution under the same session machine, so that Resume does not invent a second progress model.
21. As a developer, I want one resolver for session phase and display model, so that Billing Integration Settings does not keep parallel decision trees.
22. As a developer, I want to remove fake sync-run placeholders (`pending-backfill`, `progress-reset`) as SyncRunSummary stand-ins, so that run types stay server-shaped.
23. As a developer, I want peer flags (`pendingBackfillReset`, `progressUiReset`, `expectDeletingStep`, held run, last-live ref) folded into the session phase, so that clear and bind have one code path.
24. As a developer, I want backend progress patches to set per-step status for purge, entities, link payments, and AR tail, so that the UI can drop frontier heuristics.
25. As a developer, I want `active_step` cleared when a step finishes, so that the UI does not keep a finished step as Running.
26. As a QA engineer, I want to open Billing Integration with delete-before-import on and no live run and see last finished (or empty)—never Record deletion Running, so that the original bug is regression-tested.
27. As a QA engineer, I want to Start with clear-before-import and see seeding without a deletion spinner until purge reports, so that Start-gap behavior is regression-tested.
28. As a QA engineer, I want Reset and Preview to empty the step list / zero counts, so that clear behavior is regression-tested.
29. As a QA engineer, I want reload mid-import to continue on the server RUNNING run, so that D6 is regression-tested.
30. As a product owner, I want sync history grid behavior left as-is, so that this work stays scoped to the Backfill progress panel and its session.
31. As an ops engineer, I want action busy gating (Start disabled while truly live) to follow session phase + real sync-run activity—not placeholder runs—so that Start stays usable when the panel is idle or cleared.
32. As a developer, I want unit tests at the session resolver seam, so that phase transitions are proven without driving the full React page.

## Implementation Decisions

### Primary seam (testing and behavior)

Highest seam: a pure **progress session resolver** (new or extended module beside existing backfill progress helpers) that inputs:

- sync-runs list (and fetch/settled flag)
- connector config snapshots needed for deferred AR pending count and same-run checkpoints
- persisted session hint (execution id / phase)
- Start/Preview/Reset intents

and outputs:

- canonical `BackfillProgressSession` (`phase`, optional `executionId`, optional `plannedSteps` / `expectPurge` for seeding only)
- the bound run summary when applicable (real server run only)
- display rows / header inputs derived from phase + bound run

Billing Integration Settings and the progress host consume that output only. Prefer this single seam over testing React flag combinations.

Prototype shape (decision-rich, from grill-me):

```text
BackfillProgressSession {
  phase: idle | seeding | running | finishing | deferred_drain | finished | cleared
  executionId?: string
  plannedSteps?: StepKey[]
  expectPurge?: boolean  // seeding only; never forces Running after bind
}
```

### Locked product rules (grill-me D1–D9)

- **D1** — Explicit session machine owns the panel; no fake sync-run ids.
- **D2** — Idle shows last finished run only; delete-before-import toggles do not add a planned Record deletion row until Start.
- **D3** — Reset backfill, Run preview, and orphan missing execution → `cleared` empty panel (zeros / no bound id).
- **D4** — Start gap is `seeding`: planned steps, Not started / Waiting, zero counts; spinner only after live purge / `active_step`.
- **D5** — While live, Running step from backend `active_step` + per-step `status` only; drop `expectDeletingStep` and client frontier after bind.
- **D6** — Reload: server wins; never invent Running from sessionStorage alone.
- **D7** — Finished run + pending AR post-ingest customers → `deferred_drain`; only AR-related steps may stay live; then `finished`.
- **D8** — Counts: live bound-run `entity_stats` first; `sync_states` only for the same live execution; `cleared` / `seeding` / idle-without-finished always zero for the cleared path.
- **D9** — Frontend machine plus small backend hardening so each pipeline key gets reliable `status` (and `active_step` clears on step completion).

### Frontend modules

- Collapse display resolution into the session resolver; remove dual trees (`resolveBackfillProgressRun` vs Settings `displayProgressRun` vs `resolveDisplayBackfillProgressRun` as competing owners).
- Persist a slim session hint compatible with D6 (execution id + phase); treat storage as hint only.
- Map phases to existing row builders where possible; stop building rows from placeholder SyncRunSummary objects.
- Keep clear-before-import prefs in local storage for Start confirm/payload only (unchanged product for purge on Start).

### Backend modules

- Harden in-process progress patches so purge, entity types, link-payments (maturity), and AR tail keys expose `status` consistently.
- Ensure `active_step` is set while a step runs and cleared (or advanced) when that step completes, matching existing tail-step behavior.

### Discovery gates

| Gate | If Yes | If No |
|------|--------|-------|
| Entity keys already get reliable `status` on every progress patch | Frontend maps 1:1 | Backend hardening required before dropping all heuristics |
| Sync-runs always includes the new execution soon after Start | Short `seeding` | Keep `seeding` until id appears; still never fake RUNNING |

## Testing Decisions

Good tests assert **external behavior** of the session resolver and (where needed) progress patches: given sync-runs + config + session + intent, which phase, bound execution, and step phases/counts the panel model exposes. Do not assert internal React flag names.

### Primary seam under test

`resolveBackfillProgressSession` (name may vary) — pure inputs → session + display model. This is the preferred single seam.

### Backend seam (D9)

Progress patch / `entity_stats` + `active_step` contract for a representative Start-with-purge → entity → maturity → tail sequence (unit or existing sync progress tests). Prefer extending existing billing-connector sync progress tests over new end-to-end ERP runs.

### Prior art

- Frontend: `backfillImportProgress` unit tests (optimistic merge, active_step mapping, session resolve).
- Backend: connector sync runtime / in-process progress patch tests.

### Behavioral cases to cover at the seam

1. Idle, delete toggles on, no RUNNING run → not seeding/running; no Record deletion Running; last finished or empty per D2/D3.
2. Stale sessionStorage execution missing from sync-runs after fetch → `cleared` / idle; no fake Running.
3. Start with purge → `seeding` with deletion in planned steps, zero counts, deletion not Running until live purge status/`active_step`.
4. Live run with `active_step` past purge → deletion Done (or not Running); active entity Running.
5. Reset / Preview intent → `cleared`, zero counts, no execution id.
6. Finished run + pending AR customers above zero → `deferred_drain`; queue zero → `finished`.
7. Reload with RUNNING in sync-runs → `running` bound to that id.

## Out of Scope

- Redesign of the sync history grid or history export.
- Changing clear-before-import preference UX beyond “no idle planned Record deletion row” (toggles, customer picker, confirm copy stay as today except panel idle behavior).
- New Mongo collections or server-side “UI session” persistence beyond existing sync-runs / sync_states / pending AR config fields.
- Full rewrite of entity import / ERP pull logic.
- Translating progress strings / i18n pass (unless a touched string already requires it under existing rules).
- Broad visual redesign of the progress accordion (icons/layout) beyond correct phase mapping.

## Further Notes

- Grill-me locked A for D1–D9 in one session (answers given as “1” = recommended option each time).
- Partial mitigations already landed in the frontend (stop inventing pending-backfill from stale session; idle reset zeros; planned deletion as not_started) are stopgaps; this PRD replaces that patchwork with the session machine.
- Primary repo for implementation is the frontend; backend changes are limited to progress status/`active_step` hardening (D9).
- ClickUp: https://app.clickup.com/t/869ey85u5

## Issues (vertical slices)

Tracer-bullet breakdown published as commit-able markdown under `.cursor/plans/backfill-progress-session-machine/`. **Hard blockers** are recorded in each slice's **Blocked by** header. Implement in dependency order; start a **fresh session per issue**.

**Overview:** `.cursor/plans/backfill-progress-session-machine/OVERVIEW.md`

| # | Title | File | Waiting on | User stories |
|---|-------|------|------------|--------------|
| 1 | Session machine: idle, clear, reload | `issues/01-session-idle-clear-reload.md` | — | 1, 2, 10–14, 17, 21–23, 26, 28, 31, 32 |
| 2 | Start seeding without fake Running | `issues/02-start-seeding.md` | 01 | 3–6, 19, 20, 27 |
| 3 | Live steps from backend + same-run counts | `issues/03-live-steps-and-counts.md` | 02 | 7–9, 18, 24, 25, 29 |
| 4 | Deferred AR drain phase | `issues/04-deferred-drain.md` | 03 | 15, 16 |

**Status:** `ready-for-agent` on all slices.
