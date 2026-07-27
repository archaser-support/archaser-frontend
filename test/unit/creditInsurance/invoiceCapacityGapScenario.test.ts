import { describe, expect, it } from "vitest";

import {
    computeInvoiceCapacityGapContribution,
    computeLimitAssessedAmountForNewOpenInvoice,
} from "@/server/services/creditInsurance/invoiceInsuranceFields";

type SimInvoice = {
    outstanding: number;
    assessed: number | null;
};

function stampNewInvoice(args: {
    approvedLimit: number;
    openArBefore: number;
    outstanding?: number;
}): number {
    return computeLimitAssessedAmountForNewOpenInvoice({
        approvedLimit: args.approvedLimit,
        openArOnPolicyBeforeInvoice: args.openArBefore,
        newInvoiceOutstanding: args.outstanding,
    });
}

function gapFor(inv: SimInvoice): number {
    if (inv.assessed == null) {
        return 0;
    }
    return computeInvoiceCapacityGapContribution({
        outstandingLeft: inv.outstanding,
        limitAssessedAmount: inv.assessed,
    });
}

function totalGap(invoices: SimInvoice[]): number {
    return invoices.reduce((sum, inv) => sum + gapFor(inv), 0);
}

describe("invoice-level capacity gap acceptance scenario", () => {
    it("matches plan totals across limit changes, payments, and new invoices", () => {
        const inv1: SimInvoice = {
            outstanding: 20_000,
            assessed: stampNewInvoice({
                approvedLimit: 19_000,
                openArBefore: 0,
            }),
        };
        expect(inv1.assessed).toBe(19_000);
        expect(totalGap([inv1])).toBe(1_000);

        // Limit decrease only — snapshot unchanged
        expect(totalGap([inv1])).toBe(1_000);

        inv1.outstanding = 19_500;
        expect(totalGap([inv1])).toBe(500);

        const openArBeforeInv2 = inv1.outstanding;
        const inv2: SimInvoice = {
            outstanding: 3_000,
            assessed: stampNewInvoice({
                approvedLimit: 18_000,
                openArBefore: openArBeforeInv2,
            }),
        };
        expect(inv2.assessed).toBe(0);
        expect(totalGap([inv1, inv2])).toBe(3_500);

        const openArBeforeInv3 = inv1.outstanding + inv2.outstanding;
        const inv3: SimInvoice = {
            outstanding: 1_000,
            assessed: stampNewInvoice({
                approvedLimit: 17_000,
                openArBefore: openArBeforeInv3,
            }),
        };
        expect(inv3.assessed).toBe(0);
        expect(totalGap([inv1, inv2, inv3])).toBe(4_500);

        inv1.outstanding = 18_500;
        inv2.outstanding = 2_000;
        expect(totalGap([inv1, inv2, inv3])).toBe(3_000);

        // Limit increase only — snapshots unchanged
        expect(totalGap([inv1, inv2, inv3])).toBe(3_000);
    });

    it("allocates limit in import order so only the last invoice has gap", () => {
        const approvedLimit = 10_000;
        const inv1: SimInvoice = {
            outstanding: 5_000,
            assessed: stampNewInvoice({
                approvedLimit,
                openArBefore: 0,
                outstanding: 5_000,
            }),
        };
        expect(inv1.assessed).toBe(5_000);
        expect(gapFor(inv1)).toBe(0);

        const inv2: SimInvoice = {
            outstanding: 4_500,
            assessed: stampNewInvoice({
                approvedLimit,
                openArBefore: 5_000,
                outstanding: 4_500,
            }),
        };
        expect(inv2.assessed).toBe(4_500);
        expect(gapFor(inv2)).toBe(0);

        const inv3: SimInvoice = {
            outstanding: 4_000,
            assessed: stampNewInvoice({
                approvedLimit,
                openArBefore: 9_500,
                outstanding: 4_000,
            }),
        };
        expect(inv3.assessed).toBe(500);
        expect(gapFor(inv3)).toBe(3_500);
        expect(gapFor(inv1)).toBe(0);
        expect(gapFor(inv2)).toBe(0);
        expect(totalGap([inv1, inv2, inv3])).toBe(3_500);
    });
});
