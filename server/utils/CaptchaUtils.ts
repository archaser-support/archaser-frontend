import axios from "axios";

/**
 * Verifies a Google reCAPTCHA v3 token.
 * 
 * @param token The token received from the frontend
 * @returns A promise that resolves to true if the token is valid and score is sufficient
 */
export async function verifyCaptcha(token: string): Promise<boolean> {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
        console.warn("RECAPTCHA_SECRET_KEY is not set. Skipping captcha verification.");
        return true; // Don't block if not configured (optional, depending on requirements)
    }

    if (!token) {
        return false;
    }

    try {
        const response = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`
        );

        const { success, score } = response.data;

        // For v3, success must be true and score should be ideally > 0.5
        // Default threshold is usually 0.5
        const threshold = parseFloat(process.env.RECAPTCHA_THRESHOLD || "0.5");

        if (success && score >= threshold) {
            return true;
        }

        console.warn("reCAPTCHA verification failed:", response.data);
        return false;
    } catch (error) {
        console.error("Error verifying reCAPTCHA:", error);
        return false;
    }
}
