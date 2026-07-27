import { InvoiceStatusState, RecordStatus } from "./enums";
import { Invoice } from "./Invoice";

export interface InvoiceStatus {
    id: number;
    created_at: Date;
    name: string;
    modifiedAt: Date;
    description?: string;
    status: RecordStatus;
    colorCode?: string;
    state: InvoiceStatusState;
    invoices: Invoice[];
}
