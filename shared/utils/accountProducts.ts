export type AccountProducts = {
    has_collection?: boolean;
    has_credit_insurance?: boolean;
};

export function isCreditOnlyAccount(
    accountProducts?: AccountProducts | null
): boolean {
    return (
        accountProducts?.has_collection === false &&
        accountProducts?.has_credit_insurance === true
    );
}

export function accountProductsFromRecord(
    record?: { has_collection?: boolean; has_credit_insurance?: boolean } | null
): AccountProducts | undefined {
    if (!record) {
        return undefined;
    }

    return {
        has_collection: record.has_collection,
        has_credit_insurance: record.has_credit_insurance,
    };
}

/** Prisma Account filter matching credit-only accounts */
export const creditOnlyAccountWhere = {
    has_collection: false,
    has_credit_insurance: true,
} as const;

/**
 * Prisma Customer where fragment: exclude customers on credit-only accounts.
 * Pass additional Customer filters (e.g. automation_stuck_no_contacts).
 */
export function excludeCreditOnlyCustomerWhere(
    additional?: Record<string, unknown>
): Record<string, unknown> {
    return {
        ...additional,
        NOT: {
            Account: creditOnlyAccountWhere,
        },
    };
}
