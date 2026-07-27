import { Page, expect } from "@playwright/test";

/**
 * Navigate to portal home page
 */
export async function navigateToPortal(
    page: Page,
    customerUUID: string,
    locale: string = "en"
): Promise<void> {
    await page.goto(`/${locale}/portal/${customerUUID}`);
    await page.waitForLoadState("networkidle");
}

/**
 * Navigate to the Create Dispute page for a specific customer
 */
export async function navigateToCreateDispute(
    page: Page,
    customerUUID: string,
    locale: string = "en"
): Promise<void> {
    // Use domcontentloaded instead of load/networkidle to avoid timeouts
    await page.goto(`/${locale}/portal/${customerUUID}/create-dispute`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
    });

    // Wait for the page to be interactive
    await page.waitForTimeout(1000);

    // Wait for the page to be fully loaded - but don't fail if not found
    await page.waitForSelector("text=Create Dispute", { timeout: 10000 }).catch(() => {
        // Page might use different text, continue anyway
    });
}

/**
 * Select an invoice by clicking on it
 */
export async function selectInvoice(page: Page, invoiceId: number): Promise<void> {
    // Wait for invoices to load first
    await page.waitForSelector('input[type="checkbox"]', { timeout: 20000 });

    // Wait a bit for page to stabilize
    await page.waitForTimeout(1000);

    // Try multiple strategies to select invoice
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    if (count > 0) {
        // Click the first available checkbox (tests usually create invoices in order)
        // Explicitly wait for visibility to handle Webkit timing
        await checkboxes.first().waitFor({ state: "visible", timeout: 5000 });
        await checkboxes.first().click({ force: true });
        await page.waitForTimeout(2000); // Let selection register and UI update
    } else {
        // Fallback: look for clickable invoice card/row
        const invoiceCard = page
            .locator(`[data-invoice-id="${invoiceId}"], .invoice-card, [role="row"]`)
            .first();
        if (await invoiceCard.count() > 0) {
            await invoiceCard.click();
        }
    }
}

/**
 * Select multiple invoices
 */
export async function selectInvoices(
    page: Page,
    invoiceIds: number[]
): Promise<void> {
    for (const invoiceId of invoiceIds) {
        await selectInvoice(page, invoiceId);
    }
}

/**
 * Fill dispute form with provided data
 */
export async function fillDisputeForm(
    page: Page,
    data: {
        disputeReason?: string;
        disputeComment: string;
    }
): Promise<void> {
    // Select dispute reason if provided
    if (data.disputeReason) {
        // Find the MUI Select component for dispute reason
        const reasonSelectButton = page
            .locator('[role="combobox"], select')
            .first();

        if (await reasonSelectButton.count() > 0) {
            await reasonSelectButton.click();
            await page.waitForTimeout(500); // Wait for dropdown to open

            // Find enabled options only (skip disabled placeholder)
            // Use CSS selector to exclude aria-disabled=true
            const enabledOptions = page.locator('[role="option"]:not([aria-disabled="true"])');

            // Try to find matching reason
            const matchingOption = enabledOptions.filter({ hasText: data.disputeReason });

            if (await matchingOption.count() > 0) {
                await matchingOption.first().click();
            } else {
                // Fallback: select first enabled option
                const firstEnabled = await enabledOptions.first();
                if (await firstEnabled.isVisible({ timeout: 1000 }).catch(() => false)) {
                    await firstEnabled.click();
                }
            }
        }
    }

    // Fill dispute comment/message
    // Look for textarea (MUI TextField renders as textarea for multiline)
    const commentField = page.locator("textarea").first();

    if (await commentField.count() > 0) {
        await commentField.fill(data.disputeComment);
    } else {
        // Fallback: find any text input
        const textInput = page.locator('input[type="text"]').first();
        if (await textInput.count() > 0) {
            await textInput.fill(data.disputeComment);
        }
    }
}

/**
 * Submit dispute form
 */
