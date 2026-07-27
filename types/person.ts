import { Customer } from "./Customer";

export interface Person {
    id: number;
    created_at: Date;
    modifiedAt: Date;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    identificationNumber?: string;
    mobile?: string;
    fullName?: string;
    customers: Customer[];
}
