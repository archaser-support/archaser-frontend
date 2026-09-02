/** UI kill-switch: hide File Import from sidenav and role matrix (feature code remains). */
export const FILE_IMPORT_UI_VISIBLE = false;

export type AccountProducts = {
    has_collection?: boolean;
    has_credit_insurance?: boolean;
    /** Defaults to true when omitted (existing accounts / pre-migration). */
    has_file_import?: boolean;
};

export function isCreditOnlyAccount(
    accountProducts?: AccountProducts | null
): boolean {
    return (
        accountProducts?.has_collection === false &&
        accountProducts?.has_credit_insurance === true
    );
}

/** File Import nav/page/matrix surfaces are shown unless UI or account flag is off. */
export function isFileImportVisible(
    accountProducts?: AccountProducts | null
): boolean {
    return (
        FILE_IMPORT_UI_VISIBLE &&
        accountProducts?.has_file_import !== false
    );
}

/** Strip file-import permissions from the role matrix catalog (UI-only hide). */
export function filterFileImportFromPermissionMatrix<
    T extends {
        permissions: string[];
        permissionsByCategory: Record<string, Record<string, string[]>>;
    },
>(data: T): T {
    if (FILE_IMPORT_UI_VISIBLE) {
        return data;
    }

    const importExportKeys = new Set<string>();
    for (const subcategories of Object.values(data.permissionsByCategory)) {
        const importExport = subcategories.import_export;
        if (importExport) {
            for (const permission of importExport) {
                importExportKeys.add(permission);
            }
        }
    }

    const permissions = data.permissions.filter(
        (permission) => !importExportKeys.has(permission)
    );

    const permissionsByCategory: Record<string, Record<string, string[]>> = {};
    for (const [categoryKey, subcategories] of Object.entries(
        data.permissionsByCategory
    )) {
        const nextSubcategories: Record<string, string[]> = {};
        for (const [subKey, perms] of Object.entries(subcategories)) {
            if (subKey === "import_export") {
                continue;
            }
            if (perms.length > 0) {
                nextSubcategories[subKey] = perms;
            }
        }
        if (Object.keys(nextSubcategories).length > 0) {
            permissionsByCategory[categoryKey] = nextSubcategories;
        }
    }

    return {
        ...data,
        permissions,
        permissionsByCategory,
    };
}

export function accountProductsFromRecord(
    record?: {
        has_collection?: boolean;
        has_credit_insurance?: boolean;
        has_file_import?: boolean;
    } | null
): AccountProducts | undefined {
    if (!record) {
        return undefined;
    }

    return {
        has_collection: record.has_collection,
        has_credit_insurance: record.has_credit_insurance,
        has_file_import:
            record.has_file_import !== undefined
                ? record.has_file_import
                : true,
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
