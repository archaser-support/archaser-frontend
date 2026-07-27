/**
 * Twilio Mock Factory
 * 
 * Creates a mock Twilio client for testing
 */

import { vi } from "vitest";

export function createTwilioMock() {
    return {
        messages: {
            create: vi.fn(),
            list: vi.fn(),
            get: vi.fn(),
        },
        validateRequest: vi.fn(),
    };
}

/**
 * Creates a mock Twilio message response
 */
export function createTwilioMessageResponse(overrides = {}) {
    return {
        sid: "SM1234567890abcdef",
        status: "queued",
        to: "+1234567890",
        from: "+0987654321",
        body: "Test message",
        dateCreated: new Date(),
        ...overrides,
    };
}

