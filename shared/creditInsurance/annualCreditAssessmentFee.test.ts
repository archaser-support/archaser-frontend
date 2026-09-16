import { describe, expect, it } from "vitest";
import {
    parseAnnualCreditAssessmentFee,
    validateAnnualCreditAssessmentFeeFormField,
} from "./annualCreditAssessmentFee";

describe("parseAnnualCreditAssessmentFee (server normalization)", () => {
    it("forces null on TopUp", () => {
        expect(parseAnnualCreditAssessmentFee("50", "TopUp")).toBeNull();
        expect(parseAnnualCreditAssessmentFee(50, "TopUp")).toBeNull();
        expect(parseAnnualCreditAssessmentFee(null, "TopUp")).toBeNull();
    });

    it("accepts blank as null on Primary", () => {
        expect(parseAnnualCreditAssessmentFee(null, "Primary")).toBeNull();
        expect(parseAnnualCreditAssessmentFee(undefined, "Primary")).toBeNull();
        expect(parseAnnualCreditAssessmentFee("", "Primary")).toBeNull();
        expect(parseAnnualCreditAssessmentFee("   ", "Primary")).toBeNull();
    });

    it("accepts zero and positive amounts on Primary", () => {
        expect(parseAnnualCreditAssessmentFee(0, "Primary")).toBe(0);
        expect(parseAnnualCreditAssessmentFee("0", "Primary")).toBe(0);
        expect(parseAnnualCreditAssessmentFee("500", "Primary")).toBe(500);
        expect(parseAnnualCreditAssessmentFee("12,5", "Primary")).toBe(12.5);
    });

    it("rejects negative and non-numeric values", () => {
        expect(() => parseAnnualCreditAssessmentFee(-0.01, "Primary")).toThrow(
            /greater than or equal to 0/
        );
        expect(() => parseAnnualCreditAssessmentFee("abc", "Primary")).toThrow(
            /valid number/
        );
    });
});

describe("validateAnnualCreditAssessmentFeeFormField (client parity)", () => {
    it("mirrors server rules without throwing", () => {
        expect(
            validateAnnualCreditAssessmentFeeFormField("50", "TopUp")
        ).toEqual({ value: null });
        expect(
            validateAnnualCreditAssessmentFeeFormField("", "Primary")
        ).toEqual({ value: null });
        expect(
            validateAnnualCreditAssessmentFeeFormField("500", "Primary")
        ).toEqual({ value: 500 });
        expect(
            validateAnnualCreditAssessmentFeeFormField("-1", "Primary")
        ).toEqual({ value: null, error: "negative" });
        expect(
            validateAnnualCreditAssessmentFeeFormField("abc", "Primary")
        ).toEqual({ value: null, error: "invalid_number" });
    });
});
