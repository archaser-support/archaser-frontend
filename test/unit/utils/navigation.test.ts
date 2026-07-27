import { describe, expect, it } from "vitest";

import { getDefaultLandingPage, getFirstAccessiblePage } from "@/shared/utils/navigation";

describe("getFirstAccessiblePage", () => {
    it("returns credit dashboard for credit-only accounts when permitted", () => {
        const page = getFirstAccessiblePage(
            [
                "view_customers",
                "view_credit_dashboard",
            ],
            20001,
            {
                has_collection: false,
                has_credit_insurance: true,
            }
        );

        expect(page).toBe("/app/credit-dashboard");
    });

    it("credit-only without credit dashboard permission falls back to customers", () => {
        const page = getFirstAccessiblePage(
            ["view_customers"],
            20001,
            {
                has_collection: false,
                has_credit_insurance: true,
            }
        );

        expect(page).toBe("/app/customers");
    });

    it("credit-only with reports but no credit dashboard opens reports first", () => {
        const page = getFirstAccessiblePage(
            ["view_customers", "view_reports"],
            20001,
            {
                has_collection: false,
                has_credit_insurance: true,
            }
        );

        expect(page).toBe("/app/reports");
    });

    it("keeps existing behavior for collection accounts", () => {
        const page = getFirstAccessiblePage(
            ["view_financial_dashboard", "view_customers"],
            20001,
            {
                has_collection: true,
                has_credit_insurance: false,
            }
        );

        expect(page).toBe("/app/dashboard");
    });

    it("account 10013 with no permissions gets first admin nav item", () => {
        const page = getFirstAccessiblePage([], 10013);
        expect(page).toBe("/app/admin/accounts");
    });

    it("returns accounts as default landing page for archaser admin", () => {
        expect(getDefaultLandingPage(10013)).toBe("/app/admin/accounts");
    });

    it("returns dashboard as default landing page for non-admin accounts", () => {
        expect(getDefaultLandingPage(20001)).toBe("/app/dashboard");
    });
});
