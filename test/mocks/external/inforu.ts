/**
 * Inforu Mock Factory
 * 
 * Creates a mock Inforu API client for testing
 */

import { vi } from "vitest";

export function createInforuMock() {
    return {
        sendSMS: vi.fn(),
        getStatus: vi.fn(),
        checkStatus: vi.fn(),
    };
}

/**
 * Creates a mock Inforu SMS response
 */
export function createInforuSMSResponse(overrides = {}) {
    return {
        success: true,
        messageId: "INF1234567890",
        status: "sent",
        ...overrides,
    };
}

/**
 * Creates a mock Inforu status response
 */
export function createInforuStatusResponse(overrides = {}) {
    return {
        success: true,
        messageId: "INF1234567890",
        status: "delivered",
        deliveredAt: new Date(),
        ...overrides,
    };
}

