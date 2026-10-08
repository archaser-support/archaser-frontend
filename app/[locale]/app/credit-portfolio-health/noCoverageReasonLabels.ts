import type { NoCoverageReasonKey } from "@/types/creditInsurance";

export type ReasonLabelKey = { key: string; defaultValue: string };

export const NO_COVERAGE_REASON_LABEL_KEYS: Partial<
    Record<NoCoverageReasonKey, ReasonLabelKey>
> = {
    pending_review: {
        key: "credit_portfolio_health.reason_pending_review",
        defaultValue: "Pending review",
    },
    credit_hold: {
        key: "credit_portfolio_health.reason_credit_hold",
        defaultValue: "Credit hold",
    },
    insurer_declined: {
        key: "credit_portfolio_health.reason_insurer_declined",
        defaultValue: "Insurer declined",
    },
    no_linked_policy: {
        key: "credit_portfolio_health.reason_no_linked_policy",
        defaultValue: "No linked policy",
    },
};

export const BREACH_REASON_LABEL_KEYS: Record<string, ReasonLabelKey> = {
    reportingBreach: {
        key: "credit_insurance_dashboard.breach_type_reporting_breach",
        defaultValue: "Reporting Breach",
    },
    paymentTerm: {
        key: "credit_insurance_dashboard.breach_type_payment_term",
        defaultValue: "Payment Term Breach",
    },
    customerOverdueMep: {
        key: "credit_insurance_dashboard.breach_type_customer_overdue_mep",
        defaultValue: "Customer Overdue MEP",
    },
    outdatedDcl: {
        key: "credit_insurance_dashboard.breach_type_outdated_dcl",
        defaultValue: "Outdated DCL",
    },
    invoiceAfterPolicyEnd: {
        key: "credit_insurance_dashboard.breach_type_invoice_after_policy_end",
        defaultValue: "Invoice After Policy End",
    },
    other: {
        key: "credit_insurance_dashboard.breach_type_other",
        defaultValue: "Other",
    },
};
