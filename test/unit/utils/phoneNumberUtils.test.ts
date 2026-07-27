import { describe, it, expect } from "vitest";

import {
    identifyCountryFromPhoneNumber,
    isValidPhoneNumber,
    formatPhoneNumber,
} from "@/utils/phoneNumberUtils";

describe("phoneNumberUtils", () => {
    describe("identifyCountryFromPhoneNumber", () => {
        it("should identify US phone number", () => {
            const result = identifyCountryFromPhoneNumber("+1-212-123-4567");
            expect(result).toEqual({
                id: 0,
                name: "United States",
                phonecode: "1",
                iso2: "US",
            });
        });

        it("should identify Canadian phone number", () => {
            const result = identifyCountryFromPhoneNumber("+1-416-123-4567");
            expect(result).toEqual({
                id: 0,
                name: "Canada",
                phonecode: "1",
                iso2: "CA",
            });
        });

        it("should identify another Canadian phone number", () => {
            const result = identifyCountryFromPhoneNumber("+1-514-123-4567");
            expect(result).toEqual({
                id: 0,
                name: "Canada",
                phonecode: "1",
                iso2: "CA",
            });
        });

        it("should identify US phone number with different area code", () => {
            const result = identifyCountryFromPhoneNumber("+1-212-123-4567");
            expect(result).toEqual({
                id: 0,
                name: "United States",
                phonecode: "1",
                iso2: "US",
            });
        });

        it("should identify UK phone number", () => {
            const result = identifyCountryFromPhoneNumber("+44 20 7946 0958");
            expect(result).toEqual({
                id: 0,
                name: "United Kingdom",
                phonecode: "44",
                iso2: "GB",
            });
        });

        it("should identify Israeli phone number", () => {
            const result = identifyCountryFromPhoneNumber("+972-50-123-4567");
            expect(result).toEqual({
                id: 0,
                name: "Israel",
                phonecode: "972",
                iso2: "IL",
            });
        });

        it("should identify German phone number", () => {
            const result = identifyCountryFromPhoneNumber("+49 30 12345678");
            expect(result).toEqual({
                id: 0,
                name: "Germany",
                phonecode: "49",
                iso2: "DE",
            });
        });

        it("should return null for invalid phone number", () => {
            const result = identifyCountryFromPhoneNumber("invalid");
            expect(result).toBeNull();
        });

        it("should return null for empty string", () => {
            const result = identifyCountryFromPhoneNumber("");
            expect(result).toBeNull();
        });

        it("should return null for null input", () => {
            const result = identifyCountryFromPhoneNumber(null as any);
            expect(result).toBeNull();
        });

        it("should handle phone numbers without plus sign", () => {
            const result = identifyCountryFromPhoneNumber("447911123456");
            expect(result).toEqual({
                id: 0,
                name: "United Kingdom",
                phonecode: "44",
                iso2: "GB",
            });
        });

        it("should handle phone numbers with spaces and dashes", () => {
            const result = identifyCountryFromPhoneNumber("+1 (212) 123-4567");
            expect(result).toEqual({
                id: 0,
                name: "United States",
                phonecode: "1",
                iso2: "US",
            });
        });

        it("should handle Canadian phone numbers with spaces and dashes", () => {
            const result = identifyCountryFromPhoneNumber("+1 (416) 123-4567");
            expect(result).toEqual({
                id: 0,
                name: "Canada",
                phonecode: "1",
                iso2: "CA",
            });
        });
    });

    describe("isValidPhoneNumber", () => {
        it("should validate valid phone numbers", () => {
            expect(isValidPhoneNumber("+1-555-123-4567")).toBe(true);
            expect(isValidPhoneNumber("+1-416-123-4567")).toBe(true);
            expect(isValidPhoneNumber("+44 20 7946 0958")).toBe(true);
            expect(isValidPhoneNumber("15551234567")).toBe(true);
            expect(isValidPhoneNumber("+1 (555) 123-4567")).toBe(true);
        });

        it("should reject invalid phone numbers", () => {
            expect(isValidPhoneNumber("invalid")).toBe(false);
            expect(isValidPhoneNumber("abc123")).toBe(false);
            expect(isValidPhoneNumber("123@456")).toBe(false);
        });

        it("should handle edge cases", () => {
            expect(isValidPhoneNumber("")).toBe(false);
            expect(isValidPhoneNumber(null as any)).toBe(false);
            expect(isValidPhoneNumber(undefined as any)).toBe(false);
        });
    });

    describe("formatPhoneNumber", () => {
        it("should format phone numbers correctly", () => {
            expect(formatPhoneNumber("15551234567")).toBe("15551234567");
            expect(formatPhoneNumber("+15551234567")).toBe("+15551234567");
            expect(formatPhoneNumber("5551234567", "1")).toBe("+15551234567");
        });
    });
});
