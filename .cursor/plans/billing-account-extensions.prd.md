---
name: billing-account-extensions
overview: >-
  Layered billing-connector account extensions (post-map transform plugins)
  plus an account toggle to show or hide File Import in nav, page, and role
  permissions.
source: grill-me session
clickup_task_url: null
isProject: false
---

# Billing account extensions and File Import visibility

## Problem Statement

After running the billing interface with one Priority ERP (Enterprise Resource
Planning) account, the team learned that some accounts will need special import
logic—for example complex manipulation of mapped data before it is written to
the database—without forking the whole Billing integration UI or hardcoding
account IDs.

Today the platform has:

- A shared admin Billing integration tab and a Priority-only connector path
  (pull → field map → import).
- No registry for per-account code plugins or a documented hook between mapping
  and save.
- File Import in the sidebar whenever a user has any `import_*` permission, with
  no account-level product switch to hide it when ERP sync replaces spreadsheet
  upload.
- Role permission matrices that always list import permissions, even when File
  Import should not be offered to that customer.

Without a layered extension model and a File Import visibility flag, each
special account risks one-off branches, and ERP-synced customers still see (and
can be granted) File Import surfaces they should not use.

## Solution

Ship two related capabilities in one product slice:

1. **Account extensions for the ERP billing connector (MVP = framework)**  
   Keep shared config, provider adapters, sync orchestration, and the Billing UI
   shell. When an account needs special logic, attach an optional
   `extension_key` on the billing connector. Sync then uses a staged, windowed
   path: pull and map enabled entities for a time/date slice → run one
   registered plugin that may rewrite, drop, expand, and cross-link entities →
   save with the normal importer in platform entity order. Preview uses the same
   plugin path. Standard accounts (no key) keep today’s entity-by-entity path.

2. **Show / hide File Import for the customer**  
   Add an account product flag (default on) edited like other product toggles.
   When off: hide the Import menu item, block the Import page in the UI, and
   omit all `import_*` keys from the role permissions matrix (leave
   `export_data` visible; do not strip stored role permissions from the
   database; do not reject File Import APIs).

## User Stories

1. As an archaser admin, I want to attach an optional extension key to a billing
   connector, so that an account can use special pre-save transform logic
   without a code fork of the whole Billing tab.
2. As an archaser admin, I want the extension key to be empty by default, so that
   standard Priority accounts keep today’s sync behavior.
3. As an archaser admin, I want extension-specific settings stored as JSON on the
   connector, so that a plugin can be configured per account without new columns
   for every rule.
4. As an archaser admin, I want only roles that already manage the billing
   connector to set the extension key, so that customers cannot attach arbitrary
   transform code.
5. As an archaser admin, I want saving an unknown extension key to fail
   validation, so that typos do not create a broken connector.
6. As a platform engineer, I want a code registry that maps extension keys to
   transform modules, so that core sync does not hardcode account IDs.
7. As a platform engineer, I want plugins to live as first-party in-repo modules
   under a clear extensions folder, so that we can add account solutions without
   publishing separate packages yet.
8. As a platform engineer, I want a tiny sample or no-op extension in MVP, so
   that the framework is testable before the first real customer rules are
   known.
9. As a sync operator, I want special logic to run after field mapping and
   before database save, so that pull and mapping stay shared across accounts.
10. As a sync operator, I want the plugin to see a cross-entity batch for the
    current window, so that invoices, customers, and payments can be adjusted
    together.
11. As a sync operator, I want large syncs to process time/date windows rather
    than the full history in memory, so that backfills stay within memory and
    time budgets.
12. As a sync operator, I want only accounts with an extension key to use the
    staged windowed pipeline, so that standard Priority connectors are not
    regressed.
13. As a sync operator, I want a failed plugin in one window to fail that window
    while keeping earlier successful windows, so that progress is retained and
    retry is safe.
