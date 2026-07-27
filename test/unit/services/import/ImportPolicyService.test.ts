import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    ImportPolicyService,
    type ImportPolicyRowInput,
} from "@/server/services/import/ImportPolicyService";
import { createPrismaMock } from "@/test/mocks/prisma";

const mocks = vi.hoisted(() => ({
    applyActivePolicyPatch: vi.fn(),
    switchActivePolicy: vi.fn(),
    findAssignablePrimaryPolicyByNumber: vi.fn(),
    getCustomerPrefillForEdit: vi.fn(),
    getAccessibleBusinessUnitIds: vi.fn(),
    getActiveCustomerPolicyRow: vi.fn(),
    syncCustomerInsuranceFields: vi.fn(),
}));

const { prismaHolder } = vi.hoisted(() => ({
    prismaHolder: {
        prisma: null as ReturnType<typeof createPrismaMock> | null,
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    prismaHolder.prisma = createPrismaMock();
    return {
        prismaJobs: () => prismaHolder.prisma!,
    };
});

vi.mock("@/server/services/InsurancePolicyService", () => ({
    InsurancePolicyService: {
        findAssignablePrimaryPolicyByNumber:
            mocks.findAssignablePrimaryPolicyByNumber,
        getCustomerPrefillForEdit: mocks.getCustomerPrefillForEdit,
    },
}));

vi.mock("@/server/services/creditInsurance/CustomerPolicyService", () => ({
    CustomerPolicyService: {
        applyActivePolicyPatch: mocks.applyActivePolicyPatch,
        switchActivePolicy: mocks.switchActivePolicy,
    },
}));

vi.mock("@/server/services/BusinessUnitService", () => ({
    BusinessUnitService: {
        getAccessibleBusinessUnitIds: mocks.getAccessibleBusinessUnitIds,
    },
}));

vi.mock(
    "@/server/services/creditInsurance/resolveActiveCustomerPolicy",
    () => ({
        getActiveCustomerPolicyRow: mocks.getActiveCustomerPolicyRow,
    })
);

vi.mock(
    "@/server/services/creditInsurance/syncCustomerInsuranceFields",
    () => ({
        syncCustomerInsuranceFields: mocks.syncCustomerInsuranceFields,
    })
);

const baseRow: ImportPolicyRowInput = {
    policy_number: "POL-100",
    customer_number: "CUST-1",
    limit_type: "DCL",
};

const baseContext = {
    accountId: 42,
    userId: "user-1",
    userBusinessUnitId: 5,
    isAdmin: false,
};

const baseCustomer = {
    id: 100,
    country_id: 1,
    customer_number: "CUST-1",
    business_unit_id: 5,
};

describe("ImportPolicyService", () => {
    let service: ImportPolicyService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ImportPolicyService();
        mocks.getAccessibleBusinessUnitIds.mockResolvedValue([5, 6]);
        mocks.getActiveCustomerPolicyRow.mockResolvedValue(null);
        mocks.applyActivePolicyPatch.mockResolvedValue({});
        mocks.switchActivePolicy.mockResolvedValue({});
        mocks.syncCustomerInsuranceFields.mockResolvedValue(undefined);
        mocks.findAssignablePrimaryPolicyByNumber.mockResolvedValue({ id: 10 });
        prismaHolder.prisma!.customer.findFirst.mockResolvedValue(baseCustomer);
    });

    it("creates DCL assignment with country prefill when optional columns are blank", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "country",
            limit_type: "DCL",
            max_payment_term: 45,
            max_allowed_mep: 80,
            reporting_days: 14,
            approved_limit: 50000,
            credit_score: 70,
        });

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: true,
            action: "create",
            customerId: 100,
        });
        expect(mocks.getCustomerPrefillForEdit).toHaveBeenCalledWith({
            policyId: 10,
            accountId: 42,
            countryId: 1,
            customerNumber: "CUST-1",
            customerNumberPolicy: null,
            namedMatchByPolicyCustomerNumberOnly: false,
        });
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 100,
                patch: expect.objectContaining({
                    policy_id: 10,
                    limit_type: "DCL",
                    policy_exclusion_reason: "Pending review",
                    max_payment_term: 45,
                    max_allowed_mep: 80,
                    reporting_days: 14,
                    approved_limit: 50000,
                    credit_score: 70,
                }),
            })
        );
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(100, {
            refreshTermsBreachFlags: false,
        });
    });

    it("creates DCL assignment with policy-level prefill when no country row exists", async () => {
        prismaHolder.prisma!.customer.findFirst.mockResolvedValue({
            ...baseCustomer,
            id: 101,
            country_id: null,
            customer_number: "CUST-2",
        });
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "policy",
            limit_type: "DCL",
            max_payment_term: 30,
            max_allowed_mep: 60,
            reporting_days: 7,
            approved_limit: 25000,
            credit_score: null,
        });

        const result = await service.importPolicyRow(
            {
                ...baseRow,
                customer_number: "CUST-2",
            },
            baseContext
        );

        expect(result).toEqual({
            success: true,
            action: "create",
            customerId: 101,
        });
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    max_payment_term: 30,
                    max_allowed_mep: 60,
                    reporting_days: 7,
                    approved_limit: 25000,
                }),
            })
        );
    });

    it("patches same active policy with fresh prefill when optional columns are blank", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            id: 50,
            insurance_policy_id: 10,
            customer_number_policy: "OLD-POL-CUST",
            approved_limit: 1000,
            approved_limit_currency: "USD",
            approved_limit_expiration_date: null,
            zero_limit_date: null,
            limit_type: "DCL",
            max_payment_term: 10,
            max_allowed_mep: 20,
            reporting_days: 5,
            excluded_from_policy: false,
            policy_exclusion_reason: null,
            credit_score: 50,
            credit_score_input_date: null,
            active_customer_since: null,
            outdated_dcl: false,
            capacity_gap_amount: null,
            capacity_gap_amount_date: null,
            uninsured_amount: null,
            capacity_gap_amount1: null,
            capacity_gap_currency1: null,
            capacity_gap_amount2: null,
            capacity_gap_currency2: null,
            uninsured_amount1: null,
            uninsured_currency1: null,
            uninsured_amount2: null,
            uninsured_currency2: null,
        });
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "country",
            limit_type: "DCL",
            max_payment_term: 45,
            max_allowed_mep: 80,
            reporting_days: 14,
            approved_limit: 50000,
            credit_score: 70,
        });

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: true,
            action: "patch",
            customerId: 100,
        });
        expect(mocks.switchActivePolicy).not.toHaveBeenCalled();
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    max_payment_term: 45,
                    approved_limit: 50000,
                }),
            })
        );
    });

    it("switches policy when file policy_number differs from active policy", async () => {
        mocks.getActiveCustomerPolicyRow
            .mockResolvedValueOnce({
                id: 50,
                insurance_policy_id: 99,
                customer_number_policy: null,
                approved_limit: null,
                approved_limit_currency: null,
                approved_limit_expiration_date: null,
                zero_limit_date: null,
                limit_type: "DCL",
                max_payment_term: null,
                max_allowed_mep: null,
                reporting_days: null,
                excluded_from_policy: false,
                policy_exclusion_reason: null,
                credit_score: null,
                credit_score_input_date: null,
                active_customer_since: null,
                outdated_dcl: false,
                capacity_gap_amount: null,
                capacity_gap_amount_date: null,
                uninsured_amount: null,
                capacity_gap_amount1: null,
                capacity_gap_currency1: null,
                capacity_gap_amount2: null,
                capacity_gap_currency2: null,
                uninsured_amount1: null,
                uninsured_currency1: null,
                uninsured_amount2: null,
                uninsured_currency2: null,
            })
            .mockResolvedValueOnce({
                id: 51,
                insurance_policy_id: 10,
                customer_number_policy: null,
                approved_limit: 50000,
                approved_limit_currency: null,
                approved_limit_expiration_date: null,
                zero_limit_date: null,
                limit_type: "DCL",
                max_payment_term: 45,
                max_allowed_mep: 80,
                reporting_days: 14,
                excluded_from_policy: false,
                policy_exclusion_reason: null,
                credit_score: null,
                credit_score_input_date: null,
                active_customer_since: null,
                outdated_dcl: false,
                capacity_gap_amount: null,
                capacity_gap_amount_date: null,
                uninsured_amount: null,
                capacity_gap_amount1: null,
                capacity_gap_currency1: null,
                capacity_gap_amount2: null,
                capacity_gap_currency2: null,
                uninsured_amount1: null,
                uninsured_currency1: null,
                uninsured_amount2: null,
                uninsured_currency2: null,
            });
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "country",
            limit_type: "DCL",
            max_payment_term: 45,
            max_allowed_mep: 80,
            reporting_days: 14,
            approved_limit: 50000,
            credit_score: null,
        });

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: true,
            action: "switch",
            customerId: 100,
        });
        expect(mocks.switchActivePolicy).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 100,
                newInsurancePolicyId: 10,
                limitType: "DCL",
            })
        );
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledTimes(1);
    });

    it("succeeds for Named limit type when NamedPolicy match exists", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "named",
            limit_type: "Named",
            max_payment_term: 60,
            max_allowed_mep: 90,
            reporting_days: 21,
            approved_limit: 75000,
            customer_number_policy: "NAMED-1",
            credit_score: 80,
        });

        const result = await service.importPolicyRow(
            { ...baseRow, limit_type: "Named" },
            baseContext
        );

        expect(result.success).toBe(true);
        expect(mocks.getCustomerPrefillForEdit).toHaveBeenCalledWith(
            expect.objectContaining({
                namedMatchByPolicyCustomerNumberOnly: true,
            })
        );
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    limit_type: "Named",
                    approved_limit: 75000,
                    customer_number_policy: "NAMED-1",
                }),
            })
        );
    });

    it("fails for Named limit type when no NamedPolicy match exists", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "no_named_match",
        });

        const result = await service.importPolicyRow(
            {
                ...baseRow,
                limit_type: "Named",
                approved_limit: 99999,
            },
            baseContext
        );

        expect(result).toEqual({
            success: false,
            errorCode: "no_named_match",
            message: "import.validation.noNamedPolicyMatch:CUST-1",
        });
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("fails when customer is not found", async () => {
        prismaHolder.prisma!.customer.findFirst.mockResolvedValue(null);

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: false,
            errorCode: "customer_not_found",
            message: "import.validation.customerNotFound:CUST-1",
        });
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("fails when policy number does not exist", async () => {
        mocks.findAssignablePrimaryPolicyByNumber.mockResolvedValue(null);
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue(null);

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: false,
            errorCode: "policy_not_found",
            message: "import.validation.policyNotFound:POL-100",
        });
    });

    it("fails when policy is TopUp (not assignable primary)", async () => {
        mocks.findAssignablePrimaryPolicyByNumber.mockResolvedValue(null);
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
            id: 99,
            policy_kind: "TopUp",
        });

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: false,
            errorCode: "policy_not_assignable",
            message: "import.validation.policyTopUpNotAssignable:POL-100",
        });
    });

    it("fails when policy exists but is inactive or out of term", async () => {
        mocks.findAssignablePrimaryPolicyByNumber.mockResolvedValue(null);
        prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
            id: 88,
            policy_kind: "Primary",
        });

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: false,
            errorCode: "policy_not_assignable",
            message: "import.validation.policyNotAssignable:POL-100",
        });
    });

    it("fails when user lacks business unit access to the customer", async () => {
        prismaHolder.prisma!.customer.findFirst.mockResolvedValue({
            ...baseCustomer,
            business_unit_id: 99,
        });
        mocks.getAccessibleBusinessUnitIds.mockResolvedValue([5]);
        prismaHolder.prisma!.businessUnit.findFirst.mockResolvedValue({
            external_id: "BU-EAST",
        });

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: false,
            errorCode: "business_unit_access_denied",
            message: "import.validation.businessUnitAccessDenied:BU-EAST",
        });
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("fails when policy exclusion reason is outside allowlist", async () => {
        const result = await service.importPolicyRow(
            {
                ...baseRow,
                policy_exclusion_reason: "not-valid",
            },
            baseContext
        );

        expect(result).toEqual({
            success: false,
            errorCode: "invalid_policy_exclusion_reason",
            message: "import.validation.invalidPolicyExclusionReason",
        });
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("uses explicit file values over prefill for provided columns", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "country",
            limit_type: "DCL",
            max_payment_term: 45,
            max_allowed_mep: 80,
            reporting_days: 14,
            mep_cutoff_day_of_month: 24,
            mep_substitute_day_of_month: 2,
            reporting_cutoff_day_of_month: 20,
            reporting_substitute_day_of_month: 3,
            payment_term_cutoff_day_of_month: 18,
            payment_term_substitute_day_of_month: 4,
            approved_limit: 50000,
            credit_score: 70,
        });

        await service.importPolicyRow(
            {
                ...baseRow,
                max_payment_term: 90,
                approved_limit: 120000,
                approved_limit_currency: "EUR",
                credit_score_input_date: "2025-01-15",
                reporting_cutoff_day_of_month: 15,
                reporting_substitute_day_of_month: 5,
                payment_term_cutoff_day_of_month: 22,
                payment_term_substitute_day_of_month: 6,
            },
            baseContext
        );

        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    max_payment_term: 90,
                    approved_limit: 120000,
                    max_allowed_mep: 80,
                    approved_limit_currency: "EUR",
                    credit_score_input_date: "2025-01-15",
                    mep_cutoff_day_of_month: 24,
                    mep_substitute_day_of_month: 2,
                    reporting_cutoff_day_of_month: 15,
                    reporting_substitute_day_of_month: 5,
                    payment_term_cutoff_day_of_month: 22,
                    payment_term_substitute_day_of_month: 6,
                }),
            })
        );
    });

    it("prefills month-end fields from policy defaults when import columns are blank", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "policy",
            limit_type: "DCL",
            max_payment_term: 30,
            max_allowed_mep: 60,
            reporting_days: 7,
            mep_cutoff_day_of_month: 24,
            mep_substitute_day_of_month: 2,
            reporting_cutoff_day_of_month: null,
            reporting_substitute_day_of_month: null,
            payment_term_cutoff_day_of_month: 18,
            payment_term_substitute_day_of_month: 3,
            approved_limit: 25000,
            credit_score: null,
        });

        const result = await service.importPolicyRow(baseRow, baseContext);

        expect(result).toEqual({
            success: true,
            action: "create",
            customerId: 100,
        });
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    mep_cutoff_day_of_month: 24,
                    mep_substitute_day_of_month: 2,
                    reporting_cutoff_day_of_month: null,
                    reporting_substitute_day_of_month: null,
                    payment_term_cutoff_day_of_month: 18,
                    payment_term_substitute_day_of_month: 3,
                }),
            })
        );
    });

    it("fails when payment-term cutoff is set without substitute in the import row", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "policy",
            limit_type: "DCL",
            max_payment_term: 30,
            max_allowed_mep: 60,
            reporting_days: 7,
            mep_cutoff_day_of_month: null,
            mep_substitute_day_of_month: null,
            reporting_cutoff_day_of_month: null,
            reporting_substitute_day_of_month: null,
            payment_term_cutoff_day_of_month: null,
            payment_term_substitute_day_of_month: null,
            approved_limit: 25000,
            credit_score: null,
        });

        const result = await service.importPolicyRow(
            {
                ...baseRow,
                payment_term_cutoff_day_of_month: 24,
            },
            baseContext
        );

        expect(result).toEqual({
            success: false,
            errorCode: "payment_term_cutoff_requires_substitute",
            message: "import.validation.paymentTermCutoffRequiresSubstitute",
        });
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("fails when MEP cutoff is set without substitute in the import row", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "policy",
            limit_type: "DCL",
            max_payment_term: 30,
            max_allowed_mep: 60,
            reporting_days: 7,
            mep_cutoff_day_of_month: null,
            mep_substitute_day_of_month: null,
            reporting_cutoff_day_of_month: null,
            reporting_substitute_day_of_month: null,
            approved_limit: 25000,
            credit_score: null,
        });

        const result = await service.importPolicyRow(
            {
                ...baseRow,
                mep_cutoff_day_of_month: 24,
            },
            baseContext
        );

        expect(result).toEqual({
            success: false,
            errorCode: "mep_cutoff_requires_substitute",
            message: "import.validation.mepCutoffRequiresSubstitute",
        });
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("fails when month-end day-of-month is out of range", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "policy",
            limit_type: "DCL",
            max_payment_term: 30,
            max_allowed_mep: 60,
            reporting_days: 7,
            mep_cutoff_day_of_month: null,
            mep_substitute_day_of_month: null,
            reporting_cutoff_day_of_month: null,
            reporting_substitute_day_of_month: null,
            approved_limit: 25000,
            credit_score: null,
        });

        const result = await service.importPolicyRow(
            {
                ...baseRow,
                reporting_cutoff_day_of_month: 32,
                reporting_substitute_day_of_month: 2,
            },
            baseContext
        );

        expect(result).toEqual({
            success: false,
            errorCode: "month_end_day_out_of_range",
            message:
                "import.validation.monthEndDayOutOfRange:reporting_cutoff_day_of_month",
        });
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
    });

    it("last row wins when duplicate customer_number rows are imported sequentially", async () => {
        mocks.getCustomerPrefillForEdit.mockResolvedValue({
            source: "country",
            limit_type: "DCL",
            max_payment_term: 45,
            max_allowed_mep: 80,
            reporting_days: 14,
            approved_limit: 50000,
            credit_score: null,
        });

        const first = await service.importPolicyRow(
            { ...baseRow, policy_number: "POL-A" },
            baseContext
        );
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            id: 50,
            insurance_policy_id: 10,
            customer_number_policy: null,
            approved_limit: 50000,
            approved_limit_currency: null,
            approved_limit_expiration_date: null,
            zero_limit_date: null,
            limit_type: "DCL",
            max_payment_term: 45,
            max_allowed_mep: 80,
            reporting_days: 14,
            excluded_from_policy: false,
            policy_exclusion_reason: null,
            credit_score: null,
            credit_score_input_date: null,
            active_customer_since: null,
            outdated_dcl: false,
            capacity_gap_amount: null,
            capacity_gap_amount_date: null,
            uninsured_amount: null,
            capacity_gap_amount1: null,
            capacity_gap_currency1: null,
            capacity_gap_amount2: null,
            capacity_gap_currency2: null,
            uninsured_amount1: null,
            uninsured_currency1: null,
            uninsured_amount2: null,
            uninsured_currency2: null,
        });
        mocks.findAssignablePrimaryPolicyByNumber.mockResolvedValue({ id: 20 });

        const second = await service.importPolicyRow(
            {
                ...baseRow,
                policy_number: "POL-B",
                max_payment_term: 120,
            },
            baseContext
        );

        expect(first).toEqual({
            success: true,
            action: "create",
            customerId: 100,
        });
        expect(second).toEqual({
            success: true,
            action: "switch",
            customerId: 100,
        });
    });

    it("does not set pending review on Named policy import", async () => {
        const result = await service.importPolicyRow(
            {
                ...baseRow,
                limit_type: "Named",
            },
            baseContext
        );

        expect(result).toEqual({
            success: true,
            action: "create",
            customerId: 100,
        });
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.not.objectContaining({
                    policy_exclusion_reason: "Pending review",
                }),
            })
        );
    });

    it("keeps explicit exclusion reason on DCL import", async () => {
        const result = await service.importPolicyRow(
            {
                ...baseRow,
                policy_exclusion_reason: "Credit hold",
            },
            baseContext
        );

        expect(result).toEqual({
            success: true,
            action: "create",
            customerId: 100,
        });
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    policy_exclusion_reason: "Credit hold",
                }),
            })
        );
    });
});
