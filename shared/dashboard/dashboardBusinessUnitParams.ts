export function parseDashboardBusinessUnitIdFromUrl(
    value: string | null | undefined
): number | null {
    if (!value) {
        return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

export function appendDashboardBusinessUnitId(
    searchParams: URLSearchParams,
    businessUnitId: number | null | undefined
): URLSearchParams {
    if (businessUnitId != null) {
        searchParams.set("businessUnitId", String(businessUnitId));
    }

    return searchParams;
}
