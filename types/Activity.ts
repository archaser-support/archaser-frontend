import type {
    Account,
    ActivitiesSequence,
    ActivitiesTemplate,
    Activity as ActivityRow,
    Contact,
    Customer,
    CustomerCollectionPeriod,
} from "@/types/db";

export type Activity = ActivityRow & {
    Contact: Contact | null;
    Account: Account;
    Customer: Customer;
    CustomerCollectionPeriod: CustomerCollectionPeriod | null;
    ActivitiesSequence: ActivitiesSequence | null;
    ActivitiesTemplate: ActivitiesTemplate | null;
};
