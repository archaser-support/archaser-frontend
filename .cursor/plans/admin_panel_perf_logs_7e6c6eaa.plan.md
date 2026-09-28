---
name: Admin panel perf logs
overview: Add gated `[DEBUG-admin-perf]` timing instrumentation on the AppShell baseline and Account Details mount path, then use those timings as the feedback loop to pinpoint what feels slow before any fix.
todos:
  - id: add-perf-helper
    content: Add gated [DEBUG-admin-perf] timing helper (localStorage flag)
    status: completed
  - id: instrument-shell
    content: Instrument AppShell/AppHeader queryFn timings on pathname/auth load
    status: in_progress
  - id: instrument-account-details
    content: Instrument AccountDetails mount, account/country/state, eager SMS fetches
    status: pending
  - id: instrument-account-list
    content: Instrument AccountList first-page fetch
    status: pending
  - id: collect-timings
    content: Have user reproduce with flag on; rank slowest labels vs hypotheses
    status: pending
isProject: false
---

# Admin panel slowness diagnosis

## Scope (default)

Measure **Account Details** (`/app/admin/accounts/[id]/details`) plus the **AppShell/AppHeader baseline** that runs on every `/app/admin/*` route. Account list gets light coverage too. Other admin pages (cron, logs, SMS) share the same shell cost and will show up in the baseline logs.

If the slowness is only on Billing / Business Units / Cron after you open those tabs, say so — we will extend the same probe set there after the first pass.

## Ranked hypotheses (falsifiable)

1. **AppShell duplicate account GETs + always-fresh permissions** — If products + theme each call `GET /api/entities/accounts/{id}` and permissions use `staleTime: 0`, shell timings will dominate every admin navigation (~hundreds of ms–seconds each). Changing only Account Details would not fix list/nav feel.
2. **Eager SMS loads on Account Details** — If `/api/sms/country-vendors` and `/api/accounts/{id}/sms-preferences` run on every details mount (even on General tab), their durations will appear in the critical path before paint settles. Gating those behind the Communication tab would remove them from General-load timings.
3. **Control-center stats on every authenticated shell** — If `GET /api/system/control-center?operation=stats` is slow, every admin (and app) page will feel laggy regardless of tab.
4. **Account + countries + states waterfall** — If account finishes then states wait on `country_id`, TTI will track the sum, not the max of parallel work.
5. **Billing tab kept alive after first visit** — Only if slowness continues after leaving Billing; logs will show sync/history queries still firing while another tab is visible.

## Instrumentation approach

Add a tiny helper (e.g. `shared/utils/adminPerfDebug.ts`):

- Prefix: `[DEBUG-admin-perf]`
- Gate: `localStorage.getItem('DEBUG-admin-perf') === '1'` (dev-friendly; no always-on console noise)
- API: `startAdminPerf(label)` / `endAdminPerf(label, extra?)` using `performance.now()`, flattened fields (`label`, `durationMs`, `pathname`, `accountId`, `url`)

Wire probes (not “log everything”):

| Location | What to time |
|----------|----------------|
| [`AppShell.tsx`](w:/Cloudial/archaser-rest/fe/app/[locale]/app/AppShell.tsx) | pathname change → `controlCenterStats`, `permissions/me`, `account-products`, `account-theme-colors`, `collection-agents` |
| [`AppHeader.tsx`](w:/Cloudial/archaser-rest/fe) (account sync query) | Duplicate account GET vs shell |
| [`AccountDetails.tsx`](w:/Cloudial/archaser-rest/fe/app/[locale]/app/admin/accounts/[AccountId]/details/AccountDetails.tsx) | Mount mark; account / country / state queries; eager SMS pair (~694–701) |
| [`AccountList.tsx`](w:/Cloudial/archaser-rest/fe/app/[locale]/app/admin/accounts/AccountList.tsx) | First page `GET /api/entities/accounts` |
| Optional central: [`app/api.ts`](w:/Cloudial/archaser-rest/fe/app/api.ts) / `apiFetch` | Duration for matching URLs when flag is on (single place to catch waterfall) |

No permanent production logs; tag every line with `[DEBUG-admin-perf]` so cleanup is one grep after diagnosis.

## Feedback loop (Phase 1)

1. Enable: `localStorage.setItem('DEBUG-admin-perf','1')` then hard-refresh.
2. Navigate: Accounts list → open one account details (default General tab). Wait until UI settles.
3. Collect: browser console lines with `[DEBUG-admin-perf]` (or paste here).
4. Success criterion: we can name the **slowest 1–2 labels by `durationMs`** and map them to a hypothesis above.

Optional tighten (if API is runnable locally): a small script that `GET`s the same endpoints with auth and prints durations — agent-runnable without clicking. Only add if console timing is insufficient.

## After measurement (not in this slice unless timings already prove it)

Likely cheap wins if hypothesis 1 or 2 wins:

- Merge AppShell account products + theme into one query/cache key
- Raise permissions `staleTime` or share one query with AppHeader
- Move SMS country-vendors / preferences behind Communication tab (or React Query with shared key used by `IntelligentChannelSelection`)

Fix only after timings confirm; remove debug helper/probes before commit unless you want them behind the flag permanently.

## Codebase scan

**Required**

- [`AppShell.tsx`](w:/Cloudial/archaser-rest/fe/app/[locale]/app/AppShell.tsx) — shell baseline queries
- Account details SMS `useEffect` + account/country/state queries
- Small `adminPerfDebug` helper + gate

**Optional / out of scope unless timings point there**

- BillingIntegrationSettings, BusinessUnits `limit=1000`, cron-jobs page
- Backend query plans for control-center / sms country-vendors
- i18n namespace load in app layout

**No change needed**

- StatsCards (unused)
- Permanent audit `createLogRecord` paths
