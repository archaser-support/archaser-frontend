type UserIdentity = {
    email?: string | null;
    is_audit_user?: boolean;
};

/**
 * Portal/System users are synthetic audit actors, not people who can use the
 * application. The email fallback supports older API responses that omit the
 * `is_audit_user` field.
 */
export function isSyntheticAuditUser(user: UserIdentity): boolean {
    return (
        user.is_audit_user === true ||
        /^(portal|system)-\d+@audit\.local$/i.test(user.email || "")
    );
}
