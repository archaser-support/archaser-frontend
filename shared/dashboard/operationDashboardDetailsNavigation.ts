import type { TFunction } from "i18next";

import AppUrls from "@/utils/appUrls";

import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";

type TranslateFn = TFunction;

const OPERATION_DETAILS_TITLE_KEYS: Record<
    string,
    { key: string; ns: string }
> = {
    "manual-activities": { key: "fields.manual_activities", ns: "activities" },
    "automated-activities": {
        key: "fields.automated_activities",
        ns: "activities",
    },
    "total-calls": { key: "fields.total_calls", ns: "activities" },
    "activity-success-rate": {
        key: "fields.activity_success_rate",
        ns: "activities",
    },
    "disputes-created": { key: "fields.disputes_created", ns: "disputes" },
    "disputes-closed": { key: "fields.disputes_closed", ns: "disputes" },
    "open-disputes": { key: "fields.open_disputes", ns: "disputes" },
    "promises-to-pay": { key: "fields.promises_to_pay", ns: "dashboard" },
    "undelivered-activities": {
        key: "fields.undelivered_activities",
        ns: "activities",
    },
    "overdue-follow-ups": {
        key: "fields.overdue_follow_ups",
        ns: "activities",
    },
    "automation-stuck": { key: "fields.automation_stuck", ns: "activities" },
    "system-activities": { key: "fields.system_activities", ns: "activities" },
    "portal-activities": { key: "fields.portal_activities", ns: "activities" },
};

export function getOperationDashboardDetailsTitle(
    t: TranslateFn,
    type: string | null | undefined
): string {
    if (!type) {
        return "";
    }
    const entry = OPERATION_DETAILS_TITLE_KEYS[type];
    if (!entry) {
        return type;
    }
    return t(entry.key, { ns: entry.ns });
}

export function applyOperationDashboardDetailsDocumentTitle(
    t: TranslateFn,
    type: string
): void {
    if (typeof document === "undefined") {
        return;
    }
    const title = getOperationDashboardDetailsTitle(t, type);
    if (title) {
        document.title = title;
    }
}

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

type RouterLike = { push: (href: string) => void };

/** Soft-nav to operation details with Safari-safe history title. */
export function pushOperationDashboardDetails(
    router: RouterLike,
    t: TranslateFn,
    type: string,
    options?: {
        startDate?: Date;
        endDate?: Date;
        selectedUserId?: string | null;
        businessUnitId?: number | null;
    }
): void {
    applyOperationDashboardDetailsDocumentTitle(t, type);
    router.push(buildOperationDashboardDetailsUrl(type, options));
}
