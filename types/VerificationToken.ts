export interface VerificationToken {
    id: string;
    identifier: string;
    token: string;
    expires: Date;
    created_at: Date;
    modified_at: Date;
}
