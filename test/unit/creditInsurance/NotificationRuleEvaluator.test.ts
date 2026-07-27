import { describe, expect, it, vi } from "vitest";

import {
    NotificationRuleEvaluator,
    type NotificationRuleEvaluatorProvider,
} from "@/server/services/creditInsurance/NotificationRuleEvaluator";

function buildProvider(
    overrides: Partial<NotificationRuleEvaluatorProvider> = {}
): NotificationRuleEvaluatorProvider {
    const baseRuleSets = [
        {
            id: 1,
            trigger_type: "overdue_block" as const,
            enabled: true,
            rules: [
                {
                    id: 11,
                    advance_day_offsets: [],
                    role_defaults: ["CFO"] as any,
                    user_overrides: [],
                },
            ],
        },
        {
            id: 2,
            trigger_type: "capacity_gap" as const,
            enabled: true,
            rules: [
                {
                    id: 22,
                    advance_day_offsets: [],
                    role_defaults: ["CFO"] as any,
                    user_overrides: [],
                },
            ],
        },
        {
            id: 3,
            trigger_type: "entry_terms_breach" as const,
            enabled: true,
            rules: [
                {
                    id: 33,
                    advance_day_offsets: [],
                    role_defaults: ["CFO"] as any,
                    user_overrides: [],
                },
            ],
        },
        {
            id: 4,
            trigger_type: "action_window" as const,
            enabled: true,
            rules: [
                {
                    id: 44,
                    advance_day_offsets: [14, 7, 3],
                    role_defaults: ["CFO"] as any,
                    user_overrides: [],
                },
            ],
        },
        {
            id: 5,
            trigger_type: "limit_warnings" as const,
            enabled: true,
            rules: [
                {
                    id: 55,
                    advance_day_offsets: [],
                    role_defaults: ["CFO"] as any,
                    user_overrides: [],
                },
            ],
        },
    ];

    return {
        getRuleSets: vi.fn().mockResolvedValue(baseRuleSets),
        getOverdueBlockCustomers: vi
            .fn()
            .mockResolvedValue([{ customerId: 101, customerNumber: "C-101" }]),
        getCapacityGapCustomers: vi
            .fn()
            .mockResolvedValue([{ customerId: 102, customerNumber: "C-102" }]),
        getLimitWarningCustomers: vi
            .fn()
            .mockResolvedValue([{ customerId: 103, customerNumber: "C-103" }]),
        getEntryTermsBreachInvoices: vi.fn().mockResolvedValue([
            {
                invoiceId: 201,
                customerId: 101,
                invoiceNumber: "INV-201",
                hasZeroLimitWarning: false,
            },
        ]),
        getActionWindowInvoices: vi.fn().mockResolvedValue([
            {
                invoiceId: 202,
                customerId: 101,
                invoiceNumber: "INV-202",
                targetReportingDate: new Date("2026-07-07T00:00:00.000Z"),
                reportingBreach: false,
            },
        ]),
        getUsersByRoles: vi.fn().mockResolvedValue([
            { id: "u-role", active: true, creditInsuranceEligible: true },
            { id: "u-ineligible-role", active: true, creditInsuranceEligible: false },
            { id: "u-deactivated-role", active: false, creditInsuranceEligible: true },
        ]),
        getUsersByIds: vi.fn().mockResolvedValue([]),
        isDedupActive: vi.fn().mockResolvedValue(false),
        ...overrides,
    };
}

describe("NotificationRuleEvaluator", () => {
    it("returns intents across all five triggers", async () => {
        const provider = buildProvider();
        const evaluator = new NotificationRuleEvaluator(provider);

        const intents = await evaluator.evaluateCreditAccount({
            accountId: 10,
            now: new Date("2026-06-30T00:00:00.000Z"),
        });

        const triggerSet = new Set(intents.map((i) => i.triggerType));
        expect(triggerSet).toEqual(
            new Set([
                "overdue_block",
                "capacity_gap",
                "entry_terms_breach",
                "action_window",
                "limit_warnings",
            ])
        );
        expect(intents.length).toBeGreaterThan(0);
    });

    it("fires action-window advance only for matching offset day", async () => {
        const provider = buildProvider({
            getActionWindowInvoices: vi.fn().mockResolvedValue([
                {
                    invoiceId: 301,
                    customerId: 101,
                    invoiceNumber: "INV-301",
                    targetReportingDate: new Date("2026-07-07T00:00:00.000Z"), // +7d
                    reportingBreach: false,
                },
            ]),
        });
        const evaluator = new NotificationRuleEvaluator(provider);

        const intents = await evaluator.evaluateCreditAccount({
            accountId: 10,
            now: new Date("2026-06-30T00:00:00.000Z"),
        });
        const actionIntents = intents.filter(
            (intent) => intent.triggerType === "action_window"
        );
        expect(actionIntents.length).toBe(2);
        expect(
            actionIntents.every((intent) => intent.metadata.offsetDays === 7)
        ).toBe(true);
    });

    it("skips on-breach intents when dedup is already active", async () => {
        const provider = buildProvider({
            isDedupActive: vi.fn().mockResolvedValue(true),
        });
        const evaluator = new NotificationRuleEvaluator(provider);

        const intents = await evaluator.evaluateCreditAccount({
            accountId: 10,
            now: new Date("2026-06-30T00:00:00.000Z"),
        });
        expect(intents).toHaveLength(0);
    });

    it("merges role + overrides, excludes inactive unless explicitly overridden", async () => {
        const provider = buildProvider({
            getRuleSets: vi.fn().mockResolvedValue([
                {
                    id: 1,
                    trigger_type: "overdue_block",
                    enabled: true,
                    rules: [
                        {
                            id: 11,
                            advance_day_offsets: [],
                            role_defaults: ["CFO"],
                            user_overrides: [
                                { user_id: "u-ineligible-role" },
                                { user_id: "u-deactivated-role" },
                            ],
                        },
                    ],
                },
            ]),
            getUsersByIds: vi.fn().mockResolvedValue([
                {
                    id: "u-ineligible-role",
                    active: true,
                    creditInsuranceEligible: false,
                },
                {
                    id: "u-deactivated-role",
                    active: false,
                    creditInsuranceEligible: true,
                },
            ]),
        });
        const evaluator = new NotificationRuleEvaluator(provider);
        const intents = await evaluator.evaluateCreditAccount({
            accountId: 10,
            now: new Date("2026-06-30T00:00:00.000Z"),
        });

        const recipients = new Set(intents.map((intent) => intent.recipientUserId));
        expect(recipients.has("u-role")).toBe(true);
        expect(recipients.has("u-ineligible-role")).toBe(true);
        expect(recipients.has("u-deactivated-role")).toBe(false);
    });

    it("uses provided limit-warning signals (threshold coupling via provider data)", async () => {
        const provider = buildProvider({
            getLimitWarningCustomers: vi
                .fn()
                .mockResolvedValue([{ customerId: 555, customerNumber: "TH-555" }]),
        });
        const evaluator = new NotificationRuleEvaluator(provider);
        const intents = await evaluator.evaluateCreditAccount({
            accountId: 10,
            now: new Date("2026-06-30T00:00:00.000Z"),
        });

        const limitIntents = intents.filter(
            (intent) => intent.triggerType === "limit_warnings"
        );
        expect(limitIntents.length).toBe(2);
        expect(limitIntents[0].metadata.customerId).toBe(555);
    });
});
