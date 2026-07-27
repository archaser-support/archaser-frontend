import { describe, expect, it } from "vitest";

import {
    applyMonthEndCutoffAdjustment,
    computeInvoiceCapacityGapContribution,
    computeLimitAssessedAmountForNewOpenInvoice,
    sumInvoiceCapacityGapContributions,
    computeCustomerOverdueBlock,
    computeCreatedTermsViolationInvoiceAfterPolicyEnd,
    computeCreatedTermsViolationOutdatedDcl,
    computeCreatedTermsViolationSnapshot,
    computePaymentTermBreach,
    computePaymentTermDays,
    computeInvoiceInsuranceRowData,
    computeTargetMepDate,
    computeTargetReportingDate,
    isTargetReportingDateBeforeToday,
    parseImportDateToLocalCalendarDate,
    shouldSetReportingBreach,
} from "@/server/services/creditInsurance/invoiceInsuranceFields";

describe("parseImportDateToLocalCalendarDate", () => {
    it("parses YYYY-MM-DD as local calendar day", () => {
        const d = parseImportDateToLocalCalendarDate("2025-06-15");
        expect(d).not.toBeNull();
        expect(d!.getFullYear()).toBe(2025);
        expect(d!.getMonth()).toBe(5);
        expect(d!.getDate()).toBe(15);
    });

    it("returns null for empty input", () => {
        expect(parseImportDateToLocalCalendarDate("")).toBeNull();
        expect(parseImportDateToLocalCalendarDate(null)).toBeNull();
    });
});

describe("computeCustomerOverdueBlock", () => {
    it("is false without oldest overdue date or max_allowed_mep", () => {
        expect(
            computeCustomerOverdueBlock({
                oldestInvoiceOverdueDate: null,
                maxAllowedMepDays: 30,
                today: new Date("2025-06-15"),
            })
        ).toBe(false);
        expect(
            computeCustomerOverdueBlock({
                oldestInvoiceOverdueDate: new Date("2025-01-01"),
                maxAllowedMepDays: null,
                today: new Date("2025-06-15"),
            })
        ).toBe(false);
    });

    it("is true when today is after oldest due + MEP days", () => {
        const oldest = new Date("2025-01-01");
        const today = new Date("2025-01-12");
        expect(
            computeCustomerOverdueBlock({
                oldestInvoiceOverdueDate: oldest,
                maxAllowedMepDays: 10,
                today,
            })
        ).toBe(true);
    });

    it("is false on the MEP deadline day", () => {
        const oldest = new Date("2025-01-01");
        const deadline = new Date("2025-01-11");
        expect(
            computeCustomerOverdueBlock({
                oldestInvoiceOverdueDate: oldest,
                maxAllowedMepDays: 10,
                today: deadline,
            })
        ).toBe(false);
    });
});

describe("computeCreatedTermsViolationOutdatedDcl", () => {
    it("is false when input date or validity months missing", () => {
        expect(
            computeCreatedTermsViolationOutdatedDcl(
                new Date("2025-06-15"),
                null,
                12
            )
        ).toBe(false);
        expect(
            computeCreatedTermsViolationOutdatedDcl(
                new Date("2025-06-15"),
                new Date("2025-01-01"),
                null
            )
        ).toBe(false);
    });

    it("is false on validity end anniversary day, true the next day", () => {
        const input = new Date("2025-01-01");
        const end = new Date("2026-01-01");
        expect(
            computeCreatedTermsViolationOutdatedDcl(end, input, 12)
        ).toBe(false);
        expect(
            computeCreatedTermsViolationOutdatedDcl(
                new Date("2026-01-02"),
                input,
                12
            )
        ).toBe(true);
    });
});

describe("computeCreatedTermsViolationInvoiceAfterPolicyEnd", () => {
    it("is true when invoice date is after policy end", () => {
        expect(
            computeCreatedTermsViolationInvoiceAfterPolicyEnd(
                new Date("2025-12-01"),
                new Date("2025-11-30")
            )
        ).toBe(true);
    });

    it("is true when invoice date is on policy expiry (same calendar day)", () => {
        expect(
            computeCreatedTermsViolationInvoiceAfterPolicyEnd(
                new Date("2025-11-30"),
                new Date("2025-11-30")
            )
        ).toBe(true);
    });

    it("is false when invoice date is strictly before policy end", () => {
        expect(
            computeCreatedTermsViolationInvoiceAfterPolicyEnd(
                new Date("2025-11-29"),
                new Date("2025-11-30")
            )
        ).toBe(false);
    });

    it("is true when import-parsed invoice day equals policy end from DB (UTC DATE)", () => {
        const policyFromDb = new Date("2025-11-30T00:00:00.000Z");
        const invoiceFromImport = parseImportDateToLocalCalendarDate("2025-11-30")!;
        expect(
            computeCreatedTermsViolationInvoiceAfterPolicyEnd(
                invoiceFromImport,
                policyFromDb
            )
        ).toBe(true);
    });
});

