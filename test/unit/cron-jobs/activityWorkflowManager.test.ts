import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPrismaMock } from "@/test/mocks/prisma";
import { ActivityStatus } from "@/types/enums";

// Mock services
vi.mock("@/server/services/ActivityService", () => ({
    ActivityService: vi.fn().mockImplementation(() => ({
        processTemplateContent: vi.fn().mockResolvedValue("mock content"),
        getNextActivityTime: vi.fn().mockReturnValue(new Date()),
        createAutomatedActivity: vi.fn().mockResolvedValue({ id: 999 }),
    })),
}));

vi.mock("@/server/services/CommunicationIntelligenceService", () => ({
    CommunicationIntelligenceService: vi.fn().mockImplementation(() => ({
        optimizeSendTime: vi.fn(),
    })),
}));

vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: vi.fn().mockImplementation(() => ({
        updateCollectionPeriodCategory: vi.fn(),
        calculateNextAutomatedActivityTime: vi.fn().mockResolvedValue(new Map()),
    })),
}));

vi.mock("@/server/services/LogService", () => ({
    LogService: class {
        static getInstance = vi.fn().mockReturnValue({
            logMessage: vi.fn(),
        });
        static getContext = vi.fn();
    },
}));

vi.mock("@/server/services/SMSVendorService", () => ({
    SMSVendorService: vi.fn().mockImplementation(() => ({
        sendSms: vi.fn().mockResolvedValue({ sid: "mock-sid" }),
    })),
}));

vi.mock("@/server/services/ControlCenterRealtimeService", () => ({
    default: {
        broadcastJobUpdate: vi.fn(),
        broadcastJobStep: vi.fn(),
    },
}));

const emailServiceSendEmailMock = vi.fn().mockResolvedValue({ messageId: "mock-id" });
vi.mock("@/server/EmailService", () => ({
    EmailService: vi.fn().mockImplementation(function (this: any) {
        this.setCustomerSenderNameAndReplyToEmail = vi.fn().mockResolvedValue(undefined);
        this.sendEmail = vi.fn().mockResolvedValue({ messageId: "mock-id" });
        return this;
    }),
}));

vi.mock("@/server/services/CollectionPeriodRevalidationService", () => ({
    revalidateStuckCollectionPeriodsForSequence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/emailTrackingUtils", () => ({
    addEmailTracking: (content: string) => content,
}));

// Mock Prisma
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    const mock = createPrismaMock();
    return {
        prismaCron: () => mock,
    };
});

import * as activitiesApi from "@/server/services/CollectionPeriodRevalidationService";
import { prismaCron } from "@/lib/prisma";
import {
    activityWorkflowManager,
    getActivityStatus,
    clearStuckFlagForCustomer,
} from "@/server/cron-jobs/activityWorkflowManager";
import { EmailService } from "@/server/EmailService";
import { ActivityService } from "@/server/services/ActivityService";

const mockPrisma = prismaCron() as unknown as ReturnType<typeof createPrismaMock>;

// =============================================================================
// Shared setup helpers
// =============================================================================

/** Minimal Phase 1: no activities to send. Phase 2 will still run if we set Phase 2 mocks. */
function setupPhase1NoActivities() {
    (mockPrisma.activity.findMany as any).mockImplementation((args: any) => {
        if (args?.where?.schedule_time !== undefined) {
            return Promise.resolve([]);
        }
        if (args?.where?.collection_period_id !== undefined) {
            return Promise.resolve([]);
        }
        return Promise.resolve([]);
    });
}

/** Phase 2: no collection periods (early exit, no $transaction). */
function setupPhase2NoPeriods() {
    (mockPrisma.customerCollectionPeriod.findMany as any).mockResolvedValue([]);
}

