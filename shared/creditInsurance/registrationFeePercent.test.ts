import { describe, expect, it } from "vitest";

import {
    REGISTRATION_FEE_PERCENT_MAX,
    REGISTRATION_FEE_PERCENT_MIN,
    parseRegistrationFeePercent,
    validateRegistrationFeePercentFormField,
} from "./registrationFeePercent";

describe("parseRegistrationFeePercent (server normalization)", () => {
    it("normalizes TopUp policies to null regardless of input", () => {
        expect(parseRegistrationFeePercent("50", "TopUp")).toBeNull();
        expect(parseRegistrationFeePercent(50, "TopUp")).toBeNull();
        expect(parseRegistrationFeePercent(null, "TopUp")).toBeNull();
    });

    it("treats null/undefined/blank Primary values as no fee configured", () => {
        expect(parseRegistrationFeePercent(null, "Primary")).toBeNull();
        expect(parseRegistrationFeePercent(undefined, "Primary")).toBeNull();
        expect(parseRegistrationFeePercent("", "Primary")).toBeNull();
        expect(parseRegistrationFeePercent("   ", "Primary")).toBeNull();
    });

    it("accepts the inclusive 0 and 100 boundaries for Primary policies", () => {
        expect(
            parseRegistrationFeePercent(REGISTRATION_FEE_PERCENT_MIN, "Primary")
        ).toBe(0);
        expect(parseRegistrationFeePercent("0", "Primary")).toBe(0);
        expect(
            parseRegistrationFeePercent(REGISTRATION_FEE_PERCENT_MAX, "Primary")
        ).toBe(100);
        expect(parseRegistrationFeePercent("100", "Primary")).toBe(100);
    });

    it("accepts valid intermediate values and comma decimals", () => {
        expect(parseRegistrationFeePercent("2.5", "Primary")).toBe(2.5);
        expect(parseRegistrationFeePercent("2,5", "Primary")).toBe(2.5);
        expect(parseRegistrationFeePercent(33.33, "Primary")).toBe(33.33);
    });

    it("rejects values below 0 or above 100 for Primary policies", () => {
        expect(() => parseRegistrationFeePercent(-0.01, "Primary")).toThrow(
            /between/
        );
        expect(() => parseRegistrationFeePercent(100.01, "Primary")).toThrow(
            /between/
        );
        expect(() => parseRegistrationFeePercent("150", "Primary")).toThrow(
            /between/
        );
    });

    it("rejects non-numeric and non-finite values for Primary policies", () => {
        expect(() => parseRegistrationFeePercent("abc", "Primary")).toThrow(
            /valid number/
        );
        expect(() =>
            parseRegistrationFeePercent(Number.POSITIVE_INFINITY, "Primary")
        ).toThrow(/valid number/);
        expect(() => parseRegistrationFeePercent(Number.NaN, "Primary")).toThrow(
            /valid number/
        );
    });
});

describe("validateRegistrationFeePercentFormField (client parity)", () => {
    it("clears the value for TopUp policies without error", () => {
        expect(validateRegistrationFeePercentFormField("50", "TopUp")).toEqual({
            value: null,
        });
    });

    it("returns null value for blank Primary input", () => {
        expect(validateRegistrationFeePercentFormField("", "Primary")).toEqual({
            value: null,
        });
        expect(
            validateRegistrationFeePercentFormField("   ", "Primary")
        ).toEqual({ value: null });
    });

    it("accepts inclusive boundaries and valid values", () => {
        expect(validateRegistrationFeePercentFormField("0", "Primary")).toEqual({
            value: 0,
        });
        expect(
            validateRegistrationFeePercentFormField("100", "Primary")
        ).toEqual({ value: 100 });
        expect(
            validateRegistrationFeePercentFormField("12.5", "Primary")
        ).toEqual({ value: 12.5 });
    });

    it("flags out-of-range values with a matching error code", () => {
        expect(
            validateRegistrationFeePercentFormField("-1", "Primary")
        ).toEqual({ value: null, error: "out_of_range" });
        expect(
            validateRegistrationFeePercentFormField("101", "Primary")
        ).toEqual({ value: null, error: "out_of_range" });
    });

    it("flags non-numeric values as invalid_number", () => {
        expect(
            validateRegistrationFeePercentFormField("abc", "Primary")
        ).toEqual({ value: null, error: "invalid_number" });
    });
});
