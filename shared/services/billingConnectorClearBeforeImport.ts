import type { ImportType } from "@/types/db";

export type ClearBeforeImportEntity = Extract<
    ImportType,
    "Customer" | "Contact" | "Invoice" | "Payment"
>;

export type ClearBeforeImportSessionState = Partial<
    Record<ClearBeforeImportEntity, boolean>
>;

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

export function buildClearBeforeImportConfirmCopy(params: {
    clearBeforeImport: readonly ClearBeforeImportEntity[];
    scope?: "account" | "customer";
    customerId?: number | null;
}): { title: string; description: string } {
    const entities = params.clearBeforeImport;
    const customerId = normalizeClearBeforeImportCustomerId(params.customerId);
    const scopeIsCustomer = params.scope === "customer" || customerId != null;
    const customerLabel = customerId != null ? ` ${customerId}` : "";

    if (entities.length === 0 && scopeIsCustomer) {
        return {
            title: "Start customer-scoped reimport?",
            description: `This Start backfill will pull only customer id${customerLabel} for all enabled entities. Existing rows are not deleted. Saved pull filters are not changed. Continue?`,
        };
    }

    const entityLabel =
        entities.length === 1
            ? entities[0]
            : entities.length === 2
              ? `${entities[0]} and ${entities[1]}`
              : `${entities.slice(0, -1).join(", ")}, and ${entities[entities.length - 1]}`;
    const scopeLabel = scopeIsCustomer
        ? `for customer id${customerLabel}`
        : "for this account";
    const wholeAccountCustomerWarning =
        !scopeIsCustomer && entities.includes("Customer")
            ? " Warning: Customer delete for this account will permanently remove all customers and related data (contacts, invoices, payments, and other linked records)."
            : "";
    return {
        title: "Delete existing data before import?",
        description: `This will permanently delete existing ${entityLabel} data ${scopeLabel} before the backfill starts. Deleted rows are not restored if the import fails.${
            scopeIsCustomer
                ? " The whole Start pull is also limited to that customer."
                : ""
        }${wholeAccountCustomerWarning} Continue?`,
    };
}
