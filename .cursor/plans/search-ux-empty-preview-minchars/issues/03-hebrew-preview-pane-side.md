# 03 — Hebrew query preview pane side

**Status:** done
**Priority:** high
**Blocked by:** —
**User stories:** 3, 4, 5, 6, 20
**PRD:** `.cursor/plans/search-ux-empty-preview-minchars.prd.md`

## What to build

Make global search detail preview pane geometry consistent for Hebrew queries: the preview pane must sit to the **left** of the results list (same as the working `סער` case). Fix intermittent wrong-side cases such as `ארז`.

Do not change the intended product rule (Hebrew query → preview left). Empty-input / last-results flows should remain intact. Icon-vs-title header quirks are out of scope unless a tiny related tweak is required for the pane fix.

## Acceptance criteria

- [x] Searching `סער`, opening a result preview → preview pane is left of the results list
- [x] Searching `ארז`, opening a result preview → preview pane is left of the results list (same as `סער`)
- [x] English UI + Hebrew query still uses Hebrew-query chrome (preview left), not English pane side
- [x] Empty / last-results global search behavior unchanged

## How to test

1. Use English UI if available; open header global search.
2. Search `סער`, hover/select a customer result so the preview opens → preview must be left of the results list.
3. Clear and search `ארז`, open a result preview → preview must be left of the results list (not flipped vs step 2).
4. Spot-check one Latin query → preview remains on the English (right) side of the list.
