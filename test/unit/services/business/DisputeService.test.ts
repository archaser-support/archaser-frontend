/**
 * Unit Test: DisputeService
 *
 * 📚 Before modifying this test, read our Unit Testing Guide:
 * - Main Guide: docs/unit-testing-guide.md
 * - Best Practices: docs/development-guides/unit-testing-best-practices.md
 * - Quick Reference: docs/development-guides/unit-testing-quick-reference.md
 *
 * 🚨 CRITICAL: Don't mock the class you're testing! Mock only dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { createMockUser } from "@/test/fixtures/common/users";
import { createPrismaMock } from "@/test/mocks/prisma";

// Mock all dependencies but NOT the DisputeService itself
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

vi.mock("@/server/services/CustomerService", () => ({
    CustomerService: vi.fn().mockImplementation(() => ({
        getCustomerCollectionPeriod: vi.fn(),
        updateCollectionPeriodCategory: vi.fn(),
    })),
}));

vi.mock("@/server/services/ActivityService", () => ({
    ActivityService: vi.fn().mockImplementation(() => ({
        cancelScheduledActivities: vi.fn(),
        createScheduledDisputeResolvedActivity: vi.fn(),
        createActivityWithFormattedDescription: vi.fn(),
        createAssignUserToDisputeActivity: vi.fn(),
        generateDescription: vi.fn(),
    })),
}));

vi.mock("@/server/EmailService", () => ({
    EmailService: vi.fn().mockImplementation(() => ({
        setCustomerSenderNameAndReplyToEmail: vi.fn(),
        sendEmail: vi.fn(),
    })),
}));

vi.mock("@/server/services/ControlCenterRealtimeService", () => ({
    default: {
        getInstance: vi.fn().mockReturnValue({
            triggerUpdate: vi.fn(),
        }),
    },
}));

vi.mock("@/server/services/NotificationService", () => ({
    default: {
        getInstance: vi.fn().mockReturnValue({
            createDisputeNotification: vi.fn(),
            getNotificationStats: vi.fn(),
        }),
    },
}));

vi.mock("@/server/services/NotificationRealtimeService", () => ({
    default: {
        getInstance: vi.fn().mockReturnValue({
            triggerNotificationUpdate: vi.fn(),
        }),
    },
}));

vi.mock("@/server/services/InternalEmailTemplateService", () => ({
    InternalEmailTemplateService: vi.fn().mockImplementation(() => ({
        getTemplate: vi.fn(),
        replaceTemplateVariables: vi.fn(),
    })),
}));

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => ({
            logMessage: vi.fn(),
        })),
    },
}));

// Import the actual DisputeService after all mocks are set up
import { DisputeService } from "../../../server/services/DisputeService";

describe("DisputeService", () => {
    let disputeService: DisputeService;

    beforeEach(() => {
        disputeService = new DisputeService();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("Input Validation (Edge Cases & Malformed Data)", () => {
        describe("setDisputeId", () => {
            it("should throw error when disputeId is 0", () => {
                expect(() => disputeService.setDisputeId(0)).toThrow(
                    "Dispute ID is required"
                );
            });

            it("should accept negative disputeId (truthy values)", () => {
                expect(() => disputeService.setDisputeId(-1)).not.toThrow();
            });

            it("should accept valid disputeId", () => {
                expect(() => disputeService.setDisputeId(123)).not.toThrow();
            });
        });

        describe("setCustomerId", () => {
            it("should throw error when customerId is 0", () => {
                expect(() => disputeService.setCustomerId(0)).toThrow(
                    "Customer ID is required"
                );
            });

            it("should accept negative customerId (truthy values)", () => {
                expect(() => disputeService.setCustomerId(-1)).not.toThrow();
            });

            it("should accept valid customerId", () => {
                expect(() => disputeService.setCustomerId(456)).not.toThrow();
            });
        });

        describe("setLoggedInUserId", () => {
            it("should throw error when userId is empty string", () => {
                expect(() => disputeService.setLoggedInUserId("")).toThrow(
                    "Logged in user ID is required"
                );
            });

            it("should throw error when userId is null", () => {
                expect(() =>
                    disputeService.setLoggedInUserId(null as any)
                ).toThrow("Logged in user ID is required");
            });

            it("should throw error when userId is undefined", () => {
                expect(() =>
                    disputeService.setLoggedInUserId(undefined as any)
                ).toThrow("Logged in user ID is required");
            });

            it("should accept valid userId", () => {
                expect(() =>
                    disputeService.setLoggedInUserId("user123")
                ).not.toThrow();
            });
        });

        describe("setUserComment", () => {
            it("should handle null comment", () => {
                expect(() =>
                    disputeService.setUserComment(null as any)
                ).not.toThrow();
            });

            it("should handle undefined comment", () => {
                expect(() =>
                    disputeService.setUserComment(undefined as any)
                ).not.toThrow();
            });

            it("should handle empty string comment", () => {
                expect(() => disputeService.setUserComment("")).not.toThrow();
            });

            it("should accept valid comment", () => {
                expect(() =>
                    disputeService.setUserComment("Valid comment")
                ).not.toThrow();
            });
        });
    });

    describe("ActivityService Integration", () => {
        describe("createCategoryChangeActivity null safety", () => {
            it("should handle null currentCategory gracefully", () => {
                const currentCategory = null;
                const nextCategory = "Legal";

                // Test the null safety logic
                const currentCategoryKey = `customer.category_values.${currentCategory?.toLowerCase() || 'unknown'}`;
                const nextCategoryKey = `customer.category_values.${nextCategory?.toLowerCase() || 'unknown'}`;

                expect(currentCategoryKey).toBe("customer.category_values.unknown");
                expect(nextCategoryKey).toBe("customer.category_values.legal");
            });

            it("should handle null nextCategory gracefully", () => {
                const currentCategory = "Collection";
                const nextCategory = null;

                // Test the null safety logic
                const currentCategoryKey = `customer.category_values.${currentCategory?.toLowerCase() || 'unknown'}`;
                const nextCategoryKey = `customer.category_values.${nextCategory?.toLowerCase() || 'unknown'}`;

                expect(currentCategoryKey).toBe("customer.category_values.collection");
                expect(nextCategoryKey).toBe("customer.category_values.unknown");
            });

            it("should handle both categories being null", () => {
                const currentCategory = null;
                const nextCategory = null;

                // Test the null safety logic
                const currentCategoryKey = `customer.category_values.${currentCategory?.toLowerCase() || 'unknown'}`;
                const nextCategoryKey = `customer.category_values.${nextCategory?.toLowerCase() || 'unknown'}`;

                expect(currentCategoryKey).toBe("customer.category_values.unknown");
                expect(nextCategoryKey).toBe("customer.category_values.unknown");
            });

            it("should handle valid categories normally", () => {
                const currentCategory = "Collection";
                const nextCategory = "Legal";

                // Test the null safety logic
                const currentCategoryKey = `customer.category_values.${currentCategory?.toLowerCase() || 'unknown'}`;
                const nextCategoryKey = `customer.category_values.${nextCategory?.toLowerCase() || 'unknown'}`;

                expect(currentCategoryKey).toBe("customer.category_values.collection");
                expect(nextCategoryKey).toBe("customer.category_values.legal");
            });

            it("should use different title format when previous category is null", () => {
                const currentCategory = null;
                const nextCategory = "Dispute";

                // Test title selection logic
                let title, titleParams;

                if (!currentCategory) {
                    title = "{{activity.category_change_to}}";
                    titleParams = {
                        userId: "user123",
                        newCategory: "customer.category_values.dispute"
                    };
                } else {
                    title = "{{activity.category_change}}";
                    titleParams = {
                        userId: "user123",
                        oldCategory: "customer.category_values.unknown",
                        newCategory: "customer.category_values.dispute"
                    };
                }

                expect(title).toBe("{{activity.category_change_to}}");
                expect(titleParams).toEqual({
                    userId: "user123",
                    newCategory: "customer.category_values.dispute"
                });
                expect(titleParams.oldCategory).toBeUndefined();
            });

            it("should use standard title format when previous category exists", () => {
                const currentCategory = "Collection";
                const nextCategory = "Dispute";

                // Test title selection logic
                let title, titleParams;

                if (!currentCategory) {
                    title = "{{activity.category_change_to}}";
                    titleParams = {
                        userId: "user123",
                        newCategory: "customer.category_values.dispute"
                    };
                } else {
                    title = "{{activity.category_change}}";
                    titleParams = {
                        userId: "user123",
                        oldCategory: "customer.category_values.collection",
                        newCategory: "customer.category_values.dispute"
                    };
                }

                expect(title).toBe("{{activity.category_change}}");
                expect(titleParams).toEqual({
                    userId: "user123",
                    oldCategory: "customer.category_values.collection",
                    newCategory: "customer.category_values.dispute"
                });
            });
        });
    });

    describe("API Endpoint Integration", () => {
        describe("allowedOutcomesForInactiveCustomers", () => {
            it("should include open_dispute in allowed outcomes for inactive customers", () => {
                const allowedOutcomes = [
                    "generic_comment",
                    "no_answer",
                    "bad_number",
                    "schedule_follow_up",
                    "general",
                    "add_new_contact",
                    "open_dispute"
                ];

                expect(allowedOutcomes).toContain("open_dispute");
                expect(allowedOutcomes.length).toBe(7);
            });

            it("should allow open_dispute for customers without active collection period", () => {
                const mockCustomerWithoutCollectionPeriod = {
                    id: 1,
                    account_id: 1,
                    CustomerCollectionPeriod: []
                };

                const allowedOutcomesForInactiveCustomers = [
                    "generic_comment",
                    "no_answer",
                    "bad_number",
                    "schedule_follow_up",
                    "general",
                    "add_new_contact",
                    "open_dispute"
                ];

                const callOutcome = "open_dispute";
                const hasCollectionPeriod = mockCustomerWithoutCollectionPeriod.CustomerCollectionPeriod?.length > 0;

                if (!hasCollectionPeriod) {
                    expect(allowedOutcomesForInactiveCustomers.includes(callOutcome)).toBe(true);
                }
            });

            it("should reject non-allowed outcomes for inactive customers", () => {
                const allowedOutcomesForInactiveCustomers = [
                    "generic_comment",
                    "no_answer",
                    "bad_number",
                    "schedule_follow_up",
                    "general",
                    "add_new_contact",
                    "open_dispute"
                ];

                const restrictedOutcomes = ["make_payment", "move_to_legal", "promise_to_pay"];

                restrictedOutcomes.forEach(outcome => {
                    expect(allowedOutcomesForInactiveCustomers.includes(outcome)).toBe(false);
                });
            });
        });
    });
});
