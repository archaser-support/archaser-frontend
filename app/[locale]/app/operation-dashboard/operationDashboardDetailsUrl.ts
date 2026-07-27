import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import AppUrls from "@/utils/appUrls";

export function buildOperationDashboardDetailsUrl(
    type: string,
    options?: {
        startDate?: Date;
        endDate?: Date;
        selectedUserId?: string | null;
        businessUnitId?: number | null;
    }
): string {
    const params = new URLSearchParams({ type });
    if (options?.startDate) {
        params.append("startDate", options.startDate.toISOString());
    }
    if (options?.endDate) {
        params.append("endDate", options.endDate.toISOString());
    }
    if (options?.selectedUserId) {
        params.append("selectedUserId", options.selectedUserId);
    }
    appendDashboardBusinessUnitId(params, options?.businessUnitId);
    return `${AppUrls.OPERATION_DASHBOARD_DETAILS}?${params.toString()}`;
}
