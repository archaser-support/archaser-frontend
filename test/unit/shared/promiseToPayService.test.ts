import moment from "moment";
import { describe, expect, it } from "vitest";

import {
    DEFAULT_PROMISE_TO_PAY_WINDOW_DAYS,
    calculateLogActivityPromiseToPayDateRange,
    calculatePortalPromiseToPayDateRange,
    calculatePromiseToPayDateRange,
} from "@/shared/services/promiseToPayService";

const daysFromToday = (date: Date): number =>
    moment(date).startOf("day").diff(moment().startOf("day"), "days");

describe("calculatePromiseToPayDateRange", () => {
    it("opens the window tomorrow and closes it windowDays out", () => {
        const range = calculatePromiseToPayDateRange({ windowDays: 10 });
        expect(daysFromToday(range.minDate)).toBe(1);
        expect(daysFromToday(range.maxDate)).toBe(10);
        expect(range.windowDays).toBe(10);
    });

    it("keeps the day window independent of promises already used", () => {
        // The window is a length of time and the cap is a quantity; mixing them
        // collapsed the calendar to a day or two once a promise had been made.
        const fresh = calculatePromiseToPayDateRange({
            windowDays: 10,
            maxPerCycle: 3,
            usedCount: 0,
        });
        const used = calculatePromiseToPayDateRange({
            windowDays: 10,
            maxPerCycle: 3,
            usedCount: 2,
        });
        expect(used.windowDays).toBe(fresh.windowDays);
        expect(daysFromToday(used.maxDate)).toBe(10);
        expect(used.remainingPromises).toBe(1);
        expect(used.isValid).toBe(true);
    });

    it("treats an unset cap as unconfigured rather than zero allowed", () => {
        const range = calculatePromiseToPayDateRange({
            windowDays: 10,
            maxPerCycle: null,
            usedCount: 5,
        });
        expect(range.remainingPromises).toBeNull();
        expect(range.isMaxedOut).toBe(false);
        expect(range.isValid).toBe(true);
    });

    it("blocks only once the per-cycle cap is reached", () => {
        const range = calculatePromiseToPayDateRange({
            windowDays: 10,
            maxPerCycle: 3,
            usedCount: 3,
        });
        expect(range.remainingPromises).toBe(0);
        expect(range.isMaxedOut).toBe(true);
        expect(range.isValid).toBe(false);
    });

    it("falls back to the default window when the account has none", () => {
        for (const windowDays of [null, undefined, 0]) {
            const range = calculatePromiseToPayDateRange({ windowDays });
            expect(range.windowDays).toBe(DEFAULT_PROMISE_TO_PAY_WINDOW_DAYS);
        }
    });
});

describe("calculateLogActivityPromiseToPayDateRange", () => {
    it("reads the window and cap off the customer's account", () => {
        // Prime Law Partners: promise_to_pay = 10 days, no per-cycle cap.
        const range = calculateLogActivityPromiseToPayDateRange({
            Account: {
                promise_to_pay: 10,
                max_promise_to_pay_allowed_per_cycle: null,
            },
            CustomerCollectionPeriod: [
                { promise_to_pay_count: 2, period_end_date: null },
            ],
        });
        expect(daysFromToday(range.maxDate)).toBe(10);
        expect(range.isValid).toBe(true);
    });

    it("counts the open period, not a closed one", () => {
        const range = calculateLogActivityPromiseToPayDateRange({
            Account: {
                promise_to_pay: 7,
                max_promise_to_pay_allowed_per_cycle: 2,
            },
            CustomerCollectionPeriod: [
                { promise_to_pay_count: 9, period_end_date: "2026-01-31" },
                { promise_to_pay_count: 1, period_end_date: null },
            ],
        });
        expect(range.remainingPromises).toBe(1);
        expect(range.isMaxedOut).toBe(false);
    });

    it("handles a single collection period object and a missing account", () => {
        const single = calculateLogActivityPromiseToPayDateRange({
            Account: {
                promise_to_pay: 5,
                max_promise_to_pay_allowed_per_cycle: 2,
            },
            CustomerCollectionPeriod: { promise_to_pay_count: 2 },
        });
        expect(single.isMaxedOut).toBe(true);

        const bare = calculateLogActivityPromiseToPayDateRange({});
        expect(bare.windowDays).toBe(DEFAULT_PROMISE_TO_PAY_WINDOW_DAYS);
        expect(bare.isValid).toBe(true);
    });
});

describe("calculatePortalPromiseToPayDateRange", () => {
    it("mirrors the in-app calculation for the portal's picker", () => {
        const range = calculatePortalPromiseToPayDateRange(10, 2, 3);
        expect(daysFromToday(range.minDate)).toBe(1);
        expect(daysFromToday(range.maxDate)).toBe(10);
        expect(range.remainingPromises).toBe(1);
    });
});
