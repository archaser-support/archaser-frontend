import { Prisma } from "@prisma/client";

export type Activity = Prisma.ActivityGetPayload<{
    include: {
        Contact: true;
        Account: true;
        Customer: true;
        CustomerCollectionPeriod: true;
        ActivityStatus: true;
        ActivitiesSequence: true;
        ActivitiesTemplate: true;
    };
}>;
