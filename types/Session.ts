import { User } from "./User";

export interface Session {
    id: string;
    userId: string;
    expires: Date;
    sessionToken: string;
    created_at: Date;
    modified_at: Date;
    user: User;
    view_as_user_id?: string;
    update: (data: { view_as_user_id?: string }) => Promise<void>;
}