describe("computeCreatedTermsViolationSnapshot", () => {
    it("combines customer and policy rules", () => {
        const snap = computeCreatedTermsViolationSnapshot({
            invoice_date: new Date("2025-06-01"),
            customer: {
                overdue_block: true,
                policy_exclusion_reason: null,
                credit_score_input_date: new Date("2020-01-01"),
                policy_id: 1,
                limit_type: "DCL",
            },
            policy: {
                end_date: new Date("2025-12-31"),
                score_validity_period_months: 12,
                min_credit_score: null,
                dcl_customer_since_months: null,
            },
        });
        expect(snap.ctv_customer_overdue_mep).toBe(true);
        expect(snap.ctv_customer_excluded_from_policy).toBe(
            false
        );
        expect(snap.ctv_outdated_dcl).toBe(true);
        expect(snap.ctv_invoice_after_policy_end).toBe(
            false
        );
    });

    it("does not set ctv_outdated_dcl for Named limit even when score validity expired", () => {
        const snap = computeCreatedTermsViolationSnapshot({
            invoice_date: new Date("2025-06-01"),
            customer: {
                overdue_block: false,
                policy_exclusion_reason: null,
                credit_score_input_date: new Date("2020-01-01"),
                policy_id: 1,
                limit_type: "Named",
            },
            policy: {
                end_date: new Date("2025-12-31"),
                score_validity_period_months: 12,
                min_credit_score: 500,
                dcl_customer_since_months: 12,
            },
        });
        expect(snap.ctv_outdated_dcl).toBe(false);
    });

    it("derives ctv_customer_excluded_from_policy from exclusion reason", () => {
        const snap = computeCreatedTermsViolationSnapshot({
            invoice_date: new Date("2025-06-01"),
            customer: {
                overdue_block: false,
                policy_exclusion_reason: "Pending review",
                policy_id: 1,
                limit_type: "DCL",
            },
            policy: null,
        });
        expect(snap.ctv_customer_excluded_from_policy).toBe(true);
    });
});

describe("computePaymentTermDays", () => {
    it("returns calendar days between invoice and due", () => {
        const inv = new Date("2025-01-01T00:00:00.000Z");
        const due = new Date("2025-01-11T00:00:00.000Z");
        expect(computePaymentTermDays(inv, due)).toBe(10);
    });

    it("returns null if a date is missing", () => {
        expect(computePaymentTermDays(null, new Date())).toBeNull();
    });
});

