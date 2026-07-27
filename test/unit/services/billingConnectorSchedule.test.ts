import { describe, expect, it } from "vitest";

import {
    computeNextScheduledSyncAt,
    cronToPreset,
    describeSchedule,
    hasCronFiredBetween,
    isConnectorDue,
    presetToCron,
} from "@/server/services/billingConnectorSchedule";

const every6h = "0 */6 * * *";

describe("billingConnectorSchedule", () => {
    describe("presetToCron", () => {
        it("maps hourly presets", () => {
            expect(presetToCron("every_4h")).toBe("0 */4 * * *");
            expect(presetToCron("every_6h")).toBe("0 */6 * * *");
            expect(presetToCron("every_12h")).toBe("0 */12 * * *");
        });

        it("maps daily preset with UTC time", () => {
            expect(
                presetToCron("daily", { dailyTimeUtc: "03:00" })
            ).toBe("0 3 * * *");
            expect(
                presetToCron("daily", { dailyTimeUtc: "14:30" })
            ).toBe("30 14 * * *");
        });

        it("maps weekly preset with UTC day and time", () => {
            expect(
                presetToCron("weekly", {
                    dailyTimeUtc: "02:00",
                    weeklyDay: 1,
                })
            ).toBe("0 2 * * 1");
        });

        it("rejects invalid daily_time_utc", () => {
            expect(() =>
                presetToCron("daily", { dailyTimeUtc: "25:00" })
            ).toThrow(/daily_time_utc/);
        });

        it("rejects invalid weekly_day", () => {
            expect(() =>
                presetToCron("weekly", { dailyTimeUtc: "03:00", weeklyDay: 7 })
            ).toThrow(/weekly_day/);
        });
    });

    describe("cronToPreset", () => {
        it("round-trips hourly presets", () => {
            expect(cronToPreset("0 */6 * * *")).toEqual({
                schedule_preset: "every_6h",
            });
        });

        it("round-trips daily preset fields", () => {
            expect(cronToPreset("0 3 * * *")).toEqual({
                schedule_preset: "daily",
                daily_time_utc: "03:00",
            });
        });

        it("round-trips weekly preset fields", () => {
            expect(cronToPreset("30 14 * * 1")).toEqual({
                schedule_preset: "weekly",
                daily_time_utc: "14:30",
                weekly_day: 1,
            });
        });

        it("returns custom for legacy expressions", () => {
            expect(cronToPreset("15 8 1 * *")).toEqual({
                schedule_preset: "custom",
            });
        });
    });

    describe("describeSchedule", () => {
        it("describes every-6-hours preset", () => {
            expect(describeSchedule("0 */6 * * *")).toBe("Every 6 hours UTC");
        });

        it("describes daily UTC schedule", () => {
            expect(describeSchedule("0 3 * * *")).toBe("Daily at 03:00 UTC");
        });

        it("describes weekly UTC schedule", () => {
            expect(describeSchedule("30 14 * * 1")).toBe(
                "Weekly on Monday at 14:30 UTC"
            );
        });

        it("falls back to raw cron for custom expressions", () => {
            expect(describeSchedule("15 8 1 * *")).toBe("15 8 1 * * (UTC)");
        });
    });

    describe("isConnectorDue", () => {
        const now = new Date("2026-06-28T12:00:00.000Z");
        const modifiedAt = new Date("2026-06-20T00:00:00.000Z");

        it("always due in BACKFILL mode", () => {
            expect(
                isConnectorDue({
                    syncMode: "BACKFILL",
                    syncCronExpression: every6h,
                    now,
                    lastScheduledIncrementalSuccessAt: new Date(
                        "2026-06-28T11:00:00.000Z"
                    ),
                    hasScheduledIncrementalSuccess: true,
                    connectorModifiedAt: modifiedAt,
                })
            ).toBe(true);
        });

        it("is not due when last scheduled success was 2 hours ago on 6h cron", () => {
            expect(
                isConnectorDue({
                    syncMode: "INCREMENTAL",
                    syncCronExpression: every6h,
                    now: new Date("2026-06-28T10:00:00.000Z"),
                    lastScheduledIncrementalSuccessAt: new Date(
                        "2026-06-28T07:00:00.000Z"
                    ),
                    hasScheduledIncrementalSuccess: true,
                    connectorModifiedAt: modifiedAt,
                })
            ).toBe(false);
        });

        it("is due when last scheduled success was 7 hours ago on 6h cron", () => {
            expect(
                isConnectorDue({
                    syncMode: "INCREMENTAL",
                    syncCronExpression: every6h,
                    now,
                    lastScheduledIncrementalSuccessAt: new Date(
                        "2026-06-28T05:00:00.000Z"
                    ),
                    hasScheduledIncrementalSuccess: true,
                    connectorModifiedAt: modifiedAt,
                })
            ).toBe(true);
        });

        it("is due for post-backfill one-shot without scheduled incremental success", () => {
            expect(
                isConnectorDue({
                    syncMode: "INCREMENTAL",
                    syncCronExpression: every6h,
                    now,
                    lastScheduledIncrementalSuccessAt: null,
                    hasScheduledIncrementalSuccess: false,
                    connectorModifiedAt: modifiedAt,
                })
            ).toBe(true);
        });

        it("treats missed cron fires as a single catch-up run", () => {
            expect(
                isConnectorDue({
                    syncMode: "INCREMENTAL",
                    syncCronExpression: every6h,
                    now: new Date("2026-06-28T18:00:00.000Z"),
                    lastScheduledIncrementalSuccessAt: new Date(
                        "2026-06-28T00:00:00.000Z"
                    ),
                    hasScheduledIncrementalSuccess: true,
                    connectorModifiedAt: modifiedAt,
                })
            ).toBe(true);
        });

        it("is due after schedule change when new cron fired since save", () => {
            const scheduleChangedAt = new Date("2026-06-28T03:00:00.000Z");
            expect(
                isConnectorDue({
                    syncMode: "INCREMENTAL",
                    syncCronExpression: "0 3 * * *",
                    now: new Date("2026-06-28T03:30:00.000Z"),
                    lastScheduledIncrementalSuccessAt: new Date(
                        "2026-06-28T02:00:00.000Z"
                    ),
                    hasScheduledIncrementalSuccess: true,
                    connectorModifiedAt: scheduleChangedAt,
                })
            ).toBe(true);
        });
    });

    describe("hasCronFiredBetween", () => {
        it("returns false when the window is empty", () => {
            const at = new Date("2026-06-28T12:00:00.000Z");
            expect(hasCronFiredBetween(every6h, at, at)).toBe(false);
        });

        it("detects a cron fire inside the window", () => {
            expect(
                hasCronFiredBetween(
                    every6h,
                    new Date("2026-06-28T05:00:00.000Z"),
                    new Date("2026-06-28T12:00:00.000Z")
                )
            ).toBe(true);
        });
    });

    describe("computeNextScheduledSyncAt", () => {
        it("computes the next fire after last scheduled success", () => {
            const next = computeNextScheduledSyncAt(
                every6h,
                new Date("2026-06-28T06:00:00.000Z"),
                new Date("2026-06-28T10:00:00.000Z")
            );
            expect(next?.toISOString()).toBe("2026-06-28T12:00:00.000Z");
        });

        it("computes daily next run from anchor", () => {
            const next = computeNextScheduledSyncAt(
                "0 3 * * *",
                new Date("2026-06-27T03:00:00.000Z"),
                new Date("2026-06-28T02:00:00.000Z")
            );
            expect(next?.toISOString()).toBe("2026-06-28T03:00:00.000Z");
        });

        it("returns null for invalid cron", () => {
            expect(
                computeNextScheduledSyncAt(
                    "not-a-cron",
                    null,
                    new Date("2026-06-28T12:00:00.000Z")
                )
            ).toBeNull();
        });
    });
});
