import { describe, expect, it } from "vitest";

import { resolveAppHomePath } from "@/shared/utils/resolveAppHomePath";

describe("resolveAppHomePath", () => {
    it("returns admin accounts for archaser admin account", () => {
        expect(resolveAppHomePath({ accountId: 10013, permissions: [] })).toBe(
            "/app/admin/accounts"
        );
    });

    it("returns credit dashboard for credit-only accounts when permitted", () => {
        expect(
            resolveAppHomePath({
                accountId: 20001,
                permissions: ["view_customers", "view_credit_dashboard"],
                accountProducts: {
                    has_collection: false,
                    has_credit_insurance: true,
                },
            })
        ).toBe("/app/credit-dashboard");
    });

    it("returns financial dashboard for collection accounts when permitted", () => {
        expect(
            resolveAppHomePath({
                accountId: 20001,
                permissions: ["view_financial_dashboard", "view_customers"],
                accountProducts: {
                    has_collection: true,
                    has_credit_insurance: false,
                },
            })
        ).toBe("/app/dashboard");
    });

    it("falls back to customers when credit-only lacks credit dashboard permission", () => {
        expect(
            resolveAppHomePath({
                accountId: 20001,
                permissions: ["view_customers"],
                accountProducts: {
                    has_collection: false,
                    has_credit_insurance: true,
                },
            })
        ).toBe("/app/customers");
    });
});
