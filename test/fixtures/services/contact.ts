import { contact_status } from "@prisma/client";

/**
 * Contact Service Fixtures
 * 
 * Test data fixtures for contact-related tests
 */

export const mockContactData = {
    validContact: {
        id: 1,
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        mobile: "+1234567891",
        company_id: 1,
        customer_id: 1,
        status: contact_status.Active,
        role: "Primary Contact",
        company_wide_address: false,
        receives_standard_reminder: true,
        receives_escalated_reminder: false,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    contactWithStandardReminder: {
        id: 2,
        first_name: "Jane",
        last_name: "Smith",
        email: "jane.smith@example.com",
        phone: "+1234567892",
        mobile: "+1234567893",
        company_id: 1,
        customer_id: 1,
        status: contact_status.Active,
        role: "Standard Contact",
        company_wide_address: true,
        receives_standard_reminder: true,
        receives_escalated_reminder: false,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    contactWithEscalatedReminder: {
        id: 3,
        first_name: "Bob",
        last_name: "Johnson",
        email: "bob.johnson@example.com",
        phone: "+1234567894",
        mobile: "+1234567895",
        company_id: 1,
        customer_id: 1,
        status: contact_status.Active,
        role: "Escalated Contact",
        company_wide_address: false,
        receives_standard_reminder: false,
        receives_escalated_reminder: true,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    contactMinimal: {
        id: 4,
        first_name: "Alice",
        last_name: undefined,
        email: undefined,
        phone: undefined,
        mobile: undefined,
        company_id: 1,
        customer_id: 1,
        status: contact_status.Active,
        role: undefined,
        company_wide_address: false,
        receives_standard_reminder: false,
        receives_escalated_reminder: false,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },
};

/**
 * Creates a mock contact with optional overrides
 */
export const createMockContact = (overrides = {}) => ({
    ...mockContactData.validContact,
    ...overrides,
});

/**
 * Creates mock contact input for import tests
 */
export const createMockContactInput = (overrides = {}) => ({
    first_name: "John",
    last_name: "Doe",
    customer_number: "CUST001",
    email: "john.doe@example.com",
    phone: "+1234567890",
    mobile: "+1234567891",
    role: "Primary Contact",
    company_wide_address: false,
    receives_standard_reminder: true,
    receives_escalated_reminder: false,
    ...overrides,
});