describe("computePaymentTermBreach", () => {
    const paymentTermMonthEnd = {
        cutoffDayOfMonth: 24,
        substituteDayOfMonth: 2,
    };

    it("is false when max_payment_term - credit_days >= 0", () => {
        const inv = new Date("2025-01-01");
        const due = new Date("2025-01-11");
        expect(computePaymentTermBreach(inv, due, 10)).toBe(false);
        expect(computePaymentTermBreach(inv, due, 11)).toBe(false);
    });

    it("is true when credit days exceed max_payment_term", () => {
        const inv = new Date("2025-01-01");
        const due = new Date("2025-01-11");
        expect(computePaymentTermBreach(inv, due, 9)).toBe(true);
    });

    it("is false when max_payment_term or dates are missing", () => {
        expect(
            computePaymentTermBreach(new Date("2025-01-01"), null, 5)
        ).toBe(false);
        expect(
            computePaymentTermBreach(new Date("2025-01-01"), new Date("2025-01-10"), null)
        ).toBe(false);
    });

    it("uses plain cap when invoice day is before payment-term cutoff", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-15")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-30")!;
        expect(
            computePaymentTermBreach(invoiceDate, dueDate, 10, {
                invoiceDate,
                ...paymentTermMonthEnd,
            })
        ).toBe(true);
    });

    it("extends cap on cutoff so breach is cleared (12 credit days, cap 18)", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-07-06")!;
        expect(
            computePaymentTermBreach(invoiceDate, dueDate, 10, {
                invoiceDate,
                ...paymentTermMonthEnd,
            })
        ).toBe(false);
    });

    it("still breaches on cutoff when credit days exceed extended cap", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-07-20")!;
        expect(
            computePaymentTermBreach(invoiceDate, dueDate, 10, {
                invoiceDate,
                ...paymentTermMonthEnd,
            })
        ).toBe(true);
    });

    it("uses plain cap when payment-term cutoff fields are null", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-07-06")!;
        expect(
            computePaymentTermBreach(invoiceDate, dueDate, 10, {
                invoiceDate,
                cutoffDayOfMonth: null,
                substituteDayOfMonth: null,
            })
        ).toBe(true);
    });

    it("is false when invoice_date is missing even with cutoff set", () => {
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-30")!;
        expect(
            computePaymentTermBreach(null, dueDate, 10, {
                invoiceDate: null,
                ...paymentTermMonthEnd,
            })
        ).toBe(false);
    });

    it("is false when max_payment_term is missing", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-30")!;
        expect(
            computePaymentTermBreach(invoiceDate, dueDate, null, {
                invoiceDate,
                ...paymentTermMonthEnd,
            })
        ).toBe(false);
    });

    it("ignores MEP cutoff when payment-term cutoff is unset", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-07-06")!;
        expect(
            computePaymentTermBreach(invoiceDate, dueDate, 10, {
                invoiceDate,
                cutoffDayOfMonth: null,
                substituteDayOfMonth: null,
            })
        ).toBe(true);
    });

    it("clamps substitute 31 to 30 in April when computing extended cap", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-03-25")!;
        const dueOnCap = parseImportDateToLocalCalendarDate("2026-05-10")!;
        const dueOverCap = parseImportDateToLocalCalendarDate("2026-05-11")!;
        const monthEnd = {
            invoiceDate,
            cutoffDayOfMonth: 24,
            substituteDayOfMonth: 31,
        };
        expect(
            computePaymentTermBreach(invoiceDate, dueOnCap, 10, monthEnd)
        ).toBe(false);
        expect(
            computePaymentTermBreach(invoiceDate, dueOverCap, 10, monthEnd)
        ).toBe(true);
    });

    it("clamps substitute 31 to 28 in non-leap February when computing extended cap", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-01-25")!;
        const dueOnCap = parseImportDateToLocalCalendarDate("2026-03-10")!;
        const dueOverCap = parseImportDateToLocalCalendarDate("2026-03-11")!;
        const monthEnd = {
            invoiceDate,
            cutoffDayOfMonth: 24,
            substituteDayOfMonth: 31,
        };
        expect(
            computePaymentTermBreach(invoiceDate, dueOnCap, 10, monthEnd)
        ).toBe(false);
        expect(
            computePaymentTermBreach(invoiceDate, dueOverCap, 10, monthEnd)
        ).toBe(true);
    });
});

describe("isTargetReportingDateBeforeToday", () => {
    it("is false when target is today", () => {
        const today = parseImportDateToLocalCalendarDate("2026-02-24")!;
        const target = parseImportDateToLocalCalendarDate("2026-02-24")!;
        expect(isTargetReportingDateBeforeToday(target, today)).toBe(false);
    });

    it("is true when target is before today (e.g. Feb 24 vs May 12)", () => {
        const today = parseImportDateToLocalCalendarDate("2026-05-12")!;
        const target = parseImportDateToLocalCalendarDate("2026-02-24")!;
        expect(isTargetReportingDateBeforeToday(target, today)).toBe(true);
    });
});

describe("shouldSetReportingBreach", () => {
    it("is false when status is Paid", () => {
        const today = parseImportDateToLocalCalendarDate("2026-05-12")!;
        const target = parseImportDateToLocalCalendarDate("2026-02-24")!;
        expect(
            shouldSetReportingBreach("Paid", target, null, today)
        ).toBe(false);
    });

    it("is true for Due when target reporting date is before today", () => {
        const today = parseImportDateToLocalCalendarDate("2026-05-12")!;
        const target = parseImportDateToLocalCalendarDate("2026-02-24")!;
        expect(
            shouldSetReportingBreach("Due", target, null, today)
        ).toBe(true);
    });

    it("is true when Overdue, past target, no actual", () => {
        const today = parseImportDateToLocalCalendarDate("2026-05-12")!;
        const target = parseImportDateToLocalCalendarDate("2026-02-24")!;
        expect(
            shouldSetReportingBreach("Overdue", target, null, today)
        ).toBe(true);
    });
});

