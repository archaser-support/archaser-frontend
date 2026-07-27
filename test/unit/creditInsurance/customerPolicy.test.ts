import { describe, expect, it } from "vitest";

import {
    customerActivePolicyFilter,
    customersScopedByActivePolicy,
} from "@/server/services/creditInsurance/customerPolicyQueryHelpers";
import {
    effectivePolicyFieldsToCustomerDisplay,
    emptyEffectiveCustomerPolicyFields,
    mapCustomerPolicyRow,
} from "@/server/services/creditInsurance/customerPolicyTypes";
import { withInvoiceCustomerPolicyFilter } from "@/server/services/creditInsurance/customerPolicyQueryHelpers";
import {
    applyEffectivePolicyFieldsToCustomer,
    buildCustomerPutPayload,
    getEffectivePolicyId,
} from "@/shared/customerPolicyAdapter";

describe("customerPolicyTypes", () => {
    it("maps CustomerPolicy row", () => {
        const fields = mapCustomerPolicyRow({
            id: 1,
            insurance_policy_id: 3,
            customer_number_policy: null,
            approved_limit: null,
            approved_limit_currency: null,
            approved_limit_expiration_date: null,
            limit_type: null,
            max_payment_term: null,
            max_allowed_mep: null,
            reporting_days: 7,
            excluded_from_policy: false,
            policy_exclusion_reason: null,
            credit_score: null,
            credit_score_input_date: null,
            active_customer_since: null,
            outdated_dcl: false,
        });
        expect(fields.customerPolicyRowId).toBe(1);
        expect(fields.insurance_policy_id).toBe(3);
    });

    it("flattens effective fields for API display", () => {
        const display = effectivePolicyFieldsToCustomerDisplay({
            ...emptyEffectiveCustomerPolicyFields(),
            insurance_policy_id: 12,
            reporting_days: 10,
            mep_cutoff_day_of_month: 24,
            mep_substitute_day_of_month: 2,
        });
        expect(display.policy_id).toBe(12);
        expect(display.reporting_days).toBe(10);
        expect(display.mep_cutoff_day_of_month).toBe(24);
        expect(display.mep_substitute_day_of_month).toBe(2);
    });
});

describe("customerPolicyQueryHelpers", () => {
    it("scopes customers by active policy id", () => {
        const where = customersScopedByActivePolicy(100, 42);
        expect(where.account_id).toBe(100);
        expect(where).toHaveProperty("CustomerPolicy");
    });

    it("builds active policy filter without legacy Customer.policy_id", () => {
        const filter = customerActivePolicyFilter(9);
        expect(filter).toHaveProperty("CustomerPolicy");
        expect(filter).not.toHaveProperty("OR");
    });
});

describe("withInvoiceCustomerPolicyFilter", () => {
    it("adds policy scope to invoice where", () => {
        const filtered = withInvoiceCustomerPolicyFilter(
            { account_id: 1 },
            5
        );
        expect(filtered).toHaveProperty("AND");
    });
});

describe("customerPolicyAdapter", () => {
    it("prefers active CustomerPolicy for effective policy id", () => {
        const id = getEffectivePolicyId({
            customerPolicies: [
                { id: 2, is_active: true, insurance_policy_id: 99 },
            ],
        });
        expect(id).toBe(99);
    });

    it("merges active policy fields onto customer display object", () => {
        const merged = applyEffectivePolicyFieldsToCustomer({
            reporting_days: 1,
            activeCustomerPolicy: {
                id: 2,
                is_active: true,
                insurance_policy_id: 5,
                reporting_days: 21,
                zero_limit_date: "2026-05-01",
            },
        });
        expect(merged.policy_id).toBe(5);
        expect(merged.reporting_days).toBe(21);
        expect(merged.zero_limit_date).toBe("2026-05-01");
    });

    it("builds scalar PUT payload and unwraps relation ids", () => {
        const payload = buildCustomerPutPayload(
            {
                customer_number: "C-1",
                country_id: { id: 42 },
                policy_id: "7",
                zero_limit_date: "2026-05-01",
                mep_cutoff_day_of_month: 24,
                mep_substitute_day_of_month: 2,
                Person: { first_name: "A" },
                activeCustomerPolicy: { id: 1, is_active: true },
            },
            { confirmPolicySwitch: true }
        );
        expect(payload.country_id).toBe(42);
        expect(payload.policy_id).toBe(7);
        expect(payload.zero_limit_date).toBe("2026-05-01");
        expect(payload.mep_cutoff_day_of_month).toBe(24);
        expect(payload.mep_substitute_day_of_month).toBe(2);
        expect(payload.confirm_policy_switch).toBe(true);
        expect(payload).not.toHaveProperty("Person");
        expect(payload).not.toHaveProperty("activeCustomerPolicy");
    });
});
