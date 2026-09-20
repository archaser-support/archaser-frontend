/**
 * Gets a Google reCAPTCHA v3 token for the specified action.
 *
 * @param action The action name for reCAPTCHA v3
 * @returns A promise that resolves to the reCAPTCHA token, or null if reCAPTCHA is not configured
 */
const CAPTCHA_TIMEOUT_MS = 8_000;

export async function getCaptchaToken(action: string): Promise<string | null> {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    if (!siteKey) {
        console.warn(
            "NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. Skipping captcha."
        );
        return "skipped"; // Use a special value to indicate it's not configured
    }

    if (typeof window === "undefined" || !window.grecaptcha) {
        console.error("grecaptcha not loaded");
        return null;
    }

    try {
        return await Promise.race([
            new Promise<string | null>((resolve) => {
                window.grecaptcha.ready(() => {
                    window.grecaptcha
                        .execute(siteKey, { action })
                        .then((token: string) => {
                            resolve(token);
                        })
                        .catch((error: unknown) => {
                            console.error("Error executing reCAPTCHA:", error);
                            resolve(null);
                        });
                });
            }),
            new Promise<null>((resolve) => {
                setTimeout(() => {
                    console.error("reCAPTCHA timed out; continuing without token");
                    resolve(null);
                }, CAPTCHA_TIMEOUT_MS);
            }),
        ]);
    } catch (error) {
        console.error("Error executing reCAPTCHA:", error);
        return null;
    }
}

// Extend Window interface for TypeScript
declare global {
    interface Window {
        grecaptcha: any;
    }
}