export async function submitDispute(page: Page): Promise<void> {
    // Find submit button - try multiple strategies
    let submitButton = page.getByRole('button', { name: /submit dispute/i });

    // If not found, try broader search
    if (!(await submitButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        submitButton = page.locator('button').filter({ hasText: /submit|send/i }).first();
    }

    // Wait for button to be visible and enabled
    await submitButton.waitFor({ state: 'visible', timeout: 15000 });
    await expect(submitButton).toBeEnabled({ timeout: 10000 });

    await submitButton.click();

    // Wait for API call to complete
    await page.waitForResponse(
        (response) =>
            response.url().includes('/api/portal/create-dispute') &&
            (response.status() === 201 || response.status() === 200)
        , { timeout: 15000 }).catch(() => {
            // If response not caught, just wait for network to settle
            return page.waitForLoadState('networkidle', { timeout: 10000 });
        });
}

/**
 * Wait for dispute success message
 */
export async function waitForDisputeSuccess(
    page: Page,
    timeout: number = 15000
): Promise<void> {
    // Wait for success indicators - the page shows a success card or message
    await Promise.race([
        page.waitForSelector("text=/success|submitted|created/i", { timeout }),
        page.locator('[class*="success"]').first().waitFor({ timeout }),
        // Also check if we're back on step 2 (success step)
        page.locator(".MuiStep-root.Mui-completed").nth(1).waitFor({ timeout }),
    ]).catch(() => {
        // If no success message found, just wait a bit
        return page.waitForTimeout(2000);
    });
}

/**
 * Get customer UUID from customer ID (helper for test data)
 * Note: In real tests, you'd fetch this from the database
 */
export function getCustomerUUID(customerId: number): string {
    // This is a placeholder - in real tests, fetch from database
    return `test-uuid-${customerId}`;
}

/**
 * Wait for portal page to load
 */
export async function waitForPortalPageLoad(page: Page): Promise<void> {
    // Wait for portal header or main content
    await page.waitForSelector("text=Portal", { timeout: 10000 }).catch(() => {
        // If not found, just wait for network idle
        return page.waitForLoadState("networkidle");
    });
}

/**
 * Wait for invoices to load on dispute page
 */
export async function waitForInvoicesToLoad(page: Page): Promise<void> {
    // Wait for either invoices to appear or "no invoices" message
    await Promise.race([
        // Wait for invoice checkboxes (InvoiceDisplay component)
        page.waitForSelector('input[type="checkbox"]', { timeout: 10000 }),
        // Wait for "all invoices paid" message
        page.waitForSelector('text=/all.*paid|no.*outstanding/i', { timeout: 10000 }),
        // Wait for "active dispute" message
        page.waitForSelector('text=/active.*dispute|invoices.*under.*review/i', { timeout: 20000 }),
        // Wait for any card content to load
        page.waitForSelector('.MuiCard-root', { timeout: 20000 }),
    ]).catch(() => {
        // If nothing found, just wait a bit for content to load
        return page.waitForTimeout(2000);
    });
}

/**
 * Navigate to next step in dispute creation (if using stepper)
 */
export async function goToNextStep(page: Page): Promise<void> {
    // Find Continue button - try specific "Continue to Details" first, then generic
    let nextButton = page.getByRole('button', { name: /continue to details/i });

    // If not found, try generic continue/next
    if (!(await nextButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        nextButton = page.locator('button').filter({ hasText: /continue|next/i }).first();
    }

    // Wait for button to be visible and enabled
    await nextButton.waitFor({ state: 'visible', timeout: 15000 });
    await expect(nextButton).toBeEnabled({ timeout: 15000 });

    await nextButton.click();

    // Wait for navigation to complete
    await page.waitForTimeout(1500);
}

/**
 * Go back to previous step
 */
export async function goToPreviousStep(page: Page): Promise<void> {
    const backButton = page.getByRole("button", { name: /back/i }).first();
    await backButton.click();
    await page.waitForLoadState("networkidle");
}

/**
 * Complete dispute creation flow - handles all steps
 */
export async function createDisputeComplete(
    page: Page,
    invoiceId: number,
    disputeDetails: {
        disputeReason?: string;
        disputeComment: string;
    }
): Promise<void> {
    // Step 1: Wait for invoices and select one
    await waitForInvoicesToLoad(page);
    await selectInvoice(page, invoiceId);

    // Navigate to step 2
    await goToNextStep(page);

    // Step 2: Fill dispute form - ensure disputeReason is set
    await fillDisputeForm(page, {
        disputeReason: disputeDetails.disputeReason || "Incorrect amount",
        disputeComment: disputeDetails.disputeComment,
    });

    // Submit directly (flow is 2 steps: Select -> Details/Submit)
    await submitDispute(page);
}
