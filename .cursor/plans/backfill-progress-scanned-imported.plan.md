---
name: backfill-progress-scanned-imported
overview: Relabel Backfill progress step counts for Customer, Payment import, Invoice import, and Contact to scanned vs imported, with pipe-separated extras.
source: grill-me session (Backfill progress count line)
isProject: false
---

# Backfill progress — scanned | imported counts

## Problem

The count line under each step’s progress bar on Invoice/Payment is `imported / pulled imported`, which swaps the two numbers and does not name “scanned.” Customer and Contact use a single `N imported` line.

## Solution

On **every Backfill progress step**, paint pipe-separated capital labels. ERP pull steps (Customer, Payment import, Invoice import, Contact, Policy) use `Scanned: {pulled} | Imported {success}`. Record deletion uses `Deleted`. Link payments uses `Linked`. AR (accounts receivable) tails use `Processed`. Append `| Total {n}` when a total is known.

## Decision log

| # | Topic | Decision | Rationale / plan impact |
|---|-------|----------|-------------------------|
| D1 | Which steps | All Backfill progress steps (follow-up: include Policy, deletion, link, tails) | Same pipe + capital grammar; units differ by step. |
| D2 | “Account” | The **Customer** step | No row titled Account; Customer is the ERP (Enterprise Resource Planning) account/master pull. |
| D3 | Number mapping | `scanned` = `records_pulled` (ERP rows); `imported` = `success` (database writes) | Matches existing entity_stats; reverses old Invoice/Payment order (writes were first). |
| D4 | Copy | Exact: `Scanned: 1,350 \| Imported 1,200` (colon after Scanned only; capital labels) | User-specified string; keep `toLocaleString()` on numbers. |
| D5 | Extras style | Same pipe format for failed / skipped / deleted | Not the old ` · ` suffix. |
| D6 | When extras show | Only when the count is **> 0** | Clean runs stay `scanned: N \| imported N`. |
| D7 | Waiting / queued | Waiting / not_started stay `—`; queued stays `Queued`; new line once running, done, or failed | Seeding rows are waiting → they keep `—`. |
| D8 | Tooltips | Update info-icon text for all four steps | Stop describing `imported / pulled`. |
| D10 | Progress bars | Bar only on the Running step; determinate iff a real total exists (link / tails / deletion); hide on Waiting/Done | Counters carry the numbers; estimated entity % was misleading. |

Locked extras order (synthesized from D5, not a separate question): `scanned | imported | failed | skipped | deleted`.

## Copy rules

```text
Scanned: {pulled} | Imported {success}
Scanned: {pulled} | Imported {success} | Failed {n}          # failed > 0
Scanned: {pulled} | Imported {success} | Skipped {n}         # skipped > 0
Scanned: {pulled} | Imported {success} | Deleted {n}         # deleted > 0
```

Missing `success` on a live row: treat as `0` (same as today’s Invoice/Payment `row.success ?? 0`).

## Implementation

- Change `formatCounts` in `app/[locale]/app/admin/accounts/[AccountId]/details/components/BackfillImportProgress.tsx` for the four entity rows (reuse `isInvoiceOrPaymentRow` or widen to Customer/Contact labels).
- Update `BACKFILL_PROGRESS_STEP_TOOLTIPS` for Customer, Payment import, Invoice import, Contact in `shared/services/backfillImportProgress.ts`.
- Keep English hardcoded strings (this panel is not i18n’d today). Do not add locale keys unless a later slice internationalizes the whole accordion.

## Codebase scan

**Required**

- `app/[locale]/app/admin/accounts/[AccountId]/details/components/BackfillImportProgress.tsx` — count line under the bar.
- `shared/services/backfillImportProgress.ts` — four step tooltips.

**No change needed**

- Record deletion / Link payments / AR tail formatters — D1.
- Policy row — not in D1 list.
- Sync history grid `pulled / success / failed` — different surface (session-machine story 30).
- Backend `entity_stats` — already has `pulled` and `success`.
- Locale files — panel copy is English in-component.

**Out of scope unless requested**

- Unit tests for `formatCounts` (logic lives in the React file today).
- Hebrew strings for this panel.

## How to test

1. Open Admin → Account → Billing Integration → Backfill progress.
2. During or after a run, Customer / Payment import / Invoice import / Contact should show `Scanned: … | Imported …` under the step bar; extras only if Failed/Skipped/Deleted > 0.
3. Waiting steps still show `—`. Record deletion / Link payments / tails keep their old units (`deleted`, `linked`, `processed`).
4. Hover the “i” on those four steps: text should describe scanned (ERP rows) vs imported (database writes).
