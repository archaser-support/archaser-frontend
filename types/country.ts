import { Account } from "./Account";
import { Customer } from "./Customer";
import { State } from "./state";

export interface Country {
    id: number;
    code: string;
    name: string;
    numericCode?: number;
    region?: string;
    subregion?: string;
    capital?: string;
    currencyName?: string;
    phoneCode?: string;
    timezones?: Record<string, any>;
    languages?: Record<string, any>;
    flagUrl?: string;
    currencyCode?: string;
    alpha3Code: string;
    emoji?: string;
    emojiU?: string;
    accounts: Account[];
    customers: Customer[];
    states: State[];
}
