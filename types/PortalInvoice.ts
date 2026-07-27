/**
 * Standardized Invoice type for portal components
 * This type is used across all portal invoice-related components
 */
export type PortalInvoice = {
    id: number;
    invoiceNumber: string;
    amount: number;
    customerAmount: number;
    dueDate: string;
    totalPaid: number;
    customerTotalPaid: number;
    outstandingDebt: number;
    customerOutstandingDebt: number;
    status: string;
    customerCurrency: string;
    currency: string;
};

/**
 * Column definition for invoice tables
 */
export type InvoiceColumn = {
    key: keyof PortalInvoice;
    label: string;
    render?: (row: PortalInvoice) => React.ReactNode;
    mobilePriority?: number; // Higher number = higher priority for mobile display
    tooltip?: string; // Helpful tooltip for column headers
};

/**
 * Props for invoice display components
 */
export type InvoiceDisplayProps = {
    invoices: PortalInvoice[];
    columns: InvoiceColumn[];
    isSelectable?: boolean;
    selectedInvoices?: Set<number>;
    onInvoiceSelect?: (invoiceId: number) => void;
    onSelectAll?: (checked: boolean) => void;
    showSelectAll?: boolean;
    mobileBreakpoint?: number;
    emptyMessage?: string;
};
