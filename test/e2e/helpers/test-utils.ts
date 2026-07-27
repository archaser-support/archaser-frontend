import { Page } from "@playwright/test";

/**
 * Test data generators and utilities
 */

/**
 * Generate a random email for testing
 */
export function generateTestEmail(): string {
    const timestamp = Date.now();
    return `test-${timestamp}@example.com`;
}

/**
 * Generate a random phone number for testing
 */
export function generateTestPhone(): string {
    const randomNum = Math.floor(Math.random() * 10000000000);
    return `+1${randomNum.toString().padStart(10, "0")}`;
}

/**
 * Format currency for comparison in tests
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
    }).format(amount);
}

/**
 * Generate a future date for testing (7 days from now by default)
 */
export function generateFutureDate(daysFromNow: number = 7): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split("T")[0]; // YYYY-MM-DD format
}

/**
 * Generate a past date for testing
 */
export function generatePastDate(daysAgo: number = 7): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split("T")[0];
}

/**
 * Wait for API response matching pattern
 */
export async function waitForApiResponse(
    page: Page,
    urlPattern: string | RegExp,
    timeout: number = 10000
) {
    return await page.waitForResponse(
        (response) => {
            const url = response.url();
            if (typeof urlPattern === "string") {
                return url.includes(urlPattern);
            }
            return urlPattern.test(url);
        },
        { timeout }
    );
}

/**
 * Wait for multiple API calls to complete
 */
export async function waitForMultipleApiResponses(
    page: Page,
    urlPatterns: Array<string | RegExp>,
    timeout: number = 10000
) {
    const promises = urlPatterns.map((pattern) =>
        waitForApiResponse(page, pattern, timeout)
    );
    return await Promise.all(promises);
}

/**
 * Fill form field with retry logic
 */
export async function fillFieldWithRetry(
    page: Page,
    selector: string,
    value: string,
    maxRetries: number = 3
) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await page.fill(selector, value);
            const inputValue = await page.inputValue(selector);
            if (inputValue === value) {
                return;
            }
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await page.waitForTimeout(500);
        }
    }
}

/**
 * Click element with retry logic
 */
export async function clickWithRetry(
    page: Page,
    selector: string,
    maxRetries: number = 3
) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            await page.click(selector, { timeout: 5000 });
            return;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await page.waitForTimeout(500);
        }
    }
}

/**
 * Check if element exists (without throwing error)
 */
export async function elementExists(
    page: Page,
    selector: string
): Promise<boolean> {
    try {
        const element = page.locator(selector);
        return (await element.count()) > 0;
    } catch {
        return false;
    }
}

/**
 * Get text content safely (returns null if element doesn't exist)
 */
export async function getTextContent(
    page: Page,
    selector: string
): Promise<string | null> {
    try {
        const element = page.locator(selector);
        if ((await element.count()) > 0) {
            return await element.first().textContent();
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string) {
    await page.locator(selector).scrollIntoViewIfNeeded();
}

/**
 * Wait for element to be stable (not animating)
 */
export async function waitForStableElement(
    page: Page,
    selector: string,
    timeout: number = 5000
) {
    const element = page.locator(selector);
    await element.waitFor({ state: "visible", timeout });

    // Wait a bit for animations to complete
    await page.waitForTimeout(300);
}

/**
 * Get all text contents from elements matching selector
 */
export async function getAllTextContents(
    page: Page,
    selector: string
): Promise<string[]> {
    const elements = page.locator(selector);
    const count = await elements.count();
    const texts: string[] = [];

    for (let i = 0; i < count; i++) {
        const text = await elements.nth(i).textContent();
        if (text) {
            texts.push(text.trim());
        }
    }

    return texts;
}

/**
 * Check if page has error message
 */
export async function hasErrorMessage(page: Page): Promise<boolean> {
    const errorSelectors = [
        '[role="alert"]',
        '.error',
        '.error-message',
        '[data-testid="error"]',
        'text=/error/i',
    ];

    for (const selector of errorSelectors) {
        if (await elementExists(page, selector)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if page has success message
 */
export async function hasSuccessMessage(page: Page): Promise<boolean> {
    const successSelectors = [
        '[role="status"]',
        '.success',
        '.success-message',
        '[data-testid="success"]',
        'text=/success/i',
    ];

    for (const selector of successSelectors) {
        if (await elementExists(page, selector)) {
            return true;
        }
    }

    return false;
}

/**
 * Clear local storage and cookies
 */
export async function clearBrowserData(page: Page) {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
}

/**
 * Take a screenshot with timestamp
 */
export async function takeTimestampedScreenshot(
    page: Page,
    name: string,
    fullPage: boolean = false
) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await page.screenshot({
        path: `test-results/screenshots/${name}-${timestamp}.png`,
        fullPage,
    });
}

/**
 * Mock API response
 */
export async function mockApiResponse(
    page: Page,
    urlPattern: string | RegExp,
    response: any,
    status: number = 200
) {
    await page.route(urlPattern, (route) => {
        route.fulfill({
            status,
            contentType: "application/json",
            body: JSON.stringify(response),
        });
    });
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone format (US format)
 */
export function isValidPhone(phone: string): boolean {
    const phoneRegex = /^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
    return phoneRegex.test(phone);
}

/**
 * Extract number from currency string (e.g., "$1,234.56" -> 1234.56)
 */
export function extractNumberFromCurrency(currencyString: string): number {
    const cleaned = currencyString.replace(/[^0-9.-]/g, "");
    return parseFloat(cleaned);
}
