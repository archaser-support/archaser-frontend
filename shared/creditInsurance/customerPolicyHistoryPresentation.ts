export type CustomerPolicyHistoryChipKind =
    | "previous_policy"
    | "previous_version";

export type UserAuditDisplaySource = {
    name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
} | null | undefined;

export function resolveUserAuditDisplayName(
    user: UserAuditDisplaySource
): string | null {
    if (!user) {
        return null;
    }
    const fromName = user.name?.trim();
    if (fromName) {
        return fromName;
    }
    const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
    if (fullName) {
        return fullName;
    }
    const email = user.email?.trim();
    return email || null;
}

export function resolveCustomerPolicyHistoryChipKind(args: {
    inactiveInsurancePolicyId: number | null | undefined;
    activeInsurancePolicyId: number | null | undefined;
}): CustomerPolicyHistoryChipKind | null {
    const inactive = args.inactiveInsurancePolicyId ?? null;
    const active = args.activeInsurancePolicyId ?? null;
    if (inactive === active) {
        return "previous_version";
    }
    return "previous_policy";
}

type CustomerPolicyHistoryFieldKind = "number" | "date" | "string" | "boolean";

/**
 * Fields shown in the Policy history readonly grid that are compared between
 * consecutive versions. Excludes `policy_change_start_date` (per-version
 * effective date, differs on almost every version by design). Normalization
 * mirrors `customerPolicyFieldValuesEqual` in `@archaser/credit-insurance-domain`
 * (not importable here: depends on Prisma).
 */
const CUSTOMER_POLICY_HISTORY_COMPARED_FIELD_KINDS = {
    insurance_policy_id: "number",
    customer_number_policy: "string",
    limit_type: "string",
    approved_limit: "number",
    approved_limit_currency: "string",
    approved_limit_expiration_date: "date",
    zero_limit_date: "date",
    max_payment_term: "number",
    max_allowed_mep: "number",
    reporting_days: "number",
    mep_cutoff_day: "number",
    mep_substitute_extra_days: "number",
    reporting_cutoff_day: "number",
    reporting_substitute_extra_days: "number",
    payment_term_cutoff_day: "number",
    payment_term_substitute_day: "number",
    credit_score: "number",
    credit_score_input_date: "date",
    active_customer_since: "date",
    outdated_dcl: "boolean",
    policy_exclusion_reason: "string",
} as const;

export type CustomerPolicyHistoryComparedField =
    keyof typeof CUSTOMER_POLICY_HISTORY_COMPARED_FIELD_KINDS;

type CustomerPolicyHistoryVersion = Record<string, unknown> & {
    id?: number | string | null;
    status?: unknown;
};

function normalizeHistoryFieldValue(
    value: unknown,
    kind: CustomerPolicyHistoryFieldKind
): string | number | boolean | null {
    if (kind === "boolean") {
        return Boolean(value);
    }
    if (value === null || value === undefined) {
        return null;
    }
    const text = String(value).trim();
    if (text === "") {
        return null;
    }
    if (kind === "number") {
        const numeric = Number(text);
        return Number.isFinite(numeric) ? numeric : text;
    }
    if (kind === "date") {
        const date = new Date(text);
        return Number.isNaN(date.getTime())
            ? text
            : date.toISOString().slice(0, 10);
    }
    return text;
}

/** Compared fields whose normalized values differ between two versions. */
export function listChangedCustomerPolicyHistoryFields(
    previous: Record<string, unknown>,
    current: Record<string, unknown>
): Set<CustomerPolicyHistoryComparedField> {
    const changed = new Set<CustomerPolicyHistoryComparedField>();
    for (const [field, kind] of Object.entries(
        CUSTOMER_POLICY_HISTORY_COMPARED_FIELD_KINDS
    ) as [CustomerPolicyHistoryComparedField, CustomerPolicyHistoryFieldKind][]) {
        if (
            normalizeHistoryFieldValue(previous[field], kind) !==
            normalizeHistoryFieldValue(current[field], kind)
        ) {
            changed.add(field);
        }
    }
    return changed;
}

/**
 * Changed fields per version id (string key), each version compared to the
 * chronologically previous one (by ascending id = creation order). Pending
 * rows are skipped; the oldest version has no entry.
 */
export function buildCustomerPolicyHistoryChangedFieldsById(
    versions: readonly CustomerPolicyHistoryVersion[]
): Map<string, Set<CustomerPolicyHistoryComparedField>> {
    const chronological = versions
        .filter(
            (version) =>
                version.status !== "pending" &&
                version.id != null &&
                Number.isFinite(Number(version.id))
        )
        .sort((a, b) => Number(a.id) - Number(b.id));
    const changedById = new Map<string, Set<CustomerPolicyHistoryComparedField>>();
    for (let index = 1; index < chronological.length; index += 1) {
        const current = chronological[index];
        changedById.set(
            String(current.id),
            listChangedCustomerPolicyHistoryFields(
                chronological[index - 1],
                current
            )
        );
    }
    return changedById;
}

export function buildPolicyHistoryHeaderAuditSegment(args: {
    modifiedAt: Date | string | null | undefined;
    modifiedByDisplayName: string | null | undefined;
    formatDate: (value: Date | string) => string;
}): string | null {
    if (
        args.modifiedAt == null ||
        args.modifiedAt === "" ||
        !args.modifiedByDisplayName?.trim()
    ) {
        return null;
    }
    return `${args.formatDate(args.modifiedAt)} · ${args.modifiedByDisplayName.trim()}`;
}
