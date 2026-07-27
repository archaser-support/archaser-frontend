
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock } from "@/test/mocks/prisma";
import { ActivityStatus } from "@/types/enums";

// Mock services
vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: vi.fn().mockImplementation(() => ({
        updateCollectionPeriodCategory: vi.fn(),
        calculateNextAutomatedActivityTime: vi.fn().mockResolvedValue(new Map([[102, { schedule_time: new Date() }]])),
    })),
}));

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn().mockReturnValue({
            logMessage: vi.fn(),
            getContext: vi.fn(),
        }),
    },
}));

// Mock Prisma
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const mock = createPrismaMock();
    return {
        prismaCron: () => mock,
    };
});

import { prismaCron } from "@/lib/prisma";
import { processAutomatedCollectionPeriods } from "@/server/cron-jobs/processAutomatedCollectionPeriods";

const mockPrisma = prismaCron() as unknown as ReturnType<typeof createPrismaMock>;

describe("processAutomatedCollectionPeriods", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock return values for commands used in cron job
        (mockPrisma.activity.update as any).mockResolvedValue({});
        (mockPrisma.customerCollectionPeriod.update as any).mockResolvedValue({});
        (mockPrisma.activity.updateMany as any).mockResolvedValue({ count: 1 });
        (mockPrisma.customerCollectionPeriod.updateMany as any).mockResolvedValue({ count: 1 });
    });

    it("should process Phase 1: Mark Last Steps correctly", async () => {
        // Mock Phase 1 data: Delivered activities that are last steps
        (mockPrisma.activity.findMany as any).mockResolvedValue([
            {
                id: 1,
                customer_id: 101,
                status: ActivityStatus.DELIVERED,
                created_at: new Date(),
                ActivitiesSequence: {
                    step: 5,
                    sequence_container_id: null,
                },
                CustomerCollectionPeriod: {
                    id: 1,
                    customer_id: 101,
                    last_automated_step: 4, // Current step is 4
                    Customer: { account_id: 1 },
                },
            },
        ]);

        // Mock Max Steps for Accounts
        (mockPrisma.activitiesSequence.groupBy as any).mockResolvedValue([
            {
                account_id: 1,
                sequence_container_id: null,
                _max: { step: 5 },
            },
        ]);

        // Mock Phase 2 & 3 empty to isolate Phase 1
        (mockPrisma.customerCollectionPeriod.findMany as any).mockResolvedValue([]);

        await processAutomatedCollectionPeriods();

        // Should update activity to mark is_last_step = true
        expect(mockPrisma.activity.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: { in: [1] } },
                data: { is_last_step: true },
            })
        );

        // Should update collection period to mark is_last_automated_step_delivered = true
        expect(mockPrisma.customerCollectionPeriod.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: { in: [1] } },
                data: { is_last_automated_step_delivered: true },
            })
        );
    });

    it("should process Phase 2: Prepare Next Activities", async () => {
        // Mock Phase 1 empty
        (mockPrisma.activity.findMany as any).mockResolvedValue([]);

        // Mock Phase 2 data: Collection periods waiting for next activity
        (mockPrisma.customerCollectionPeriod.findMany as any)
            .mockResolvedValueOnce([]) // Reset check (Agent->Automated logic)
            .mockResolvedValueOnce([ // Phase 2 query match
                {
                    id: 2,
                    customer_id: 102, // Match the ID in the default mock for calculateNextAutomatedActivityTime
                    current_category: "Automated",
                    last_automated_step: 1,
                    create_next_activity: false,
                    is_last_automated_step_delivered: true,
                    next_category: null,
                    Customer: { account_id: 1 },
                },
            ]);

        // Mock activities for this period
        (mockPrisma.activity.findFirst as any).mockResolvedValue({
            status: ActivityStatus.DELIVERED,
            actual_delivery_time: new Date(),
        });

        // Mock Sequence info
        (mockPrisma.activitiesSequence.findFirst as any).mockResolvedValue({
            days_after_previous: 3,
        });

        await processAutomatedCollectionPeriods();

        expect(mockPrisma.customerCollectionPeriod.findMany).toHaveBeenCalled();
        // Verify we tried to update the period
        expect(mockPrisma.customerCollectionPeriod.update).toHaveBeenCalled();
    });

    it("should process Sequence Reset (Agent -> Automated fresh transition)", async () => {
        // Mock manually changed collection periods
        (mockPrisma.customerCollectionPeriod.findMany as any).mockResolvedValueOnce([
            {
                id: 3,
                customer_id: 103,
                current_category: "Automated",
                previous_category: "Agent",
                last_automated_step: 0,
                create_next_activity: false,
                Customer: { account_id: 1 },
            }
        ]);

        // Mock customer data
        (mockPrisma.customer.findMany as any).mockResolvedValue([
            { id: 103, account_id: 1, sequence_container_id: null }
        ]);

        // Mock max steps (to confirm sequences exist)
        (mockPrisma.activitiesSequence.groupBy as any).mockResolvedValue([
            {
                account_id: 1,
                sequence_container_id: null,
                _max: { step: 5 },
            },
        ]);

        await processAutomatedCollectionPeriods();

        // Should enable activity creation
        expect(mockPrisma.customerCollectionPeriod.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 3 },
                data: expect.objectContaining({
                    create_next_activity: true,
                    is_last_automated_step_delivered: false,
                }),
            })
        );
    });

    it("excludes credit-only customers from automation cron queries", async () => {
        (mockPrisma.activity.findMany as any).mockResolvedValue([]);
        (mockPrisma.customerCollectionPeriod.findMany as any).mockResolvedValue(
            []
        );

        await processAutomatedCollectionPeriods();

        const phase1ActivityQuery = (
            mockPrisma.activity.findMany as any
        ).mock.calls.find(
            (call: any[]) =>
                call[0]?.where?.CustomerCollectionPeriod?.current_category ===
                "Automated"
        );
        expect(phase1ActivityQuery?.[0]?.where?.CustomerCollectionPeriod?.Customer).toEqual(
            expect.objectContaining({
                NOT: {
                    Account: {
                        has_collection: false,
                        has_credit_insurance: true,
                    },
                },
            })
        );

        const phase2PeriodQuery = (
            mockPrisma.customerCollectionPeriod.findMany as any
        ).mock.calls.find(
            (call: any[]) =>
                call[0]?.where?.current_category === "Automated" &&
                call[0]?.where?.create_next_activity === false
        );
        expect(phase2PeriodQuery?.[0]?.where?.Customer).toEqual(
            expect.objectContaining({
                automation_stuck_no_contacts: { not: true },
                NOT: {
                    Account: {
                        has_collection: false,
                        has_credit_insurance: true,
                    },
                },
            })
        );
    });
});
