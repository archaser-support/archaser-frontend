import { Account } from "./Account";
import { Country } from "./country";
import { Customer } from "./Customer";

export interface State {
    id: number;
    created_at: Date;
    modified_at: Date;
    name: string;
    countryId: number;
    stateAbbreviation: string;
    timeZone?: string;
    accounts: Account[];
    customers: Customer[];
    country: Country;
}
