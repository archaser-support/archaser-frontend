import { describe, expect, it } from "vitest";

import {
    isCustomerReportCurrencyAmountField,
    resolveCustomerAmountFieldCurrency,
} from "@/server/utils/reportCustomerAmountCurrency";

describe("reportCustomerAmountCurrency", () => {
    it("treats top-up cover amount fields as currency fields", () => {
        expect(isCustomerReportCurrencyAmountField("approved_limit")).toBe(
            true
        );
        expect(isCustomerReportCurrencyAmountField("top_up_total")).toBe(true);
        expect(
            isCustomerReportCurrencyAmountField("effective_approved_limit")
        ).toBe(true);
        expect(
            isCustomerReportCurrencyAmountField("open_receivable_amount")
        ).toBe(true);
        expect(isCustomerReportCurrencyAmountField("open_invoice_count")).toBe(
            false
        );
    });

    it("uses account currency for dashboard KPI amounts", () => {
        expect(
            resolveCustomerAmountFieldCurrency(
                {},
                "top_up_total",
                "USD"
            )
        ).toBe("USD");
        expect(
            resolveCustomerAmountFieldCurrency(
                {},
                "open_receivable_amount",
                "ILS"
            )
        ).toBe("ILS");
    });

    it("uses policy currency for approved limit when available", () => {
        expect(
            resolveCustomerAmountFieldCurrency(
                {
                    CustomerPolicy: [
                        {
                            is_active: true,
                            approved_limit_currency: "EUR",
                            InsurancePolicy: { currency: "EUR" },
                        },
                    ],
                },
                "approved_limit",
                "USD"
            )
        ).toBe("EUR");
    });
});
