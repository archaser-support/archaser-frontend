/**
 * Gets a Google reCAPTCHA v3 token for the specified action.
 * 
 * @param action The action name for reCAPTCHA v3
 * @returns A promise that resolves to the reCAPTCHA token, or null if reCAPTCHA is not configured
 */
export async function getCaptchaToken(action: string): Promise<string | null> {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    if (!siteKey) {
        console.warn("NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. Skipping captcha.");
        return "skipped"; // Use a special value to indicate it's not configured
    }

    if (typeof window === "undefined" || !window.grecaptcha) {
        console.error("grecaptcha not loaded");
        return null;
    }

    return new Promise((resolve) => {
        window.grecaptcha.ready(() => {
            window.grecaptcha
                .execute(siteKey, { action })
                .then((token: string) => {
                    resolve(token);
                })
                .catch((error: any) => {
                    console.error("Error executing reCAPTCHA:", error);
                    resolve(null);
                });
        });
    });
}

// Extend Window interface for TypeScript
declare global {
    interface Window {
        grecaptcha: any;
    }
}
