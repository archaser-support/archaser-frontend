import { describe, it, expect } from "vitest";

// Simple utility function to test
function add(a: number, b: number): number {
    return a + b;
}

function multiply(a: number, b: number): number {
    return a * b;
}

function formatCurrency(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

describe("Utility Functions", () => {
    describe("add", () => {
        it("should add two positive numbers", () => {
            expect(add(2, 3)).toBe(5);
        });

        it("should handle negative numbers", () => {
            expect(add(-1, 5)).toBe(4);
        });

        it("should handle zero", () => {
            expect(add(0, 7)).toBe(7);
        });
    });

    describe("multiply", () => {
        it("should multiply two numbers", () => {
            expect(multiply(3, 4)).toBe(12);
        });

        it("should handle zero", () => {
            expect(multiply(5, 0)).toBe(0);
        });
    });

    describe("formatCurrency", () => {
        it("should format number as currency", () => {
            expect(formatCurrency(123.456)).toBe("$123.46");
        });

        it("should handle whole numbers", () => {
            expect(formatCurrency(100)).toBe("$100.00");
        });
    });
});
