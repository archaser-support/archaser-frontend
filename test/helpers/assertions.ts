/**
 * Custom Assertions
 * 
 * Helper functions for common test assertions
 */

import { expect } from "vitest";

/**
 * Asserts that a date is within a certain range
 */
export function expectDateWithinRange(
    actual: Date,
    expected: Date,
    toleranceMs = 1000
): void {
    const diff = Math.abs(actual.getTime() - expected.getTime());
    expect(diff).toBeLessThanOrEqual(toleranceMs);
}

/**
 * Asserts that a BigInt value equals another
 */
export function expectBigIntEqual(actual: bigint, expected: bigint): void {
    expect(actual.toString()).toBe(expected.toString());
}

/**
 * Asserts that an object contains all required fields
 */
export function expectObjectContains<T extends Record<string, any>>(
    actual: T,
    requiredFields: Partial<T>
): void {
    Object.keys(requiredFields).forEach((key) => {
        expect(actual).toHaveProperty(key);
        expect(actual[key]).toEqual(requiredFields[key]);
    });
}

/**
 * Asserts that an array contains objects matching a pattern
 */
export function expectArrayContains<T>(
    array: T[],
    matcher: (item: T) => boolean,
    count?: number
): void {
    const matches = array.filter(matcher);
    if (count !== undefined) {
        expect(matches.length).toBe(count);
    } else {
        expect(matches.length).toBeGreaterThan(0);
    }
}

/**
 * Asserts that a value is a valid date
 */
export function expectValidDate(value: any): void {
    expect(value).toBeInstanceOf(Date);
    expect(isNaN(value.getTime())).toBe(false);
}

/**
 * Asserts that a value is a valid BigInt
 */
export function expectValidBigInt(value: any): void {
    expect(typeof value).toBe("bigint");
}

