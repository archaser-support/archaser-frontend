export const CUSTOMER_CHECKPOINT_SCHEMA_VERSION = 1 as const;

export type CustomerCheckpointPayload = {
    schemaVersion: typeof CUSTOMER_CHECKPOINT_SCHEMA_VERSION;
    capturedAt: string;
    tables: {
        customer: Record<string, unknown>;
        invoices: Record<string, unknown>[];
        invoicePayments: Record<string, unknown>[];
        payments: Record<string, unknown>[];
        collectionPeriods: Record<string, unknown>[];
        activities: Record<string, unknown>[];
        activityContacts: Record<string, unknown>[];
        disputes: Record<string, unknown>[];
        disputeInvoices: Record<string, unknown>[];
        aggregatedData: Record<string, unknown> | null;
        customerPolicies: Record<string, unknown>[];
        customerTopUps: Record<string, unknown>[];
        contacts: Record<string, unknown>[];
        customerBanks: Record<string, unknown>[];
    };
};

export type CustomerCheckpointRowCounts = {
    invoices: number;
    invoicePayments: number;
    payments: number;
    collectionPeriods: number;
    activities: number;
    activityContacts: number;
    disputes: number;
    disputeInvoices: number;
    customerPolicies: number;
    customerTopUps: number;
    contacts: number;
    customerBanks: number;
    hasAggregatedData: boolean;
};

export type CustomerCheckpointStatus = {
    exists: boolean;
    savedAt: string | null;
    savedBy: string | null;
    rowCounts?: CustomerCheckpointRowCounts;
};

export type CustomerCheckpointRestoreSummary = {
    restoredAt: string;
    rowCounts: CustomerCheckpointRowCounts;
};

export class CustomerCheckpointNotFoundError extends Error {
    constructor(customerId: number) {
        super(`No checkpoint found for customer ${customerId}`);
        this.name = "CustomerCheckpointNotFoundError";
    }
}

export class CustomerCheckpointInvalidBaselineError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CustomerCheckpointInvalidBaselineError";
    }
}

export function checkpointHasArData(
    rowCounts: CustomerCheckpointRowCounts
): boolean {
    return rowCounts.invoices > 0 || rowCounts.invoicePayments > 0;
}
