import { describe, expect, it } from "vitest";

import {
    formatLimitWarningSummary,
    isCreditDashboardEnrichedSortField,
    sortCreditDashboardEnrichedRows,
} from "@/server/services/creditInsurance/creditDashboardReportEnrichment";

describe("creditDashboardReportEnrichment", () => {
    it("formats limit warning summary in English", () => {
        expect(
            formatLimitWarningSummary(
                {
                    nearLimit: true,
                    nearLimitUtilizationPct: 92,
                    scoreExpiring: true,
                    scoreExpiresInDays: 5,
                    limitExpiring: false,
                    limitExpiresInDays: null,
                },
                "English"
            )
        ).toBe(
            "At 92% of approved limit · Credit score validity in 5d"
        );
    });

    it("formats limit warning summary in Hebrew", () => {
        expect(
            formatLimitWarningSummary(
                {
                    nearLimit: false,
                    nearLimitUtilizationPct: null,
                    scoreExpiring: false,
                    scoreExpiresInDays: null,
                    limitExpiring: true,
                    limitExpiresInDays: 3,
                },
                "Hebrew"
            )
        ).toBe("תוקף המסגרת יפוג בעוד 3 ימים");
    });

    it("detects enriched sort fields", () => {
        expect(isCreditDashboardEnrichedSortField("open_receivable_amount")).toBe(
            true
        );
        expect(isCreditDashboardEnrichedSortField("name")).toBe(false);
    });

    it("sorts enriched rows numerically", () => {
        const sorted = sortCreditDashboardEnrichedRows(
            [
                { id: 1, open_receivable_amount: 100 },
                { id: 2, open_receivable_amount: 500 },
                { id: 3, open_receivable_amount: 200 },
            ],
            "open_receivable_amount",
            "desc"
        );
        expect(sorted.map((r) => r.id)).toEqual([2, 3, 1]);
    });
});
