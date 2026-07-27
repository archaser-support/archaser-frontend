import { beforeEach, describe, expect, it, vi } from "vitest";

import { NamedPolicyAssignmentService } from "@/server/services/creditInsurance/NamedPolicyAssignmentService";
import {
    customerPolicyToNamedMasterFields,
    namedMasterToCustomerPolicyPatch,
    namedPolicyCustomerNumberMatchesAssignment,
    resolveNamedPolicyCustomerNumber,
} from "@/server/services/creditInsurance/namedMasterToCustomerPolicyPatch";
import { createPrismaMock } from "@/test/mocks/prisma";

const { mocks, prismaHolder } = vi.hoisted(() => ({
    mocks: {
        applyActivePolicyPatch: vi.fn(),
        switchActivePolicy: vi.fn(),
        getActiveCustomerPolicyRow: vi.fn(),
        assertAccountHasCreditInsurance: vi.fn(),
        syncCustomerInsuranceFields: vi.fn(),
        syncCreditInsuranceGapPipelineForCustomer: vi.fn(),
        freezeCustomerPolicyGapOnDeactivation: vi.fn(),
    },
    prismaHolder: {
        prisma: null as ReturnType<typeof createPrismaMock> & {
            namedPolicy: ReturnType<typeof createPrismaMock>["customer"];
            customerPolicy: ReturnType<typeof createPrismaMock>["customer"];
        } | null,
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const prisma = createPrismaMock() as ReturnType<typeof createPrismaMock> & {
        namedPolicy: ReturnType<typeof createPrismaMock>["customer"];
        customerPolicy: ReturnType<typeof createPrismaMock>["customer"];
    };
    prisma.namedPolicy = createPrismaMock().customer;
    prisma.customerPolicy = createPrismaMock().customer;
    prismaHolder.prisma = prisma;
    return { prisma };
});

vi.mock("@/server/services/InsurancePolicyService", () => ({
    InsurancePolicyService: {
        assertAccountHasCreditInsurance: mocks.assertAccountHasCreditInsurance,
    },
}));

vi.mock("@/server/services/creditInsurance/CustomerPolicyService", () => ({
    CustomerPolicyService: {
        applyActivePolicyPatch: mocks.applyActivePolicyPatch,
        switchActivePolicy: mocks.switchActivePolicy,
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

vi.mock(
    "@/server/services/creditInsurance/syncCreditInsuranceGapPipeline",
    () => ({
        syncCreditInsuranceGapPipelineForCustomer:
            mocks.syncCreditInsuranceGapPipelineForCustomer,
    })
);

vi.mock(
    "@/server/services/creditInsurance/syncCustomerPolicyGapAmounts",
    () => ({
        freezeCustomerPolicyGapOnDeactivation:
            mocks.freezeCustomerPolicyGapOnDeactivation,
    })
);

const baseArgs = {
    policyId: 10,
    accountId: 42,
    userId: "user-1",
    data: {
        customer_number: "CUST-1",
        max_payment_term: 45,
        customer_mep: 80,
        reporting_days: 14,
        customer_max_limit: 50000,
        limit_expiration_date: new Date("2027-01-15"),
    },
};

const baseCustomer = {
    id: 100,
    country_id: 1,
    customer_number: "CUST-1",
};

const createdNamedPolicy = {
    id: 55,
    insurance_policy_id: 10,
    customer_number: "CUST-1",
    max_payment_term: 45,
    customer_mep: 80,
    reporting_days: 14,
    customer_max_limit: 50000,
    limit_expiration_date: new Date("2027-01-15"),
};

const activePolicyRow = {
    id: 7,
    customer_id: 100,
    insurance_policy_id: 10,
    customer_number_policy: "CUST-1",
    approved_limit: null,
    approved_limit_currency: null,
    approved_limit_expiration_date: null,
    zero_limit_date: null,
    limit_type: "Named" as const,
    max_payment_term: 30,
    max_allowed_mep: 60,
    reporting_days: 7,
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
    is_active: true,
    created_at: new Date(),
    modified_at: new Date(),
};

function setupCreateTransaction() {
    prismaHolder.prisma!.insurancePolicy.findFirst.mockResolvedValue({
        id: 10,
        min_credit_score: 55,
    });
    prismaHolder.prisma!.customer.findFirst.mockResolvedValue(baseCustomer);
    prismaHolder.prisma!.namedPolicy.findFirst.mockResolvedValue(null);
    prismaHolder.prisma!.namedPolicy.create.mockResolvedValue(
        createdNamedPolicy
    );
    prismaHolder.prisma!.$transaction.mockImplementation(
        async (fn: (tx: typeof prismaHolder.prisma) => Promise<unknown>) =>
            fn(prismaHolder.prisma!)
    );
}

describe("namedMasterToCustomerPolicyPatch", () => {
    it("prefers policy customer number when resolving named master key", () => {
        expect(
            resolveNamedPolicyCustomerNumber({
                customerNumberPolicy: " POL-1 ",
                customerNumber: "MAIN-1",
            })
        ).toBe("POL-1");
    });

    it("falls back to main customer number when policy number is empty", () => {
        expect(
            resolveNamedPolicyCustomerNumber({
                customerNumberPolicy: "",
                customerNumber: "MAIN-1",
            })
        ).toBe("MAIN-1");
    });

    it("maps CustomerPolicy assignment fields to NamedPolicy master fields", () => {
        const master = customerPolicyToNamedMasterFields(
            {
                customer_number_policy: "POL-9",
                approved_limit: 90000,
                approved_limit_expiration_date: new Date("2027-03-01"),
                max_payment_term: 60,
                max_allowed_mep: 75,
                reporting_days: 12,
            },
            "MAIN-9"
        );

        expect(master).toEqual({
            customer_number: "POL-9",
            customer_max_limit: 90000,
            limit_expiration_date: new Date("2027-03-01"),
            max_payment_term: 60,
            customer_mep: 75,
            reporting_days: 12,
        });
    });

    it("matches named masters by policy or main customer number", () => {
        expect(
            namedPolicyCustomerNumberMatchesAssignment({
                masterCustomerNumber: "MAIN-1",
                customerNumberPolicy: "POL-1",
                customerNumber: "MAIN-1",
            })
        ).toBe(true);
        expect(
            namedPolicyCustomerNumberMatchesAssignment({
                masterCustomerNumber: "POL-1",
                customerNumberPolicy: "POL-1",
                customerNumber: "MAIN-1",
            })
        ).toBe(true);
        expect(
            namedPolicyCustomerNumberMatchesAssignment({
                masterCustomerNumber: "OTHER",
                customerNumberPolicy: "POL-1",
                customerNumber: "MAIN-1",
            })
        ).toBe(false);
    });

    it("maps NamedPolicy master fields to CustomerPolicy write input", () => {
        const patch = namedMasterToCustomerPolicyPatch({
            customer_number: " CUST-9 ",
            customer_max_limit: 120000,
            limit_expiration_date: new Date("2027-06-01"),
            max_payment_term: 30,
            customer_mep: 70,
            reporting_days: 10,
        });

        expect(patch).toEqual({
            customer_number_policy: "CUST-9",
            approved_limit: 120000,
            approved_limit_expiration_date: new Date("2027-06-01"),
            max_payment_term: 30,
            max_allowed_mep: 70,
            reporting_days: 10,
            limit_type: "Named",
        });
    });

    it("can omit limit_type when requested", () => {
        const patch = namedMasterToCustomerPolicyPatch(
            {
                customer_number: "CUST-1",
                customer_max_limit: null,
                max_payment_term: null,
                customer_mep: null,
                reporting_days: null,
            },
            { includeLimitType: false }
        );

        expect(patch.limit_type).toBeUndefined();
        expect(patch.customer_number_policy).toBe("CUST-1");
    });
});

describe("NamedPolicyAssignmentService.createNamedPolicyWithAssignment", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.assertAccountHasCreditInsurance.mockResolvedValue(undefined);
        mocks.getActiveCustomerPolicyRow.mockResolvedValue(null);
        mocks.applyActivePolicyPatch.mockResolvedValue({});
        mocks.switchActivePolicy.mockResolvedValue({});
        mocks.syncCustomerInsuranceFields.mockResolvedValue(undefined);
        mocks.syncCreditInsuranceGapPipelineForCustomer.mockResolvedValue(
            undefined
        );
        setupCreateTransaction();
    });

    it("creates master and active Named assignment when customer has no active policy", async () => {
        const result =
            await NamedPolicyAssignmentService.createNamedPolicyWithAssignment(
                baseArgs
            );

        expect(result).toEqual({
            success: true,
            namedPolicy: createdNamedPolicy,
            customerId: 100,
        });

        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 100,
                patch: expect.objectContaining({
                    policy_id: 10,
                    limit_type: "Named",
                    customer_number_policy: "CUST-1",
                    approved_limit: 50000,
                }),
            })
        );
        expect(mocks.switchActivePolicy).not.toHaveBeenCalled();
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(100);
    });

    it("patches same-policy Named assignment without policy_id when customer already on policy", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue(activePolicyRow);

        const result =
            await NamedPolicyAssignmentService.createNamedPolicyWithAssignment(
                baseArgs
            );

        expect(result.success).toBe(true);
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    limit_type: "Named",
                    approved_limit: 50000,
                }),
            })
        );
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.not.objectContaining({
                patch: expect.objectContaining({ policy_id: 10 }),
            })
        );
        expect(mocks.switchActivePolicy).not.toHaveBeenCalled();
    });

    it("converts same-policy DCL to Named with policy min credit score and cleared zero_limit_date", async () => {
        mocks.getActiveCustomerPolicyRow.mockResolvedValue({
            ...activePolicyRow,
            limit_type: "DCL",
            zero_limit_date: new Date("2026-01-01"),
            credit_score: 40,
        });

        const result =
            await NamedPolicyAssignmentService.createNamedPolicyWithAssignment(
                baseArgs
            );

        expect(result.success).toBe(true);
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    limit_type: "Named",
                    credit_score: 55,
                    zero_limit_date: null,
                    approved_limit: 50000,
                }),
            })
        );
        expect(mocks.switchActivePolicy).not.toHaveBeenCalled();
    });

    it("switches policy then patches when customer is on a different policy", async () => {
        mocks.getActiveCustomerPolicyRow
            .mockResolvedValueOnce({
                ...activePolicyRow,
                insurance_policy_id: 20,
                limit_type: "DCL",
            })
            .mockResolvedValueOnce({
                ...activePolicyRow,
                insurance_policy_id: 10,
                limit_type: "Named",
            });

        const result =
            await NamedPolicyAssignmentService.createNamedPolicyWithAssignment(
                baseArgs
            );

        expect(result.success).toBe(true);
        expect(mocks.switchActivePolicy).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 100,
                newInsurancePolicyId: 10,
                limitType: "Named",
                customerNumberPolicy: "CUST-1",
            })
        );
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    limit_type: "Named",
                    approved_limit: 50000,
                }),
            })
        );
    });

    it("rejects duplicate customer_number on the same policy", async () => {
        prismaHolder.prisma!.namedPolicy.findFirst.mockResolvedValue({
            id: 99,
            customer_number: "CUST-1",
        });

        const result =
            await NamedPolicyAssignmentService.createNamedPolicyWithAssignment(
                baseArgs
            );

        expect(result).toEqual({
            success: false,
            errorCode: "named_policy_customer_number_exists",
            message: "A row for this customer number already exists",
        });
        expect(mocks.applyActivePolicyPatch).not.toHaveBeenCalled();
        expect(mocks.syncCustomerInsuranceFields).not.toHaveBeenCalled();
    });

    it("rolls back and does not sync when assignment patch fails inside the transaction", async () => {
        mocks.applyActivePolicyPatch.mockResolvedValue({
            error: "Invalid or inactive policy for this account",
        });

        const result =
            await NamedPolicyAssignmentService.createNamedPolicyWithAssignment(
                baseArgs
            );

        expect(result).toEqual({
            success: false,
            errorCode: "policy_write_failed",
            message: "Invalid or inactive policy for this account",
        });
        expect(mocks.syncCustomerInsuranceFields).not.toHaveBeenCalled();
    });

    it("returns customer_not_found when customer number does not resolve", async () => {
        prismaHolder.prisma!.customer.findFirst.mockResolvedValue(null);

        const result =
            await NamedPolicyAssignmentService.createNamedPolicyWithAssignment(
                baseArgs
            );

        expect(result).toEqual({
            success: false,
            errorCode: "customer_not_found",
            message: "Customer not found: CUST-1",
        });
        expect(prismaHolder.prisma!.$transaction).not.toHaveBeenCalled();
    });
});

