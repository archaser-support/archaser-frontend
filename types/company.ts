import { Contact } from "./contact";
import { Customer } from "./Customer";

export interface Company {
    id: number;
    created_at: Date;
    modifiedAt: Date;
    name: string;
    companyNumber?: string;
    contacts: Contact[];
    customers: Customer[];
}
