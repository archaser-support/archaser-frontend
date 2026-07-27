/**
 * ActivityService Mock Factory
 * 
 * Creates a mock ActivityService for testing
 */

import { vi } from "vitest";

export function createActivityServiceMock() {
    return {
        handleSMSDelivery: vi.fn(),
        createActivity: vi.fn(),
        updateActivity: vi.fn(),
        getActivity: vi.fn(),
        getActivities: vi.fn(),
        deleteActivity: vi.fn(),
    };
}

