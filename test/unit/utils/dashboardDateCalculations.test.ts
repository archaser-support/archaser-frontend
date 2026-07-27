import {
    describe,
    it,
    expect,
} from "vitest";

describe("Dashboard Date Calculations", () => {
    describe("Due Today Date Range", () => {
        it("should calculate correct date range for today", () => {
            const today = new Date("2025-09-25T00:00:00.000Z");
            const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
            const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

            // Should include all times on September 25, 2025
            expect(startOfDay.toISOString()).toBe("2025-09-25T00:00:00.000Z"); // September 25 00:00:00
            expect(endOfDay.toISOString()).toBe("2025-09-26T00:00:00.000Z"); // September 26 00:00:00

            // Test that dates within the range are included
            const testDates = [
                new Date("2025-09-25T00:00:00.000Z"), // Start of day
                new Date("2025-09-25T12:00:00.000Z"), // Middle of day
                new Date("2025-09-25T23:59:59.999Z"), // End of day
            ];

            testDates.forEach(date => {
                const isInRange = date >= startOfDay && date < endOfDay;
                expect(isInRange).toBe(true);
            });

            // Test that dates outside the range are excluded
            const excludedDates = [
                new Date("2025-09-24T23:59:59.999Z"), // Yesterday
                new Date("2025-09-26T00:00:00.000Z"), // Tomorrow
            ];

            excludedDates.forEach(date => {
                const isInRange = date >= startOfDay && date < endOfDay;
                expect(isInRange).toBe(false);
            });
        });
    });

    describe("Due This Week Date Range", () => {
        it("should calculate week range boundaries correctly", () => {
            const today = new Date("2025-09-25T00:00:00.000Z"); // Thursday
            const startOfWeek = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - today.getUTCDay()));
            const endOfWeek = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - today.getUTCDay() + 7));

            // Verify start of week is Sunday
            expect(startOfWeek.getUTCDay()).toBe(0);

            // Verify end of week is next Sunday
            expect(endOfWeek.getUTCDay()).toBe(0);

            // Verify the week span is 7 days
            const daysDiff = (endOfWeek.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24);
            expect(daysDiff).toBe(7);

            // Verify today falls within the calculated week
            const isInRange = today >= startOfWeek && today < endOfWeek;
            expect(isInRange).toBe(true);
        });
    });

    describe("Due This Month Date Range", () => {
        it("should calculate correct month range from today to end of month", () => {
            const today = new Date("2025-09-25T00:00:00.000Z");
            const endOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999));

            // Should end on September 30, 2025 at 23:59:59
            expect(endOfMonth.toISOString()).toBe("2025-09-30T23:59:59.999Z");

            // Test that dates from today to end of month are included
            const includedDates = [
                new Date("2025-09-25T00:00:00.000Z"), // Today
                new Date("2025-09-26T00:00:00.000Z"), // Tomorrow
                new Date("2025-09-30T23:59:59.999Z"), // End of month
            ];

            includedDates.forEach(date => {
                const isInRange = date >= today && date <= endOfMonth;
                expect(isInRange).toBe(true);
            });

            // Test that dates before today are excluded
            const excludedDates = [
                new Date("2025-09-24T23:59:59.999Z"), // Yesterday
                new Date("2025-10-01T00:00:00.000Z"), // Next month
            ];

            excludedDates.forEach(date => {
                const isInRange = date >= today && date <= endOfMonth;
                expect(isInRange).toBe(false);
            });
        });
    });

    describe("Due Next Month Date Range", () => {
        it("should calculate correct next month range", () => {
            const today = new Date("2025-09-25T00:00:00.000Z");
            const startOfNextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
            const endOfNextMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 1));

            // Should start from October 1, 2025
            expect(startOfNextMonth.toISOString()).toBe("2025-10-01T00:00:00.000Z"); // October 1 00:00:00

            // Should end on November 1, 2025 (exclusive)
            expect(endOfNextMonth.toISOString()).toBe("2025-11-01T00:00:00.000Z"); // November 1 00:00:00

            // Test that dates in next month are included
            const includedDates = [
                new Date("2025-10-01T00:00:00.000Z"), // Start of October
                new Date("2025-10-15T00:00:00.000Z"), // Middle of October
                new Date("2025-10-31T23:59:59.999Z"), // End of October
            ];

            includedDates.forEach(date => {
                const isInRange = date >= startOfNextMonth && date < endOfNextMonth;
                expect(isInRange).toBe(true);
            });

            // Test that dates outside next month are excluded
            const excludedDates = [
                new Date("2025-09-30T23:59:59.999Z"), // End of current month
                new Date("2025-11-01T00:00:00.000Z"), // Start of month after next
            ];

            excludedDates.forEach(date => {
                const isInRange = date >= startOfNextMonth && date < endOfNextMonth;
                expect(isInRange).toBe(false);
            });
        });
    });

    describe("Edge Cases", () => {
        it("should handle month boundaries correctly", () => {
            // Test with January (month 0)
            const january = new Date("2025-01-15T00:00:00.000Z");
            const endOfJanuary = new Date(Date.UTC(january.getUTCFullYear(), january.getUTCMonth() + 1, 0, 23, 59, 59, 999));
            expect(endOfJanuary.toISOString()).toBe("2025-01-31T23:59:59.999Z");

            // Test with December (month 11)
            const december = new Date("2025-12-15T00:00:00.000Z");
            const endOfDecember = new Date(Date.UTC(december.getUTCFullYear(), december.getUTCMonth() + 1, 0, 23, 59, 59, 999));
            expect(endOfDecember.toISOString()).toBe("2025-12-31T23:59:59.999Z");
        });

        it("should handle leap year February correctly", () => {
            const leapYear = new Date("2024-02-15T00:00:00.000Z");
            const endOfFebruary = new Date(Date.UTC(leapYear.getUTCFullYear(), leapYear.getUTCMonth() + 1, 0, 23, 59, 59, 999));
            expect(endOfFebruary.toISOString()).toBe("2024-02-29T23:59:59.999Z");
        });

        it("should handle non-leap year February correctly", () => {
            const nonLeapYear = new Date("2025-02-15T00:00:00.000Z");
            const endOfFebruary = new Date(Date.UTC(nonLeapYear.getUTCFullYear(), nonLeapYear.getUTCMonth() + 1, 0, 23, 59, 59, 999));
            expect(endOfFebruary.toISOString()).toBe("2025-02-28T23:59:59.999Z");
        });
    });

    describe("Timezone Considerations", () => {
        it("should work with UTC dates consistently", () => {
            // Test with UTC dates
            const utcDate = new Date("2025-09-25T00:00:00.000Z");
            const startOfDayUTC = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()));

            // Verify UTC date properties
            expect(startOfDayUTC.getUTCDate()).toBe(25);
            expect(startOfDayUTC.getUTCMonth()).toBe(8); // September is month 8 (0-indexed)
            expect(startOfDayUTC.getUTCFullYear()).toBe(2025);

            // Verify the UTC ISO string
            expect(startOfDayUTC.toISOString()).toBe("2025-09-25T00:00:00.000Z");
        });
    });
});

