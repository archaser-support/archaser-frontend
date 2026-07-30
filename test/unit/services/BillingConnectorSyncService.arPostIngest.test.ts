import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    applyConnectorArPostIngest: vi.fn(),
    shouldRunConnectorPaymentOnlyArFallback: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    assertMappingsCompleteForEnabledEntities: vi.fn(),
    createExecution: vi.fn(),
    findLatestRunning: vi.fn(),
    getLastCompletedAt: vi.fn(),
    updateExecution: vi.fn(),
    hashMapping: vi.fn(() => "hash"),
    createImportJob: vi.fn(),
    updateImportJobStatus: vi.fn(),
    sweepStaleSyncExecutions: vi.fn(),
    decryptCredentials: vi.fn(() => ({})),
}));

vi.mock("@/lib/prisma", () => {
    const client = {
        billingConnector: {
            findUnique: mocks.findUnique,
            update: mocks.update,
        },
    };
    return {
        prisma: client,
        prismaCron: () => client,
        prismaJobs: () => client,
    };
});

vi.mock("@/lib/metrics", () => ({
    billingConnectorSyncTotal: { inc: vi.fn() },
    billingConnectorSyncDuration: { observe: vi.fn() },
    billingConnectorErrorsTotal: { inc: vi.fn() },
    billingConnectorRecordsProcessed: { inc: vi.fn() },
}));

vi.mock("@/server/services/import/connectorArPostIngest", () => ({
    applyConnectorArPostIngest: mocks.applyConnectorArPostIngest,
    shouldRunConnectorPaymentOnlyArFallback:
        mocks.shouldRunConnectorPaymentOnlyArFallback,
}));

vi.mock("@/server/services/ConnectorFieldMappingService", () => ({
    ConnectorFieldMappingService: {
        getInstance: () => ({
            assertMappingsCompleteForEnabledEntities:
                mocks.assertMappingsCompleteForEnabledEntities,
        }),
    },
}));

vi.mock("@/server/services/ConnectorSyncExecutionService", () => ({
    ConnectorSyncExecutionService: {
        createExecution: mocks.createExecution,
        findLatestRunning: mocks.findLatestRunning,
        getLastCompletedAt: mocks.getLastCompletedAt,
        updateExecution: mocks.updateExecution,
        hashMapping: mocks.hashMapping,
    },
}));

vi.mock("@/server/services/ImportJobService", () => ({
    ImportJobService: {
        createImportJob: mocks.createImportJob,
        updateImportJobStatus: mocks.updateImportJobStatus,
    },
}));

vi.mock("@/server/integrations/billing/staleSyncExecutionSweeper", () => ({
    sweepStaleSyncExecutions: mocks.sweepStaleSyncExecutions,
}));

vi.mock("@/server/utils/billingConnectorCrypto", () => ({
    decryptCredentials: mocks.decryptCredentials,
}));

vi.mock("@/server/integrations/priority/PriorityProviderClient", () => ({
    PriorityProviderClient: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/server/services/MongoLogService", () => ({
    MongoLogService: vi.fn().mockImplementation(() => ({
        log: vi.fn(),
    })),
}));

vi.mock("@/server/services/import/updateAccountLastSyncDate", () => ({
    updateAccountLastSyncDate: vi.fn(),
}));

import { BillingConnectorSyncService } from "@/server/services/BillingConnectorSyncService";

function baseConnector(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        account_id: 100,
        provider: "Priority",
        status: "Active",
        sync_enabled: true,
        sync_mode: "INCREMENTAL",
        base_url: "https://example.test",
        credentials_encrypted: "enc",
        auth_type: "Basic",
        enabled_entities: ["Payment", "Invoice", "Contact"],
        backfill_start_date: null,
        include_older_open_invoices: true,
        skip_reporting_breach_on_backfill: false,
        backfill_started_at: new Date("2026-01-01T00:00:00.000Z"),
        backfill_max_duration_seconds: 3600,
        consecutive_auth_failures: 0,
        ConnectorFieldMapping: [
            { import_type: "Payment", mapping: [] },
            { import_type: "Invoice", mapping: [] },
            { import_type: "Contact", mapping: [] },
        ],
        ConnectorSyncState: [
            {
                id: 11,
                entity_type: "Payment",
                backfill_completed: true,
            },
            {
                id: 12,
                entity_type: "Invoice",
                backfill_completed: true,
            },
            {
                id: 13,
                entity_type: "Contact",
                backfill_completed: true,
            },
        ],
        ...overrides,
    };
}

