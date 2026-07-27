import { beforeEach, describe, expect, it, vi } from "vitest";

const takeInsurancePolicyTrendSnapshots = vi.fn();
const takeCustomerPolicyTrendSnapshots = vi.fn();
const takeCreditDashboardDailySnapshots = vi.fn();
const fetchAndStoreCurrencyRates = vi.fn();
const syncAllCustomerPolicyGapAmounts = vi.fn();
const processDueNotificationsService = vi.fn();
const getAllPastDueInvoices = vi.fn();
const billingConnectorFindMany = vi.fn();
const customerFindMany = vi.fn();

vi.mock("@/server/services/creditInsurance/insurancePolicyTrendService", () => ({
    takeInsurancePolicyTrendSnapshots,
}));

vi.mock("@/server/services/creditInsurance/customerPolicyTrendService", () => ({
    takeCustomerPolicyTrendSnapshots,
}));

vi.mock("@/server/services/creditInsurance/creditDashboardSnapshotService", () => ({
    takeCreditDashboardDailySnapshots,
}));

vi.mock("@/server/services/currencyRateService", () => ({
    fetchAndStoreCurrencyRates,
}));

vi.mock("@/server/services/creditInsurance/syncCustomerPolicyGapAmounts", () => ({
    syncAllCustomerPolicyGapAmounts,
}));

vi.mock("@/server/services/DueNotificationService", () => ({
    DueNotificationService: vi.fn().mockImplementation(() => ({
        processDueNotifications: processDueNotificationsService,
    })),
}));

vi.mock("@/server/services/InvoiceService", () => ({
    InvoiceService: vi.fn().mockImplementation(() => ({
        getAllPastDueInvoices,
    })),
}));

vi.mock("@/server/services/BillingConnectorSyncService", () => ({
    BillingConnectorSyncService: {
        getInstance: () => ({
            runSync: vi.fn(),
        }),
    },
}));

vi.mock("@/server/integrations/billing/staleSyncExecutionSweeper", () => ({
    sweepStaleSyncExecutions: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        billingConnector: {
            findMany: billingConnectorFindMany,
        },
    },
    prismaCron: () => ({
        customer: {
            findMany: customerFindMany,
        },
    }),
}));

const serviceError = new Error("underlying service failed");

describe("cron wrappers re-throw on failure", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        [
            "takeInsurancePolicyTrendSnapshotsJob",
            "default",
            () => import("@/server/cron-jobs/takeInsurancePolicyTrendSnapshots"),
            () => takeInsurancePolicyTrendSnapshots.mockRejectedValue(serviceError),
        ],
        [
            "takeCustomerPolicyTrendSnapshotsJob",
            "default",
            () => import("@/server/cron-jobs/takeCustomerPolicyTrendSnapshots"),
            () => takeCustomerPolicyTrendSnapshots.mockRejectedValue(serviceError),
        ],
        [
            "takeCreditDashboardDailySnapshotsJob",
            "default",
            () => import("@/server/cron-jobs/takeCreditDashboardDailySnapshots"),
            () => takeCreditDashboardDailySnapshots.mockRejectedValue(serviceError),
        ],
        [
            "fetchCurrencyRatesJob",
            "default",
            () => import("@/server/cron-jobs/fetchCurrencyRates"),
            () => fetchAndStoreCurrencyRates.mockRejectedValue(serviceError),
        ],
        [
            "computeGapInBaseCurrencyJob",
            "default",
            () => import("@/server/cron-jobs/computeGapInBaseCurrency"),
            () => fetchAndStoreCurrencyRates.mockRejectedValue(serviceError),
        ],
        [
            "computeCustomerOverdueMetrics",
            "default",
            () => import("@/server/cron-jobs/computeCustomerOverdueMetrics"),
            () => customerFindMany.mockRejectedValue(serviceError),
        ],
        [
            "processDueNotifications",
            "processDueNotifications",
            () => import("@/server/cron-jobs/processDueNotifications"),
            () => processDueNotificationsService.mockRejectedValue(serviceError),
        ],
        [
            "handleOverdueInvoices",
            "handleOverdueInvoices",
            () => import("@/server/cron-jobs/handleOverdueInvoices"),
            () => getAllPastDueInvoices.mockRejectedValue(serviceError),
        ],
        [
            "syncBillingConnectorsJob",
            "default",
            () => import("@/server/cron-jobs/syncBillingConnectors"),
            () => billingConnectorFindMany.mockRejectedValue(serviceError),
        ],
    ])(
        "%s propagates errors instead of returning success: false",
        async (_name, exportName, importJob, setupFailure) => {
            setupFailure();

            const module = await importJob();
            const job = module[exportName as keyof typeof module] as () => Promise<unknown>;

            await expect(job()).rejects.toThrow("underlying service failed");
        }
    );

    it("logs an ERROR step before re-throwing for snapshot wrappers", async () => {
        takeInsurancePolicyTrendSnapshots.mockRejectedValue(serviceError);
        const addStep = vi.fn();
        const job = (await import("@/server/cron-jobs/takeInsurancePolicyTrendSnapshots"))
            .default;

        await expect(job(undefined, undefined, { addStep })).rejects.toThrow(
            "underlying service failed"
        );

        expect(addStep).toHaveBeenCalledWith(
            "INSURANCE_POLICY_TREND_ERROR",
            "underlying service failed",
            "ERROR",
            expect.objectContaining({ stack: expect.any(String) })
        );
    });
});
