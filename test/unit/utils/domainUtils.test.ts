import { describe, expect, it } from "vitest";

import {
    getEnvironmentLabel,
    getTenantSubdomain,
    isEnvironmentHost,
} from "@/utils/domainUtils";

describe("domainUtils host classification", () => {
    it("treats dev the same as staging and preprod", () => {
        expect(isEnvironmentHost("dev.archaser.com")).toBe(true);
        expect(isEnvironmentHost("staging.archaser.com")).toBe(true);
        expect(isEnvironmentHost("preprod.archaser.com")).toBe(true);
        expect(getEnvironmentLabel("dev.archaser.com")).toBe("dev");
        expect(getEnvironmentLabel("staging.archaser.com")).toBe("staging");
    });

    it("does not classify tenant or apex hosts as environments", () => {
        expect(isEnvironmentHost("acme.archaser.com")).toBe(false);
        expect(isEnvironmentHost("portal.archaser.com")).toBe(false);
        expect(isEnvironmentHost("archaser.com")).toBe(false);
        expect(getEnvironmentLabel("acme.archaser.com")).toBeNull();
    });

    it("matches on the leading label only, not a substring", () => {
        // A tenant named "developers" must not be mistaken for the dev deploy.
        expect(isEnvironmentHost("developers.archaser.com")).toBe(false);
        expect(getTenantSubdomain("developers.archaser.com")).toBe(
            "developers"
        );
    });

    it("resolves tenant subdomains and rejects reserved ones", () => {
        expect(getTenantSubdomain("acme.archaser.com")).toBe("acme");
        expect(getTenantSubdomain("dev.archaser.com")).toBeNull();
        expect(getTenantSubdomain("staging.archaser.com")).toBeNull();
        expect(getTenantSubdomain("www.archaser.com")).toBeNull();
        expect(getTenantSubdomain("portal.archaser.com")).toBeNull();
        expect(getTenantSubdomain("archaser.com")).toBeNull();
        expect(getTenantSubdomain("localhost")).toBeNull();
        expect(getTenantSubdomain(undefined)).toBeNull();
    });

    it("ignores case in the leading label", () => {
        expect(isEnvironmentHost("DEV.archaser.com")).toBe(true);
        expect(getTenantSubdomain("ACME.archaser.com")).toBe("acme");
    });
});
