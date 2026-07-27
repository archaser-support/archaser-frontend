import { describe, it, expect } from "vitest";

import {
    calculateDaysLeft,
    calculateDaysOverdue,
    calculateDaysUntilDue,
    extractCallDirectionFromTitleParams,
    extractTermsBreachReasonCodes,
    formatTermsBreachReasonForDisplay,
} from "@/server/services/ReportExecutionService.virtualFields";

describe("dashboard report virtual day helpers", () => {
    const now = new Date(2026, 6, 14); // Jul 14, 2026

    it("calculates days overdue like chart-details", () => {
        expect(calculateDaysOverdue(new Date(2026, 6, 4), now)).toBe(10);
        expect(calculateDaysOverdue(new Date(2026, 6, 20), now)).toBe(0);
        expect(calculateDaysOverdue(null, now)).toBeNull();
    });

    it("calculates days until due like chart-details", () => {
        expect(calculateDaysUntilDue(new Date(2026, 6, 20), now)).toBe(6);
        expect(calculateDaysUntilDue(new Date(2026, 6, 10), now)).toBe(-4);
        expect(calculateDaysUntilDue(undefined, now)).toBeNull();
    });

    it("calculates non-negative days left for reporting / limit expiry", () => {
        expect(calculateDaysLeft(new Date(2026, 6, 20), now)).toBe(6);
        expect(calculateDaysLeft(new Date(2026, 6, 10), now)).toBe(0);
        expect(calculateDaysLeft(null, now)).toBeNull();
    });

    it("joins terms breach reason codes like the legacy list", () => {
        expect(
            extractTermsBreachReasonCodes({
                reporting_breach: true,
                ctv_payment_term: false,
                ctv_customer_overdue_mep: true,
                ctv_outdated_dcl: false,
                ctv_invoice_after_policy_end: false,
            })
        ).toBe("reporting_breach · ctv_customer_overdue_mep");
        expect(extractTermsBreachReasonCodes({})).toBe("");
    });

    it("formats terms breach codes to localized labels", () => {
        expect(
            formatTermsBreachReasonForDisplay("ctv_payment_term", "en-US")
        ).toBe("Payment term violation");
        expect(
            formatTermsBreachReasonForDisplay("ctv_payment_term", "he-IL")
        ).toBe("הפרת תנאי תשלום");
        expect(
            formatTermsBreachReasonForDisplay(
                "reporting_breach · ctv_payment_term",
                "en"
            )
        ).toBe("Reporting breach · Payment term violation");
        expect(
            formatTermsBreachReasonForDisplay(
                "ctv_payment_term",
                "he-IL",
                "English"
            )
        ).toBe("Payment term violation");
        expect(
            formatTermsBreachReasonForDisplay(
                "ctv_payment_term",
                "en-US",
                "Hebrew"
            )
        ).toBe("הפרת תנאי תשלום");
    });

    it("extracts call direction from title_params.callType", () => {
        expect(
            extractCallDirectionFromTitleParams({ callType: "Incoming" })
        ).toBe("incoming");
        expect(
            extractCallDirectionFromTitleParams({ callType: "outgoing" })
        ).toBe("outgoing");
        expect(extractCallDirectionFromTitleParams({ callType: "other" })).toBeNull();
        expect(extractCallDirectionFromTitleParams(null)).toBeNull();
    });
});
