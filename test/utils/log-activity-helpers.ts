import { Page, expect } from "@playwright/test";

import customerData from "../automation/customerData.json";

export interface LogActivityTestData {
    contact: {
        firstName: string;
        lastName: string;
        fullName: string;
        phone: string;
    };
    invoice: {
        number: string;
        amount: number;
    };
    disputeReasons: string[];
}

export const logActivityTestData: LogActivityTestData = {
    contact: {
        firstName: customerData.Customer[0].Company.Contact[0].first_name,
        lastName: customerData.Customer[0].Company.Contact[0].last_name,
        fullName: `${customerData.Customer[0].Company.Contact[0].first_name} ${customerData.Customer[0].Company.Contact[0].last_name}`,
        phone: customerData.Customer[0].Company.Contact[0].phone,
    },
    invoice: {
        number: customerData.Customer[0].Invoice[0].invoice_number,
        amount: customerData.Customer[0].Invoice[0].amount,
    },
    disputeReasons: customerData.DisputeReason.map((reason) => reason.name),
};

export async function navigateToCustomerAndOpenLogActivity(
    page: Page,
    customerId: number = 1
) {
    // Navigate to customer page
    await page.goto(`/en/app/customers/${customerId}`);

    // Wait for the page to load
    await page.waitForSelector('[data-testid="customer-details-container"]', {
        timeout: 10000,
    });

    // Wait for activities tab to be visible
    await page.waitForSelector('[data-testid="activities-tab"]', {
        timeout: 10000,
    });

    // Open LogActivity component
    const openButton = page.locator(
        '[data-testid="open-log-activity-button"], button:has-text("Log Activity"), .log-activity-button'
    );
    if (await openButton.isVisible()) {
        await openButton.click();
    }

    // Wait for LogActivity to be visible
    await page.waitForSelector("#contact", { timeout: 10000 });
}

export async function selectContact(page: Page, contactName?: string) {
    const name = contactName || logActivityTestData.contact.fullName;

    await page.click("#contact");
    await page.click(`text=${name}`);

    // Verify contact is selected
    await expect(page.locator("#contact")).not.toHaveValue("");
}

export async function selectOutcome(page: Page, outcome: string) {
    await page.click("#outcome");
    await page.click(`text=${outcome}`);

    // Verify outcome is selected
    await expect(page.locator("#outcome")).toHaveValue(
        outcome.toLowerCase().replace(/\s+/g, "_")
    );
}

export async function fillComment(page: Page, comment: string) {
    await page.fill("#comment", comment);
}

export async function submitForm(page: Page) {
    await page.click('button:has-text("Save")');
}

export async function cancelForm(page: Page) {
    await page.click('button:has-text("Cancel")');
}

export async function mockApiResponse(
    page: Page,
    customerId: number,
    response: any,
    status: number = 200
) {
    await page.route(
        `**/api/customers/${customerId}/activity/log-call-activity`,
        async (route) => {
            await route.fulfill({
                status,
                contentType: "application/json",
                body: JSON.stringify(response),
            });
        }
    );
}

export async function mockSlowApiResponse(
    page: Page,
    customerId: number,
    response: any,
    delay: number = 2000
) {
    await page.route(
        `**/api/customers/${customerId}/activity/log-call-activity`,
        async (route) => {
            await page.waitForTimeout(delay);
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(response),
            });
        }
    );
}

export async function verifyValidationError(
    page: Page,
    fieldName: string,
    errorMessage: string
) {
    await expect(page.locator(`text=${errorMessage}`)).toBeVisible();
    await expect(page.locator(`#${fieldName}`).locator("..")).toHaveClass(
        /Mui-error/
    );
}

export async function verifySuccessMessage(
    page: Page,
    message: string = "Activity logged successfully"
) {
    await expect(page.locator(`text=${message}`)).toBeVisible({
        timeout: 10000,
    });
}

export async function verifyErrorMessage(page: Page, message: string) {
    await expect(page.locator(`text=${message}`)).toBeVisible({
        timeout: 10000,
    });
}

