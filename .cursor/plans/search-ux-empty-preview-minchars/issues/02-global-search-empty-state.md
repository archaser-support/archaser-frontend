# 02 — Global search empty-state below the field

**Status:** done
**Priority:** high
**Blocked by:** —
**User stories:** 1, 2, 17
**PRD:** `.cursor/plans/search-ux-empty-preview-minchars.prd.md`

## What to build

Fix global search so the “No results found” panel never overlaps or covers the search TextField. The empty panel must sit fully below the input in all major browsers (including Safari and Chrome), on desktop and narrow viewports.

Prefer fixing Popper / placement / offset / measurement logic over new decorative styles.

## Acceptance criteria

- [x] No-match query shows empty state below the field; the TextField remains visible and editable
- [x] Verified in Safari and Chrome (or documented equivalent WebKit + Chromium check)
- [x] Narrow/mobile width does not cover the field
- [x] Existing no-results copy and tips still render; if copy changes, EN+HE locales update together

## How to test

1. Open header global search (prefer Safari for the reported case; also check Chrome).
2. Type a query with no matches (e.g. `zzzzznotfound`).
3. Confirm the “No results found” panel sits below the search field and does not cover it.
4. Click/tap into the field and edit the query without dismissing via guesswork.
5. Repeat at a narrow viewport width.
