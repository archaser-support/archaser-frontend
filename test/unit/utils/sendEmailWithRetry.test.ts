import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailService } from "@/server/EmailService";
import { sendEmailWithRetry } from "@/server/utils/sendEmailWithRetry";

describe("sendEmailWithRetry", () => {
    const originalMax = process.env.EMAIL_INPROCESS_MAX_ATTEMPTS;
    const originalBackoff = process.env.EMAIL_INPROCESS_BACKOFF_MS;

    beforeEach(() => {
        process.env.EMAIL_INPROCESS_MAX_ATTEMPTS = "3";
        process.env.EMAIL_INPROCESS_BACKOFF_MS = "0";
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        if (originalMax === undefined) {
            delete process.env.EMAIL_INPROCESS_MAX_ATTEMPTS;
        } else {
            process.env.EMAIL_INPROCESS_MAX_ATTEMPTS = originalMax;
        }
        if (originalBackoff === undefined) {
            delete process.env.EMAIL_INPROCESS_BACKOFF_MS;
        } else {
            process.env.EMAIL_INPROCESS_BACKOFF_MS = originalBackoff;
        }
    });

    it("returns on first success", async () => {
        const sendEmail = vi
            .fn()
            .mockResolvedValue({ messageId: "ses-1" });
        const service = { sendEmail } as unknown as EmailService;

        const result = await sendEmailWithRetry(
            service,
            "a@b.com",
            "Subject",
            "Body"
        );

        expect(result.messageId).toBe("ses-1");
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it("retries transient errors then succeeds", async () => {
        const sendEmail = vi
            .fn()
            .mockRejectedValueOnce(new Error("454 Throttling failure"))
            .mockResolvedValueOnce({ messageId: "ses-2" });
        const service = { sendEmail } as unknown as EmailService;

        const promise = sendEmailWithRetry(
            service,
            "a@b.com",
            "Subject",
            "Body"
        );
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.messageId).toBe("ses-2");
        expect(sendEmail).toHaveBeenCalledTimes(2);
    });

    it("does not retry permanent errors", async () => {
        const sendEmail = vi
            .fn()
            .mockRejectedValue(
                new Error("550 5.1.1 User unknown in virtual mailbox table")
            );
        const service = { sendEmail } as unknown as EmailService;

        await expect(
            sendEmailWithRetry(service, "bad@b.com", "Subject", "Body")
        ).rejects.toThrow("550");
        expect(sendEmail).toHaveBeenCalledTimes(1);
    });
});
