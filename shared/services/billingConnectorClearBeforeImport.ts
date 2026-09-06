import type { ImportType } from "@/types/db";

export type ClearBeforeImportEntity = Extract<
    ImportType,
    "Customer" | "Contact" | "Invoice" | "Payment"
>;

export type ClearBeforeImportSessionState = Partial<
    Record<ClearBeforeImportEntity, boolean>
>;

export type ClearBeforeImportPrefs = {
    entities: ClearBeforeImportSessionState;
    customerId: number | null;
    customerName: string | null;
};

const CLEAR_BEFORE_IMPORT_ENTITIES: readonly ClearBeforeImportEntity[] = [
    "Customer",
    "Contact",
    "Invoice",
    "Payment",
];

export function clearBeforeImportPrefsStorageKey(accountId: number): string {
    return `billing-clear-before-import:${accountId}`;
}

function isClearBeforeImportEntity(
    value: string
): value is ClearBeforeImportEntity {
    return (CLEAR_BEFORE_IMPORT_ENTITIES as readonly string[]).includes(value);
}

function parseEntitiesFromRecord(
    record: Record<string, unknown>
): ClearBeforeImportSessionState {
    const out: ClearBeforeImportSessionState = {};
    for (const [key, value] of Object.entries(record)) {
        if (isClearBeforeImportEntity(key) && typeof value === "boolean") {
            out[key] = value;
        }
    }
    return out;
}

function normalizeCustomerId(
    value: unknown
): number | null {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return Math.trunc(value);
    }
    return null;
}

const EMPTY_PREFS: ClearBeforeImportPrefs = {
    entities: {},
    customerId: null,
    customerName: null,
};

/** Load persisted clear-before-import prefs for an account (browser localStorage). */
export function readClearBeforeImportPrefs(
    accountId: number
): ClearBeforeImportPrefs {
    if (typeof window === "undefined" || !(accountId > 0)) {
        return { ...EMPTY_PREFS, entities: {} };
    }
    try {
        const raw = window.localStorage.getItem(
            clearBeforeImportPrefsStorageKey(accountId)
        );
        if (!raw) {
            return { ...EMPTY_PREFS, entities: {} };
        }
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { ...EMPTY_PREFS, entities: {} };
        }
        const record = parsed as Record<string, unknown>;

        // New shape: { entities, customerId, customerName }
        if (
            record.entities != null &&
            typeof record.entities === "object" &&
            !Array.isArray(record.entities)
        ) {
            const customerId = normalizeCustomerId(record.customerId);
            const customerName =
                customerId != null && typeof record.customerName === "string"
                    ? record.customerName.trim() || null
                    : null;
            return {
                entities: parseEntitiesFromRecord(
                    record.entities as Record<string, unknown>
                ),
                customerId,
                customerName:
                    customerId != null
                        ? customerName || `Customer ${customerId}`
                        : null,
            };
        }

        // Legacy shape: top-level entity booleans only
        return {
            entities: parseEntitiesFromRecord(record),
            customerId: null,
            customerName: null,
        };
    } catch {
        return { ...EMPTY_PREFS, entities: {} };
    }
}

/** Persist clear-before-import prefs for an account (browser localStorage). */
export function writeClearBeforeImportPrefs(
    accountId: number,
    prefs: ClearBeforeImportPrefs
): void {
    if (typeof window === "undefined" || !(accountId > 0)) {
        return;
    }
    const key = clearBeforeImportPrefsStorageKey(accountId);
    // Always persist explicit booleans for every entity so reloads restore faithfully.
    const entities: ClearBeforeImportSessionState = {};
    for (const entity of CLEAR_BEFORE_IMPORT_ENTITIES) {
        entities[entity] = prefs.entities[entity] === true;
    }
    const customerId = normalizeCustomerId(prefs.customerId);
    const hasAnyEntity = CLEAR_BEFORE_IMPORT_ENTITIES.some(
        (entity) => entities[entity] === true
    );
    if (!hasAnyEntity && customerId == null) {
        window.localStorage.removeItem(key);
        return;
    }
    const toStore: ClearBeforeImportPrefs = {
        entities,
        customerId,
        customerName:
            customerId != null
                ? prefs.customerName?.trim() || `Customer ${customerId}`
                : null,
    };
    window.localStorage.setItem(key, JSON.stringify(toStore));
}