14. As a sync operator, I want an unknown extension key at sync time to block the
    run with a clear error (not fall back to the standard path), so that
    required transforms are never skipped silently.
15. As an archaser admin, I want preview / dry-run sync to run the same plugin
    path as a real sync, so that what I preview matches what will be imported.
16. As an archaser admin, I want the Billing tab to stay a shared shell (connect,
    schedule, sync, mapping) with an optional extension panel, so that only
    accounts with an extension see extra UI.
17. As a frontend engineer, I want a frontend registry of extension panels keyed
    like the backend, so that UI and transforms stay in lockstep.
18. As an archaser admin, I want a product toggle on the account to show or hide
    File Import for that customer, so that ERP-synced accounts are not pushed
    toward spreadsheet import.
19. As an account user, I want the Import menu item hidden when the account flag
    is off, even if I still have old `import_*` permissions, so that the product
    surface matches the account configuration.
20. As an account user, I want the Import page unavailable in the UI when the
    flag is off, so that deep links do not reopen File Import accidentally.
21. As an account admin editing roles, I want all `import_*` permissions hidden
    from the role permissions matrix when File Import is off, so that I do not
    grant irrelevant import rights.
22. As an account admin, I want `export_data` to remain on the permissions matrix
    when File Import is off, so that export is not tied to File Import
    visibility.
23. As a platform operator, I want turning the File Import flag off not to delete
    permissions already stored on roles, so that turning the flag back on
    restores the prior grants without rework.
24. As a platform engineer, I want File Import APIs to keep working when the flag
    is off if the caller has permission, so that this MVP stays UI-surface
    gating only.
25. As a developer, I want existing accounts to default to File Import visible,
    so that we do not surprise current customers after migration.
26. As a QA engineer, I want automated coverage for registry miss, plugin failure
    mid-window, preview parity, and no-key Priority regression, so that the
    framework is safe to evolve.
27. As a QA engineer, I want automated coverage for nav hide, Import page block,
    and permissions-matrix filtering of `import_*`, so that File Import
    visibility stays consistent.
28. As a product owner, I want File Import extension hooks deferred, so that MVP
    focuses on the ERP billing connector path.
29. As a product owner, I want the first real customer transform shipped as a
    follow-up once rules are known, so that the framework is not blocked on
    discovery.
30. As a platform engineer, I want post-plugin save to keep platform entity
    order, so that AR (Accounts Receivable) ingest invariants remain intact.

## Implementation Decisions

### Architecture (layered extensions)

- Prefer config and field mappings first; use provider adapters for different
  ERPs; use code plugins only when mapped-row logic must run before save.
- Do not hardcode account IDs for special behavior.
- Provider adapter work (e.g. enabling SAP) remains a separate track; this PRD
  does not implement a new ERP provider.

### Billing connector data model

- Add nullable `extension_key` on the billing connector.
- Add `extension_config` JSON (or equivalent) on the billing connector for
  plugin-owned settings; each plugin validates its own shape.
- Empty / null `extension_key` means the standard sync path.

### Extension attachment and authorization

- Resolve plugins via a backend registry keyed by `extension_key`.
- Only users who can manage the billing connector (archaser admin pattern) may
  set `extension_key` and extension settings.
- Validate `extension_key` against the registry on save; reject unknown keys.
- At sync start, if a key is set but missing from the registry, fail the sync
  with a clear error—never silently fall back to the standard path.

### Plugin contract and sync orchestration

- Plugin runs after field mapping and before the shared entity importer.
- Plugin may rewrite, drop, or expand rows and operate on a cross-entity batch
  for the current window.
- Staged path when key is set: pull + map enabled entities for a time/date
  window → one plugin call → save all returned rows.
- Windowing is required for large backfills; plugin sees a cross-entity
  **slice**, not necessarily full history.
- Accounts without `extension_key` keep the existing entity-by-entity
  pull/map/import path.