describe("computeLimitAssessedAmountForNewOpenInvoice", () => {
    it("allocates remaining approved limit headroom", () => {
        expect(
            computeLimitAssessedAmountForNewOpenInvoice({
                approvedLimit: 19_000,
                openArOnPolicyBeforeInvoice: 0,
            })
        ).toBe(19_000);
        expect(
            computeLimitAssessedAmountForNewOpenInvoice({
                approvedLimit: 18_000,
                openArOnPolicyBeforeInvoice: 19_500,
            })
        ).toBe(0);
    });

    it("consumes top-up pool only after policy limit is exhausted", () => {
        expect(
            computeLimitAssessedAmountForNewOpenInvoice({
                approvedLimit: 10_000,
                topUpTotal: 5_000,
                openArOnPolicyBeforeInvoice: 8_000,
            })
        ).toBe(2_000);
        expect(
            computeLimitAssessedAmountForNewOpenInvoice({
                approvedLimit: 10_000,
                topUpTotal: 5_000,
                openArOnPolicyBeforeInvoice: 12_000,
            })
        ).toBe(3_000);
    });

    it("allocates approved and top-up within one invoice when outstanding is provided", () => {
        expect(
            computeLimitAssessedAmountForNewOpenInvoice({
                approvedLimit: 12_000,
                topUpTotal: 6_000,
                openArOnPolicyBeforeInvoice: 0,
                newInvoiceOutstanding: 18_000,
            })
        ).toBe(18_000);
        expect(
            computeLimitAssessedAmountForNewOpenInvoice({
                approvedLimit: 12_000,
                topUpTotal: 6_000,
                openArOnPolicyBeforeInvoice: 11_000,
                newInvoiceOutstanding: 7_000,
            })
        ).toBe(7_000);
    });
});

describe("sumInvoiceCapacityGapContributions", () => {
    it("returns null when any invoice lacks a snapshot", () => {
        const result = sumInvoiceCapacityGapContributions([
            {
                outstanding_debt: 100,
                customer_outstanding_debt: null,
                amount: 100,
                limit_assessed_amount: 50,
            },
            {
                outstanding_debt: 200,
                customer_outstanding_debt: null,
                amount: 200,
                limit_assessed_amount: null,
            },
        ]);
        expect(result.hasMissingSnapshots).toBe(true);
        expect(result.total).toBeNull();
    });
});

describe("computeInvoiceCapacityGapContribution", () => {
    it("returns outstanding when assessed basis is zero (new exposure)", () => {
        expect(
            computeInvoiceCapacityGapContribution({
                outstandingLeft: 3000,
                limitAssessedAmount: 0,
            })
        ).toBe(3000);
    });

    it("returns max(0, outstanding - assessed) for legacy snapshot", () => {
        expect(
            computeInvoiceCapacityGapContribution({
                outstandingLeft: 2000,
                limitAssessedAmount: 1500,
            })
        ).toBe(500);
        expect(
            computeInvoiceCapacityGapContribution({
                outstandingLeft: 500,
                limitAssessedAmount: 1500,
            })
        ).toBe(0);
    });

    it("returns zero for non-positive outstanding", () => {
        expect(
            computeInvoiceCapacityGapContribution({
                outstandingLeft: 0,
                limitAssessedAmount: 100,
            })
        ).toBe(0);
        expect(
            computeInvoiceCapacityGapContribution({
                outstandingLeft: -5,
                limitAssessedAmount: 100,
            })
        ).toBe(0);
    });
});

