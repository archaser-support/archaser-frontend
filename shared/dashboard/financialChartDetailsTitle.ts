import type { TFunction } from "i18next";

import {
    COLLECTED_MTD_CHART_TYPE,
    isCollectedMtdChartType,
} from "@/shared/dashboard/collectedMtdChartDetails";

type TranslateFn = TFunction;

export type FinancialChartDetailsTitleOptions = {
    type: string;
    period?: string | null;
    daysRange?: string | null;
    locale?: string;
};

function tDashboard(
    t: TranslateFn,
    key: string,
    defaultValue?: string
): string {
    if (defaultValue != null) {
        return t(key, defaultValue, { ns: "dashboard" });
    }
    return t(key, { ns: "dashboard" });
}

/** Page / browser title for financial dashboard chart-details drills. */
export function getFinancialChartDetailsTitle(
    t: TranslateFn,
    options: FinancialChartDetailsTitleOptions
): string {
    const { type, period, daysRange, locale } = options;

    if (isCollectedMtdChartType(type) || type === COLLECTED_MTD_CHART_TYPE) {
        return tDashboard(t, "fields.stats_total_collected_m_t_d");
    }

    const titles: Record<string, string> = {
        "active-customers": tDashboard(
            t,
            "fields.charts_active_customers_title",
            "Overdue Accounts Dynamics"
        ),
        "aging-portfolio": tDashboard(
            t,
            "fields.stats_aging_overdue_portfolio",
            "Aging Overdue Portfolio"
        ),
        "overdue-amount": tDashboard(
            t,
            "fields.stats_overdue_amount",
            "Overdue Amount"
        ),
        "overdue-invoices": tDashboard(
            t,
            "fields.stats_overdue_invoices",
            "Overdue Invoices"
        ),
        "overdue-customers": tDashboard(
            t,
            "fields.stats_overdue_customers",
            "Overdue Customers"
        ),
        "collection-efforts": tDashboard(
            t,
            "fields.charts_collection_efforts_phase_title",
            "Collection Efforts Phase"
        ),
        "automated-phase-split": tDashboard(
            t,
            "fields.charts_automated_phase_split_title",
            "Automated Phase Split"
        ),
        "total-due": tDashboard(t, "fields.stats_total_due", "Total Due"),
        "due-today": tDashboard(t, "fields.stats_due_today", "Due Today"),
        "due-this-week": tDashboard(
            t,
            "fields.stats_due_this_week",
            "Due This Week"
        ),
        "due-this-month": tDashboard(
            t,
            "fields.stats_due_this_month",
            "Due This Month"
        ),
        "due-next-month": tDashboard(
            t,
            "fields.stats_due_next_month",
            "Due Next Month"
        ),
    };

    let title =
        titles[type] ||
        tDashboard(t, "fields.chart_details_default_title", "Chart Details");

    if (type === "active-customers" && period) {
        const date = new Date(`${period}-01`);
        if (!Number.isNaN(date.getTime())) {
            const monthName = date.toLocaleDateString(locale || "en", {
                month: "short",
            });
            title = `${title} – ${monthName}`;
        }
    }

    if (type === "aging-portfolio" && daysRange) {
        const rangeLabels: Record<string, string> = {
            "0_7": "0-7 days",
            "8_30": "8-30 days",
            "31_60": "31-60 days",
            "61_90": "61-90 days",
            "91_180": "91-180 days",
            "181_365": "181-365 days",
            "365_2000": "365+ days",
        };
        title = `${title} – ${rangeLabels[daysRange] || daysRange}`;
    }

    return title;
}

export function applyFinancialChartDetailsDocumentTitle(
    t: TranslateFn,
    options: FinancialChartDetailsTitleOptions
): void {
    if (typeof document === "undefined" || !options.type) {
        return;
    }
    document.title = getFinancialChartDetailsTitle(t, options);
}

export function applyFinancialChartDetailsDocumentTitleFromHref(
    t: TranslateFn,
    href: string,
    locale?: string
): void {
    try {
        const url = new URL(href, "http://local");
        const type = url.searchParams.get("type");
        if (!type) {
            return;
        }
        applyFinancialChartDetailsDocumentTitle(t, {
            type,
            period: url.searchParams.get("period"),
            daysRange: url.searchParams.get("daysRange"),
            locale,
        });
    } catch {
        // ignore parse errors
    }
}

type RouterLike = { push: (href: string) => void };

/** Soft-nav to chart-details with Safari-safe history title. */
export function pushFinancialChartDetails(
    router: RouterLike,
    href: string,
    t: TranslateFn,
    locale?: string
): void {
    applyFinancialChartDetailsDocumentTitleFromHref(t, href, locale);
    router.push(href);
}