export async function startCall(
    page: Page,
    callType: "outgoing" | "incoming" = "outgoing"
) {
    const callButton = page.locator(
        `button[aria-label*="${callType}"], button:has([data-testid="${callType}-call-icon"])`
    );
    await callButton.click();

    // Verify call timer is running
    await expect(page.locator("text=00:00")).toBeVisible();
}

export async function endCall(page: Page) {
    const endCallButton = page.locator(
        'button[aria-label*="end"], button:has([data-testid="end-call-icon"])'
    );
    await endCallButton.click();

    // Verify call timer shows elapsed time
    await expect(page.locator("text=00:")).toBeVisible();
}

export async function verifyDatePickerVisible(
    page: Page,
    type: "follow-up" | "payment"
) {
    const selector =
        type === "follow-up"
            ? 'input[placeholder*="follow"], input[placeholder*="date"], [data-testid="follow-up-date-picker"]'
            : 'input[placeholder*="payment"], input[placeholder*="date"], [data-testid="payment-date-picker"]';

    await expect(page.locator(selector)).toBeVisible();
}

export async function verifyDisputeFormVisible(page: Page) {
    await expect(page.locator("#disputed-invoices")).toBeVisible();
    await expect(page.locator("#dispute-reason")).toBeVisible();
}

export async function selectDisputeReason(page: Page, reason: string) {
    await page.click("#dispute-reason");
    await page.click(`text=${reason}`);
}

export async function selectDisputedInvoices(
    page: Page,
    invoiceNumbers: string[]
) {
    await page.click("#disputed-invoices");

    for (const invoiceNumber of invoiceNumbers) {
        await page.click(`text=Invoice #${invoiceNumber}`);
    }

    // Close dropdown by clicking outside
    await page.click("body");
}

export async function verifyModalOpened(
    page: Page,
    modalType: "contact" | "payment"
) {
    const selector =
        modalType === "contact"
            ? '[data-testid="contact-modal"], .contact-modal, [role="dialog"]'
            : '[data-testid="payment-modal"], .payment-modal, [role="dialog"]';

    await expect(page.locator(selector)).toBeVisible();
}

export async function closeModal(page: Page) {
    const closeButton = page.locator(
        'button[aria-label="close"], button:has-text("Close"), button:has-text("Cancel")'
    );
    if (await closeButton.isVisible()) {
        await closeButton.click();
    }
}

export async function verifyLoadingState(page: Page) {
    await expect(page.locator('button:has-text("Save")')).toBeDisabled();
    await expect(
        page.locator(
            '[data-testid="loading-spinner"], .MuiCircularProgress-root'
        )
    ).toBeVisible();
}

export async function fillLogActivityForm(
    page: Page,
    data: {
        contact?: string;
        outcome?: string;
        comment?: string;
        followUpDate?: string;
        paymentDate?: string;
        disputeReason?: string;
        disputedInvoices?: string[];
    }
) {
    if (data.contact) {
        await selectContact(page, data.contact);
    }

    if (data.outcome) {
        await selectOutcome(page, data.outcome);
    }

    if (data.comment) {
        await fillComment(page, data.comment);
    }

    if (data.followUpDate) {
        await page.fill(
            'input[placeholder*="follow"], input[placeholder*="date"]',
            data.followUpDate
        );
    }

    if (data.paymentDate) {
        await page.fill(
            'input[placeholder*="payment"], input[placeholder*="date"]',
            data.paymentDate
        );
    }

    if (data.disputeReason) {
        await selectDisputeReason(page, data.disputeReason);
    }

    if (data.disputedInvoices) {
        await selectDisputedInvoices(page, data.disputedInvoices);
    }
}

export const outcomes = [
    "No Answer",
    "Bad Number",
    "Schedule Follow Up",
    "General",
    "Make Payment",
    "Add New Contact",
    "Move to Legal",
    "Promise to Pay",
    "Open Dispute",
] as const;

export type Outcome = (typeof outcomes)[number];
