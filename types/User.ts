import { Prisma } from "@prisma/client";

export type User = Prisma.UserGetPayload<{
    include: {
        Account: true;
        CustomerDispute: true;
        Language: true;
        Log: true;
        Session: true;
    };
}>;

export interface UserResponse {
    users: User[];
    totalRecords: number;
}