/**
 * Normalize optional Start backfill customer_id field.
 * Empty / whitespace / non-positive / non-numeric → null (account-wide).
 */
export function normalizeClearBeforeImportCustomerId(
    value: string | number | null | undefined
): number | null {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return Math.trunc(value);
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!/^\d+$/.test(trimmed)) {
            return null;
        }
        const id = Number.parseInt(trimmed, 10);
        return Number.isFinite(id) && id > 0 ? id : null;
    }
    return null;
}

/** @deprecated Use {@link normalizeClearBeforeImportCustomerId}. */
export function normalizeClearBeforeImportCustomerNumber(
    value: string | null | undefined
): string | null {
    const id = normalizeClearBeforeImportCustomerId(value);
    return id != null ? String(id) : null;
}

/** Entities whose delete-before-import switch is on and currently enabled. */
export function resolveClearBeforeImportPayload(params: {
    session: ClearBeforeImportSessionState;
    enabledEntities: readonly ImportType[];
}): ClearBeforeImportEntity[] {
    const enabled = new Set(params.enabledEntities);
    const out: ClearBeforeImportEntity[] = [];
    for (const entity of [
        "Customer",
        "Contact",
        "Invoice",
        "Payment",
    ] as ClearBeforeImportEntity[]) {
        if (params.session[entity] && enabled.has(entity)) {
            out.push(entity);
        }
    }
    return out;
}

export function shouldConfirmStartBackfillClear(params: {
    clearBeforeImport: readonly ClearBeforeImportEntity[];
    customerId?: number | null;
}): boolean {
    if (params.clearBeforeImport.length > 0) {
        return true;
    }
    return normalizeClearBeforeImportCustomerId(params.customerId) != null;
}

export type ClearBeforeImportCustomerScope = {
    id: number;
    name: string;
};

export type ClearBeforeImportConfirmCopy = {
    title: string;
    description: string;
    customerScope?: ClearBeforeImportCustomerScope;
    /** When set, UI inserts a bold customer name + id after this prefix. */
    customerScopePrefix?: string;
};

export function buildClearBeforeImportConfirmCopy(params: {
    clearBeforeImport: readonly ClearBeforeImportEntity[];
    scope?: "account" | "customer";
    customerId?: number | null;
    customerName?: string | null;
}): ClearBeforeImportConfirmCopy {
    const entities = params.clearBeforeImport;
    const customerId = normalizeClearBeforeImportCustomerId(params.customerId);
    const scopeIsCustomer = params.scope === "customer" || customerId != null;
    const customerScope =
        customerId != null
            ? {
                  id: customerId,
                  name:
                      params.customerName?.trim() ||
                      `Customer ${customerId}`,
              }
            : undefined;

    if (entities.length === 0 && scopeIsCustomer && customerScope) {
        return {
            title: "Start customer-scoped reimport?",
            description:
                "This Start backfill will pull only customer for all enabled entities. Existing rows are not deleted. Saved pull filters are not changed. Continue?",
            customerScope,
            customerScopePrefix:
                "This Start backfill will pull only customer",
        };
    }

    const entityLabel =
        entities.length === 1
            ? entities[0]
            : entities.length === 2
              ? `${entities[0]} and ${entities[1]}`
              : `${entities.slice(0, -1).join(", ")}, and ${entities[entities.length - 1]}`;
    const wholeAccountCustomerWarning =
        !scopeIsCustomer && entities.includes("Customer")
            ? " Warning: Customer delete for this account will permanently remove all customers and related data (contacts, invoices, payments, and other linked records)."
            : "";
    const description = scopeIsCustomer
        ? `This will permanently delete existing ${entityLabel} data for customer before the backfill starts. Deleted rows are not restored if the import fails. The whole Start pull is also limited to that customer.${wholeAccountCustomerWarning} Continue?`
        : `This will permanently delete existing ${entityLabel} data for this account before the backfill starts. Deleted rows are not restored if the import fails.${wholeAccountCustomerWarning} Continue?`;
    return {
        title: "Delete existing data before import?",
        description,
        customerScope: scopeIsCustomer ? customerScope : undefined,
        customerScopePrefix: scopeIsCustomer
            ? `This will permanently delete existing ${entityLabel} data for customer`
            : undefined,
    };
}
