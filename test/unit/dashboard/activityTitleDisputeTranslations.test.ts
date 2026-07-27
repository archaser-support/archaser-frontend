import { describe, it, expect } from "vitest";

import { SpecialFieldHandler } from "@/server/services/ReportExecutionService.helpers";
import heDisputes from "@/locales/he/disputes.json";

describe("SpecialFieldHandler.extractCustomerNameFromRelation", () => {
    it("returns Company name when present", () => {
        expect(
            SpecialFieldHandler.extractCustomerNameFromRelation(
                { Company: { name: "Acme Ltd" }, Person: null },
                "name"
            )
        ).toBe("Acme Ltd");
    });

    it("falls back to Person full name when Company is null", () => {
        expect(
            SpecialFieldHandler.extractCustomerNameFromRelation(
                {
                    Company: null,
                    Person: {
                        first_name: "Dana",
                        last_name: "Cohen",
                        full_name: null,
                    },
                },
                "name"
            )
        ).toBe("Dana Cohen");
    });
});

describe("dispute activity title locale resources", () => {
    it("exposes disputes.fields keys used by activity titles", () => {
        expect(heDisputes.fields.resolved).toContain("{{disputeId}}");
        expect(heDisputes.fields.filed_title).toContain("{{disputeReason}}");
        expect(heDisputes.fields.status_updated).toContain("{{status}}");
        expect(heDisputes.fields.resolution_updated).toContain("{{resolution}}");
    });

    it("resolves disputes.fields.resolved via nested locale resources shape", () => {
        const language = "he";
        const resources = {
            [language]: {
                disputes: heDisputes,
            },
        };
        const localeResources = resources[language];
        const keys = "disputes.fields.resolved".split(".");
        let current: any = localeResources;
        for (const k of keys) {
            current = current[k];
        }
        expect(typeof current).toBe("string");
        expect(current).not.toBe("disputes.fields.resolved");
    });
});
