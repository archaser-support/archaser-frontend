---
name: portfolio-health-trim-leading-empty-days
overview: Trim empty leading days/months from portfolio health time charts so the x-axis starts at the first series point, without changing the user’s date filter or KPI math.
source: grill-me session (/start-work portfolio health trim empty leading days)
clickup_task_url: https://app.clickup.com/t/869eyq4hg
isProject: false
---

# Portfolio health — trim leading empty days

## Problem Statement

On Credit Portfolio Health, a wide filter (for example This Year) often starts before the first day that has snapshot data. Daily and monthly charts pad the full filter range, so the left side of the chart shows blank days (or months) before anything useful appears. That makes trends harder to read. Users expect charts to start where data starts, while keeping the filter they picked.

## Solution

Keep the date filter and URL as the user set them. For every portfolio-health time chart that pads the filter range today, after padding, drop empty slots before the first point that has data for that chart’s own series. Keep gaps in the middle and empty slots after the last point. KPI cards stay unchanged (they already use available snapshot days).

## User Stories

1. As a portfolio analyst, I want the Daily avg. health chart to start on the first day with a health point, so that empty leading days do not waste the x-axis.
2. As a portfolio analyst, I want the Daily avg. utilization chart to start on the first day with a utilization point, so that utilization history is readable when backfill starts mid-range.
3. As a portfolio analyst, I want the monthly health chart to start on the first month with a monthly point, so that empty leading months are not shown.
4. As a portfolio analyst, I want the costs monthly chart to start on the first month with a cost point, so that cost history matches the same trim rule.
5. As a portfolio analyst, I want the date range picker and URL to stay as I set them, so that trimming charts does not rewrite my filter.
6. As a portfolio analyst, I want middle missing days to stay as blank slots, so that gaps in history remain visible.
7. As a portfolio analyst, I want trailing empty days after the last point to stay on the chart, so that incomplete recent history is still obvious.
8. As a portfolio analyst, I want each chart to trim from its own series, so that health can start earlier than utilization when those series differ.
9. As a portfolio analyst, I want “has data” to mean any point already returned for that day/month, so that chart start matches the series the API already sent.
10. As a portfolio analyst, I want Lowest health and other KPI cards to keep today’s available-day math, so that card values do not change because of chart padding.
11. As a portfolio analyst, I want the days-available footnote to keep reporting selected range vs available days as today, so that coverage of the filter stays clear.
12. As a Hebrew-locale user, I want trim behavior identical in RTL, so that only layout direction differs, not which days appear.
13. As a QA engineer, I want a This Year range with first data mid-January to show charts starting at that first day/month, so that the grill example is easy to verify.
14. As a QA engineer, I want a range that already starts on a day with data to look unchanged, so that trim is a no-op when there is nothing to drop.
15. As a developer, I want one shared trim rule next to the existing pad helpers, so that all charts share one definition of leading empty slots.
16. As a product owner, I want no backend or API contract change for this work, so that the fix stays frontend-only.

## Implementation Decisions

### Primary seam (testing and behavior)

Highest seam: the portfolio health date-range padding helpers (day and month). Extend or wrap them so padded series can drop leading `null` points until the first non-null point, then keep the rest of the padded window (including middle nulls and trailing nulls) through the filter end (as already clamped for future dates by existing end clamp).

Inputs: points for one chart, filter `from`/`to` (or equivalent already used by pad). Output: padded series with leading empties removed. Empty input series stays empty (no axis), same as today’s pad behavior.

Charts should keep calling the shared helpers; they should not each invent a different trim.

### Scope of charts

Apply the same rule to all current padded portfolio-health time charts:

- Daily avg. health
- Daily avg. utilization
- Monthly health
- Costs monthly

### Grill-locked product rules

- Charts only — do not change the date filter, URL, or request `from`/`to`.
- Trim leading empties only.
- Keep middle gaps as blank slots.
- Keep trailing empties.
- “Has data” = first day/month present in that chart’s API series (non-null after pad).
- Each chart trims independently from its own series.
- KPI cards and days-available meta are out of this change’s behavior surface (already available-day based / informational).

### Frontend-only

No API, snapshot generation, or backend date-range changes in this feature.

## Testing Decisions

- Prefer testing the shared pad/trim seam’s external behavior: given points and a from/to window, leading nulls are gone, middle/trailing nulls remain, empty input stays empty.
- Manual How to test on the live page covers chart wiring (This Year with late first snapshot; range that already starts on data; utilization vs health if first days differ).
- Do not add or expand automated tests unless explicitly requested later.
- Prior art: existing portfolio health date-range helpers and chart padding usage on the credit portfolio health page.

## Out of Scope

- Changing KPI formulas (Lowest health, averages, % days below threshold, etc.)
- Auto-updating the date picker or URL to the first day with data
- Dropping middle gaps or connecting lines across missing days
- Trimming trailing empty days
- Backend/API changes, generate/backfill job behavior
- Intro overlay or other unrelated portfolio health UI work
- Translation file changes (unless a later copy change is explicitly approved)

## Further Notes

ClickUp: https://app.clickup.com/t/869eyq4hg  
Branch (primary repo `archaser-frontend`): `feat/CU-869eyq4hg-trim-leading-empty-days`

Intro-overlay WIP for a prior task was stashed on `feat/CU-869eygw1c-portfolio-health-intro-overlay` as `stash@{0}` before this branch was cut from `staging`.

## Issues (vertical slices)

Tracer-bullet breakdown published as commit-able markdown under `.cursor/plans/portfolio-health-trim-leading-empty-days/`. **Hard blockers** are recorded in each slice's **Blocked by** header. Implement in dependency order; start a **fresh session per issue**.

**Overview:** `.cursor/plans/portfolio-health-trim-leading-empty-days/OVERVIEW.md`

| # | Title | File | Waiting on | User stories |
|---|-------|------|------------|--------------|
| 1 | Shared trim + Daily avg. health | `issues/01-shared-trim-daily-health.md` | — | 1, 5, 6, 7, 9, 15 |
| 2 | Utilization + monthly charts | `issues/02-utilization-monthly-charts.md` | 01 | 2, 3, 4, 8 |

**Status:** `ready-for-agent` on all slices unless the user specified otherwise.
