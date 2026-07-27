/**
 * Whether view selection has settled with nothing to show.
 * Used to avoid an infinite loading spinner when a context has no seeded reports.
 */
export function hasNoAvailableViewsForContext(input: {
    isDefaultViewFetched: boolean;
    isReportsListFetched: boolean;
    selectedViewId: number | null;
    defaultViewId?: number | null;
    defaultViewData: unknown;
    accessibleReportsCount: number;
}): boolean {
    if (!input.isDefaultViewFetched || !input.isReportsListFetched) {
        return false;
    }
    if (input.selectedViewId != null || input.defaultViewId != null) {
        return false;
    }
    if (input.defaultViewData) {
        return false;
    }
    return input.accessibleReportsCount === 0;
}
