import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPrismaMock } from "@/test/mocks/prisma";

vi.mock("@/server/integrations/billing/staleSyncExecutionSweeper", () => ({
    sweepStaleSyncExecutions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/services/ConnectorSyncExecutionService", () => ({
    ConnectorSyncExecutionService: {
        getLastScheduledIncrementalSuccessAt: vi.fn(),
        hasScheduledIncrementalSuccess: vi.fn(),
    },
}));

vi.mock("@/server/services/BillingConnectorSyncService", () => ({
    BillingConnectorSyncService: {
        getInstance: vi.fn().mockReturnValue({
            runSync: vi.fn(),
        }),
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const mock = createPrismaMock();
    return { prisma: mock };
});

import { prisma } from "@/lib/prisma";
import syncBillingConnectorsJob from "@/server/cron-jobs/syncBillingConnectors";
import { BillingConnectorSyncService } from "@/server/services/BillingConnectorSyncService";
import { ConnectorSyncExecutionService } from "@/server/services/ConnectorSyncExecutionService";

const mockPrisma = prisma as unknown as ReturnType<typeof createPrismaMock>;
const mockRunSync = vi.mocked(
    BillingConnectorSyncService.getInstance().runSync
);
const mockLastSuccess = vi.mocked(
    ConnectorSyncExecutionService.getLastScheduledIncrementalSuccessAt
);
const mockHasIncrementalSuccess = vi.mocked(
    ConnectorSyncExecutionService.hasScheduledIncrementalSuccess
);

const baseConnector = {
    id: 1,
    account_id: 42,
    provider: "PRIORITY" as const,
    status: "Active" as const,
    sync_enabled: true,
    sync_cron_expression: "0 */6 * * *",
    sync_mode: "INCREMENTAL" as const,
    modified_at: new Date("2026-06-20T00:00:00.000Z"),
    backfill_max_duration_seconds: 600,
};

describe("syncBillingConnectorsJob", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));
        (mockPrisma as any).billingConnector = {
            findMany: vi.fn(),
        };
        mockRunSync.mockResolvedValue({
            execution_id: "exec-1",
            status: "SUCCESS",
            sync_mode: "INCREMENTAL",
            trigger: "scheduled",
            entity_stats: {},
            duration_seconds: 1,
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("skips INCREMENTAL connectors that are not due", async () => {
        (mockPrisma as any).billingConnector.findMany.mockResolvedValue([
            baseConnector,
        ]);
        mockLastSuccess.mockResolvedValue(
            new Date("2026-06-28T12:00:00.000Z")
        );
        mockHasIncrementalSuccess.mockResolvedValue(true);
        vi.setSystemTime(new Date("2026-06-28T14:00:00.000Z"));

        const result = await syncBillingConnectorsJob();

        expect(mockRunSync).not.toHaveBeenCalled();
        expect(result.summary).toMatchObject({ processed: 0, skipped: 1 });
    });

    it("runs INCREMENTAL connectors that are due", async () => {
        (mockPrisma as any).billingConnector.findMany.mockResolvedValue([
            baseConnector,
        ]);
        mockLastSuccess.mockResolvedValue(
            new Date("2026-06-28T05:00:00.000Z")
        );
        mockHasIncrementalSuccess.mockResolvedValue(true);

        const result = await syncBillingConnectorsJob();

        expect(mockRunSync).toHaveBeenCalledWith({
            accountId: 42,
            mode: "incremental",
            trigger: "scheduled",
            skipAntiSpam: true,
        });
        expect(result.summary).toMatchObject({ processed: 1, skipped: 0 });
    });

    it("always processes BACKFILL connectors regardless of cron", async () => {
        (mockPrisma as any).billingConnector.findMany.mockResolvedValue([
            {
                ...baseConnector,
                sync_mode: "BACKFILL",
            },
        ]);

        const result = await syncBillingConnectorsJob();

        expect(mockRunSync).toHaveBeenCalledWith({
            accountId: 42,
            mode: "backfill",
            trigger: "scheduled",
            skipAntiSpam: true,
        });
        expect(mockLastSuccess).not.toHaveBeenCalled();
        expect(result.summary).toMatchObject({ processed: 1, skipped: 0 });
    });

    it("runs post-backfill INCREMENTAL connectors without prior scheduled success", async () => {
        (mockPrisma as any).billingConnector.findMany.mockResolvedValue([
            baseConnector,
        ]);
        mockLastSuccess.mockResolvedValue(null);
        mockHasIncrementalSuccess.mockResolvedValue(false);

        await syncBillingConnectorsJob();

        expect(mockRunSync).toHaveBeenCalledTimes(1);
    });
});
