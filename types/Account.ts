import { Prisma } from "@prisma/client";

export type Account = Prisma.AccountGetPayload<{
    include: {
        ActivitiesSequence: true;
        ActivitiesTemplate: true;
        Activity: true;
        Customer: true;
        DisputeReason: true;
        Invoice: true;
        Log: true;
        User: true;
    };
}> & {
    portal_verification_enabled?: boolean | null;
    has_collection?: boolean | null;
    has_credit_insurance?: boolean | null;
    enable_customer_checkpoints?: boolean | null;
};

export interface AccountResponse {
    accounts: Account[];
    totalRecords: number;
}
