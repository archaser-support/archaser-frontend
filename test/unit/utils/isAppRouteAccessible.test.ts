import { describe, expect, it } from "vitest";

import {
    getAccessibleAppRoutePrefixes,
    isAppRouteAccessible,
    normalizeAppPathname,
} from "@/shared/utils/navigation";

const creditOnlyProducts = {
    has_collection: false,
    has_credit_insurance: true,
};

const collectionProducts = {
    has_collection: true,
    has_credit_insurance: false,
};

describe("normalizeAppPathname", () => {
    it("strips locale prefix", () => {
        expect(normalizeAppPathname("/en/app/dashboard")).toBe("/app/dashboard");
    });
});

describe("isAppRouteAccessible", () => {
    it("allows credit dashboard paths for credit-only accounts", () => {
        const permissions = ["view_customers", "view_credit_dashboard"];

        expect(
            isAppRouteAccessible(
                "/en/app/credit-dashboard",
                permissions,
                20001,
                creditOnlyProducts
            )
        ).toBe(true);
        expect(
            isAppRouteAccessible(
                "/en/app/credit-dashboard/report",
                permissions,
                20001,
                creditOnlyProducts
            )
        ).toBe(true);
        expect(
            isAppRouteAccessible(
                "/en/app/credit-portfolio-health",
                permissions,
                20001,
                creditOnlyProducts
            )
        ).toBe(true);
    });

    it("blocks portfolio health without view_credit_dashboard", () => {
        expect(
            isAppRouteAccessible(
                "/app/credit-portfolio-health",
                ["view_customers"],
                20001,
                creditOnlyProducts
            )
        ).toBe(false);
    });

    it("blocks financial dashboard for credit-only accounts", () => {
        const permissions = [
            "view_customers",
            "view_credit_dashboard",
            "view_financial_dashboard",
        ];

        expect(
            isAppRouteAccessible(
                "/en/app/dashboard",
                permissions,
                20001,
                creditOnlyProducts
            )
        ).toBe(false);
        expect(
            isAppRouteAccessible(
                "/en/app/dashboard/chart-details",
                permissions,
                20001,
                creditOnlyProducts
            )
        ).toBe(false);
    });

    it("allows financial dashboard for collection accounts with permission", () => {
        const permissions = ["view_financial_dashboard", "view_customers"];

        expect(
            isAppRouteAccessible(
                "/app/dashboard",
                permissions,
                20001,
                collectionProducts
            )
        ).toBe(true);
    });

    it("blocks collection-only routes for credit-only accounts", () => {
        const permissions = ["view_customers", "view_credit_dashboard"];

        expect(
            isAppRouteAccessible(
                "/app/disputes",
                permissions,
                20001,
                creditOnlyProducts
            )
        ).toBe(false);
        expect(
            isAppRouteAccessible(
                "/app/control-center",
                permissions,
                20001,
                creditOnlyProducts
            )
        ).toBe(false);
    });

    it("allows customer detail under customers prefix", () => {
        const permissions = ["view_customers", "view_credit_dashboard"];

        expect(
            isAppRouteAccessible(
                "/app/customers/5401",
                permissions,
                20001,
                creditOnlyProducts
            )
        ).toBe(true);
    });
});

describe("getAccessibleAppRoutePrefixes", () => {
    it("omits financial dashboard prefix for credit-only accounts", () => {
        const prefixes = getAccessibleAppRoutePrefixes(
            ["view_customers", "view_credit_dashboard", "view_financial_dashboard"],
            20001,
            creditOnlyProducts
        );

        expect(prefixes).toContain("/app/credit-dashboard");
        expect(prefixes).toContain("/app/credit-portfolio-health");
        expect(prefixes).not.toContain("/app/dashboard");
    });
});
