import { describe, expect, it } from "vitest";

import {
    getEmailErrorSummary,
    isTransientEmailError,
    shouldDeferEmailForRetry,
} from "@/server/utils/emailErrorClassification";

describe("isTransientEmailError", () => {
    it("detects SES throttling", () => {
        expect(
            isTransientEmailError(
                new Error("454 Throttling failure: Maximum sending rate exceeded")
            )
        ).toBe(true);
    });

    it("detects connection reset", () => {
        const err = new Error("read ECONNRESET") as Error & { code: "ECONNRESET" };
        err.code = "ECONNRESET";
        expect(isTransientEmailError(err)).toBe(true);
    });

    it("detects temporary SMTP 451", () => {
        expect(
            isTransientEmailError(new Error("451 4.4.2 Timeout waiting for data"))
        ).toBe(true);
    });

    it("treats unknown user as permanent", () => {
        expect(
            isTransientEmailError(
                new Error("550 5.1.1 User unknown in virtual mailbox table")
            )
        ).toBe(false);
    });

    it("treats mailbox unavailable as permanent", () => {
        expect(
            isTransientEmailError(
                new Error("553 5.1.3 Mailbox unavailable")
            )
        ).toBe(false);
    });
});

describe("getEmailErrorSummary", () => {
    it("truncates long messages to 255 chars", () => {
        const long = "x".repeat(300);
        const summary = getEmailErrorSummary(new Error(long));
        expect(summary.length).toBeLessThanOrEqual(255);
    });
});

describe("shouldDeferEmailForRetry", () => {
    it("defers when transient and max retries is unlimited (0)", () => {
        const prev = process.env.EMAIL_TRANSIENT_MAX_RETRIES;
        process.env.EMAIL_TRANSIENT_MAX_RETRIES = "0";
        try {
            expect(
                shouldDeferEmailForRetry(
                    new Error("454 Throttling"),
                    999
                )
            ).toBe(true);
        } finally {
            if (prev === undefined) {
                delete process.env.EMAIL_TRANSIENT_MAX_RETRIES;
            } else {
                process.env.EMAIL_TRANSIENT_MAX_RETRIES = prev;
            }
        }
    });

    it("stops deferring when max retries exceeded", () => {
        const prev = process.env.EMAIL_TRANSIENT_MAX_RETRIES;
        process.env.EMAIL_TRANSIENT_MAX_RETRIES = "3";
        try {
            expect(
                shouldDeferEmailForRetry(new Error("454 Throttling"), 3)
            ).toBe(false);
            expect(
                shouldDeferEmailForRetry(new Error("454 Throttling"), 2)
            ).toBe(true);
        } finally {
            if (prev === undefined) {
                delete process.env.EMAIL_TRANSIENT_MAX_RETRIES;
            } else {
                process.env.EMAIL_TRANSIENT_MAX_RETRIES = prev;
            }
        }
    });
});
