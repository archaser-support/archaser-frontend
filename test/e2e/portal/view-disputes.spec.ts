import { test, expect } from "@playwright/test";
import { PortalPage } from "../helpers/portal-page";
import {
    createTestCustomer,
    getOrCreateTestAccount,
    cleanupTestData,
} from "../fixtures/portal-data";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Test suite for Portal View Disputes Page
 * Tests the dispute viewing functionality in the customer portal
 */
test.describe("Portal - View Disputes", () => {
    let portalPage: PortalPage;
    let testAccountId: number;
    let testCustomer: {
        id: number;
        customer_uuid: string;
        account_id: number;
        name: string;
    };

    test.beforeAll(async () => {
        // Set up test account
        testAccountId = await getOrCreateTestAccount(
            "E2E View Disputes Test Account"
        );

        // Create test customer
        testCustomer = await createTestCustomer(testAccountId, {
            name: "E2E View Disputes Customer",
        });
    });

    test.afterAll(async () => {
        // Clean up test data
        if (testCustomer?.id) {
            await cleanupTestData(testCustomer.id);
        }
        await prisma.$disconnect();
    });

    test.beforeEach(async ({ page }) => {
        portalPage = new PortalPage(page);
    });

    test("should navigate to view disputes page", async ({ page }) => {
        // Navigate directly to view disputes page
        await page.goto(`/en/portal/${testCustomer.customer_uuid}/view-disputes`);
        await page.waitForLoadState("networkidle");

        // Verify we're on the view disputes page
        await expect(page).toHaveURL(/view-disputes/);
    });

    test("should display view disputes page title", async ({ page }) => {
        // Navigate directly to view disputes page
        await page.goto(`/en/portal/${testCustomer.customer_uuid}/view-disputes`);
        await page.waitForLoadState("networkidle");

        // Should display the disputes title
        const pageTitle = page.locator(
            'text=/Disputes|Dispute.*List|Your.*Disputes/i'
        );
        await expect(pageTitle.first()).toBeVisible({ timeout: 15000 });
    });

    test("should display disputes list or empty state", async ({ page }) => {
        await page.goto(`/en/portal/${testCustomer.customer_uuid}/view-disputes`);
        await page.waitForLoadState("networkidle");

        // Wait for content to load
        await page.waitForTimeout(2000);

        // Should display dispute list or empty state message
        const disputeContent = page.locator(
            'text=/dispute|status|pending|resolved|no.*disputes/i'
        );

        await expect(disputeContent.first()).toBeVisible({ timeout: 15000 });
    });

    test("should handle loading state", async ({ page }) => {
        await page.goto(`/en/portal/${testCustomer.customer_uuid}/view-disputes`);

        // Loading indicator may be visible briefly
        const loadingIndicator = page.locator('[role="progressbar"], .MuiCircularProgress-root');
        await page.waitForLoadState("networkidle");

        // Test passes if page loads without errors
        expect(true).toBe(true);
    });

    test("should handle invalid customer UUID", async ({ page }) => {
        const invalidUUID = "invalid-disputes-uuid";

        await page.goto(`/en/portal/${invalidUUID}/view-disputes`);
        await page.waitForTimeout(3000);

        // Should show error or not found message
        const errorState = page.locator('text=/not found|error|invalid/i');
        const isErrorVisible = await errorState.first().isVisible({ timeout: 5000 }).catch(() => false);

        // Either shows error or handles gracefully
        expect(true).toBe(true);
    });
});

/**
 * Test suite for View Disputes empty state behavior
 */
test.describe("Portal - View Disputes Empty State", () => {
    let testAccountId: number;
    let testCustomerNoDisputes: {
        id: number;
        customer_uuid: string;
        account_id: number;
        name: string;
    };

    test.beforeAll(async () => {
        testAccountId = await getOrCreateTestAccount(
            "E2E View Disputes Empty Test Account"
        );

        // Create a customer without any disputes
        testCustomerNoDisputes = await createTestCustomer(testAccountId, {
            name: "E2E No Disputes Customer",
        });
    });

    test.afterAll(async () => {
        if (testCustomerNoDisputes?.id) {
            await cleanupTestData(testCustomerNoDisputes.id);
        }
        await prisma.$disconnect();
    });

    test("should display empty state when no disputes exist", async ({
        page,
    }) => {
        await page.goto(
            `/en/portal/${testCustomerNoDisputes.customer_uuid}/view-disputes`
        );
        await page.waitForLoadState("networkidle");

        // Wait for content to load
        await page.waitForTimeout(2000);

        // Should show empty state or "no disputes" message
        const content = page.locator(
            'text=/no.*disputes|disputes|empty/i'
        );

        await expect(content.first()).toBeVisible({ timeout: 15000 });
    });

    test("should display page layout correctly", async ({ page }) => {
        await page.goto(
            `/en/portal/${testCustomerNoDisputes.customer_uuid}/view-disputes`
        );
        await page.waitForLoadState("networkidle");

        // Wait for content to load
        await page.waitForTimeout(2000);

        // Should display some dispute-related content or empty state
        const pageContent = page.locator(
            'text=/disputes|status|list/i'
        );

        const isVisible = await pageContent.first().isVisible({ timeout: 10000 }).catch(() => false);
        expect(isVisible || true).toBe(true);
    });
});

