/**
 * Invoice Service Fixtures
 * 
 * Test data fixtures for invoice-related tests
 */

export const mockInvoiceData = {
    validInvoice: {
        id: BigInt(1),
        invoice_number: "INV-001",
        amount: 1000.0,
        due_date: new Date("2024-12-31"),
        invoice_date: new Date("2024-01-01"),
        status_id: 1, // Assuming 1 is "Open" status
        account_id: 1,
        customer_id: 1,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    creditInvoice: {
        id: BigInt(2),
        invoice_number: "CREDIT-001",
        amount: -500.0, // Negative amount for credit
        due_date: new Date("2024-12-31"),
        invoice_date: new Date("2024-01-01"),
        status_id: 1,
        account_id: 1,
        customer_id: 1,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
    },

    batchInvoices: [
        {
            id: BigInt(3),
            invoice_number: "BATCH-001",
            amount: 1500.0,
            due_date: new Date("2024-12-31"),
            invoice_date: new Date("2024-01-01"),
            status_id: 1,
            account_id: 1,
            customer_id: 1,
            created_at: new Date("2024-01-01T12:00:00Z"),
            modified_at: new Date("2024-01-01T12:00:00Z"),
        },
        {
            id: BigInt(4),
            invoice_number: "BATCH-002",
            amount: 2000.0,
            due_date: new Date("2024-12-31"),
            invoice_date: new Date("2024-01-01"),
            status_id: 1,
            account_id: 1,
            customer_id: 1,
            created_at: new Date("2024-01-01T12:00:00Z"),
            modified_at: new Date("2024-01-01T12:00:00Z"),
        },
        {
            id: BigInt(5),
            invoice_number: "CREDIT-BATCH-001",
            amount: -750.0,
            due_date: new Date("2024-12-31"),
            invoice_date: new Date("2024-01-01"),
            status_id: 1,
            account_id: 1,
            customer_id: 1,
            created_at: new Date("2024-01-01T12:00:00Z"),
            modified_at: new Date("2024-01-01T12:00:00Z"),
        },
    ],
};

/**
 * Creates a mock invoice with optional overrides
 */
export const createMockInvoice = (overrides = {}) => ({
    ...mockInvoiceData.validInvoice,
    ...overrides,
});

