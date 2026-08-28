# Archaser — Agent instructions

## Agent skills

**Shared skills live in the backend repo** — `archaser-backend/.agents/skills/`. This repo keeps only frontend-specific skills under `.cursor/skills/`: `implement-next`, `pre-commit-cleanup`, `review-ui`, `wayfinder`. Do not re-add copies of the shared skills here — duplicates make every skill appear twice in the agent skills list.

### Issue tracker

**`/to-issues` vertical slices** live as local markdown under `.scratch/<feature-slug>/`. PRDs/plans stay in `.cursor/plans/`. ClickUp is for ad-hoc human workflow only. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles map to `**Status:**` on `.scratch/` issue files (and to ClickUp statuses for ad-hoc ClickUp tasks). See `docs/agents/triage-labels.md`.

### Domain docs

**Single-context** — `CONTEXT.md` and `docs/adr/` at the repo root when they exist. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
