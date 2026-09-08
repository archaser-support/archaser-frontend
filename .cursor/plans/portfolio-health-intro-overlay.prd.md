---
name: portfolio-health-intro-overlay
overview: Add a once-per-session cinematic jade progress intro over the credit portfolio health page (bar + large % counter + status lines) that loads the dashboard behind it, then fades out to reveal the real UI.
source: grill-me session (/start-work portfolio health movie-style progress overlay); percent counter grill 2026-09-08
clickup_task_url: https://app.clickup.com/t/869eygw1c
isProject: false
---

# Portfolio health intro overlay

## Problem Statement

The credit portfolio health page opens straight into charts and filters. Users want a short movie-style “upload / loading” beat—glowing progress bar, a running percentage to 100%, and staged status lines—before the existing dashboard appears, without changing real data loading or the dashboard itself.

## Solution

On first visit in a browser session, cover the portfolio health page body (under the app shell) with a light overlay: a large teal percentage counter above a jade-glow progress bar (~3–4s) and rotating status lines (health → utilisation → coverage → costs). The real dashboard continues to load behind the overlay. At 100%, the overlay fades out and the existing UI is revealed. Later visits in the same session skip the intro. Reduce-motion users skip it entirely. Testers can force a replay by clicking the page title five times. Hebrew fills the bar right-to-left; copy is translated.

## User Stories

1. As a portfolio analyst, I want a short glowing progress intro the first time I open portfolio health in a session, so that the page feels cinematic before the dashboard appears.
2. As a portfolio analyst, I want the intro to cover the page body under the app shell, so that navigation stays usable while the effect plays.
3. As a portfolio analyst, I want a jade glow on a light overlay, so that the effect matches the portfolio health design tokens.
4. As a portfolio analyst, I want status text under the bar to cycle through loading health, utilisation, coverage, and costs, so that the beat mirrors the page sections.
5. As a portfolio analyst, I want the bar to reach 100% in about 3–4 seconds, then fade out, so that the intro stays short.
6. As a portfolio analyst, I want the real dashboard to load behind the overlay, so that reveal feels instant when the intro ends.
7. As a portfolio analyst, I want the existing dashboard unchanged after the fade, so that filters, tabs, and charts work as today.
8. As a portfolio analyst, I want later visits in the same browser session to skip the intro, so that I am not delayed every time I return.
9. As a portfolio analyst with reduce motion enabled, I want the intro skipped, so that accessibility preferences are respected.
10. As a Hebrew-locale user, I want status lines in Hebrew, so that the intro matches the UI language.
11. As a Hebrew-locale user, I want the progress bar to fill from right to left, so that the motion matches RTL reading direction.
12. As an English-locale user, I want the bar to fill left to right with English status lines, so that LTR behavior stays natural.
13. As a tester, I want to click the page title five times to immediately replay the intro, so that I can re-check the effect without a lasting UI control.
14. As a tester, I want no early skip (click/Escape) during the intro, so that the full movie beat always completes once started.
15. As a product owner, I want the intro to be visual-only and not gated on real fetch completion, so that timing stays predictable.
16. As a developer, I want session “already played” stored in sessionStorage (or equivalent session scope), so that refresh in the same tab/session skips correctly and a new session plays again.
17. As a developer, I want one intro controller seam owning play/skip/replay and progress phase, so that the screen does not scatter overlay logic.
18. As a QA engineer, I want to verify once-per-session, reduce-motion skip, RTL fill, and five-click replay, so that grill decisions are regression-checked manually.
19. As a designer-aligned implementer, I want to reuse existing portfolio health jade tokens and reduced-motion helper, so that the island stays consistent.
20. As an internationalization owner, I want new strings added under the existing credit portfolio health translation namespace (EN and HE), so that copy is maintainable with the rest of the page.
21. As a portfolio analyst, I want a large teal percentage above the bar that counts smoothly toward 100% (shown as whole percents like `48%`), so that the load beat feels like a movie progress counter.

## Implementation Decisions

### Primary seam (testing and behavior)

Highest seam: a **portfolio health intro controller** (hook or small module used by the portfolio health screen) that inputs:

- whether this browser session has already played the intro
- `prefers-reduced-motion`
- locale / document direction (LTR vs RTL)
- replay intent (five title clicks)

and outputs:

- whether the overlay is active
- progress 0–100 (time-based ~3–4s)
- current status line key/index
- callbacks to mark session played and to start a forced replay

The screen mounts the real dashboard as today while the overlay is active (hidden/covered), then fades the overlay out. Prefer this single seam over scattering sessionStorage and timers across presentational components.

The **visible percentage** is presentational on the overlay: it smoothly chases the controller’s `progress` (intro-local ease), while the bar width continues to use the existing interval-based `progress`. Short visual drift between bar and number is accepted. Do not rewire the bar to a shared RAF value for this delta (avoids reintroducing Safari/React max-update-depth risk). Do not mount `StatNumber`/`BigNumber` as-is (their ~1.1s per-target ease lags behind a continuous 0→100 tick).

### Behavior

