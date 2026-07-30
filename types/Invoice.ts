import type {
    Account,
    Customer,
    CustomerCollectionPeriod,
    Invoice as InvoiceRow,
} from "@/types/db";

export type Invoice = InvoiceRow & {
    Account: Account;
    Customer: Customer | null;
    CustomerCollectionPeriod: CustomerCollectionPeriod | null;
};

export interface InvoiceResponse {
    invoices: Invoice[];
    totalRecords: number;
}
