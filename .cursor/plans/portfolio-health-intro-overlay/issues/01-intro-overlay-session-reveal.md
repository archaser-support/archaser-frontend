# 01 — Intro overlay session gate and reveal

**Status:** ready-for-agent
**Priority:** high
**Blocked by:** —
**User stories:** 1, 2, 3, 5, 6, 7, 8, 15, 16, 17
**PRD:** `.cursor/plans/portfolio-health-intro-overlay.prd.md`

## What to build

Ship the first end-to-end intro on the credit portfolio health page: once per browser session, cover the page body (under the app shell) with a light overlay and a jade-glow progress bar that fills over ~3–4 seconds, while the real dashboard loads behind. At 100%, fade the overlay out and leave the existing dashboard usable. Later visits in the same session skip the intro. Use a single intro controller seam for play/skip and progress; a single static or simple status line is enough in this slice (rotating translated lines come next). No early dismiss. Not tied to API completion.

## Acceptance criteria

- [ ] First visit in a browser session shows the overlay over the portfolio health page body; app nav/shell remain outside the cover
- [ ] Progress bar uses light overlay + jade glow and completes in about 3–4 seconds, then fades out
- [ ] Dashboard continues to load behind the overlay and is visible/usable after fade
- [ ] Second visit in the same session skips the intro
- [ ] New browser session plays the intro again
- [ ] Intro timing is cosmetic (not waiting on fetch success)
- [ ] No lasting testing UI in this slice

## How to test

1. Open a fresh browser session (or clear session storage for the intro key) and go to credit portfolio health.
2. Confirm the light jade-glow progress overlay covers the page body and fills to 100% in ~3–4s, then fades.
3. Confirm the dashboard underneath is already loading / is ready after reveal and works normally.
4. Navigate away and back in the same session — intro should not play again.
5. Open a new session/tab context that resets session storage — intro should play once more.
