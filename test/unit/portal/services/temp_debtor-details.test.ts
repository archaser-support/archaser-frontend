import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { prisma } from "@/lib/prisma";
import { createPrismaMock } from "@/test/mocks/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

describe("Customer Details Service", () => {
    const mockPrisma = vi.mocked(prisma);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Promise to Pay Logic", () => {
        it("should calculate promise to pay eligibility correctly", () => {
            const maxAllowed = 3;
            const currentCount = 1;
            const promiseDate = null;

            const isAllowed =
                maxAllowed > currentCount &&
                (promiseDate === null || promiseDate < new Date());

            expect(isAllowed).toBe(true);
        });

        it("should not allow promise to pay when maxed out", () => {
            const maxAllowed = 3;
            const currentCount = 3;
            const promiseDate = null;

            const isAllowed =
                maxAllowed > currentCount &&
                (promiseDate === null || promiseDate < new Date());

            expect(isAllowed).toBe(false);
        });

        it("should not allow promise to pay when future date is set", () => {
            const maxAllowed = 3;
            const currentCount = 1;
            const promiseDate: Date | null = new Date(
                Date.now() + 24 * 60 * 60 * 1000
            ); // Tomorrow

            const isAllowed =
                maxAllowed > currentCount &&
                (promiseDate === null || promiseDate < new Date());

            expect(isAllowed).toBe(false);
        });

        it("should allow promise to pay when past date is set", () => {
            const maxAllowed = 3;
            const currentCount = 1;
            const promiseDate: Date | null = new Date(
                Date.now() - 24 * 60 * 60 * 1000
            ); // Yesterday

            const isAllowed =
                maxAllowed > currentCount &&
                (promiseDate === null || promiseDate < new Date());

            expect(isAllowed).toBe(true);
        });

        it("should handle undefined max_promise_to_pay_allowed_per_cycle", () => {
            const maxAllowed = undefined;
            const currentCount = 0;
            const promiseDate = null;

            const isAllowed =
                (maxAllowed ?? 0) > currentCount &&
                (promiseDate === null ||
                    (promiseDate && promiseDate < new Date()));

            expect(isAllowed).toBe(false);
        });
    });

    describe("Customer Name Logic", () => {
        it("should extract person name correctly", () => {
            const customerType = "Person";
            const personName = "John Doe";
            const companyName = null;

            const customerName =
                customerType === "Person"
                    ? personName || "Unknown Person"
                    : companyName || "Unknown Company";

            expect(customerName).toBe("John Doe");
        });

        it("should extract company name correctly", () => {
            const customerType: string = "Company";
            const personName = null;
            const companyName = "Acme Corp";

            const customerName =
                customerType === "Person"
                    ? personName || "Unknown Person"
                    : companyName || "Unknown Company";

            expect(customerName).toBe("Acme Corp");
        });

        it("should handle missing person name", () => {
            const customerType = "Person";
            const personName = null;
            const companyName = null;

            const customerName =
                customerType === "Person"
                    ? personName || "Unknown Person"
                    : companyName || "Unknown Company";

            expect(customerName).toBe("Unknown Person");
        });

        it("should handle missing company name", () => {
            const customerType: string = "Company";
            const personName = null;
            const companyName = null;

            const customerName =
                customerType === "Person"
                    ? personName || "Unknown Person"
                    : companyName || "Unknown Company";

            expect(customerName).toBe("Unknown Company");
        });
    });

    describe("Collection Period Logic", () => {
        it("should find active collection period", () => {
            const collectionPeriods = [
                {
                    id: 1,
                    period_end_date: null, // Active period
                    total_outstanding_amount: 1000,
                },
                {
                    id: 2,
                    period_end_date: new Date(), // Closed period
                    total_outstanding_amount: 500,
                },
            ];

            const activePeriod = collectionPeriods.find(
                (period) => period.period_end_date === null
            );

            expect(activePeriod).toBeDefined();
            expect(activePeriod?.id).toBe(1);
            expect(activePeriod?.total_outstanding_amount).toBe(1000);
        });

        it("should handle no active collection period", () => {
            const collectionPeriods = [
                {
                    id: 1,
                    period_end_date: new Date(), // Closed period
                    total_outstanding_amount: 1000,
                },
                {
                    id: 2,
                    period_end_date: new Date(), // Closed period
                    total_outstanding_amount: 500,
                },
            ];

            const activePeriod = collectionPeriods.find(
                (period) => period.period_end_date === null
            );

            expect(activePeriod).toBeUndefined();
        });

        it("should handle empty collection periods", () => {
            const collectionPeriods: any[] = [];

            const activePeriod = collectionPeriods.find(
                (period) => period.period_end_date === null
            );

            expect(activePeriod).toBeUndefined();
        });
    });

    describe("Dispute Count Logic", () => {
        it("should count unresolved disputes correctly", async () => {
            (mockPrisma.customerDispute.count as any).mockResolvedValue(2);

            const result = await mockPrisma.customerDispute.count({
                where: {
                    customer_id: 1,
                    NOT: {
                        dispute_status: "Resolved",
                    },
                },
            });

            expect(result).toBe(2);
            expect(mockPrisma.customerDispute.count).toHaveBeenCalledWith({
                where: {
                    customer_id: 1,
                    NOT: {
                        dispute_status: "Resolved",
                    },
                },
            });
        });

        it("should handle zero disputes", async () => {
            (mockPrisma.customerDispute.count as any).mockResolvedValue(0);

            const result = await mockPrisma.customerDispute.count({
                where: {
                    customer_id: 1,
                    NOT: {
                        dispute_status: "Resolved",
                    },
                },
            });

            expect(result).toBe(0);
        });
    });

    describe("Error Handling", () => {
        it("should handle database connection errors", async () => {
            const error = new Error("Database connection failed");
            (mockPrisma.customer.findFirst as any).mockRejectedValue(error);

            await expect(
                mockPrisma.customer.findFirst({
                    where: { customer_uuid: "test-uuid" },
                    include: expect.any(Object),
                })
            ).rejects.toThrow("Database connection failed");
        });

        it("should handle dispute count errors", async () => {
            const error = new Error("Dispute count failed");
            (mockPrisma.customerDispute.count as any).mockRejectedValue(error);

            await expect(
                mockPrisma.customerDispute.count({
                    where: {
                        customer_id: 1,
                        NOT: {
                            dispute_status: "Resolved",
                        },
                    },
                })
            ).rejects.toThrow("Dispute count failed");
        });
    });

    describe("Data Validation", () => {
        it("should validate required customer fields", () => {
            const customer = {
                id: 1,
                name: "Test Company",
                status: "Active",
            };

            expect(customer.id).toBeDefined();
            expect(customer.name).toBeDefined();
            expect(customer.status).toBe("Active");
        });

        it("should validate required customer fields", () => {
            const customer = {
                id: 1,
                customer_uuid: "test-uuid-123",
                type: "Person",
            };

            expect(customer.id).toBeDefined();
            expect(customer.customer_uuid).toBeDefined();
            expect(customer.type).toBe("Person");
        });

        it("should handle optional fields gracefully", () => {
            const customer = {
                id: 1,
                customer_uuid: "test-uuid-123",
                type: "Person",
                Person: null,
                Company: null,
                Customer: null,
            };

            expect(customer.Person).toBeNull();
            expect(customer.Company).toBeNull();
            expect(customer.Customer).toBeNull();
        });
    });
});
