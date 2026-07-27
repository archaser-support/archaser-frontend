/**
 * Pure helpers for reading stored CustomerPolicy capacity-gap secondary amounts.
 * Shared copy so Amplify UI bundles avoid `@/server` value imports.
 */

export type PolicyGapReadable = {
    capacity_gap_amount1?: number | null;
    capacity_gap_currency1?: string | null;
    capacity_gap_amount2?: number | null;
    capacity_gap_currency2?: string | null;
};

export type PolicyRowForStoredGapSecondary = PolicyGapReadable & {
    insurance_policy_id?: number | null;
    is_active?: boolean;
};

/** Secondary header line from policy bucket when currency matches. */
export function storedCapacityGapInCurrency(
    c: PolicyGapReadable,
    currency: string
): number | null {
    const target = currency.trim().toUpperCase();
    if (!target) {
        return null;
    }
    const acct = c.capacity_gap_currency1?.trim().toUpperCase();
    if (acct === target && c.capacity_gap_amount1 != null) {
        return Math.max(0, Number(c.capacity_gap_amount1));
    }
    const acct2 = c.capacity_gap_currency2?.trim().toUpperCase();
    if (acct2 === target && c.capacity_gap_amount2 != null) {
        return Math.max(0, Number(c.capacity_gap_amount2));
    }
    return null;
}

/** Sum stored limit-currency gap across rows (one active row per insurance policy). */
export function sumStoredCapacityGapInCurrency(
    rows: PolicyGapReadable[],
    currency: string
): number | null {
    const target = currency.trim().toUpperCase();
    if (!target) {
        return null;
    }
    let total = 0;
    let found = false;
    for (const row of rows) {
        const part = storedCapacityGapInCurrency(row, target);
        if (part != null) {
            total += part;
            found = true;
        }
    }
    return found ? total : null;
}

/**
 * Capacity gap secondary line from synced invoice limit-currency totals
 * (CustomerPolicy.capacity_gap_amount1), not live FX or AR bucket ratio.
 */
export function resolveStoredCapacityGapSecondary(
    rows: PolicyRowForStoredGapSecondary[],
    currency: string,
    options?: { policyId?: number }
): number | null {
    let scoped: PolicyGapReadable[];
    if (options?.policyId != null) {
        const row = rows.find(
            (r) => r.insurance_policy_id === options.policyId
        );
        scoped = row ? [row] : [];
    } else {
        const byPolicyId = new Map<number, PolicyRowForStoredGapSecondary>();
        for (const row of rows) {
            const pid = row.insurance_policy_id;
            if (pid == null) {
                continue;
            }
            const existing = byPolicyId.get(pid);
            if (!existing || (row.is_active && !existing.is_active)) {
                byPolicyId.set(pid, row);
            }
        }
        scoped = Array.from(byPolicyId.values());
    }
    return sumStoredCapacityGapInCurrency(scoped, currency);
}