describe("NamedPolicyAssignmentService.updateNamedPolicyWithSync", () => {
    const existingNamedPolicy = {
        id: 55,
        insurance_policy_id: 10,
        customer_number: "CUST-1",
        InsurancePolicy: { account_id: 42 },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.assertAccountHasCreditInsurance.mockResolvedValue(undefined);
        mocks.getActiveCustomerPolicyRow.mockResolvedValue(activePolicyRow);
        mocks.applyActivePolicyPatch.mockResolvedValue({});
        mocks.syncCustomerInsuranceFields.mockResolvedValue(undefined);
        mocks.syncCreditInsuranceGapPipelineForCustomer.mockResolvedValue(
            undefined
        );

        prismaHolder.prisma!.namedPolicy.findFirst.mockImplementation(
            (args: { where?: { NOT?: { id?: number } } }) => {
                if (args?.where?.NOT?.id != null) {
                    return Promise.resolve(null);
                }
                return Promise.resolve(existingNamedPolicy);
            }
        );
        prismaHolder.prisma!.customer.findFirst.mockResolvedValue(baseCustomer);
        prismaHolder.prisma!.namedPolicy.update.mockResolvedValue({
            ...createdNamedPolicy,
            customer_max_limit: 75000,
        });
        prismaHolder.prisma!.$transaction.mockImplementation(
            async (fn: (tx: typeof prismaHolder.prisma) => Promise<unknown>) =>
                fn(prismaHolder.prisma!)
        );
    });

    it("updates master and syncs active Named CustomerPolicy on the same policy", async () => {
        const result =
            await NamedPolicyAssignmentService.updateNamedPolicyWithSync({
                namedPolicyId: 55,
                accountId: 42,
                userId: "user-1",
                data: {
                    ...baseArgs.data,
                    customer_number: "OTHER",
                    customer_max_limit: 75000,
                },
            });

        expect(result.success).toBe(true);
        expect(prismaHolder.prisma!.namedPolicy.update).toHaveBeenCalledWith({
            where: { id: 55 },
            data: expect.objectContaining({
                customer_number: "CUST-1",
                customer_max_limit: 75000,
            }),
        });
        expect(mocks.applyActivePolicyPatch).toHaveBeenCalledWith(
            expect.objectContaining({
                patch: expect.objectContaining({
                    approved_limit: 75000,
                    customer_number_policy: "CUST-1",
                }),
            })
        );
        const updatePatch =
            mocks.applyActivePolicyPatch.mock.calls[0]?.[0]?.patch;
        expect(updatePatch?.limit_type).toBeUndefined();
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(100);
    });

    it("returns named_policy_not_found when row is missing", async () => {
        prismaHolder.prisma!.namedPolicy.findFirst.mockReset();
        prismaHolder.prisma!.namedPolicy.findFirst.mockResolvedValue(null);

        const result =
            await NamedPolicyAssignmentService.updateNamedPolicyWithSync({
                namedPolicyId: 55,
                accountId: 42,
                userId: "user-1",
                data: baseArgs.data,
            });

        expect(result).toEqual({
            success: false,
            errorCode: "named_policy_not_found",
            message: "Row not found",
        });
    });
});

