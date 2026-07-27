export interface ActivityStats {
    manual: number;
    automated: number;
    byType: {
        SMS: number;
        Email: number;
        Call: number;
        WhatsApp: number;
        Internal: number;
    };
    delivered: number;
    failed: number;
    successRate: number;
}

export interface DisputeStats {
    created: number;
    closed: number;
    open: number;
    averageResolutionDays: number;
}

export interface CallStats {
    total: number;
    successful: number;
    successRate: number;
    byOutcome: Record<string, number>;
}

export interface PromiseStats {
    total: number;
    fulfilled: number;
    fulfillmentRate: number;
    totalAmount: number;
}

export interface IssueStats {
    undeliveredActivities: number;
    missingContacts: number;
    automationStuck: number;
    overdueFollowUps: number;
    invalidTemplates: number;
}

export interface ProductivityStats {
    averageActivitiesPerAgent: number;
    averageActivitiesPerDay: number;
    topPerformingAgent: {
        userId: string;
        name: string;
        activities: number;
    } | null;
}

export interface AgentOperationStats {
    userId: string;
    name: string;
    email: string;
    image: string | null;
    activities: {
        manual: number;
        automated: number;
        byType: Record<string, number>;
        delivered: number;
        failed: number;
    };
    disputes: {
        created: number;
        closed: number;
        open: number;
    };
    calls: {
        total: number;
        successful: number;
        byOutcome: Record<string, number>;
    };
    promises: {
        total: number;
        fulfilled: number;
        totalAmount: number;
    };
    productivity: {
        activitiesPerDay: number;
        averageDisputeResolutionDays: number;
    };
    issues: {
        undeliveredActivities: number;
        missingContacts: number;
        automationStuck: number;
        overdueFollowUps: number;
    };
}

export interface AggregateOperationStats {
    activities: ActivityStats;
    disputes: DisputeStats;
    calls: CallStats;
    promises: PromiseStats;
    productivity: ProductivityStats;
    issues: IssueStats;
    userCounts: {
        system: number;
        portal: number;
    };
}

export interface OperationDashboardResponse {
    aggregate: AggregateOperationStats;
    agents: AgentOperationStats[];
    currency: string;
    dateRange: {
        startDate: string;
        endDate: string;
    };
    disputeTrend?: {
        dates: string[];
        created: number[];
        closed: number[];
    };
}