- After the plugin returns, persist using existing platform entity order
  (Customer → Payment → Invoice → Contact, including any existing orchestration
  steps between those entities).
- Preview / dry-run uses the same plugin path; no database writes.
- If the plugin fails for a window: fail that window / run status appropriately;
  keep earlier successful windows; do not save the failed window; do not skip
  the plugin and import raw mapped rows.

### Packaging

- First-party in-repo modules (e.g. backend `extensions/<key>/` plus matching
  frontend panel registration).
- MVP includes a sample or no-op extension used only for tests and wiring.
- Real business plugins are follow-ups once account rules are known.

### Billing UI

- Refactor Billing integration settings into a shared shell (connect, schedule,
  sync history, field mapping) plus an optional extension panel from a frontend
  registry when `extension_key` is set.
- Do not replace the entire Billing tab per account in MVP.

### File Import visibility (account product flag)

- Add a boolean on Account, default **true** (name such as `show_file_import` /
  `has_file_import`—pick one name and use it consistently in schema, API, and
  `AccountProducts`).
- Edit on admin account General Information alongside other product toggles.
- Navigation: Import item requires the flag **and** any `import_*` permission.
- Import page: when the flag is false, treat as unavailable in the UI (redirect
  or equivalent), even if the user has `import_*`.
- Permissions matrix: when the flag is false, filter all `import_*` keys from
  the catalog returned to the role permissions UI (same pattern as filtering
  credit permissions when credit insurance is off). Keep `export_data`.
- Do **not** delete or rewrite stored role permission rows when the flag is
  turned off.
- Do **not** reject File Import HTTP APIs based on this flag in MVP (UI-only
  gating).

### Primary test seams (confirm before `/to-issues`)

Prefer two high seams rather than many low-level spies:

1. **Billing account extension seam** — Registry resolution + staged window
   pipeline entry (transform input/output batch and failure/unknown-key
   behavior), including preview parity. Prefer testing through the
   sync/orchestrator façade the connectors app already uses, not internal mapper
   helpers.
2. **File Import visibility seam** — Account product flag as observed through
   (a) permissions matrix filtering of `import_*` and (b) nav / Import page
   access helpers that already take `AccountProducts`. Prefer extending existing
   permissions-matrix and navigation tests over new one-off UI snapshots.

If these seams do not match expectations, adjust before slicing issues.

## Testing Decisions

- Test external behavior: given connector config / account flag / window batch,
  assert sync outcomes, matrix contents, and visibility—not private helper
  implementation details.
- Good tests assert: unknown key blocked on save and sync; plugin throw fails
  window and preserves prior windows; preview applies plugin without writes;
  no-key accounts still follow legacy path; flag off hides `import_*` in matrix
  and Import nav/page; flag off leaves `export_data`; default true preserves
  current customers.
- Modules / areas to cover: billing-connector extension registry and staged sync
  branch; billing connector config GET/PUT validation; permissions matrix
  product filtering; account products / navigation Import visibility; Billing
  shell renders extension slot when key set (light UI or integration as existing
  patterns allow).
- Prior art: existing billing-connector package tests; Nest accounts-nested
  billing-connector tests; `PermissionsService` credit-insurance matrix
  filtering; `navigation.ts` / `AccountProducts` product gating; admin General
  Information product toggles.

## Out of Scope

- Implementing the first real customer transform plugin (beyond sample/no-op).
- File Import page hooks into the same extension registry.
- Rejecting File Import APIs when the visibility flag is off.
- Stripping stored role permissions when the flag is turned off.
- Enabling SAP or other new ERP providers (adapter interface may remain as-is).
- Replacing the entire Billing tab with per-account pages.
- Changing global sync cron tick semantics unrelated to extension windowing.
- Translation file edits without explicit approval (flag and panel copy need a
  separate i18n pass).
- New visual styles beyond reusing existing admin / Billing patterns.

## Further Notes

### Decision log (from grill-me)

