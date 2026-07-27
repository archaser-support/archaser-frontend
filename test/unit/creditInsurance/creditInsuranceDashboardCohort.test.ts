import { describe, expect, it } from "vitest";

import {
    isNoPolicyExposureCardCustomer,
    isUncoveredExposureCustomer,
} from "@/shared/creditInsurance/policyExclusion";

/**
 * Dashboard summary uses card cohort for the No Policy Exposure card + filter,
 * and uncovered exposure for at-risk allocation (full open AR).
 */
describe("credit dashboard cohort matrix", () => {
    const cases = [
        {
            label: "no linked policy with open AR",
            hasLinkedPolicy: false,
            exclusionReason: null,
            openAr: 1000,
            onCard: true,
            uncovered: true,
        },
        {
            label: "no linked policy with zero AR",
            hasLinkedPolicy: false,
            exclusionReason: null,
            openAr: 0,
            onCard: false,
            uncovered: true,
        },
        {
            label: "pending review with linked policy",
            hasLinkedPolicy: true,
            exclusionReason: "Pending review",
            openAr: 500,
            onCard: true,
            uncovered: true,
        },
        {
            label: "credit hold with linked policy",
            hasLinkedPolicy: true,
            exclusionReason: "Credit hold",
            openAr: 500,
            onCard: false,
            uncovered: true,
        },
        {
            label: "insured customer without exclusion",
            hasLinkedPolicy: true,
            exclusionReason: null,
            openAr: 2000,
            onCard: false,
            uncovered: false,
        },
    ] as const;

    it.each(cases)(
        "$label → card=$onCard uncovered=$uncovered",
        ({ hasLinkedPolicy, exclusionReason, openAr, onCard, uncovered }) => {
            expect(
                isNoPolicyExposureCardCustomer({
                    hasLinkedPolicy,
                    exclusionReason,
                    openAr,
                })
            ).toBe(onCard);
            expect(
                isUncoveredExposureCustomer({
                    hasLinkedPolicy,
                    exclusionReason,
                })
            ).toBe(uncovered);
        }
    );

    it("filter off removes only card cohort members from dashboard customer set", () => {
        const customers = [
            { id: 1, hasLinkedPolicy: false, exclusionReason: null, openAr: 100 },
            { id: 2, hasLinkedPolicy: true, exclusionReason: "Pending review", openAr: 50 },
            { id: 3, hasLinkedPolicy: true, exclusionReason: "Credit hold", openAr: 75 },
            { id: 4, hasLinkedPolicy: true, exclusionReason: null, openAr: 200 },
        ];

        const isCardCohort = (c: (typeof customers)[number]) =>
            isNoPolicyExposureCardCustomer({
                hasLinkedPolicy: c.hasLinkedPolicy,
                exclusionReason: c.exclusionReason,
                openAr: c.openAr,
            });

        const withCohort = customers;
        const withoutCohort = customers.filter((c) => !isCardCohort(c));

        expect(withCohort).toHaveLength(4);
        expect(withoutCohort.map((c) => c.id)).toEqual([3, 4]);
    });
});
