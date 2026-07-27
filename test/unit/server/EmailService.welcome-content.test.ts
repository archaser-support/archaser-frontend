import { describe, expect, it } from "vitest";

import { buildWelcomeContentVars } from "@/server/EmailService";
import { EMAIL_TYPES, getEmailTemplate } from "@/shared/templates/email-templates";

describe("buildWelcomeContentVars", () => {
    it("returns collection-focused content for collection-only accounts", () => {
        const content = buildWelcomeContentVars({
            hasCollection: true,
            hasCreditInsurance: false,
            language: "en",
        });

        expect(content.product_subtitle).toBe(
            "Your debt collection management platform"
        );
        expect(content.feature_1).toContain("collections");
    });

    it("returns credit-focused content for credit-only accounts", () => {
        const content = buildWelcomeContentVars({
            hasCollection: false,
            hasCreditInsurance: true,
            language: "en",
        });

        expect(content.product_subtitle).toBe(
            "Your credit insurance management platform"
        );
        expect(content.feature_2).toContain("capacity gaps");
    });

    it("returns combined content for dual-product accounts", () => {
        const content = buildWelcomeContentVars({
            hasCollection: true,
            hasCreditInsurance: true,
            language: "en",
        });

        expect(content.product_subtitle).toBe(
            "Your collections and credit insurance platform"
        );
        expect(content.feature_1).toContain("collection workflows");
        expect(content.feature_2).toContain("exposure");
    });
});

describe("welcome-user template interpolation", () => {
    it("replaces dynamic placeholders and reset link", () => {
        const content = buildWelcomeContentVars({
            hasCollection: false,
            hasCreditInsurance: true,
            language: "en",
        });

        const html = getEmailTemplate(EMAIL_TYPES.WELCOME_USER, "en", {
            user_name: "Test User",
            reset_link: "https://app.example/reset",
            ...content,
        });

        expect(html).toContain("https://app.example/reset");
        expect(html).toContain(content.product_subtitle);
        expect(html).toContain(content.feature_1);
        expect(html).not.toContain("${product_subtitle}");
        expect(html).not.toContain("${feature_1}");
    });
});