describe("NamedPolicyAssignmentService.deleteNamedPolicyWithDeactivation", () => {
    const existingNamedPolicy = {
        id: 55,
        insurance_policy_id: 10,
        customer_number: "CUST-1",
        InsurancePolicy: { account_id: 42 },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.assertAccountHasCreditInsurance.mockResolvedValue(undefined);
        mocks.getActiveCustomerPolicyRow.mockResolvedValue(activePolicyRow);
        mocks.freezeCustomerPolicyGapOnDeactivation.mockResolvedValue(undefined);
        mocks.syncCustomerInsuranceFields.mockResolvedValue(undefined);
        mocks.syncCreditInsuranceGapPipelineForCustomer.mockResolvedValue(
            undefined
        );

        prismaHolder.prisma!.namedPolicy.findFirst.mockResolvedValue(
            existingNamedPolicy
        );
        prismaHolder.prisma!.customer.findFirst.mockResolvedValue({
            id: 100,
        });
        prismaHolder.prisma!.namedPolicy.delete.mockResolvedValue(
            existingNamedPolicy
        );
        prismaHolder.prisma!.customerPolicy.update.mockResolvedValue({});
        prismaHolder.prisma!.$transaction.mockImplementation(
            async (fn: (tx: typeof prismaHolder.prisma) => Promise<unknown>) =>
                fn(prismaHolder.prisma!)
        );
    });

    it("deletes master, deactivates assignment, and runs sync pipeline", async () => {
        const result =
            await NamedPolicyAssignmentService.deleteNamedPolicyWithDeactivation(
                {
                    namedPolicyId: 55,
                    accountId: 42,
                    userId: "user-1",
                }
            );

        expect(result).toEqual({ success: true, customerId: 100 });
        expect(prismaHolder.prisma!.namedPolicy.delete).toHaveBeenCalledWith({
            where: { id: 55 },
        });
        expect(mocks.freezeCustomerPolicyGapOnDeactivation).toHaveBeenCalledWith(
            100,
            7,
            prismaHolder.prisma
        );
        expect(prismaHolder.prisma!.customerPolicy.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: { is_active: false, modified_by: "user-1" },
        });
        expect(mocks.syncCustomerInsuranceFields).toHaveBeenCalledWith(100);
        expect(
            mocks.syncCreditInsuranceGapPipelineForCustomer
        ).toHaveBeenCalledWith(100, { skipPolicyAggregate: false });
    });

    it("returns named_policy_not_found when row is missing", async () => {
        prismaHolder.prisma!.namedPolicy.findFirst.mockReset();
        prismaHolder.prisma!.namedPolicy.findFirst.mockResolvedValue(null);

        const result =
            await NamedPolicyAssignmentService.deleteNamedPolicyWithDeactivation(
                {
                    namedPolicyId: 55,
                    accountId: 42,
                    userId: "user-1",
                }
            );

        expect(result).toEqual({
            success: false,
            errorCode: "named_policy_not_found",
            message: "Row not found",
        });
    });
});

