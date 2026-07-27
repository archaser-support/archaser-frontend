import moment from "moment-timezone";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { createPrismaMock } from "@/test/mocks/prisma";
import { ContactAvailability, SchedulingOptions } from "@/types/BusinessHours";


// Mock only the dependencies, not the class under test
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

// Import the real class after mocks are set up
import { BusinessHoursService } from "@/utils/businessHoursService";

describe("BusinessHoursService", () => {
    let businessHoursService: BusinessHoursService;

    beforeEach(() => {
        businessHoursService = BusinessHoursService.getInstance();
    });

    describe("getContactAvailability", () => {
        it("should return default availability", async () => {
            const result = await businessHoursService.getContactAvailability(1);

            expect(result).not.toBeNull();
            expect(result).toHaveProperty("businessHours");
            expect(result).toHaveProperty("preferredChannels");
            expect(result).toHaveProperty("urgencyLevels");

            if (result) {
                expect(result.businessHours).toHaveProperty("start");
                expect(result.businessHours).toHaveProperty("end");
                expect(result.businessHours).toHaveProperty("timezone");
                expect(result.businessHours).toHaveProperty("daysOfWeek");
                expect(Array.isArray(result.preferredChannels)).toBe(true);
                expect(result.urgencyLevels).toHaveProperty("urgent");
                expect(result.urgencyLevels).toHaveProperty("emergency");
            }
        });

        it("should return cached result for same contact", async () => {
            const result1 =
                await businessHoursService.getContactAvailability(1);
            const result2 =
                await businessHoursService.getContactAvailability(1);

            expect(result1).toEqual(result2);
        });

        it("should clear cache when requested", async () => {
            const result1 =
                await businessHoursService.getContactAvailability(1);
            businessHoursService.clearContactAvailabilityCacheForContact(1);
            const result2 =
                await businessHoursService.getContactAvailability(1);

            // Results should be the same since it uses default availability
            expect(result1).toEqual(result2);
        });
    });

    describe("scheduleWithBusinessHours", () => {
        it("should schedule within business hours when time is valid", async () => {
            const baseDate = new Date("2024-01-15T10:00:00Z"); // Monday 10 AM
            const options: SchedulingOptions = {
                contactId: 1,
                urgency: "normal",
                channel: "email",
                businessHoursOnly: true,
            };

            const result = await businessHoursService.scheduleWithBusinessHours(
                baseDate,
                options
            );

            expect(result).toHaveProperty("isBusinessHours");
            expect(result).toHaveProperty("warnings");
            expect(result).toHaveProperty("suggestedTimes");
            expect(result).toHaveProperty("contactTimezone");
            expect(Array.isArray(result.warnings)).toBe(true);
            expect(Array.isArray(result.suggestedTimes)).toBe(true);
        });

        it("should handle scheduling outside business hours", async () => {
            const baseDate = new Date("2024-01-15T20:00:00Z"); // Monday 8 PM
            const options: SchedulingOptions = {
                contactId: 1,
                urgency: "normal",
                channel: "email",
                businessHoursOnly: true,
            };

            const result = await businessHoursService.scheduleWithBusinessHours(
                baseDate,
                options
            );

            expect(result).toHaveProperty("isBusinessHours");
            expect(result).toHaveProperty("warnings");
            expect(result).toHaveProperty("suggestedTimes");
            expect(result).toHaveProperty("contactTimezone");
            expect(Array.isArray(result.warnings)).toBe(true);
            expect(Array.isArray(result.suggestedTimes)).toBe(true);
        });
    });

    describe("updateResponsePattern", () => {
        it("should update response patterns", async () => {
            const contactId = 1;
            const channel = "email";
            const responseTime = 120;
            const success = true;

            await businessHoursService.updateResponsePattern(
                contactId,
                channel,
                responseTime,
                success
            );

            // Verify the method completes without error
            expect(true).toBe(true);
        });
    });

    describe("holiday and vacation handling", () => {
        it("should detect holidays and provide warnings", async () => {
            const baseDate = new Date("2024-01-01T10:00:00Z"); // New Year's Day
            const options: SchedulingOptions = {
                contactId: 1,
                urgency: "normal",
                channel: "email",
                businessHoursOnly: true,
            };

            const mockAvailability: ContactAvailability = {
                businessHours: {
                    start: "09:00",
                    end: "18:00",
                    timezone: "America/New_York",
                    daysOfWeek: [1, 2, 3, 4, 5],
                },
                preferredChannels: ["email", "sms"],
                urgencyLevels: {
                    urgent: true,
                    emergency: true,
                },
                holidays: [
                    {
                        dates: ["2024-01-01"],
                        description: "New Year's Day",
                    },
                ],
            };

            vi.spyOn(
                businessHoursService,
                "getContactAvailability"
            ).mockResolvedValue(mockAvailability);

            const result = await businessHoursService.scheduleWithBusinessHours(
                baseDate,
                options
            );

            expect(
                result.warnings.some((warning) =>
                    warning.includes("New Year's Day")
                )
            ).toBe(true);
        });

        it("should detect vacation periods", async () => {
            const baseDate = new Date("2024-07-15T10:00:00Z"); // During vacation
            const options: SchedulingOptions = {
                contactId: 1,
                urgency: "normal",
                channel: "email",
                businessHoursOnly: true,
            };

            const mockAvailability: ContactAvailability = {
                businessHours: {
                    start: "09:00",
                    end: "18:00",
                    timezone: "America/New_York",
                    daysOfWeek: [1, 2, 3, 4, 5],
                },
                preferredChannels: ["email", "sms"],
                urgencyLevels: {
                    urgent: true,
                    emergency: true,
                },
                vacation: {
                    startDate: "2024-07-10",
                    endDate: "2024-07-20",
                    description: "Summer Vacation",
                },
            };

            vi.spyOn(
                businessHoursService,
                "getContactAvailability"
            ).mockResolvedValue(mockAvailability);

            const result = await businessHoursService.scheduleWithBusinessHours(
                baseDate,
                options
            );

            expect(
                result.warnings.some((warning) =>
                    warning.includes("Summer Vacation")
                )
            ).toBe(true);
        });
    });
});
