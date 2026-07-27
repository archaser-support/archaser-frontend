/**
 * Customer Service Fixtures
 * 
 * Test data fixtures for customer-related tests
 */

export const mockCustomerData = {
    validCustomer: {
        id: 1,
        name: "Test Customer",
        client_type: "Company" as const,
        account_id: 1,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
        status: "Active" as const,
    },

    customerWithBankAccount: {
        id: 1,
        name: "Test Customer",
        client_type: "Company" as const,
        account_id: 1,
        created_at: new Date("2024-01-01T12:00:00Z"),
        modified_at: new Date("2024-01-01T12:00:00Z"),
        status: "Active" as const,
        bankAccounts: [
            {
                id: 1,
                customer_id: 1,
                account_number: "123456789",
                bank_name: "Test Bank",
            },
        ],
    },
};

/**
 * Creates a mock customer with optional overrides
 */
export const createMockCustomer = (overrides = {}) => ({
    ...mockCustomerData.validCustomer,
    ...overrides,
});

/**
 * Parent Customer Test Fixtures
 */
export const mockParentCustomerData = {
    // Parent customer (no parent itself)
    parentCustomer: {
        id: 2,
        customer_number: "PARENT-001",
        account_id: 100,
        parent_customer_id: null,
        type: "Company" as const,
        company_id: 2,
        person_id: null,
        Company: {
            id: 2,
            name: "Parent Company",
        },
        Person: null,
    },

    // Child customer with parent
    childCustomer: {
        id: 1,
        customer_number: "CHILD-001",
        account_id: 100,
        parent_customer_id: 2,
        type: "Company" as const,
        company_id: 1,
        person_id: null,
        Company: {
            id: 1,
            name: "Child Company",
        },
        Person: null,
    },

    // Another child customer with same parent
    childCustomer2: {
        id: 3,
        customer_number: "CHILD-002",
        account_id: 100,
        parent_customer_id: 2,
        type: "Person" as const,
        company_id: null,
        person_id: 3,
        Company: null,
        Person: {
            id: 3,
            first_name: "John",
            last_name: "Doe",
            full_name: "John Doe",
        },
    },

    // Customer in different account
    differentAccountCustomer: {
        id: 4,
        customer_number: "OTHER-001",
        account_id: 200, // Different account
        parent_customer_id: null,
        type: "Company" as const,
        company_id: 4,
        person_id: null,
        Company: {
            id: 4,
            name: "Other Account Company",
        },
        Person: null,
    },

    // Customer that would create circular relationship
    circularCustomer: {
        id: 5,
        customer_number: "CIRCULAR-001",
        account_id: 100,
        parent_customer_id: 2, // Parent is customer 2
        type: "Company" as const,
        company_id: 5,
        person_id: null,
        Company: {
            id: 5,
            name: "Circular Customer",
        },
        Person: null,
    },

    // Grandparent customer (parent of parent)
    grandparentCustomer: {
        id: 6,
        customer_number: "GRANDPARENT-001",
        account_id: 100,
        parent_customer_id: null,
        type: "Company" as const,
        company_id: 6,
        person_id: null,
        Company: {
            id: 6,
            name: "Grandparent Company",
        },
        Person: null,
    },
};

/**
 * Creates a mock parent customer with optional overrides
 */
export const createMockParentCustomer = (overrides = {}) => ({
    ...mockParentCustomerData.parentCustomer,
    ...overrides,
});

/**
 * Creates a mock child customer with optional overrides
 */
export const createMockChildCustomer = (overrides = {}) => ({
    ...mockParentCustomerData.childCustomer,
    ...overrides,
});

/**
 * Creates a customer with parent relationship for testing
 */
export const createMockCustomerWithParent = (
    customerId: number,
    parentId: number | null,
    accountId: number = 100
) => ({
    id: customerId,
    customer_number: `CUSTOMER-${customerId}`,
    account_id: accountId,
    parent_customer_id: parentId,
    type: "Company" as const,
    company_id: customerId,
    person_id: null,
    Company: {
        id: customerId,
        name: `Customer ${customerId}`,
    },
    Person: null,
});

/**
 * Creates aggregated data for a parent customer
 */
export const createMockAggregatedData = (
    parentCustomerId: number,
    overrides = {}
) => ({
    id: 1,
    customer_id: parentCustomerId,
    child_customers_count: 2,
    total_outstanding_amount: 10000,
    customer_outstanding_amount1: 5000,
    customer_outstanding_amount2: 5000,
    customer_currency1: "USD",
    customer_currency2: "EUR",
    no_of_overdue_invoices: 5,
    no_of_due_invoices: 3,
    total_invoices_count: 8,
    total_paid_amount: 2000,
    customer_total_paid_amount1: 1000,
    customer_total_paid_amount2: 1000,
    total_collection_periods: 8,
    active_collection_periods: 5,
    created_at: new Date("2024-01-01T12:00:00Z"),
    modified_at: new Date("2024-01-01T12:00:00Z"),
    ...overrides,
});

