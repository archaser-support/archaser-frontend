/**
 * Prepare dashboard_customers execute filters: strip active-dynamics marker
 * and expand into primaryWhereExtras (Entered/Exited OR with legacy BU asymmetry).
 */

import {
    DASHBOARD_ACTIVE_DYNAMICS_FILTER_FIELD,
    expandDashboardActiveDynamicsWhere,
} from "@/shared/dashboard/dashboardCustomerChartFilters";
import type { Filter } from "@/server/services/ReportExecutionService.types";

export interface PreparedDashboardCustomerExecuteFilters {
    filters: Filter[];
    primaryWhereExtras?: Record<string, unknown>;
    /** When true, do not apply URL/session BU on execute (encoded in Entered branch). */
    skipBusinessUnitFilter: boolean;
}

export function prepareDashboardCustomerExecuteFilters(
    filters: Filter[] | undefined,
    options: {
        businessUnitFilter?: Record<string, unknown>;
        now?: Date;
    } = {}
): PreparedDashboardCustomerExecuteFilters {
    if (!filters?.length) {
        return { filters: filters ?? [], skipBusinessUnitFilter: false };
    }

    const markerIndex = filters.findIndex(
        (f) =>
            f.table === "Customer" &&
            f.field === DASHBOARD_ACTIVE_DYNAMICS_FILTER_FIELD
    );

    if (markerIndex < 0) {
        return { filters, skipBusinessUnitFilter: false };
    }

    const marker = filters[markerIndex];
    const periodYyyyMm =
        typeof marker.value === "string" ? marker.value : String(marker.value);

    const primaryWhereExtras = expandDashboardActiveDynamicsWhere(
        periodYyyyMm,
        {
            businessUnitFilter: options.businessUnitFilter,
            now: options.now,
        }
    );

    const rest = filters.filter((_, i) => i !== markerIndex);

    return {
        filters: rest,
        primaryWhereExtras: primaryWhereExtras ?? undefined,
        skipBusinessUnitFilter: true,
    };
}
