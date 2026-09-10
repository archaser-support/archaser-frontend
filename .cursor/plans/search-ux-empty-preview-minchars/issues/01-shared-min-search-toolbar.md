# 01 — Shared min-search policy + toolbar/TableSearch

**Status:** done
**Priority:** high
**Blocked by:** —
**User stories:** 7, 8, 9, 10, 11, 12, 13, 14, 18, 19
**PRD:** `.cursor/plans/search-ux-empty-preview-minchars.prd.md`

## What to build

Introduce a shared search policy helper (and shared 200ms debounce constant) that answers whether a term should run a search (`trim().length >= 2`) and drives clear-when-under-2.

Wire EndlessScrollToolbar to search as you type with that policy and 200ms debounce (clear filter when under 2; clear icon / empty still clears immediately; Enter and search-icon submit must not bypass the ≥2 gate except for clearing).

Wire TableSearch to the same helper and force 200ms debounce everywhere it is used (replace prior 500/1000 effective waits).

## Acceptance criteria

- [x] Shared function owns “should search” / under-2 clear policy; EndlessScrollToolbar and TableSearch both call it
- [x] Shared 200ms debounce constant used by EndlessScrollToolbar and TableSearch
- [x] EndlessScrollToolbar: 1 character does not filter; ≥2 filters after ~200ms; delete to 1 clears; empty clear is immediate
- [x] Enter / search icon with 1 character does not apply a 1-character filter
- [x] TableSearch screens follow the same ≥2 / clear-under-2 / 200ms rules
- [x] No unrelated search UIs changed unless required to share the helper

## How to test

1. Open a list that uses EndlessScrollToolbar search (e.g. customers or invoices endless grid).
2. Type 1 character and wait → grid must not apply a new 1-character filter.
3. Type a second character and wait ~200ms → filter applies.
4. Delete back to 1 character → filter clears.
5. Clear the field with the clear control → filter clears immediately.
6. Open a screen that still uses TableSearch → repeat steps 2–5; confirm the pause feels ~200ms.