/** Phase 2: one collection period with full Customer/Contact shape for processing. */
function getOneCollectionPeriod(overrides: Record<string, unknown> = {}) {
    return [
        {
            id: 1,
            customer_id: 101,
            current_category: "Automated",
            last_automated_step: 0,
            create_next_activity: true,
            period_start_date: new Date(),
            period_end_date: null,
            previous_category: null,
            Customer: {
                account_id: 1,
                type: "Company",
                email: null,
                customer_uuid: "uuid-101",
                automation_stuck_no_contacts: false,
                language: "en",
                sequence_container_id: null,
                Person: { mobile: null, first_name: "John" },
                Company: {
                    name: "Acme",
                    Contact: {
                        id: 1,
                        email: "c@example.com",
                        mobile: null,
                        status: "Active",
                        first_name: "Jane",
                        company_wide_address: false,
                        receives_standard_reminder: true,
                        receives_escalated_reminder: true,
                    },
                },
                Country: { id: 1, iso2: "US" },
                State: { iso2: "CA" },
            },
            ...overrides,
        },
    ];
}

/** Phase 2: one period + sequences so processCollectionPeriod runs (can create or revert). */
function setupPhase2OnePeriodWithSequences(options: { sequencesEmpty?: boolean } = {}) {
    const periods = getOneCollectionPeriod();
    (mockPrisma.customerCollectionPeriod.findMany as any).mockImplementation((args: any) => {
        if (args?.where?.customer_id !== undefined && args?.select?.is_last_automated_step_delivered) {
            return Promise.resolve(periods);
        }
        if (args?.where?.create_next_activity === true) {
            return Promise.resolve(periods);
        }
        return Promise.resolve([]);
    });
    (mockPrisma.sequenceContainer.findMany as any).mockResolvedValue([]);
    (mockPrisma.activitiesSequence.findMany as any).mockResolvedValue(
        options.sequencesEmpty
            ? []
            : [
                  {
                      id: 1,
                      step: 1,
                      account_id: 1,
                      category: "Automated",
                      active: true,
                      sequence_container_id: null,
                      ActivitiesTemplate: {
                          type: "Email",
                          ActivityTemplateLanguage: [{ language: "en", subject: "Test", content: "Body" }],
                      },
                  },
              ]
    );
    (mockPrisma.activity.findFirst as any).mockResolvedValue(null);
    (mockPrisma.customerCollectionPeriod.updateMany as any).mockResolvedValue({ count: 1 });
    (mockPrisma.customerCollectionPeriod.update as any).mockResolvedValue(periods[0]);
    (mockPrisma.$transaction as any).mockImplementation((callback: any) => callback(mockPrisma));
}

/** Phase 1: one Email activity with one contact (triggers send path). */
function setupPhase1OneEmailActivityWithContact() {
    const activityWithContact = {
        id: 1,
        customer_id: 101,
        type: "Email",
        status: ActivityStatus.SCHEDULED,
        schedule_time: new Date(0),
        collection_period_id: 1,
        account_id: 1,
        Account: {
            id: 1,
            name: "Test",
            logo: null,
            sub_domain: "test",
            sms_fallback_enabled: false,
            sms_from_name: null,
        },
        ActivityContact: [
            {
                id: 1,
                contact_id: 1,
                status: "Scheduled",
                Contact: {
                    id: 1,
                    first_name: "Jane",
                    last_name: "Doe",
                    email: "jane@example.com",
                    phone: null,
                    mobile: null,
                    role: null,
                    company_wide_address: false,
                },
            },
        ],
        CustomerCollectionPeriod: {
            id: 1,
            customer_id: 101,
            current_category: "Automated",
            previous_category: null,
            Customer: {
                type: "Company",
                customer_uuid: "u",
                language: "en",
                Person: { first_name: "John", last_name: "Doe", mobile: null },
                Company: { name: "Acme", Contact: { email: "c@example.com", first_name: "C", last_name: "C" } },
                Country: { id: 1, iso2: "US" },
            },
        },
        ActivitiesSequence: {
            id: 1,
            step: 1,
            category: "Automated",
            activity_template_id: 1,
            activity_type: "Email",
            step_type: null,
        },
    };
    (mockPrisma.activity.findMany as any).mockImplementation((args: any) => {
        if (args?.where?.schedule_time !== undefined) {
            return Promise.resolve([activityWithContact]);
        }
        return Promise.resolve([]);
    });
    (mockPrisma.activityTemplateLanguage.findFirst as any).mockResolvedValue({
        language: "en",
        subject: "Test",
        content: "Hello",
    });
    (mockPrisma.activity.update as any).mockResolvedValue(activityWithContact);
    (mockPrisma.activityContact as any).updateMany = vi.fn().mockResolvedValue({ count: 1 });
    (mockPrisma.customerCollectionPeriod.findUnique as any).mockResolvedValue({
        id: 1,
        Customer: { account_id: 1, sequence_container_id: null },
    });
    (mockPrisma.account.findUnique as any).mockResolvedValue({
        id: 1,
        wait_days_after_automated: 0,
    });
}

