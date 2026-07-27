import { describe, expect, it } from "vitest";

import {
    type CustomerWithPolicyFields,
    getActiveCustomerPolicyFromCustomer,
    isZeroApprovedLimit,
} from "@/shared/customerPolicyAdapter";

describe("customerPolicyAdapter helpers", () => {
    describe("getActiveCustomerPolicyFromCustomer", () => {
        it("prefers activeCustomerPolicy over customerPolicies history", () => {
            const customer: CustomerWithPolicyFields = {
                activeCustomerPolicy: {
                    id: 1,
                    is_active: true,
                    insurance_policy_id: null,
                    approved_limit: 123,
                },
                customerPolicies: [
                    {
                        id: 2,
                        is_active: true,
                        insurance_policy_id: null,
                        approved_limit: 0,
                    },
                ],
            };

            expect(
                getActiveCustomerPolicyFromCustomer(customer)?.approved_limit
            ).toBe(123);
        });

        it("falls back to the first is_active row in customerPolicies", () => {
            const customer: CustomerWithPolicyFields = {
                activeCustomerPolicy: null,
                customerPolicies: [
                    {
                        id: 1,
                        is_active: false,
                        insurance_policy_id: null,
                        approved_limit: 10,
                    },
                    {
                        id: 2,
                        is_active: true,
                        insurance_policy_id: null,
                        approved_limit: 0,
                    },
                ],
            };

            expect(
                getActiveCustomerPolicyFromCustomer(customer)?.approved_limit
            ).toBe(0);
        });

        it("returns null when no active policy exists", () => {
            const customer: CustomerWithPolicyFields = {
                activeCustomerPolicy: null,
                customerPolicies: [
                    {
                        id: 1,
                        is_active: false,
                        insurance_policy_id: null,
                        approved_limit: 10,
                    },
                ],
            };

            expect(getActiveCustomerPolicyFromCustomer(customer)).toBeNull();
        });
    });

    describe("isZeroApprovedLimit", () => {
        it("returns true for 0 and \"0\"", () => {
            expect(isZeroApprovedLimit(0)).toBe(true);
            expect(isZeroApprovedLimit("0")).toBe(true);
            expect(isZeroApprovedLimit(" 0 ")).toBe(true);
        });

        it("returns false for null/undefined/empty and non-zero values", () => {
            expect(isZeroApprovedLimit(null)).toBe(false);
            expect(isZeroApprovedLimit(undefined)).toBe(false);
            expect(isZeroApprovedLimit("")).toBe(false);
            expect(isZeroApprovedLimit(1000)).toBe(false);
            expect(isZeroApprovedLimit("1000")).toBe(false);
        });
    });
});

