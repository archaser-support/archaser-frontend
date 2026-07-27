/**
 * Webhook Validation Utility
 *
 * Provides signature validation for various webhook providers
 */

import { createHmac } from "crypto";
import { NextApiRequest } from "next";

/**
 * Validate AWS SNS webhook signature
 *
 * AWS SNS signs messages with RSA-SHA1. For simplicity, we'll validate
 * that the message comes from AWS by checking the SigningCertURL points to AWS.
 * Full signature validation requires downloading the certificate.
 */
export async function validateAWSSNSWebhook(
    req: NextApiRequest,
    body: string | object
): Promise<boolean> {
    const notification = typeof body === "string" ? JSON.parse(body) : body;

    // Check if SigningCertURL is from AWS
    const signingCertUrl = notification.SigningCertURL;
    if (!signingCertUrl) {
        return false;
    }

    // Verify URL is from AWS
    if (
        !signingCertUrl.startsWith("https://sns.") ||
        !signingCertUrl.includes(".amazonaws.com/")
    ) {
        return false;
    }

    // Additional validation: Check TopicArn if configured
    const expectedTopicArn = process.env.AWS_SNS_TOPIC_ARN;
    if (expectedTopicArn && notification.TopicArn !== expectedTopicArn) {
        return false;
    }

    // Note: Full signature validation would require:
    // 1. Downloading the certificate from SigningCertURL
    // 2. Verifying the certificate chain
    // 3. Extracting the public key
    // 4. Verifying the signature using the public key
    // This is a simplified check - consider implementing full validation for production

    return true;
}

/**
 * Validate Twilio webhook signature
 */
export function validateTwilioWebhook(
    req: NextApiRequest,
    body: string | Record<string, any>
): boolean {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
        // If no auth token configured, skip validation (not recommended)
        console.warn(
            "TWILIO_AUTH_TOKEN not configured, skipping webhook validation"
        );
        return true;
    }

    const signature = req.headers["x-twilio-signature"] as string;
    if (!signature) {
        return false;
    }

    // Get the full URL
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const path = req.url || "";
    const url = `${protocol}://${host}${path}`;

    // Convert body to string if it's an object
    const bodyString =
        typeof body === "string"
            ? body
            : new URLSearchParams(body as Record<string, string>).toString();

    // Create the signature string
    const data = url + bodyString;

    // Calculate expected signature
    const expectedSignature = createHmac("sha1", authToken)
        .update(data)
        .digest("base64");

    // Compare signatures (use constant-time comparison to prevent timing attacks)
    return timingSafeEqual(signature, expectedSignature);
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
}

/**
 * Validate generic HMAC signature
 */
export function validateHMACSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: "sha1" | "sha256" = "sha256"
): boolean {
    if (!secret || !signature) {
        return false;
    }

    const expectedSignature = createHmac(algorithm, secret)
        .update(payload)
        .digest("hex");

    return timingSafeEqual(
        signature.toLowerCase(),
        expectedSignature.toLowerCase()
    );
}

/**
 * Validate Inforu webhook signature (if implemented)
 */
export function validateInforuWebhook(
    req: NextApiRequest,
    body: string | Record<string, any>
): boolean {
    const secret = process.env.INFORU_WEBHOOK_SECRET;
    if (!secret) {
        console.warn(
            "INFORU_WEBHOOK_SECRET not configured, skipping webhook validation"
        );
        return true;
    }

    const signature = req.headers["x-inforu-signature"] as string;
    if (!signature) {
        return false;
    }

    const bodyString = typeof body === "string" ? body : JSON.stringify(body);

    return validateHMACSignature(bodyString, signature, secret, "sha256");
}
