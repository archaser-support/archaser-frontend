import { describe, expect, it } from "vitest";

import { validateSyncCronExpression } from "@/server/services/BillingConnectorService";
import {
    areBackfillOptionsLocked,
    resolveBackfillStartDateChange,
    resolveIncludeOlderOpenInvoicesChange,
    resolveSkipReportingBreachOnBackfillChange,
} from "@/server/services/billingConnectorBackfillBounds";
import {
    cronToPreset,
    presetToCron,
} from "@/server/services/billingConnectorSchedule";

describe("validateSyncCronExpression", () => {
    it("accepts default every-6-hours schedule", () => {
        const result = validateSyncCronExpression("0 */6 * * *");
        expect(result.valid).toBe(true);
        expect(result.minIntervalMinutes).toBeGreaterThanOrEqual(30);
    });

    it("rejects schedules faster than 30 minutes", () => {
        const result = validateSyncCronExpression("*/15 * * * *");
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/30 minutes/);
    });

    it("rejects invalid cron syntax", () => {
        const result = validateSyncCronExpression("not-a-cron");
        expect(result.valid).toBe(false);
    });
});

describe("billing connector schedule preset contract", () => {
    it("accepts preset-generated daily cron", () => {
        const cron = presetToCron("daily", { dailyTimeUtc: "03:00" });
        const result = validateSyncCronExpression(cron);
        expect(result.valid).toBe(true);
        expect(cronToPreset(cron)).toEqual({
            schedule_preset: "daily",
            daily_time_utc: "03:00",
        });
    });

    it("accepts preset-generated weekly cron", () => {
        const cron = presetToCron("weekly", {
            dailyTimeUtc: "02:00",
            weeklyDay: 1,
        });
        const result = validateSyncCronExpression(cron);
        expect(result.valid).toBe(true);
        expect(cronToPreset(cron)).toEqual({
            schedule_preset: "weekly",
            daily_time_utc: "02:00",
            weekly_day: 1,
        });
    });
});

describe("billing connector backfill start-date lock seam", () => {
    it("treats backfill_started_at as lock and unlocks when cleared", () => {
        expect(areBackfillOptionsLocked(new Date())).toBe(true);
        expect(areBackfillOptionsLocked(null)).toBe(false);
    });

    it("rejects start-date mutation after backfill started until reset", () => {
        const result = resolveBackfillStartDateChange({
            backfillStartedAt: new Date("2024-01-01T12:00:00Z"),
            existingStartDate: new Date(Date.UTC(2024, 0, 1)),
            nextInput: "2024-06-01",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe("BACKFILL_OPTIONS_LOCKED");
        }
    });

    it("rejects include-older-open mutation after backfill started until reset", () => {
        const result = resolveIncludeOlderOpenInvoicesChange({
            backfillStartedAt: new Date("2024-01-01T12:00:00Z"),
            existingValue: true,
            nextInput: false,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe("BACKFILL_OPTIONS_LOCKED");
        }
    });

    it("rejects skip-reporting-breach mutation after backfill started until reset", () => {
        const result = resolveSkipReportingBreachOnBackfillChange({
            backfillStartedAt: new Date("2024-01-01T12:00:00Z"),
            existingValue: false,
            nextInput: true,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe("BACKFILL_OPTIONS_LOCKED");
        }
    });
});