- Play once per browser session; mark played when the intro completes (or when skipped for reduce-motion so it does not surprise later if settings change mid-session—implementer may mark played on skip as well for simplicity).
- Duration ~3–4 seconds fill, then fade out; no early dismiss.
- Status sequence: health → utilisation → coverage → costs (translated).
- Visual: light overlay, jade progress fill with glow; covers page body under app shell only.
- **Percent counter:** centered above the bar; large teal Space Grotesk (~40–48px); format whole number + `%` (e.g. `48%`); intro-local smooth chase toward controller `progress`; bar keeps today’s timer; on five-click replay, snap the displayed % to `0%` immediately then chase up again; hold `100%` through the fade-out.
- Replay: five clicks on the page title / header title area immediately restarts the intro; no persistent toggle UI.
- Progress direction: LTR left→right; RTL (Hebrew) right→left.
- Cosmetic only: not tied to API load completion.
- `%` suffix is hard-coded like other CPH big numbers (no new i18n key for the counter).

### Modules

- Portfolio health screen hosts the overlay and wires title click counting.
- Intro overlay presentational component (percent + bar + glow + status text + fade).
- Intro-local percent chase helper (or inline in the overlay) — not `StatNumber`/`BigNumber` as-is.
- Session play flag (sessionStorage key scoped to portfolio health intro).
- i18n keys for the four status lines (EN + HE) — translation file edits require explicit permission at implement time.
- Reuse existing `usePrefersReducedMotion`, `SPACE_GROTESK_FONT_FAMILY`, and `CPH` jade/teal tokens; new styles only in the portfolio-health intro CSS module (ask before inventing global theme hooks).

### Non-goals for architecture

- No backend or API changes.
- No change to real loading/error/empty states of the dashboard after reveal.
- No shared frame-driven progress for bar + number in this delta (bar timer stays).

## Testing Decisions

- Good tests assert external behavior: overlay shows/hides under the agreed gates, progress completes then reveals dashboard, RTL direction, reduce-motion skip, five-click replay, visible `%` runs to `100%` and snaps to `0%` on replay. Do not assert CSS glow implementation details or exact chase easing curves.
- Primary module under test: the intro controller seam (pure helpers for session flag + phase timing if extracted).
- Prefer manual How to test on the page for visual glow/fade/percent; automated unit tests only if the user later asks for them.
- Prior art: portfolio health already uses `usePrefersReducedMotion` and island motion CSS modules for enter animations.

## Out of Scope

- Syncing intro progress to real data fetch completion
- Driving bar width from the smooth percent chase (or vice versa) for perfect lockstep
- Reusing `StatNumber`/`BigNumber` unchanged for the intro counter
- Full-viewport cover over app chrome / sidebar
- Persistent on-page toggle, URL query flags, or admin-only controls (five-click replay only)
- Early skip via click or Escape
- Changing dashboard charts, KPIs, filters, or backfill/generate flows
- Backend / reports service changes
- Automated test suite expansion unless explicitly requested
- New vertical-slice issue file for the percent counter (fold into PRD + same branch)

## Grill decision log (percent counter)

| # | Topic | Decision | Rationale / plan impact |
|---|-------|----------|-------------------------|
| D1 | Where the % sits | Above the bar, centered, large | Hero number → bar → status |
| D2 | How the number counts | Smoother count (like StatNumber) | Eased display value |
| D3 | Bar ↔ number sync | Keep bar timer; only smooth the number | Short drift OK; avoid RAF rewrite |
| D4 | Format | Whole percent + `%` (`48%`) | Round while easing |
| D5 | Counter implementation | Intro-local smooth chase toward `progress` | Avoid StatNumber 1.1s lag |
| D6 | Look | Large teal Space Grotesk ~40–48px | Matches jade load beat |
| D7 | Replay | Snap to `0%`, then chase up | Matches bar reset |
| D8 | Plan packaging | Update this PRD; no new issue file | Small delta on same branch |

## Further Notes

- ClickUp: https://app.clickup.com/t/869eygw1c
- Primary repo: `archaser-frontend`; branch `feat/CU-869eygw1c-portfolio-health-intro-overlay`
- Implementers must get explicit approval before editing translation files and before adding new global theme/CSS patterns beyond the portfolio health island.
- “Prozac effect” in the original ask maps to this cinematic progress intro (visual only).

## Issues (vertical slices)

Tracer-bullet breakdown published as commit-able markdown under `.cursor/plans/portfolio-health-intro-overlay/`. **Hard blockers** are recorded in each slice's **Blocked by** header. Implement in dependency order; start a **fresh session per issue**.

**Overview:** `.cursor/plans/portfolio-health-intro-overlay/OVERVIEW.md`

| # | Title | File | Waiting on | User stories |
|---|-------|------|------------|--------------|
| 1 | Intro overlay session gate and reveal | `issues/01-intro-overlay-session-reveal.md` | — | 1, 2, 3, 5, 6, 7, 8, 15, 16, 17 |
| 2 | Status lines, i18n, RTL, reduce-motion, title replay | `issues/02-status-i18n-rtl-replay.md` | 01 | 4, 9, 10, 11, 12, 13, 14, 18, 19, 20 |

**Slices 01–02 status:** `done` (shipped).

**Remaining on this branch (no new slice file):** none — user story **21** (percent counter) implemented in `PortfolioHealthIntroOverlay` + `useIntroPercentChase` + intro CSS module.

**Status:** percent-counter follow-on is `done` on branch `feat/CU-869eygw1c-portfolio-health-intro-overlay`.
