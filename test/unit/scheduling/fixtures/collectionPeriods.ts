// Collection Period Test Data
export const mockCollectionPeriod = {
    id: 1,
    customer_id: 123,
    last_automated_step: 1,
    period_start_date: new Date("2024-01-15T00:00:00.000Z"),
    current_category: "Automated",
    is_last_automated_step_delivered: false,
    next_category: null,
    previous_category: "New",
    next_category_date: null,
    create_next_activity: false,
    period_end_date: null,
    created_at: new Date("2024-01-15T00:00:00.000Z"),
    modified_at: new Date("2024-01-15T00:00:00.000Z"),
    Customer: {
        account_id: 456,
        type: "Company" as const,
        email: null,
        customer_uuid: "test-customer-uuid",
        language: "English",
        Person: null,
        Company: {
            name: "Test Company",
            Contact: [
                {
                    id: 1,
                    email: "contact1@test.com",
                    mobile: "+1234567890",
                    status: "Active",
                    first_name: "John",
                    company_wide_address: true,
                    receives_standard_reminder: true,
                    receives_escalated_reminder: false,
                },
                {
                    id: 2,
                    email: "contact2@test.com",
                    mobile: "+1234567891",
                    status: "Active",
                    first_name: "Jane",
                    company_wide_address: false,
                    receives_standard_reminder: false,
                    receives_escalated_reminder: true,
                },
            ],
        },
        Country: {
            id: 1,
            iso2: "US",
        },
        State: {
            iso2: "CA",
        },
        Customer: {
            id: 456,
            name: "Test Customer",
            logo: "test-logo.png",
            sub_domain: "test",
            Country: {
                iso2: "US",
            },
            State: {
                iso2: "CA",
            },
        },
    },
};

// Person Collection Period Test Data
export const mockPersonCollectionPeriod = {
    ...mockCollectionPeriod,
    Customer: {
        ...mockCollectionPeriod.Customer,
        type: "Person" as const,
        email: "person@test.com",
        Person: {
            mobile: "+1234567890",
            first_name: "John",
        },
        Company: null,
    },
};

// Collection Period State Transitions
export const collectionPeriodStates = {
    NEW: "New",
    AUTOMATED: "Automated", 
    AGENT: "Agent",
    CLOSED: "Closed",
} as const;

// State Transition Test Data
export const stateTransitionTestData = [
    {
        from: collectionPeriodStates.NEW,
        to: collectionPeriodStates.AUTOMATED,
        valid: true,
        description: "New to Automated transition",
    },
    {
        from: collectionPeriodStates.AUTOMATED,
        to: collectionPeriodStates.AGENT,
        valid: true,
        description: "Automated to Agent transition",
    },
    {
        from: collectionPeriodStates.AGENT,
        to: collectionPeriodStates.CLOSED,
        valid: true,
        description: "Agent to Closed transition",
    },
    {
        from: collectionPeriodStates.CLOSED,
        to: collectionPeriodStates.NEW,
        valid: false,
        description: "Closed to New transition (invalid)",
    },
];

// Category Transition Scheduling Test Data
export const categoryTransitionTestData = {
    // Agent to Automated transition (should use 0 days delay)
    agentToAutomated: {
        ...mockCollectionPeriod,
        id: 2,
        current_category: "Automated",
        previous_category: "Agent",
        last_automated_step: 0, // Fresh start
        create_next_activity: true,
    },
    
    // Legal to Automated transition (should use 0 days delay)
    legalToAutomated: {
        ...mockCollectionPeriod,
        id: 3,
        current_category: "Automated",
        previous_category: "Legal",
        last_automated_step: 0, // Fresh start
        create_next_activity: true,
    },
    
    // New to Automated transition (should use configured delay)
    newToAutomated: {
        ...mockCollectionPeriod,
        id: 4,
        current_category: "Automated",
        previous_category: "New",
        last_automated_step: 0, // Fresh start
        create_next_activity: true,
    },
    
    // Subsequent automated step (should use previous activity time)
    subsequentAutomatedStep: {
        ...mockCollectionPeriod,
        id: 5,
        current_category: "Automated",
        previous_category: "Automated",
        last_automated_step: 1, // Not first step
        create_next_activity: true,
    },
};