describe("NamedPolicyAssignmentService.ensureNamedPolicyMastersForPolicy", () => {
    const activeAssignment = {
        customer_number_policy: "CUST-1",
        approved_limit: 25000,
        approved_limit_expiration_date: new Date("2027-04-01"),
        max_payment_term: 30,
        max_allowed_mep: 65,
        reporting_days: 10,
        Customer: { customer_number: "CUST-1" },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        prismaHolder.prisma!.customerPolicy.findMany.mockResolvedValue([
            activeAssignment,
        ]);
        prismaHolder.prisma!.namedPolicy.findMany.mockResolvedValue([]);
        prismaHolder.prisma!.namedPolicy.create.mockResolvedValue({
            id: 88,
            insurance_policy_id: 10,
            customer_number: "CUST-1",
        });
    });

    it("creates a master row for orphan Named assignments", async () => {
        await NamedPolicyAssignmentService.ensureNamedPolicyMastersForPolicy({
            policyId: 10,
            accountId: 42,
            userId: "user-1",
        });

        expect(prismaHolder.prisma!.namedPolicy.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                insurance_policy_id: 10,
                customer_number: "CUST-1",
                customer_max_limit: 25000,
                max_payment_term: 30,
                customer_mep: 65,
                reporting_days: 10,
            }),
        });
    });

    it("is idempotent when a matching master already exists", async () => {
        prismaHolder.prisma!.namedPolicy.findMany.mockResolvedValue([
            { customer_number: "CUST-1" },
        ]);

        await NamedPolicyAssignmentService.ensureNamedPolicyMastersForPolicy({
            policyId: 10,
            accountId: 42,
            userId: "user-1",
        });

        expect(prismaHolder.prisma!.namedPolicy.create).not.toHaveBeenCalled();
    });
});

