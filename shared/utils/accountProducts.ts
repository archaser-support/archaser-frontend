import { isStagingDeployClient } from "@/utils/domainUtils";

export type AccountProducts = {
    has_collection?: boolean;
    has_credit_insurance?: boolean;
    /** Staging Demo ON unlocks File Import nav and import_* role catalog. */
    is_demo?: boolean;
};

export function isCreditOnlyAccount(
    accountProducts?: AccountProducts | null
): boolean {
    return (
        accountProducts?.has_collection === false &&
        accountProducts?.has_credit_insurance === true
    );
}

/**
 * File Import nav/page surfaces: staging deploy and account Demo ON only.
 * Roles catalog filtering is enforced on the API; this gates client nav/UI.
 */
export function isFileImportVisible(
    accountProducts?: AccountProducts | null
): boolean {
    return (
        isStagingDeployClient() && accountProducts?.is_demo === true
    );
}

export function accountProductsFromRecord(
    record?: {
        has_collection?: boolean;
        has_credit_insurance?: boolean;
        is_demo?: boolean;
    } | null
): AccountProducts | undefined {
    if (!record) {
        return undefined;
    }

    return {
        has_collection: record.has_collection,
        has_credit_insurance: record.has_credit_insurance,
        is_demo: record.is_demo === true,
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