describe("computeInvoiceInsuranceRowData", () => {
    it("computes targets from customer fields", () => {
        const row = computeInvoiceInsuranceRowData({
            status: "Overdue",
            invoice_date: new Date("2025-01-01"),
            due_date: new Date("2025-01-10"),
            customer: {
                reporting_days: 5,
                max_allowed_mep: 7,
                max_payment_term: 30,
            },
            today: new Date("2025-01-20"),
        });
        expect(row.payment_term).toBe(9);
        expect(row.ctv_payment_term).toBe(false);
        // Due 2025-01-10 + 5 reporting days → 2025-01-15
        expect(row.target_reporting_date?.toISOString().slice(0, 10)).toBe(
            "2025-01-15"
        );
        // Due 2025-01-10 + 7 max_allowed_mep → 2025-01-17
        expect(row.target_mep_date?.toISOString().slice(0, 10)).toBe(
            "2025-01-17"
        );
    });

    it("sets target_mep_date to due_date + customer.max_allowed_mep when reporting_days unset", () => {
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: parseImportDateToLocalCalendarDate("2025-03-01")!,
            due_date: parseImportDateToLocalCalendarDate("2025-03-20")!,
            customer: {
                reporting_days: null,
                max_allowed_mep: 14,
                max_payment_term: 20,
            },
            today: parseImportDateToLocalCalendarDate("2025-03-01")!,
        });
        expect(row.target_reporting_date).toBeNull();
        const targetMep = row.target_mep_date;
        expect(targetMep).not.toBeNull();
        expect(targetMep!.getFullYear()).toBe(2025);
        expect(targetMep!.getMonth()).toBe(3);
        expect(targetMep!.getDate()).toBe(3);
        expect(row.ctv_payment_term).toBe(false);
    });

    it("sets reporting_breach when uploaded after target reporting date passed", () => {
        const row = computeInvoiceInsuranceRowData({
            status: "Overdue",
            invoice_date: new Date("2026-01-01"),
            due_date: new Date("2026-01-20"),
            customer: {
                reporting_days: 35,
                max_allowed_mep: 7,
                max_payment_term: 30,
            },
            today: parseImportDateToLocalCalendarDate("2026-05-12")!,
        });
        expect(row.target_reporting_date?.toISOString().slice(0, 10)).toBe(
            "2026-02-24"
        );
        expect(row.reporting_breach).toBe(true);
    });

    it("sets ctv_payment_term when credit days exceed max_payment_term", () => {
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: new Date("2025-01-01"),
            due_date: new Date("2025-01-15"),
            customer: {
                reporting_days: null,
                max_allowed_mep: null,
                max_payment_term: 10,
            },
            today: new Date("2025-01-01"),
        });
        expect(row.payment_term).toBe(14);
        expect(row.ctv_payment_term).toBe(true);
    });

    it("applies payment-term month-end cutoff independently from MEP cutoff", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-07-06")!;
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: invoiceDate,
            due_date: dueDate,
            customer: {
                reporting_days: null,
                max_allowed_mep: 30,
                max_payment_term: 10,
                mep_cutoff_day_of_month: 24,
                mep_substitute_day_of_month: 2,
                payment_term_cutoff_day_of_month: 24,
                payment_term_substitute_day_of_month: 2,
            },
            today: invoiceDate,
        });
        expect(row.payment_term).toBe(12);
        expect(row.ctv_payment_term).toBe(false);
    });

    it("breaches on cutoff when credit days exceed payment-term extended cap", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-07-20")!;
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: invoiceDate,
            due_date: dueDate,
            customer: {
                reporting_days: null,
                max_allowed_mep: null,
                max_payment_term: 10,
                payment_term_cutoff_day_of_month: 24,
                payment_term_substitute_day_of_month: 2,
            },
            today: invoiceDate,
        });
        expect(row.payment_term).toBe(26);
        expect(row.ctv_payment_term).toBe(true);
    });
});

