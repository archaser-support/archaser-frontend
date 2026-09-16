# 02 — Utilization + monthly charts

**Status:** done
**Priority:** normal
**Blocked by:** [01-shared-trim-daily-health](01-shared-trim-daily-health.md)
**User stories:** 2, 3, 4, 8
**PRD:** `.cursor/plans/portfolio-health-trim-leading-empty-days.prd.md`

## What to build

Apply the same shared leading-empty trim to **Daily avg. utilization**, **monthly health**, and **costs monthly**. Each chart trims from its own series only.

## Acceptance criteria

- [ ] Daily avg. utilization trims leading empty days from its own series
- [ ] Monthly health trims leading empty months from its own series
- [ ] Costs monthly trims leading empty months from its own series
- [ ] Charts do not force a shared start across tabs/series
- [ ] No KPI or filter/URL behavior changes

## How to test

1. Same late-start range as slice 01.
2. Utilization tab: Daily avg. utilization starts at that series’ first day with data (may differ from health).
3. Health monthly chart: first month shown is the first month with a monthly point (no empty leading months).
4. Costs tab monthly chart: same month trim rule for its series.
5. Confirm KPI cards and days-available footnote still behave as before.
