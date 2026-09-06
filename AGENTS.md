# Archaser — Agent instructions

## Agent skills

**Shared skills live in the backend repo** — `archaser-backend/.agents/skills/`. This repo keeps only frontend-specific skills under `.cursor/skills/`: `implement-next`, `pre-commit-cleanup`, `review-ui`, `wayfinder`. Do not re-add copies of the shared skills here — duplicates make every skill appear twice in the agent skills list.

### Issue tracker

**ClickUp** is the human ticket (status, durable summary, How to test, branch/PR links). **`/to-issues` vertical slices** are commit-able markdown under `.cursor/plans/<feature-slug>/issues/`. PRDs stay at `.cursor/plans/<feature-slug>.prd.md`. `.scratch/` remains gitignored optional workspace. See `docs/agents/clickup-git-workflow.md` and `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles map to `**Status:**` on `.cursor/plans/` issue files (and to ClickUp statuses for human tickets). See `docs/agents/triage-labels.md`.

### Domain docs

**Single-context** — `CONTEXT.md` and `docs/adr/` at the repo root when they exist. See `docs/agents/domain.md`.

### ClickUp ↔ Git workflow

Full path, short path, interrupt/park, ready-PR, post-merge, branch naming, primary repo, and status ladder: `docs/agents/clickup-git-workflow.md`. Orchestrator: `/start-work` in the backend skills (`archaser-backend/.agents/skills/start-work/SKILL.md`) — planning push through ready PR / `move to staging` (never auto-`done`); do not duplicate the skill body here. Discoverable via `/ask-matt` (backend).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