describe("month-end cutoff target dates", () => {
    const baseCustomer = {
        reporting_days: 40,
        max_allowed_mep: 30,
        max_payment_term: 60,
        mep_cutoff_day_of_month: 24,
        mep_substitute_day_of_month: 2,
        reporting_cutoff_day_of_month: null,
        reporting_substitute_day_of_month: null,
    };

    function expectCalendarDate(
        d: Date | null | undefined,
        year: number,
        month: number,
        day: number
    ) {
        expect(d).not.toBeNull();
        expect(d!.getFullYear()).toBe(year);
        expect(d!.getMonth()).toBe(month);
        expect(d!.getDate()).toBe(day);
    }

    it("keeps raw due_date + days when all cutoff fields are null", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: invoiceDate,
            due_date: dueDate,
            customer: {
                ...baseCustomer,
                mep_cutoff_day_of_month: null,
                mep_substitute_day_of_month: null,
            },
            today: invoiceDate,
        });
        expectCalendarDate(row.target_mep_date, 2026, 6, 24);
    });

    it("keeps raw dates when invoice day is before cutoff", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-15")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: invoiceDate,
            due_date: dueDate,
            customer: baseCustomer,
            today: invoiceDate,
        });
        expectCalendarDate(row.target_mep_date, 2026, 6, 24);
    });

    it("applies due_date + offset + diff when invoice day is on cutoff and due differs", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-26")!;
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: invoiceDate,
            due_date: dueDate,
            customer: baseCustomer,
            today: invoiceDate,
        });
        // substitute 2 Jul; diff = 8; due 26 Jun + 30 + 8 → 3 Aug
        expectCalendarDate(row.target_mep_date, 2026, 7, 3);
        // No reporting cutoff → due_date + 40
        expectCalendarDate(row.target_reporting_date, 2026, 7, 5);
    });

    it("applies due_date + offset + diff when invoice equals due on cutoff", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: invoiceDate,
            due_date: dueDate,
            customer: baseCustomer,
            today: invoiceDate,
        });
        // substitute 2 Jul; diff = 8; due 24 Jun + 30 + 8 → 1 Aug
        expectCalendarDate(row.target_mep_date, 2026, 7, 1);
        // No reporting cutoff → due_date + 40
        expectCalendarDate(row.target_reporting_date, 2026, 7, 3);
    });

    it("adjusts MEP and reporting independently with different cutoffs", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-26")!;
        const row = computeInvoiceInsuranceRowData({
            status: "Due",
            invoice_date: invoiceDate,
            due_date: dueDate,
            customer: {
                ...baseCustomer,
                reporting_days: 35,
                reporting_cutoff_day_of_month: 20,
                reporting_substitute_day_of_month: 5,
            },
            today: invoiceDate,
        });
        expectCalendarDate(row.target_mep_date, 2026, 7, 3);
        // July 5 substitute; diff = 11; due 26 Jun + 35 + 11 → 11 Aug
        expectCalendarDate(row.target_reporting_date, 2026, 7, 11);
    });

    it("clamps substitute 31 to 30 in April when computing diff", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-03-20")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-03-15")!;
        const adjusted = applyMonthEndCutoffAdjustment({
            dueDate,
            offsetDays: 0,
            invoiceDate,
            cutoffDayOfMonth: 15,
            substituteDayOfMonth: 31,
        });
        // substitute Apr 30; diff = 41; due 15 Mar + 41 → 25 Apr
        expectCalendarDate(adjusted, 2026, 3, 25);
    });

    it("clamps substitute 31 to 28 in non-leap February when computing diff", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-01-20")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-01-15")!;
        const adjusted = applyMonthEndCutoffAdjustment({
            dueDate,
            offsetDays: 0,
            invoiceDate,
            cutoffDayOfMonth: 15,
            substituteDayOfMonth: 31,
        });
        // substitute Feb 28; diff = 39; due 15 Jan + 39 → 23 Feb
        expectCalendarDate(adjusted, 2026, 1, 23);
    });

    it("skips adjustment when invoice_date is missing", () => {
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const mep = computeTargetMepDate(dueDate, 30, {
            invoiceDate: null,
            cutoffDayOfMonth: 24,
            substituteDayOfMonth: 2,
        });
        expectCalendarDate(mep, 2026, 6, 24);
    });

    it("returns null when due_date is missing", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const mep = computeTargetMepDate(null, 30, {
            invoiceDate,
            cutoffDayOfMonth: 24,
            substituteDayOfMonth: 2,
        });
        expect(mep).toBeNull();
    });

    it("uses due_date + offset + diff for on-cutoff invoice", () => {
        const invoiceDate = parseImportDateToLocalCalendarDate("2026-06-24")!;
        const dueDate = parseImportDateToLocalCalendarDate("2026-06-26")!;
        const mep = computeTargetMepDate(dueDate, 40, {
            invoiceDate,
            cutoffDayOfMonth: 24,
            substituteDayOfMonth: 5,
        });
        // July 5 substitute; diff = 11; due 26 Jun + 40 + 11 → 16 Aug
        expectCalendarDate(mep, 2026, 7, 16);
    });
});
