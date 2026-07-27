import { describe, expect, it } from "vitest";

import {
    accountProductsFromRecord,
    excludeCreditOnlyCustomerWhere,
    isCreditOnlyAccount,
} from "@/shared/utils/accountProducts";

describe("isCreditOnlyAccount", () => {
    it("returns true when credit insurance is enabled and collection is disabled", () => {
        expect(
            isCreditOnlyAccount({
                has_collection: false,
                has_credit_insurance: true,
            })
        ).toBe(true);
    });

    it("returns false for collection-only accounts", () => {
        expect(
            isCreditOnlyAccount({
                has_collection: true,
                has_credit_insurance: false,
            })
        ).toBe(false);
    });

    it("returns false for dual-product accounts", () => {
        expect(
            isCreditOnlyAccount({
                has_collection: true,
                has_credit_insurance: true,
            })
        ).toBe(false);
    });

    it("returns false when account products are missing", () => {
        expect(isCreditOnlyAccount(undefined)).toBe(false);
        expect(isCreditOnlyAccount(null)).toBe(false);
    });
});

describe("accountProductsFromRecord", () => {
    it("maps account product flags from a record", () => {
        expect(
            accountProductsFromRecord({
                has_collection: false,
                has_credit_insurance: true,
            })
        ).toEqual({
            has_collection: false,
            has_credit_insurance: true,
        });
    });

    it("returns undefined for missing records", () => {
        expect(accountProductsFromRecord(undefined)).toBeUndefined();
        expect(accountProductsFromRecord(null)).toBeUndefined();
    });
});

describe("excludeCreditOnlyCustomerWhere", () => {
    it("merges additional customer filters with credit-only exclusion", () => {
        expect(
            excludeCreditOnlyCustomerWhere({
                automation_stuck_no_contacts: { not: true },
            })
        ).toEqual({
            automation_stuck_no_contacts: { not: true },
            NOT: {
                Account: {
                    has_collection: false,
                    has_credit_insurance: true,
                },
            },
        });
    });
});
