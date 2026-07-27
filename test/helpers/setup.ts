/**
 * Shared Setup Utilities
 * 
 * Helper functions for test setup and teardown
 */

import { vi, beforeEach, afterEach } from "vitest";

/**
 * Clears all mocks before each test
 */
export function setupMockClearing() {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
}

/**
 * Sets up a mock timer for time-based tests
 */
export function setupMockTimer() {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });
}

/**
 * Sets up a mock date for date-based tests
 */
export function setupMockDate(mockDate: Date) {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(mockDate);
    });

    afterEach(() => {
        vi.useRealTimers();
    });
}

/**
 * Creates a mock function that returns a resolved promise
 */
export function createResolvedMock<T>(value: T) {
    return vi.fn().mockResolvedValue(value);
}

/**
 * Creates a mock function that returns a rejected promise
 */
export function createRejectedMock(error: Error) {
    return vi.fn().mockRejectedValue(error);
}

/**
 * Creates a mock function that returns a value synchronously
 */
export function createSyncMock<T>(value: T) {
    return vi.fn().mockReturnValue(value);
}

