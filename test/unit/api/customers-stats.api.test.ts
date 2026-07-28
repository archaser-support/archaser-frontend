import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();

vi.mock("@/app/api", () => ({
    default: {
        get: (...args: unknown[]) => getMock(...args),
    },
}));

import { fetchCustomerStats } from "@/shared/services/customerService";

describe("fetchCustomerStats (Nest /api/entities/customers?stats=true)", () => {
    beforeEach(() => {
        getMock.mockReset();
    });

    it("requests stats=true and wraps Nest counts payload", async () => {
        getMock.mockResolvedValue({
            data: {
                counts: {
                    total_customers: 3,
                    total_due_amount: 27500,
                    total_overdue_amount: 948025.36,
                    open_invoice_count: 1000,
                    currency: "ILS",
                },
            },
        });

        const result = await fetchCustomerStats({
            queryKey: ["customer-stats"],
            meta: undefined,
            signal: new AbortController().signal,
        } as never);

        expect(getMock).toHaveBeenCalledWith("/entities/customers?stats=true");
        expect(result.stats.counts.total_due_amount).toBe(27500);
        expect(result.stats.counts.total_overdue_amount).toBe(948025.36);
        expect(result.stats.counts.open_invoice_count).toBe(1000);
    });
});