/** Phase 1: one activity with no contacts (skipped, counted). */
function setupPhase1OneActivityWithNoContacts() {
    (mockPrisma.activity.findMany as any).mockImplementation((args: any) => {
        if (args?.where?.schedule_time !== undefined) {
            return Promise.resolve([
                {
                    id: 2,
                    type: "Email",
                    status: ActivityStatus.SCHEDULED,
                    schedule_time: new Date(0),
                    ActivityContact: [],
                    Account: {},
                    CustomerCollectionPeriod: { Customer: {} },
                    ActivitiesSequence: {},
                },
            ]);
        }
        return Promise.resolve([]);
    });
}

/** Default mocks used by both phases (transaction, findFirst no duplicate). */
function applyDefaultMocks() {
    (mockPrisma.customerCollectionPeriod.updateMany as any).mockResolvedValue({ count: 1 });
    (mockPrisma.activity.findFirst as any).mockResolvedValue(null);
    (mockPrisma.customerCollectionPeriod.findUnique as any).mockResolvedValue({ last_automated_step: 0 });
    (mockPrisma.$transaction as any).mockImplementation((callback: any) => callback(mockPrisma));
}

// =============================================================================
// getActivityStatus (pure function)
// =============================================================================

describe("getActivityStatus", () => {
    it("returns SCHEDULED for SMS", () => {
        expect(getActivityStatus("SMS")).toBe(ActivityStatus.SCHEDULED);
    });
    it("returns SCHEDULED for Email", () => {
        expect(getActivityStatus("Email")).toBe(ActivityStatus.SCHEDULED);
    });
    it("returns DISPUTE for Dispute", () => {
        expect(getActivityStatus("Dispute")).toBe(ActivityStatus.DISPUTE);
    });
    it("returns DISPUTE for Internal", () => {
        expect(getActivityStatus("Internal")).toBe(ActivityStatus.DISPUTE);
    });
    it("returns SCHEDULED for Call", () => {
        expect(getActivityStatus("Call")).toBe(ActivityStatus.SCHEDULED);
    });
    it("returns SCHEDULED for Promise_to_pay", () => {
        expect(getActivityStatus("Promise_to_pay")).toBe(ActivityStatus.SCHEDULED);
    });
    it("returns SCHEDULED for unknown type (default)", () => {
        expect(getActivityStatus("Unknown" as any)).toBe(ActivityStatus.SCHEDULED);
    });
});

// =============================================================================
// clearStuckFlagForCustomer
// =============================================================================

describe("clearStuckFlagForCustomer", () => {
    const revalidateMock = vi.mocked(activitiesApi.revalidateStuckCollectionPeriodsForSequence);

    beforeEach(() => {
        revalidateMock.mockClear();
    });

    it("returns early when customer not found", async () => {
        (mockPrisma.customer.findUnique as any).mockResolvedValue(null);

        await clearStuckFlagForCustomer(999);

        expect(revalidateMock).not.toHaveBeenCalled();
    });

    it("calls revalidateStuckCollectionPeriodsForSequence with account and container when customer found", async () => {
        (mockPrisma.customer.findUnique as any).mockResolvedValue({
            account_id: 5,
            sequence_container_id: 10,
        });

        await clearStuckFlagForCustomer(1);

        expect(revalidateMock).toHaveBeenCalledWith(5, 10);
    });

    it("calls revalidate with null sequence_container_id when customer has none", async () => {
        (mockPrisma.customer.findUnique as any).mockResolvedValue({
            account_id: 3,
            sequence_container_id: null,
        });

        await clearStuckFlagForCustomer(2);

        expect(revalidateMock).toHaveBeenCalledWith(3, null);
    });
});

