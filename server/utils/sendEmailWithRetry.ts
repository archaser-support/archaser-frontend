import { EmailService } from "@/server/EmailService";

import {
    getEmailErrorSummary,
    isTransientEmailError,
} from "./emailErrorClassification";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getInProcessMaxAttempts(): number {
    const raw = process.env.EMAIL_INPROCESS_MAX_ATTEMPTS;
    if (raw == null || String(raw).trim() === "") {
        return 3;
    }
    const n = Number.parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 1 ? n : 3;
}

function getInProcessBackoffMs(): number {
    const raw = process.env.EMAIL_INPROCESS_BACKOFF_MS;
    if (raw == null || String(raw).trim() === "") {
        return 2000;
    }
    const n = Number.parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 0 ? n : 2000;
}

/**
 * Activity-workflow only: send via EmailService with in-process retries on transient SES/SMTP errors.
 */
export async function sendEmailWithRetry(
    emailService: EmailService,
    toEmail: string,
    subject: string,
    body: string,
    messageId?: string
): Promise<{ messageId: string }> {
    const maxAttempts = getInProcessMaxAttempts();
    const baseBackoffMs = getInProcessBackoffMs();
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await emailService.sendEmail(
                toEmail,
                subject,
                body,
                messageId
            );
            if (!result.messageId?.trim()) {
                const emptyError = new Error(
                    "SES SMTP accepted send but returned no message id"
                );
                if (
                    attempt < maxAttempts &&
                    isTransientEmailError(emptyError)
                ) {
                    lastError = emptyError;
                    await sleep(baseBackoffMs * attempt);
                    continue;
                }
                throw emptyError;
            }
            return result;
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts && isTransientEmailError(error)) {
                await sleep(baseBackoffMs * attempt);
                continue;
            }
            throw error;
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(getEmailErrorSummary(lastError));
}
