/**
 * Payment Service Fixtures
 * 
 * Test data fixtures for payment-related tests
 */

export const mockPaymentData = {
    validPayment: {
        id: 1,
        invoice_id: 1,
        customer_id: 1,
        account_id: 1,
        amount: 1000.0,
        customer_amount: 1000.0,
        customer_currency: "USD",
        payment_date: new Date("2024-01-15"),
        payment_method: "Bank Transfer",
        reference: "PAY-001",
        created_at: new Date("2024-01-15T12:00:00Z"),
        modified_at: new Date("2024-01-15T12:00:00Z"),
    },

    paymentWithDifferentCurrency: {
        id: 2,
        invoice_id: 2,
        customer_id: 1,
        account_id: 1,
        amount: 1000.0,
        customer_amount: 1200.0, // Different currency conversion
        customer_currency: "EUR",
        payment_date: new Date("2024-01-16"),
        payment_method: "Credit Card",
        reference: "PAY-002",
        created_at: new Date("2024-01-16T12:00:00Z"),
        modified_at: new Date("2024-01-16T12:00:00Z"),
    },

    partialPayment: {
        id: 3,
        invoice_id: 3,
        customer_id: 1,
        account_id: 1,
        amount: 500.0,
        customer_amount: 500.0,
        customer_currency: "USD",
        payment_date: new Date("2024-01-17"),
        payment_method: "Check",
        reference: "PAY-003",
        created_at: new Date("2024-01-17T12:00:00Z"),
        modified_at: new Date("2024-01-17T12:00:00Z"),
    },

    refundPayment: {
        id: 4,
        invoice_id: 4,
        customer_id: 1,
        account_id: 1,
        amount: -200.0, // Negative amount for refund
        customer_amount: -200.0,
        customer_currency: "USD",
        payment_date: new Date("2024-01-18"),
        payment_method: "Refund",
        reference: "REF-001",
        created_at: new Date("2024-01-18T12:00:00Z"),
        modified_at: new Date("2024-01-18T12:00:00Z"),
    },
};

/**
 * Creates a mock payment with optional overrides
 */
export const createMockPayment = (overrides = {}) => ({
    ...mockPaymentData.validPayment,
    ...overrides,
});

/**
 * Creates mock payment input for import tests
 */
export const createMockPaymentInput = (overrides = {}) => ({
    account_id: 1,
    company_code: "COMP001",
    customer_number: "CUST001",
    invoice_number: "INV001",
    payment_date: "2024-01-15",
    amount: 1000.0,
    customer_amount: 1000.0,
    customer_currency: "USD",
    payment_method: "Bank Transfer",
    reference: "PAY-001",
    ...overrides,
});

