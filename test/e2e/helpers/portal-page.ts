import { Page, expect } from "@playwright/test";

/**
 * Portal Page Object Model - Helper class for interacting with the portal
 */
export class PortalPage {
    constructor(public readonly page: Page) { }

    /**
     * Navigate to the portal with a specific customer UUID
     */
    async goto(customerUUID: string, locale: string = "en") {
        await this.page.goto(`/${locale}/portal/${customerUUID}`);
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Get the customer name displayed in the hero section
     */
    async getCustomerName(): Promise<string | null> {
        const nameElement = this.page.locator(
            'text=/Account Summary for/i'
        );
        if (await nameElement.isVisible()) {
            const fullText = await nameElement.textContent();
            return fullText?.replace("Account Summary for", "").trim() || null;
        }
        return null;
    }

    /**
     * Get the total amount displayed
     */
    async getTotalAmount(): Promise<string | null> {
        // Look for amount display - this might need to be adjusted based on the actual implementation
        const amountElement = this.page.locator('[data-testid="total-amount"]').first();
        if (await amountElement.isVisible()) {
            return await amountElement.textContent();
        }
        return null;
    }

    /**
     * Check if portal header is visible
     */
    async isHeaderVisible(): Promise<boolean> {
        // Try multiple selectors for header - portal might use nav, header, or specific class
        const selectors = [
            "header",
            "nav",
            '[role="banner"]',
            ".portal-header",
            ".header"
        ];

        for (const selector of selectors) {
            const element = this.page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if portal footer is visible
     */
    async isFooterVisible(): Promise<boolean> {
        // Try multiple selectors for footer
        const selectors = [
            "footer",
            '[role="contentinfo"]',
            ".portal-footer",
            ".footer"
        ];

        for (const selector of selectors) {
            const element = this.page.locator(selector).first();
            if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Navigate to View Invoices page
     */
    async navigateToViewInvoices() {
        await this.page.click('text=/View.*Invoices/i');
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to Make Payment page
     */
    async navigateToMakePayment() {
        await this.page.click('text=/Make.*Payment/i');
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to Promise to Pay page
     */
    async navigateToPromiseToPay() {
        await this.page.click('text=/Promise.*Pay/i');
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to Create Dispute page
     */
    async navigateToCreateDispute() {
        await this.page.click('text=/Create.*Dispute/i');
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to View Disputes page
     */
    async navigateToViewDisputes() {
        await this.page.click('text=/View.*Disputes/i');
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Navigate to Report Wrong Contact page
     */
    async navigateToReportWrongContact() {
        await this.page.click('text=/Report.*Wrong.*Contact/i');
        await this.page.waitForLoadState("networkidle");
    }

    /**
     * Check if an error message is displayed
     */
    async hasErrorMessage(): Promise<boolean> {
        const errorElement = this.page.locator('[role="alert"]').first();
        return await errorElement.isVisible();
    }

    /**
     * Get error message text
     */
    async getErrorMessage(): Promise<string | null> {
        const errorElement = this.page.locator('[role="alert"]').first();
        if (await errorElement.isVisible()) {
            return await errorElement.textContent();
        }
        return null;
    }

    /**
     * Check if success message is displayed
     */
    async hasSuccessMessage(): Promise<boolean> {
        const successElement = this.page.locator(
            '[role="status"], .success-message'
        ).first();
        return await successElement.isVisible();
    }

    /**
     * Wait for navigation to complete
     */
    async waitForNavigation() {
        await this.page.waitForLoadState("networkidle");
    }
}

/**
 * Helper function to create portal URL
 */
export function createPortalUrl(
    customerUUID: string,
    locale: string = "en"
): string {
    return `/${locale}/portal/${customerUUID}`;
}

/**
 * Helper function to wait for element with custom timeout
 */
export async function waitForElement(
    page: Page,
    selector: string,
    timeout: number = 10000
) {
    await page.waitForSelector(selector, { timeout, state: "visible" });
}

/**
 * Helper function to take screenshot with descriptive name
 */
export async function takeScreenshot(
    page: Page,
    name: string,
    fullPage: boolean = false
) {
    await page.screenshot({
        path: `test-results/${name}-${Date.now()}.png`,
        fullPage,
    });
}
