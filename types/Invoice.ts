import { Prisma } from "@prisma/client";

export type Invoice = Prisma.InvoiceGetPayload<{
    include: {
        Account: true;
        Customer: true;
        CustomerCollectionPeriod: true;
        InvoiceStatus: true;
    };
}>;

export interface InvoiceResponse {
    invoices: Invoice[];
    totalRecords: number;
}