describe("BillingConnectorSyncService AR post-ingest orchestration", () => {
    let syncEntitySpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.assertMappingsCompleteForEnabledEntities.mockResolvedValue(
            undefined
        );
        mocks.findLatestRunning.mockResolvedValue(null);
        mocks.getLastCompletedAt.mockResolvedValue(null);
        mocks.sweepStaleSyncExecutions.mockResolvedValue(undefined);
        mocks.createExecution.mockResolvedValue({
            _id: { toString: () => "exec-1" },
        });
        mocks.updateExecution.mockResolvedValue(undefined);
        mocks.createImportJob.mockResolvedValue({ id: "job-1" });
        mocks.updateImportJobStatus.mockResolvedValue(undefined);
        mocks.applyConnectorArPostIngest.mockResolvedValue({
            replayStats: null,
            maturityResult: { matured: 0, deferredRemaining: 0 },
        });
        // Real decision helper behavior for orchestration assertions.
        mocks.shouldRunConnectorPaymentOnlyArFallback.mockImplementation(
            (params: {
                invoiceArPostIngestRan: boolean;
                paymentAffectedCustomerIds: number[];
            }) =>
                !params.invoiceArPostIngestRan &&
                params.paymentAffectedCustomerIds.length > 0
        );

        syncEntitySpy = vi
            .spyOn(
                BillingConnectorSyncService.prototype as unknown as {
                    syncEntity: (...args: unknown[]) => Promise<unknown>;
                },
                "syncEntity"
            )
            .mockResolvedValue({
                stats: { pulled: 1, success: 1, failed: 0, skipped: 0 },
                affectedCustomerIds: [],
                capped: false,
                hadFailure: false,
            });
    });

    it("full Payment→Invoice sync runs post-ingest once after Invoice (no payment-only fallback)", async () => {
        mocks.findUnique.mockResolvedValue(baseConnector());

        syncEntitySpy.mockImplementation(async (params: { entityType: string }) => {
            if (params.entityType === "Payment") {
                return {
                    stats: { pulled: 1, success: 1, failed: 0, skipped: 0 },
                    affectedCustomerIds: [42],
                    capped: false,
                    hadFailure: false,
                };
            }
            if (params.entityType === "Invoice") {
                return {
                    stats: { pulled: 1, success: 1, failed: 0, skipped: 0 },
                    affectedCustomerIds: [42, 99],
                    capped: false,
                    hadFailure: false,
                };
            }
            return {
                stats: { pulled: 0, success: 0, failed: 0, skipped: 0 },
                affectedCustomerIds: [],
                capped: false,
                hadFailure: false,
            };
        });

        const service = BillingConnectorSyncService.getInstance();
        await service.runSync({
            accountId: 100,
            mode: "incremental",
            trigger: "manual",
            skipAntiSpam: true,
        });

        expect(mocks.applyConnectorArPostIngest).toHaveBeenCalledTimes(1);
        expect(mocks.applyConnectorArPostIngest).toHaveBeenCalledWith(
            expect.objectContaining({
                accountId: 100,
                customerIds: expect.arrayContaining([42, 99]),
                skipReportingBreachPromotion: false,
            })
        );
        const customerIds =
            mocks.applyConnectorArPostIngest.mock.calls[0][0].customerIds;
        expect(customerIds).toHaveLength(2);
        expect(mocks.shouldRunConnectorPaymentOnlyArFallback).toHaveBeenCalled();
        // Fallback decision sees Invoice already ran → should not apply again.
        const fallbackDecisions =
            mocks.shouldRunConnectorPaymentOnlyArFallback.mock.calls.map(
                (call) => call[0]
            );
        expect(
            fallbackDecisions.every(
                (d: { invoiceArPostIngestRan: boolean }) =>
                    d.invoiceArPostIngestRan === true
            )
        ).toBe(true);
    });

    it("payment-only path (Invoice skipped) runs fallback with maturity via applyConnectorArPostIngest", async () => {
        mocks.findUnique.mockResolvedValue(
            baseConnector({
                enabled_entities: ["Payment", "Contact"],
                ConnectorFieldMapping: [
                    { import_type: "Payment", mapping: [] },
                    { import_type: "Contact", mapping: [] },
                ],
                ConnectorSyncState: [
                    {
                        id: 11,
                        entity_type: "Payment",
                        backfill_completed: true,
                    },
                    {
                        id: 13,
                        entity_type: "Contact",
                        backfill_completed: true,
                    },
                ],
            })
        );

        syncEntitySpy.mockImplementation(async (params: { entityType: string }) => {
            if (params.entityType === "Payment") {
                return {
                    stats: { pulled: 2, success: 2, failed: 0, skipped: 0 },
                    affectedCustomerIds: [7],
                    capped: false,
                    hadFailure: false,
                };
            }
            return {
                stats: { pulled: 0, success: 0, failed: 0, skipped: 0 },
                affectedCustomerIds: [],
                capped: false,
                hadFailure: false,
            };
        });

        const service = BillingConnectorSyncService.getInstance();
        await service.runSync({
            accountId: 100,
            mode: "incremental",
            trigger: "manual",
            skipAntiSpam: true,
        });

        expect(mocks.applyConnectorArPostIngest).toHaveBeenCalledTimes(1);
        expect(mocks.applyConnectorArPostIngest).toHaveBeenCalledWith(
            expect.objectContaining({
                accountId: 100,
                customerIds: [7],
                skipReportingBreachPromotion: false,
            })
        );
        // applyConnectorArPostIngest always enables maturity + live refresh.
        expect(
            mocks.shouldRunConnectorPaymentOnlyArFallback
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                invoiceArPostIngestRan: false,
                paymentAffectedCustomerIds: [7],
            })
        );
    });
});
