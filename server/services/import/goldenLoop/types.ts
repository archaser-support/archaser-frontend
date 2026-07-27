export const GOLDEN_LOOP_DEFAULT_CUSTOMER_NUMBER = "4567";

export type GoldenInvoiceImportRow = {
    customer_number: string;
    invoice_number: string;
    invoice_date: string;
    due_date?: string;
    amount: number;
    customer_amount: number;
    customer_currency: string;
    total_paid?: number;
    customer_total_paid?: number;
};

export type GoldenPaymentImportRow = {
    customer_number: string;
    invoice_number: string;
    payment_date: string;
    customer_amount: number;
    customer_currency: string;
    reference: string;
    amount?: number;
    payment_method?: string;
};

export type GoldenImportFixturePaths = {
    invoicesPath: string;
    paymentsPath: string;
    expectedResultsPath?: string;
};

export type PreprocessedGoldenImportFiles = {
    customerNumber: string;
    invoices: GoldenInvoiceImportRow[];
    payments: GoldenPaymentImportRow[];
};

export type DailyKpiSnapshot = {
    date: string;
    totalAr: number;
    termBreach: number;
    capacity: number;
    notInsured: number;
    healthIndex: number;
};

export type CustomerDailyKpiTimeline = {
    customerId: number;
    accountId: number;
    snapshots: DailyKpiSnapshot[];
};

export type GoldenExpectedKpiRow = {
    date: string;
    totalAr: number;
    termBreach: number;
    capacity: number;
    notInsured: number;
    healthIndex: number;
};

export type GoldenKpiComparisonResult = {
    match: boolean;
    firstMismatch?: {
        date: string;
        column: keyof Omit<GoldenExpectedKpiRow, "date">;
        expected: number;
        actual: number;
    };
};

export type GoldenEventKpiLogEntry = {
    eventIndex: number;
    eventType: "invoice_open" | "payment_apply";
    date: string;
    invoiceNumber: string;
    amount?: number;
    actual: DailyKpiSnapshot;
    expected: GoldenExpectedKpiRow | null;
};
