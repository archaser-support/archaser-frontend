---
name: search-ux-empty-preview-minchars
overview: Fix global search empty-state overlap and Hebrew preview pane side, and align toolbar/TableSearch with a shared ≥2 character search policy.
source: grill-me session /start-work CU-869ezrkw8
clickup_task_url: https://app.clickup.com/t/869ezrkw8
isProject: false
---

# Search UX — empty state, Hebrew preview pane, min characters

## Problem Statement

Users hit three related search problems:

1. When global search has no matches, the “No results found” panel can cover the search field (seen on Safari; may not be Safari-only).
2. List toolbars that use EndlessScrollToolbar (and older TableSearch grids) do not follow the same “start after enough characters” rule as global search, so short typing can trigger noisy or premature filtering.
3. For some Hebrew queries (e.g. `ארז`), the global search detail preview pane appears on the wrong side of the results list, while other Hebrew queries (e.g. `סער`) look correct. The intended layout for Hebrew queries is preview **left** of the results list.

## Solution

Ship a frontend-only fix that:

- Keeps the empty-state panel fully below the global search field in all major browsers.
- Makes Hebrew-query preview chrome consistent: preview pane stays to the **left** of the results list (same as the working `סער` case).
- Introduces a **shared** search policy helper (minimum length ≥ 2, clear when under 2) and a shared **200ms** debounce constant; wire it into EndlessScrollToolbar (search as you type) and TableSearch (force 200ms + same min-length rules).

## User Stories

1. As a collector, I want the “No results found” panel not to cover the search box, so that I can edit my query without closing or guessing where the field is.
2. As a collector on Safari, I want empty-state positioning to work the same as on Chrome, so that browser choice does not break search.
3. As a collector searching in Hebrew, I want the detail preview pane to open to the left of the results list, so that layout stays predictable for every Hebrew term.
4. As a collector searching `סער`, I want the current correct preview side preserved, so that a fix for `ארז` does not regress working cases.
5. As a collector searching `ארז`, I want the preview pane on the same side as `סער`, so that mixed Hebrew names do not flip the chrome.
6. As a collector with English UI typing Hebrew, I want preview geometry to follow the query script, so that English chrome labels do not force an English layout.
7. As a collector on a list with EndlessScrollToolbar, I want search to start only when I have typed at least two characters, so that one-letter typing does not reload the grid.
8. As a collector on EndlessScrollToolbar, I want search to run as I type after two characters (with a short pause), so that I do not have to press Enter for every query.
9. As a collector who deletes back to one character, I want the list filter to clear, so that the grid returns to the unfiltered state.
10. As a collector who clears the search field, I want the filter to clear immediately, so that I can reset without waiting for debounce.
11. As a collector on a grid that still uses TableSearch, I want the same ≥2 and clear-under-2 rules, so that list search feels consistent.
12. As a collector on TableSearch screens, I want the typing pause to be 200ms like global search, so that feedback speed matches the header search.
13. As a developer, I want one shared function for “should this term search?”, so that min-length policy is not copied in three places.
14. As a developer, I want a shared debounce constant for this policy, so that EndlessScrollToolbar and TableSearch stay aligned.
15. As a QA reviewer, I want concrete How to test steps for empty state, Hebrew preview, and min-length, so that staging verification is repeatable.
16. As a Hebrew-locale user, I want any new or changed search tips/empty copy updated in English and Hebrew together, so that locale parity holds (only if copy changes).
17. As a mobile user, I want empty-state not to cover the field on narrow viewports, so that touch editing still works.
18. As a collector who presses Enter with one character in the toolbar, I want that not to apply a one-character filter, so that the ≥2 rule is not bypassed.
19. As a collector who clicks the toolbar search icon with one character, I want the same ≥2 gate, so that icon submit matches typing policy.
20. As a collector opening recent/last results in global search with an empty field, I want that flow unchanged, so that min-length work does not break “show last results”.

## Implementation Decisions

- **Primary repo:** frontend only for this task.
- **Scope package:** one ClickUp task covering empty-state overlap, Hebrew preview pane side, and shared min-character search policy for EndlessScrollToolbar + TableSearch.
- **Hebrew preview (locked):** for Hebrew queries, the detail preview pane must sit to the **left** of the results list; fix intermittent wrong-side cases (e.g. `ארז`) without changing the intended left-side design.
- **Not in scope for the Hebrew bug:** entity icon vs title inside the preview header (grill decided the bug is the whole pane vs list).
- **Empty state (locked):** fix for all browsers; empty panel must sit fully below the TextField; verify Safari and Chrome.
- **Shared policy (locked):** one shared function owns “term is searchable” (`trim().length >= 2`) and clear-when-under-2 behavior for toolbar/TableSearch; force **200ms** debounce for EndlessScrollToolbar and TableSearch (including call sites that previously used 500/1000).
- **EndlessScrollToolbar (locked):** search as you type when ≥ 2; under 2 clears the applied filter; empty clear remains immediate.
- **TableSearch (locked):** add the same ≥2 / clear-under-2 rules; change default/effective debounce to 200ms via the shared constant.
- **Global search min length:** already `>= 2` for the API query; do not change product threshold; optionally reuse the shared helper where it reduces duplication without changing empty-input / last-results behavior.
- **i18n:** only if user-facing strings change; then update English and Hebrew locale files in the same change.
- **No schema/API changes** expected for this UX fix.
- **Styling:** prefer fixing Popper/placement/alignment logic over new visual styles; do not invent new theme styles without approval.

## Testing Decisions

- Prefer manual / exploratory verification on staging or local; do not add automated tests unless explicitly requested.
- **Seam A — GlobalSearch empty state:** type a no-match query → panel below field, field still editable (Safari + Chrome).
- **Seam B — GlobalSearch Hebrew preview:** compare `סער` vs `ארז` with preview open → preview left of results for both.
- **Seam C — EndlessScrollToolbar:** 1 char no filter; 2+ chars filters after ~200ms; delete to 1 clears; clear icon clears immediately.
- **Seam D — TableSearch:** same ≥2 / clear-under-2 / 200ms on a screen that still uses TableSearch.
- Good tests assert user-visible behavior (filter applied or not, pane side, overlap), not internal React state.

## Out of Scope

- Changing the Hebrew preview **icon** vs title row layout (unless a pane fix accidentally requires a tiny related tweak).
- Forcing all other app autocompletes (customer pickers, etc.) onto the shared helper in this task.
- Backend search ranking / Hebrew tokenization changes.
- Automated test suite expansion (unless later requested).
- ClickUp status `done` (human-owned after deploy).

## Further Notes

### Decision log (grill)

| # | Topic | Decision |
|---|-------|----------|
| D1 | Wrong side for `ארז` | Whole preview pane vs results list |
| D2 | Correct Hebrew preview side | Left of the results list |
| D3 | Empty-state overlap | Fix for all browsers |
| D4 | Toolbar min chars | Same as global: `>= 2` |
| D5 | Toolbar fire mode | As you type when ≥ 2 |
| D6 | Under 2 chars | Clear the search filter |
| D7 | EndlessScroll debounce | 200ms |
| D8 | Scope | EndlessScrollToolbar + TableSearch |
| D9 | TableSearch debounce + share | Force 200ms; shared function for policy |

### Issues (vertical slices)

See `.cursor/plans/search-ux-empty-preview-minchars/OVERVIEW.md` and `issues/`.
