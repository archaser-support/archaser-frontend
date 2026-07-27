import { describe, expect, it } from "vitest";

import {
    computeInvoiceCapacityGapFlagsFromStored,
} from "@/server/services/creditInsurance/syncInvoiceCapacityGapFlags";

describe("syncInvoiceCapacityGapFlags", () => {
    it("sets in_capacity_gap from stored capacity_gap_amount_limit", () => {
        const flags = computeInvoiceCapacityGapFlagsFromStored([
            { id: 1, in_capacity_gap: false, capacity_gap_amount_limit: 300 },
            { id: 2, in_capacity_gap: true, capacity_gap_amount_limit: 0 },
            { id: 3, in_capacity_gap: false, capacity_gap_amount_limit: null },
        ]);
        expect(flags.get(1)).toBe(true);
        expect(flags.get(2)).toBe(false);
        expect(flags.get(3)).toBe(false);
    });
});
