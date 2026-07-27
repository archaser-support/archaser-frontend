import { describe, it, expect } from "vitest";

import { hasNoAvailableViewsForContext } from "@/shared/components/ViewBasedDataGrid/hasNoAvailableViewsForContext";

describe("hasNoAvailableViewsForContext", () => {
    it("is true when queries settled and context has no reports (hang root cause)", () => {
        expect(
            hasNoAvailableViewsForContext({
                isDefaultViewFetched: true,
                isReportsListFetched: true,
                selectedViewId: null,
                defaultViewId: null,
                defaultViewData: null,
                accessibleReportsCount: 0,
            })
        ).toBe(true);
    });

    it("is false while default/list queries are still loading", () => {
        expect(
            hasNoAvailableViewsForContext({
                isDefaultViewFetched: false,
                isReportsListFetched: true,
                selectedViewId: null,
                defaultViewId: null,
                defaultViewData: null,
                accessibleReportsCount: 0,
            })
        ).toBe(false);
    });

    it("is false when async systemReport defaultViewId prop is present", () => {
        expect(
            hasNoAvailableViewsForContext({
                isDefaultViewFetched: true,
                isReportsListFetched: true,
                selectedViewId: null,
                defaultViewId: 3584,
                defaultViewData: null,
                accessibleReportsCount: 0,
            })
        ).toBe(false);
    });

    it("is false when a default report exists", () => {
        expect(
            hasNoAvailableViewsForContext({
                isDefaultViewFetched: true,
                isReportsListFetched: true,
                selectedViewId: null,
                defaultViewId: null,
                defaultViewData: { id: 1 },
                accessibleReportsCount: 0,
            })
        ).toBe(false);
    });
});