describe("NamedPolicyAssignmentService.listNamedPolicyGridRows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaHolder.prisma!.customerPolicy.findMany.mockResolvedValue([
            {
                customer_number_policy: "CUST-1",
                approved_limit: 25000,
                approved_limit_expiration_date: null,
                max_payment_term: 30,
                max_allowed_mep: 65,
                reporting_days: 10,
                Customer: {
                    id: 101,
                    customer_number: "CUST-1",
                    Person: null,
                    Company: { name: "Acme Corp" },
                },
            },
        ]);
        prismaHolder.prisma!.namedPolicy.findMany.mockResolvedValue([
            {
                id: 55,
                insurance_policy_id: 10,
                customer_number: "CUST-1",
                max_payment_term: 30,
                customer_mep: 65,
                reporting_days: 10,
                customer_max_limit: 25000,
                limit_expiration_date: null,
            },
            {
                id: 56,
                insurance_policy_id: 10,
                customer_number: "ORPHAN-ONLY",
                max_payment_term: 30,
                customer_mep: 65,
                reporting_days: 10,
                customer_max_limit: 1000,
                limit_expiration_date: null,
            },
        ]);
    });

    it("returns only masters with an active Named assignment on the policy", async () => {
        const rows = await NamedPolicyAssignmentService.listNamedPolicyGridRows({
            policyId: 10,
            accountId: 42,
        });

        expect(rows).toHaveLength(1);
        expect(rows[0]?.customer_number).toBe("CUST-1");
        expect(rows[0]?.customer_name).toBe("Acme Corp");
        expect(rows[0]?.customer_id).toBe(101);
    });

    it("returns an empty list when there are no active Named assignments", async () => {
        prismaHolder.prisma!.customerPolicy.findMany.mockResolvedValue([]);

        const rows = await NamedPolicyAssignmentService.listNamedPolicyGridRows({
            policyId: 10,
            accountId: 42,
        });

        expect(rows).toEqual([]);
        expect(prismaHolder.prisma!.namedPolicy.findMany).not.toHaveBeenCalled();
    });
});
