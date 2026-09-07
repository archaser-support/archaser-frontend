# Backfill progress session machine

**PRD:** `.cursor/plans/backfill-progress-session-machine.prd.md`  
**ClickUp:** https://app.clickup.com/t/869ey85u5

Replace ad-hoc progress flags and fake sync runs with one explicit session phase machine so the Backfill progress panel never looks live when idle, and Clear / Start / Reload share one lifecycle.

Vertical slices live under `issues/`. Implement in dependency order; prefer a fresh session per slice.

**Related:** Stopgap UI mitigations may already be on this branch; fold them into the session machine rather than leaving parallel paths.