// =============================================================================
// activityWorkflowManager
// =============================================================================

describe("activityWorkflowManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        applyDefaultMocks();
    });

    describe("Phase 1: Send activities", () => {
        it("runs Phase 1 then Phase 2 when no activities to send", async () => {
            setupPhase1NoActivities();
            setupPhase2OnePeriodWithSequences({ sequencesEmpty: false });

            await activityWorkflowManager();

            expect(mockPrisma.activity.findMany).toHaveBeenCalled();
            expect(mockPrisma.customerCollectionPeriod.findMany).toHaveBeenCalled();
            expect(mockPrisma.activitiesSequence.findMany).toHaveBeenCalled();
        });

        it("processes Phase 1 and fetches activities to send (schedule_time query)", async () => {
            setupPhase1OneEmailActivityWithContact();
            setupPhase2NoPeriods();

            await activityWorkflowManager();

            const activitiesToSendCall = (mockPrisma.activity.findMany as any).mock.calls.find(
                (call: any) => call[0]?.where?.schedule_time !== undefined
            );
            expect(activitiesToSendCall).toBeDefined();
        });

        it("skips activity when it has no contacts", async () => {
            setupPhase1OneActivityWithNoContacts();
            setupPhase2NoPeriods();

            await activityWorkflowManager();

            const emailServiceInstances = (EmailService as any).mock?.results?.map((r: any) => r.value) ?? [];
            const sendCallCount = emailServiceInstances.reduce(
                (n: number, i: any) => n + (i?.sendEmail?.mock?.calls?.length ?? 0),
                0
            );
            expect(sendCallCount).toBe(0);
        });
    });

    describe("Phase 2: Generate activities", () => {
        it("processes collection periods successfully", async () => {
            setupPhase1NoActivities();
            (mockPrisma.activity.findMany as any).mockImplementation((args: any) => {
                if (args?.where?.schedule_time !== undefined) return Promise.resolve([]);
                return Promise.resolve([]);
            });
            setupPhase2OnePeriodWithSequences();

            await activityWorkflowManager();

            expect(mockPrisma.customerCollectionPeriod.findMany).toHaveBeenCalled();
            expect(mockPrisma.activitiesSequence.findMany).toHaveBeenCalled();
            expect(mockPrisma.activity.findMany).toHaveBeenCalled();
        });

        it("skips transaction when no collection periods found", async () => {
            setupPhase1NoActivities();
            setupPhase2NoPeriods();

            await activityWorkflowManager();

            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });

        it("reverts period when no sequences exist (periodsToRevert path)", async () => {
            setupPhase1NoActivities();
            setupPhase2OnePeriodWithSequences({ sequencesEmpty: true });

            await activityWorkflowManager();

            expect(mockPrisma.customerCollectionPeriod.update).toHaveBeenCalled();
        });

        it("runs Phase 2 with sequences and existing-activities fetch when period has sequences", async () => {
            setupPhase1NoActivities();
            setupPhase2OnePeriodWithSequences();

            await activityWorkflowManager();

            expect(mockPrisma.customerCollectionPeriod.findMany).toHaveBeenCalled();
            expect(mockPrisma.activitiesSequence.findMany).toHaveBeenCalled();
            const existingActivitiesCall = (mockPrisma.activity.findMany as any).mock.calls.find(
                (call: any) => call[0]?.where?.collection_period_id !== undefined
            );
            expect(existingActivitiesCall).toBeDefined();
        });

        it("filters Phase 2 by customerId when provided", async () => {
            setupPhase1NoActivities();
            setupPhase2OnePeriodWithSequences();

            await activityWorkflowManager(undefined, undefined, 123);

            const phase2Call = (mockPrisma.customerCollectionPeriod.findMany as any).mock.calls.find(
                (call: any) => call[0]?.where?.customer_id === 123
            );
            expect(phase2Call).toBeDefined();
        });
    });

    describe("Entry point and options", () => {
        it("invokes stepCollector with START and phase steps when provided", async () => {
            setupPhase1NoActivities();
            setupPhase2NoPeriods();
            const addStep = vi.fn();

            await activityWorkflowManager(undefined, undefined, undefined, undefined, { addStep });

            expect(addStep).toHaveBeenCalledWith(
                "START",
                "Starting activityWorkflowManager process",
                "INFO",
                expect.any(Object)
            );
            const stepNames = addStep.mock.calls.map((c: any) => c[0]);
            expect(stepNames).toContain("PHASE1_START");
        });

        it("invokes logCallback when provided", async () => {
            setupPhase1NoActivities();
            setupPhase2NoPeriods();
            const logCallback = vi.fn();

            await activityWorkflowManager(undefined, undefined, undefined, logCallback);

            expect(logCallback).toHaveBeenCalledWith(
                "Starting activityWorkflowManager process",
                "INFO",
                expect.any(Object)
            );
        });

        it("filters Phase 1 activities by customerId when provided", async () => {
            setupPhase1NoActivities();
            setupPhase2NoPeriods();

            await activityWorkflowManager(undefined, undefined, 456);

            const phase1Call = (mockPrisma.activity.findMany as any).mock.calls.find(
                (call: any) => call[0]?.where?.customer_id === 456
            );
            expect(phase1Call).toBeDefined();
        });

        it("adds SMS_DRY_RUN step when skipSmsSend is true", async () => {
            setupPhase1NoActivities();
            setupPhase2NoPeriods();
            const addStep = vi.fn();

            await activityWorkflowManager(
                undefined,
                undefined,
                undefined,
                undefined,
                { addStep },
                true
            );

            expect(addStep).toHaveBeenCalledWith(
                "SMS_DRY_RUN",
                "SMS dry run enabled - no actual SMS will be sent",
                "INFO",
                expect.any(Object)
            );
        });
    });

    describe("Error handling", () => {
        it("logs CRITICAL_ERROR and rethrows when Phase 2 findMany throws", async () => {
            setupPhase1NoActivities();
            (mockPrisma.customerCollectionPeriod.findMany as any).mockRejectedValue(new Error("DB error"));
            const addStep = vi.fn();

            await expect(activityWorkflowManager(undefined, undefined, undefined, undefined, { addStep })).rejects.toThrow(
                "DB error"
            );

            expect(addStep).toHaveBeenCalledWith(
                "CRITICAL_ERROR",
                expect.stringContaining("Critical error in activityWorkflowManager"),
                "ERROR",
                expect.any(Object)
            );
        });
    });

    describe("Legacy / existing behavior", () => {
        it("should handle concurrency limits (multiple periods)", async () => {
            const periods = Array.from({ length: 5 }, (_, i) => ({
                id: i + 1,
                customer_id: 100 + i,
                current_category: "Automated",
                last_automated_step: 0,
                create_next_activity: true,
                period_end_date: null,
                Customer: {
                    account_id: 1,
                    sequence_container_id: null,
                    language: "en",
                    automation_stuck_no_contacts: false,
                },
            }));
            setupPhase1NoActivities();
            (mockPrisma.customerCollectionPeriod.findMany as any).mockResolvedValue(periods);
            (mockPrisma.sequenceContainer.findMany as any).mockResolvedValue([]);
            (mockPrisma.activitiesSequence.findMany as any).mockResolvedValue([]);
            (mockPrisma.activity.findMany as any).mockImplementation((args: any) => {
                if (args?.where?.schedule_time !== undefined) return Promise.resolve([]);
                return Promise.resolve([]);
            });

            await activityWorkflowManager();

            expect(mockPrisma.customerCollectionPeriod.findMany).toHaveBeenCalled();
        });
    });
});