- **D1 — What is an account extension?** Layered: config → provider adapters →
  code plugins.
- **D2 — Where special logic runs:** After mapping, before save.
- **D3 — How extension is attached:** Optional `extension_key` on billing
  connector + registry.
- **D4 — Plugin capabilities:** Rewrite/drop/expand + cross-entity batch.
- **D5 — When plugin runs:** Pull + map → one plugin call → save.
- **D6 — Large syncs:** Time/date windows (cross-entity slice).
- **D7 — Billing UI:** Shared shell + optional extension panel.
- **D8 — Extension settings:** JSON `extension_config` on billing connector.
- **D9 — Packaging:** In-repo `extensions/<key>/` + FE registry.
- **D10 — Plugin failure:** Fail that window; keep earlier successful windows.
- **D11 — Preview:** Same plugin path as real sync.
- **D12 — Who uses staged path:** Only when `extension_key` is set.
- **D13 — Who sets `extension_key`:** Manage billing connector / archaser admin.
- **D14 — File Import + extensions:** ERP connector only for MVP.
- **D15 — Unknown `extension_key`:** Block sync + validate on save.
- **D16 — MVP scope:** Framework + sample/no-op extension for tests.
- **D17 — Import menu toggle:** Account product flag, default true; nav + page
  gated.
- **D18 — File import API:** UI only — no API rejection.
- **D19 — Role permissions:** Hide all `import_*` in matrix when flag off; keep
  `export_data`; do not strip DB grants.

### Discovery gates (block first real plugin, not framework)

- **Concrete transform rules for a named account** — Required before shipping a
  real `extensions/<key>/`.
- **Window size vs cross-entity needs** — Spike with Priority volumes if rules
  need wide slices.

### Codebase scan (touchpoints)

#### Required

- Account schema + admin General Information product toggles + `AccountProducts`
  plumbing.
- Billing connector schema (`extension_key`, `extension_config`) + Nest
  billing-connector GET/PUT.
- Billing connector sync orchestration / in-process sync branch for staged
  windows.
- New extension registry + sample extension module in the billing-connector
  package.
- Billing integration settings UI shell + extension panel slot + frontend
  service types.
- Permissions matrix product filtering for `import_*`.
- Sidebar Import visibility (`navigation` / AppShell account products).
- Import page UI gate when flag is off.

#### Optional / out of scope unless requested

- File Import processors calling the extension registry.
- Provider factory for non-Priority ERPs.
- Grafana / alert tiles specific to extension failures (structured sync errors
  may suffice for MVP).

#### No change needed

- Payment skip-if-exists and other entity importer idempotency rules (plugins
  must still produce rows the importer can accept).
- Credit-insurance-only navigation rules (orthogonal product flags).

### Relationship to existing plans

- Builds on the ERP billing connector architecture (Priority MVP, shared
  importer, Billing tab).
- Does not replace dated backfill or sync-schedule PRDs; extensions compose with
  those controls.

## Issues (vertical slices)

Tracer-bullet breakdown published as local markdown under
`.scratch/billing-account-extensions/`. **Hard blockers** are recorded in each
slice's **Blocked by** header. Implement in dependency order; start a **fresh
session per issue**.

**Overview:** `.scratch/billing-account-extensions/OVERVIEW.md`

1. **File Import visibility flag** —
   `issues/01-file-import-visibility.md` — Waiting on: — — Stories: 18–25, 27
2. **Extension key, registry, and Billing shell** —
   `issues/02-extension-key-registry-billing-shell.md` — Waiting on: — —
   Stories: 1–8, 16–17
3. **Staged windowed sync with extension plugin** —
   `issues/03-staged-windowed-sync-plugin.md` — Waiting on: 02 — Stories: 9–15,
   26, 28–30

**Status:** `ready-for-agent` on all slices.

*Soft ordering:* 01 and 02 can proceed in parallel; 03 requires 02.
