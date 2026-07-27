import { beforeEach, describe, expect, it, vi } from "vitest";

const mockImportPayments = vi.fn();

vi.mock("@/server/services/import/ImportPaymentService", () => ({
    ImportPaymentService: vi.fn().mockImplementation(() => ({
        importPayments: mockImportPayments,
    })),
}));

describe("importMappedEntityBatch — Payment", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockImportPayments.mockResolvedValue([{ index: 0, success: true }]);
    });

    it("does not default missing base amount to customer amount or zero", async () => {
        const { importMappedEntityBatch } = await import(
            "@/server/integrations/billing/connectorEntityImporter"
        );

        await importMappedEntityBatch(
            "Payment",
            [
                {
                    customer_number: "CUST-1",
                    invoice_number: "INV-1",
                    reference: "PAY-1",
                    payment_date: "2024-01-01",
                    customer_amount: 600,
                    customer_currency: "EUR",
                },
            ],
            42
        );

        expect(mockImportPayments).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    account_id: 42,
                    customer_number: "CUST-1",
                    invoice_number: "INV-1",
                    reference: "PAY-1",
                    payment_date: "2024-01-01",
                    customer_amount: 600,
                    customer_currency: "EUR",
                    amount: undefined,
                }),
            ],
            42
        );
    });

    it("keeps explicit base amount when provided", async () => {
        const { importMappedEntityBatch } = await import(
            "@/server/integrations/billing/connectorEntityImporter"
        );

        await importMappedEntityBatch(
            "Payment",
            [
                {
                    customer_number: "CUST-1",
                    invoice_number: "INV-1",
                    reference: "PAY-2",
                    payment_date: "2024-01-01",
                    amount: 500,
                    customer_amount: 600,
                    customer_currency: "EUR",
                },
            ],
            42
        );

        expect(mockImportPayments).toHaveBeenCalledWith(
            [
                expect.objectContaining({
                    amount: 500,
                    customer_amount: 600,
                    customer_currency: "EUR",
                }),
            ],
            42
        );
    });
});
