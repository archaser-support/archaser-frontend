import type { CreditReportType } from "./creditReportTypes";

export const REPORT_TITLE_KEY: Record<CreditReportType, string> = {
    overdue: "title_overdue",
    capacity: "title_capacity",
    terms: "title_terms",
    policy_risk: "title_policy_risk",
    reporting: "title_reporting",
    reported: "title_reported",
    limit_warning: "title_limit_warning",
    zero_limit_warning: "title_zero_limit_warning",
    top_up: "title_top_up",
    top_up_expiring: "title_top_up_expiring",
    no_policy_exposure: "title_no_policy_exposure",
    utilization_bin: "title_utilization_bin",
    ar_extreme_moves: "title_ar_extreme_moves",
    utilization_overshoot: "title_utilization_overshoot",
    limit_capped: "title_limit_capped",
    negative_daily_cost: "title_negative_daily_cost",
    exposure_reconciliation: "title_exposure_reconciliation",
    policy_concentration: "title_policy_concentration",
    limit_breach_forecast: "title_limit_breach_forecast",
    breach_dilution: "title_breach_dilution",
    breach_episodes: "title_breach_episodes",
};

export const REPORT_DESCRIPTION_KEY: Record<CreditReportType, string> = {
    overdue: "description_overdue",
    capacity: "description_capacity",
    terms: "description_terms",
    policy_risk: "description_policy_risk",
    reporting: "description_reporting",
    reported: "description_reported",
    limit_warning: "description_limit_warning",
    zero_limit_warning: "description_zero_limit_warning",
    top_up: "description_top_up",
    top_up_expiring: "description_top_up_expiring",
    no_policy_exposure: "description_no_policy_exposure",
    utilization_bin: "description_utilization_bin",
    ar_extreme_moves: "description_ar_extreme_moves",
    utilization_overshoot: "description_utilization_overshoot",
    limit_capped: "description_limit_capped",
    negative_daily_cost: "description_negative_daily_cost",
    exposure_reconciliation: "description_exposure_reconciliation",
    policy_concentration: "description_policy_concentration",
    limit_breach_forecast: "description_limit_breach_forecast",
    breach_dilution: "description_breach_dilution",
    breach_episodes: "description_breach_episodes",
};

type TranslateFn = (
    key: string,
    options?: Record<string, unknown>
) => string;

/** Sets document.title before soft navigation so Safari history keeps the report name. */
export function applyCreditReportDocumentTitle(
    t: TranslateFn,
    type: CreditReportType
): void {
    const reportTitle = t(`credit_insurance_report.${REPORT_TITLE_KEY[type]}`, {
        ns: "dashboard",
    });
    document.title = t("credit_insurance_report.seo_title", {
        ns: "dashboard",
        title: reportTitle,
    });
}

