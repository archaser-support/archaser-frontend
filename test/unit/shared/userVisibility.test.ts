import { describe, expect, it } from "vitest";

import { isSyntheticAuditUser } from "@/shared/utils/userVisibility";

describe("isSyntheticAuditUser", () => {
    it("hides users explicitly marked as audit actors", () => {
        expect(
            isSyntheticAuditUser({
                email: "anything@example.com",
                is_audit_user: true,
            })
        ).toBe(true);
    });

    it.each([
        "portal-10117@audit.local",
        "system-10117@audit.local",
        "PORTAL-42@AUDIT.LOCAL",
    ])("hides legacy synthetic email %s", (email) => {
        expect(isSyntheticAuditUser({ email })).toBe(true);
    });

    it("keeps real users visible", () => {
        expect(
            isSyntheticAuditUser({
                email: "nilotpal@archaser.com",
                is_audit_user: false,
            })
        ).toBe(false);
    });
});
