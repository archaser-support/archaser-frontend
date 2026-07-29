import type {
    Account,
    CustomerDispute,
    Log,
    Session,
    User as UserRow,
} from "@/types/db";

export type User = UserRow & {
    Account: Account | null;
    CustomerDispute: CustomerDispute[];
    Log: Log[];
    Session: Session[];
};

export interface UserResponse {
    users: User[];
    totalRecords: number;
}
