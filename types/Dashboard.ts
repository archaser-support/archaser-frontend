import { ApexOptions } from "apexcharts";

export interface DashboardChart {
    options: ApexOptions;
    series: ApexOptions["series"];
}

export interface AgingPortfolioRow {
    id: number;
    invoiceNumber: string;
    customerName: string;
    amount: number;
    daysOverdue: number;
    dueDate: Date;
}

export interface AgingRangeRow {
    invoices: number;
    accounts: number;
    customers?: number; // Alias for backwards compatibility
    amount: string;
    daysRange: string;
    amountPercentage: string;
    progress: number;
}

export type CollectionStatValue = {
    label: string;
    value: string | number | undefined;
};

export interface CollectionStat {
    label: string;
    value: Array<CollectionStatValue>;
}

export interface PhaseStat {
    label: string;
    value: string;
}

export interface MaturityRow {
    id: number;
    invoices: number;
    accounts: number;
    customers?: number; // Alias for backwards compatibility
    amount: number;
    daysRange: string;
    amountPercentage: string;
}

export interface CustomerData {
    customer: string;
    amount: number;
    percentage: number;
    color: string;
}

export interface DashboardResponse {
    activeCustomers: number; // Count of overdue customers (customers with outstanding amounts)
    overdueAmount: number;
    overdueInvoices: number;
    totalCollected: number;
    // Due statistics
    totalDue: number;
    dueToday: number;
    dueThisWeek: number;
    dueThisMonth: number;
    dueNextMonth: number;
    // Receivables maturity schedule
    receivablesMaturitySchedule: MaturityRow[];
    // Invoices by customer
    invoicesByCustomer: CustomerData[];
    // Invoices by business unit
    invoicesByBusinessUnit: CustomerData[];
    // Overdue invoices by customer
    overdueInvoicesByCustomer: CustomerData[];
    // Overdue invoices by business unit
    overdueInvoicesByBusinessUnit: CustomerData[];
    audienceReport: DashboardChart;
    activeCustomersChart: DashboardChart; // Chart for overdue customers
    agingPortfolio: {
        chartData: AgingRangeRow[];
        details: AgingPortfolioRow[];
    };
    collectionStats: CollectionStat[];
    lastSynced: string;
    collectionEffortsPhase: {
        options: ApexOptions;
        series: ApexOptions["series"];
        stats: PhaseStat[];
    };
    automatedPhaseSplit: DashboardChart;
    currency: string;
    viewMode?: "child" | "parent"; // Current view mode for the dashboard
    hasChildBusinessUnits?: boolean; // Whether the user's business unit has child business units
    fromCache?: boolean; // Indicates if response came from cache
    cacheAge?: number; // Age of cache in seconds (if from cache)
}
