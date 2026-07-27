export interface ChartDetailsResponse {
    data: ChartDetailRow[];
    summary: {
        totalRecords: number;
        totalAmount: number;
        totalInvoiceCount?: number;
    };
    currency: string;
}

export interface ChartDetailRow {
    accountId: number;
    customerName: string;
    amount?: number;
    outstandingAmount?: number;
    status: string;
    type?: string;
    date: Date;
}
