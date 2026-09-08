# 02 — Status lines, i18n, RTL, reduce-motion, title replay

**Status:** done
**Priority:** normal
**Blocked by:** [01-intro-overlay-session-reveal](01-intro-overlay-session-reveal.md)
**User stories:** 4, 9, 10, 11, 12, 13, 14, 18, 19, 20
**PRD:** `.cursor/plans/portfolio-health-intro-overlay.prd.md`

## What to build

Complete the intro polish on top of slice 01: rotate status lines health → utilisation → coverage → costs with EN/HE i18n; fill the bar left→right in LTR and right→left in Hebrew RTL; skip the intro entirely when reduce-motion is preferred; allow testers to click the page title five times to immediately replay the intro (no lasting control). Still no early skip via click/Escape. Get explicit permission before editing translation files.

## Acceptance criteria

- [x] Status text rotates through the four section-themed lines during the fill
- [x] EN and HE translations exist under the credit portfolio health namespace (after approved translation edits)
- [x] Hebrew locale fills the progress bar right → left; English left → right
- [x] `prefers-reduced-motion: reduce` skips the intro and shows the dashboard
- [x] Five clicks on the page title immediately replay the intro
- [x] No persistent toggle/switch UI after unlock
- [x] Intro still cannot be dismissed early with click or Escape

## How to test

1. With the intro playing (force via new session or five title clicks), confirm status lines cycle: health → utilisation → coverage → costs.
2. Switch UI to Hebrew: confirm translated lines and right→left fill.
3. Switch UI to English: confirm left→right fill and English lines.
4. Enable OS reduce-motion: open the page — intro should be skipped.
5. Disable reduce-motion, open the page after the session already played, click the page title five times — intro should replay immediately with no leftover button; the large `%` should snap to `0%` then count up again.
6. During replay, try clicking the overlay / pressing Escape — intro should still run to completion.
