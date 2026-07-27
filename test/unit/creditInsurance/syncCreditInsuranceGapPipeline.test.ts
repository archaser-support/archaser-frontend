import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    syncInvoiceCapacityGapAmountsForCustomer: vi.fn(),
    syncCustomerPolicyGapAmountsForCustomer: vi.fn(),
    syncInvoiceCapacityGapFlagsForCustomer: vi.fn(),
}));

vi.mock(
    "@/server/services/creditInsurance/syncInvoiceCapacityGapAmounts",
    () => ({
        syncInvoiceCapacityGapAmountsForCustomer:
            mocks.syncInvoiceCapacityGapAmountsForCustomer,
    })
);
vi.mock(
    "@/server/services/creditInsurance/syncCustomerPolicyGapAmounts",
    () => ({
        syncCustomerPolicyGapAmountsForCustomer:
            mocks.syncCustomerPolicyGapAmountsForCustomer,
    })
);
vi.mock(
    "@/server/services/creditInsurance/syncInvoiceCapacityGapFlags",
    () => ({
        syncInvoiceCapacityGapFlagsForCustomer:
            mocks.syncInvoiceCapacityGapFlagsForCustomer,
    })
);

import { syncCreditInsuranceGapPipelineForCustomer } from "@/server/services/creditInsurance/syncCreditInsuranceGapPipeline";

describe("syncCreditInsuranceGapPipelineForCustomer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.syncInvoiceCapacityGapAmountsForCustomer.mockResolvedValue({
            missingRate: false,
        });
        mocks.syncCustomerPolicyGapAmountsForCustomer.mockResolvedValue({
            missingRate: false,
        });
        mocks.syncInvoiceCapacityGapFlagsForCustomer.mockResolvedValue(
            undefined
        );
    });

    it("runs invoice sync → policy aggregate → flags in order", async () => {
        const order: string[] = [];
        mocks.syncInvoiceCapacityGapAmountsForCustomer.mockImplementation(
            async () => {
                order.push("invoice");
                return { missingRate: false };
            }
        );
        mocks.syncCustomerPolicyGapAmountsForCustomer.mockImplementation(
            async () => {
                order.push("policy");
                return { missingRate: false };
            }
        );
        mocks.syncInvoiceCapacityGapFlagsForCustomer.mockImplementation(
            async () => {
                order.push("flags");
            }
        );

        await syncCreditInsuranceGapPipelineForCustomer(42);

        expect(order).toEqual(["invoice", "policy", "flags"]);
    });

    it("passes invoiceIds scope to invoice sync", async () => {
        await syncCreditInsuranceGapPipelineForCustomer(42, {
            invoiceIds: [7, 8],
        });

        expect(
            mocks.syncInvoiceCapacityGapAmountsForCustomer
        ).toHaveBeenCalledWith(
            42,
            expect.objectContaining({ invoiceIds: [7, 8] })
        );
    });

    it("skips policy aggregate when requested", async () => {
        await syncCreditInsuranceGapPipelineForCustomer(42, {
            skipPolicyAggregate: true,
        });

        expect(
            mocks.syncCustomerPolicyGapAmountsForCustomer
        ).not.toHaveBeenCalled();
        expect(mocks.syncInvoiceCapacityGapFlagsForCustomer).toHaveBeenCalled();
    });
});
