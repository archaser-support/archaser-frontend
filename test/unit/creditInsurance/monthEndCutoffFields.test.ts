import { describe, expect, it } from "vitest";

import {
    DAY_OF_MONTH_MAX,
    DAY_OF_MONTH_MIN,
    NULL_MONTH_END_CUTOFF_FIELDS,
    parseMonthEndCutoffFields,
    parseOptionalDayOfMonth,
    validateMonthEndCutoffFormFields,
    validateMonthEndCutoffPair,
} from "@/shared/creditInsurance/monthEndCutoffFields";

describe("monthEndCutoffFields", () => {
    describe("parseOptionalDayOfMonth", () => {
        it("returns null for blank values", () => {
            expect(parseOptionalDayOfMonth(null, "field")).toBeNull();
            expect(parseOptionalDayOfMonth("", "field")).toBeNull();
            expect(parseOptionalDayOfMonth(undefined, "field")).toBeNull();
        });

        it("accepts integers within 1–31", () => {
            expect(parseOptionalDayOfMonth(1, "field")).toBe(1);
            expect(parseOptionalDayOfMonth("24", "field")).toBe(24);
            expect(parseOptionalDayOfMonth(31, "field")).toBe(31);
        });

        it("rejects non-integers", () => {
            expect(() => parseOptionalDayOfMonth("abc", "field")).toThrow(
                "field must be a valid integer"
            );
            expect(() => parseOptionalDayOfMonth(1.5, "field")).toThrow(
                "field must be a valid integer"
            );
        });

        it("rejects values outside 1–31", () => {
            expect(() => parseOptionalDayOfMonth(0, "field")).toThrow(
                `field must be between ${DAY_OF_MONTH_MIN} and ${DAY_OF_MONTH_MAX}`
            );
            expect(() => parseOptionalDayOfMonth(32, "field")).toThrow(
                `field must be between ${DAY_OF_MONTH_MIN} and ${DAY_OF_MONTH_MAX}`
            );
        });
    });

    describe("validateMonthEndCutoffPair", () => {
        it("allows both null", () => {
            expect(() => validateMonthEndCutoffPair(null, null, "MEP")).not.toThrow();
        });

        it("allows both set", () => {
            expect(() =>
                validateMonthEndCutoffPair(24, 2, "MEP")
            ).not.toThrow();
        });

        it("rejects cutoff without substitute", () => {
            expect(() => validateMonthEndCutoffPair(24, null, "MEP")).toThrow(
                "MEP substitute day is required when cutoff is set"
            );
        });

        it("rejects substitute without cutoff", () => {
            expect(() => validateMonthEndCutoffPair(null, 2, "Reporting")).toThrow(
                "Reporting cutoff day is required when substitute is set"
            );
        });
    });

    describe("parseMonthEndCutoffFields", () => {
        it("returns all null when fields are omitted", () => {
            expect(parseMonthEndCutoffFields({})).toEqual(
                NULL_MONTH_END_CUTOFF_FIELDS
            );
        });

        it("parses valid MEP and reporting pairs independently", () => {
            expect(
                parseMonthEndCutoffFields({
                    mep_cutoff_day_of_month: 24,
                    mep_substitute_day_of_month: 2,
                    reporting_cutoff_day_of_month: 20,
                    reporting_substitute_day_of_month: 5,
                })
            ).toEqual({
                mep_cutoff_day_of_month: 24,
                mep_substitute_day_of_month: 2,
                reporting_cutoff_day_of_month: 20,
                reporting_substitute_day_of_month: 5,
                payment_term_cutoff_day_of_month: null,
                payment_term_substitute_day_of_month: null,
            });
        });

        it("parses valid payment-term pair independently of MEP and reporting", () => {
            expect(
                parseMonthEndCutoffFields({
                    payment_term_cutoff_day_of_month: 24,
                    payment_term_substitute_day_of_month: 2,
                })
            ).toEqual({
                mep_cutoff_day_of_month: null,
                mep_substitute_day_of_month: null,
                reporting_cutoff_day_of_month: null,
                reporting_substitute_day_of_month: null,
                payment_term_cutoff_day_of_month: 24,
                payment_term_substitute_day_of_month: 2,
            });
        });

        it("rejects incomplete payment-term pair", () => {
            expect(() =>
                parseMonthEndCutoffFields({
                    payment_term_cutoff_day_of_month: 24,
                })
            ).toThrow(
                "Payment term substitute day is required when cutoff is set"
            );
            expect(() =>
                parseMonthEndCutoffFields({
                    payment_term_substitute_day_of_month: 2,
                })
            ).toThrow(
                "Payment term cutoff day is required when substitute is set"
            );
        });

        it("rejects incomplete MEP pair", () => {
            expect(() =>
                parseMonthEndCutoffFields({
                    mep_cutoff_day_of_month: 24,
                })
            ).toThrow("MEP substitute day is required when cutoff is set");
        });

        it("rejects incomplete reporting pair", () => {
            expect(() =>
                parseMonthEndCutoffFields({
                    reporting_substitute_day_of_month: 2,
                })
            ).toThrow("Reporting cutoff day is required when substitute is set");
        });
    });

    describe("validateMonthEndCutoffFormFields", () => {
        it("returns empty errors for valid pairs", () => {
            const result = validateMonthEndCutoffFormFields({
                mepCutoffRaw: "24",
                mepSubstituteRaw: "2",
                reportingCutoffRaw: "",
                reportingSubstituteRaw: "",
            });
            expect(result.errors).toEqual({});
            expect(result.fields).toEqual({
                mep_cutoff_day_of_month: 24,
                mep_substitute_day_of_month: 2,
                reporting_cutoff_day_of_month: null,
                reporting_substitute_day_of_month: null,
                payment_term_cutoff_day_of_month: null,
                payment_term_substitute_day_of_month: null,
            });
        });

        it("validates payment-term pair on form", () => {
            const result = validateMonthEndCutoffFormFields({
                mepCutoffRaw: "",
                mepSubstituteRaw: "",
                reportingCutoffRaw: "",
                reportingSubstituteRaw: "",
                paymentTermCutoffRaw: "24",
                paymentTermSubstituteRaw: "2",
            });
            expect(result.errors).toEqual({});
            expect(result.fields.payment_term_cutoff_day_of_month).toBe(24);
            expect(result.fields.payment_term_substitute_day_of_month).toBe(2);
        });

        it("flags payment-term cutoff without substitute on form", () => {
            const result = validateMonthEndCutoffFormFields({
                mepCutoffRaw: "",
                mepSubstituteRaw: "",
                reportingCutoffRaw: "",
                reportingSubstituteRaw: "",
                paymentTermCutoffRaw: "24",
                paymentTermSubstituteRaw: "",
            });
            expect(result.errors.payment_term_substitute_day_of_month).toBe(
                "cutoff_requires_substitute"
            );
        });

        it("flags out-of-range substitute", () => {
            const result = validateMonthEndCutoffFormFields({
                mepCutoffRaw: "24",
                mepSubstituteRaw: "32",
                reportingCutoffRaw: "",
                reportingSubstituteRaw: "",
            });
            expect(result.errors.mep_substitute_day_of_month).toBe("out_of_range");
        });

        it("flags cutoff without substitute on form", () => {
            const result = validateMonthEndCutoffFormFields({
                mepCutoffRaw: "24",
                mepSubstituteRaw: "",
                reportingCutoffRaw: "",
                reportingSubstituteRaw: "",
            });
            expect(result.errors.mep_substitute_day_of_month).toBe(
                "cutoff_requires_substitute"
            );
        });
    });
});
