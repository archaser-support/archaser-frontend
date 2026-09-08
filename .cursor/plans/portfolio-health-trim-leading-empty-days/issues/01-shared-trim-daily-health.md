# 01 — Shared trim + Daily avg. health

**Status:** ready-for-agent
**Priority:** high
**Blocked by:** —
**User stories:** 1, 5, 6, 7, 9, 15
**PRD:** `.cursor/plans/portfolio-health-trim-leading-empty-days.prd.md`

## What to build

Add a shared leading-empty trim on the portfolio health day/month pad helpers (or a thin wrapper used by them). Wire **Daily avg. health** so its x-axis starts at the first day with a health series point. Filter dates unchanged; middle and trailing blanks stay.

## Acceptance criteria

- [ ] Padded day series drops only leading null slots before the first non-null point
- [ ] Middle and trailing null slots remain through the filter end
- [ ] Empty series input still produces an empty chart (no axis)
- [ ] Daily avg. health uses the shared rule
- [ ] Date picker / URL `from`/`to` unchanged by this behavior

## How to test

1. Open Credit Portfolio Health with a range that starts before the first health snapshot (e.g. This Year when data starts mid-January).
2. On the Health tab, confirm Daily avg. health’s first x-axis day is the first day with data (not Jan 1 blanks).
3. If a middle day is missing later in the range, confirm a blank gap remains.
4. Confirm the date filter still shows the original range.
5. Pick a range that already starts on a day with data — chart should look the same as before (no trim needed).
