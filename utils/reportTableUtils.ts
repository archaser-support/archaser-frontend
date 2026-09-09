import {
    getFormulaOutputKey,
    isFormulaFilterField,
} from "@/shared/reportFormula/types";

export interface Relationship {
    from: string;
    to: string;
    fromField?: string;
    toField?: string;
    type?: string;
}

export interface Field {
    table: string;
    field: string;
    alias?: string;
    aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
}

/** Must match {@link Field}["aggregation"] — used for grouping cleanup and SQL. */
export const REPORT_AGGREGATION_TYPES = [
    "SUM",
    "AVG",
    "COUNT",
    "MIN",
    "MAX",
] as const satisfies readonly NonNullable<Field["aggregation"]>[];

/** Keep in sync with `isNumericField` in `@/utils/reportFieldUtils` (avoid importing it here). */
function fieldTypeIsNumeric(fieldType?: string): boolean {
    if (!fieldType) {
        return false;
    }
    const normalizedType = fieldType.toLowerCase();
    return (
        normalizedType === "number" ||
        normalizedType === "decimal" ||
        normalizedType === "integer"
    );
}

/** Suffix pattern for aggregated column keys (no alias): `Table.field__SUM`. */
export const AGGREGATION_OUTPUT_KEY_SUFFIX = /__(SUM|AVG|COUNT|MIN|MAX)$/;

/**
 * Output key used in grouping, sorting, chart axes, API row keys, and grid columns.
 * Aggregated fields without an explicit alias use `table.field__AGG` so the same
 * source column can appear once per aggregation.
 */
export const getFieldOutputKey = (field: Field): string =>
    field.alias ||
    (field.aggregation
        ? `${field.table}.${field.field}__${field.aggregation}`
        : `${field.table}.${field.field}`);

/**
 * Ensure each selected field has a unique {@link getFieldOutputKey} by assigning a synthetic
 * `alias` when the same output key would otherwise repeat (e.g. two SUM columns on one amount).
 */
export function dedupeReportFieldOutputKeys(fields: Field[]): Field[] {
    const used = new Set<string>();
    const out: Field[] = [];

    for (const f of fields) {
        let key = getFieldOutputKey(f);
        if (!used.has(key)) {
            used.add(key);
            out.push(f);
            continue;
        }
        let assigned = false;
        for (let suffix = 2; suffix <= 10000; suffix += 1) {
            const aggPart = f.aggregation ? `__${f.aggregation}` : "";
            const alias = `${f.table}_${f.field}${aggPart}_${suffix}`.replace(
                /[^a-zA-Z0-9_]/g,
                "_"
            );
            const candidate: Field = { ...f, alias };
            key = getFieldOutputKey(candidate);
            if (!used.has(key)) {
                used.add(key);
                out.push(candidate);
                assigned = true;
                break;
            }
        }
        if (!assigned) {
            throw new Error(
                `Could not assign unique output key for field ${f.table}.${f.field}`
            );
        }
    }
    return out;
}

/**
 * Next column to add when the user drags or checks a palette field.
 * Numeric: fills raw then each aggregation once; after that, repeats an existing aggregation
 * (same function on the same field again) — combine with {@link dedupeReportFieldOutputKeys}.
 * Non-numeric: only one natural column per field.
 */
export function resolveNextPaletteFieldCandidate(
    baseField: Field,
    fieldType: string,
    selectedKeys: Set<string>
): Field | null {
    if (!fieldTypeIsNumeric(fieldType)) {
        if (selectedKeys.has(getFieldOutputKey(baseField))) {
            return null;
        }
        return baseField;
    }
    if (!selectedKeys.has(getFieldOutputKey(baseField))) {
        return baseField;
    }
    const variants: Field[] = [
        { ...baseField, aggregation: "SUM" },
        { ...baseField, aggregation: "AVG" },
        { ...baseField, aggregation: "COUNT" },
        { ...baseField, aggregation: "MIN" },
        { ...baseField, aggregation: "MAX" },
    ];
    const nextVariant = variants.find(
        (v) => !selectedKeys.has(getFieldOutputKey(v))
    );
    if (nextVariant) {
        return nextVariant;
    }
    const repeatAgg = REPORT_AGGREGATION_TYPES.find((a) =>
        selectedKeys.has(
            getFieldOutputKey({ ...baseField, aggregation: a })
        )
    );
    if (repeatAgg) {
        return { ...baseField, aggregation: repeatAgg };
    }
    if (selectedKeys.has(getFieldOutputKey(baseField))) {
        return { ...baseField };
    }
    return baseField;
}

/** Pre–multi-aggregation row/config key: `alias` or `table.field` (no `__AGG` suffix). */
export const getLegacyFieldOutputKey = (field: Field): string =>
    field.alias || `${field.table}.${field.field}`;

/**
 * Output / legacy keys that must not appear in `grouping` when this field is aggregated.
 * Includes every `table.field__AGG` variant so switching aggregation (e.g. SUM → MAX)
 * does not leave a stale key in the client config.
 */
export function getForbiddenGroupingKeysForAggregatedField(
    field: Field
): string[] {
    if (!field.aggregation) {
        return [];
    }
    const keys: string[] = [
        getLegacyFieldOutputKey(field),
        `${field.table}.${field.field}`,
        getFieldOutputKey(field),
    ];
    if (!field.alias) {
        for (const agg of REPORT_AGGREGATION_TYPES) {
            keys.push(`${field.table}.${field.field}__${agg}`);
        }
    }
    return keys;
}

/** Union of {@link getForbiddenGroupingKeysForAggregatedField} for every aggregated field. */
export function getForbiddenGroupingKeysForAggregatedFields(
    fields: Field[]
): Set<string> {
    const out = new Set<string>();
    for (const f of fields) {
        for (const k of getForbiddenGroupingKeysForAggregatedField(f)) {
            out.add(k);
        }
    }
    return out;
}

/**
 * Map chart axis / sort values saved as legacy `table.field` to current output keys
 * (`table.field__AGG` when the field is aggregated).
 */
export function resolveLegacyFieldOutputKey(
    storedKey: string | undefined | null,
    fields: Field[] | undefined | null
): string | undefined {
    if (storedKey == null || storedKey === "") {
        return storedKey ?? undefined;
    }
    const list = fields || [];
    if (list.some((f) => getFieldOutputKey(f) === storedKey)) {
        return storedKey;
    }
    const aggregatedMatch = list.find(
        (f) =>
            !!f.aggregation && getLegacyFieldOutputKey(f) === storedKey
    );
    if (aggregatedMatch) {
        return getFieldOutputKey(aggregatedMatch);
    }
    return storedKey;
}

/**
 * Get unique table names from selected fields
 */
export const getSelectedTableNames = (selectedFields: Field[]): string[] => {
    return Array.from(new Set(selectedFields.map((f) => f.table)));
};

/**
 * Entity/dashboard context → forced primary table.
 * Keep in sync with `CONTEXT_PRIMARY_TABLE` in reports `report.constants.ts`.
 */
export const CONTEXT_PRIMARY_TABLE: Record<string, string> = {
    customers: "Customer",
    invoices: "Invoice",
    contacts: "Contact",
    customer_contacts: "Contact",
    customer_banks: "CustomerBanks",
    customer_unpaid_invoices: "Invoice",
    disputes: "Dispute",
    activities: "Activity",
    "customer-collection-period": "CustomerCollectionPeriod",
    dashboard_customers: "Customer",
    dashboard_invoices: "Invoice",
    dashboard_payments: "InvoicePayment",
    dashboard_activities: "Activity",
    dashboard_disputes: "Dispute",
    dashboard_promises: "CustomerCollectionPeriod",
    dashboard_credit_customers: "Customer",
    dashboard_credit_invoices: "Invoice",
};

/**
 * Resolve report grain: context override → primaryTable → tables[0] → fallback.
 * Same precedence as backend execution (`resolveReportPrimaryTable`).
 */
export function resolveReportPrimaryTable(options: {
    context?: string | null;
    /** @deprecated Prefer `context`; kept for call sites that already resolved context primary. */
    contextPrimary?: string | null;
    primaryTable?: string | null;
    tables?: string[] | null;
    fallback?: string;
}): string {
    const fromContext =
        options.contextPrimary ||
        CONTEXT_PRIMARY_TABLE[options.context || ""];
    if (fromContext) {
        return fromContext;
    }
    if (options.primaryTable) {
        return options.primaryTable;
    }
    if (options.tables?.[0]) {
        return options.tables[0];
    }
    return options.fallback ?? "Customer";
}

/**
 * Keep `preferredPrimary` at `tables[0]` when it is still in the list so legacy
 * readers of `tables[0]` stay aligned with explicit `primaryTable`.
 * Column / field reorder callers must pass the saved primary — never invent one
 * from the first column's table.
 */
export function syncReportTablesWithPrimary(
    tables: string[],
    preferredPrimary?: string | null
): string[] {
    if (!preferredPrimary || tables.length === 0) {
        return [...tables];
    }
    if (!tables.includes(preferredPrimary)) {
        return [...tables];
    }
    if (tables[0] === preferredPrimary) {
        return [...tables];
    }
    return [
        preferredPrimary,
        ...tables.filter((table) => table !== preferredPrimary),
    ];
}

/**
 * Next explicit primary after membership changes: keep previous when still
 * active; otherwise first remaining table (or undefined when none).
 */
export function resolveNextReportPrimaryTable(
    previousPrimary: string | null | undefined,
    nextTables: string[]
): string | undefined {
    if (nextTables.length === 0) {
        return undefined;
    }
    if (previousPrimary && nextTables.includes(previousPrimary)) {
        return previousPrimary;
    }
    return nextTables[0];
}

/**
 * Rebuild report `tables` from fields currently in use, while preserving
 * primary (`preferredPrimary` or previous `tables[0]`) when that table is
 * still selected. When `preferredPrimary` is still active it is always
 * forced to index 0 — membership sync never flips grain from column order.
 *
 * Column / field reorder must not change which table is primary — execution
 * uses context → primaryTable → tables[0] as the Prisma root row type.
 */
export function resolveReportTablesPreservingPrimary(
    previousTables: string[],
    activeTables: Iterable<string>,
    preferredPrimary?: string | null
): string[] {
    const active = new Set(
        Array.from(activeTables).filter((table) => !!table)
    );
    if (active.size === 0) {
        return [];
    }

    const next: string[] = [];
    const used = new Set<string>();

    // Prefer explicit primary first when still active, then previous order.
    const grain =
        preferredPrimary && active.has(preferredPrimary)
            ? preferredPrimary
            : previousTables.find((table) => active.has(table)) ?? null;

    if (grain) {
        next.push(grain);
        used.add(grain);
    }

    for (const table of previousTables) {
        if (active.has(table) && !used.has(table)) {
            next.push(table);
            used.add(table);
        }
    }

    for (const table of active) {
        if (!used.has(table)) {
            next.push(table);
            used.add(table);
        }
    }

    return syncReportTablesWithPrimary(next, preferredPrimary ?? grain);
}

/**
 * Check if a table can connect to the selected fields' tables
 */
export const canTableConnect = (
    tableName: string,
    selectedTableNames: string[],
    relationships: Relationship[]
): boolean => {
    // If no tables are selected, any table can be added (first table)
    if (selectedTableNames.length === 0) {
        return true;
    }

    // If this table is already selected, it can always be used
    if (selectedTableNames.includes(tableName)) {
        return true;
    }

    // If already at max (2 tables), cannot add more
    if (selectedTableNames.length >= 2) {
        return false;
    }

    // Check if there's a relationship between this table and any selected table
    return relationships.some(
        (rel) =>
            (rel.from === tableName && selectedTableNames.includes(rel.to)) ||
            (rel.to === tableName && selectedTableNames.includes(rel.from))
    );
};

/**
 * Check if a field can be added from a table (2-table limit)
 */
export const canAddFieldFromTable = (
    tableName: string,
    selectedTableNames: string[]
): boolean => {
    // Can add if less than 2 tables selected OR table is already selected
    return (
        selectedTableNames.length < 2 || selectedTableNames.includes(tableName)
    );
};

/** Operators that do not use `value` in saved report config. */
const REPORT_FILTER_OPERATORS_WITHOUT_VALUE = new Set([
    "is_empty",
    "is_not_empty",
]);

/**
 * True when a filter row still needs a user-supplied value before save / execution.
 * Does not check table/field presence (handled separately).
 */
export function isReportFilterValueIncomplete(filter: {
    operator: string;
    value: unknown;
}): boolean {
    if (REPORT_FILTER_OPERATORS_WITHOUT_VALUE.has(filter.operator)) {
        return false;
    }

    if (filter.operator === "between") {
        const v = filter.value;
        return (
            !Array.isArray(v) ||
            v.length !== 2 ||
            v[0] === "" ||
            v[0] === null ||
            v[0] === undefined ||
            v[1] === "" ||
            v[1] === null ||
            v[1] === undefined
        );
    }

    if (filter.operator === "in") {
        const v = filter.value;
        if (!Array.isArray(v) || v.length === 0) {
            return true;
        }
        const hasSelection = v.some(
            (item) =>
                item !== "" && item !== null && item !== undefined
        );
        return !hasSelection;
    }

    const v = filter.value;
    if (v === null || v === undefined) {
        return true;
    }
    if (typeof v === "string" && v.trim() === "") {
        return true;
    }
    if (Array.isArray(v) && v.length === 0) {
        return true;
    }
    return false;
}

export interface ReportFilterRow {
    table?: string;
    field?: string;
    operator: string;
    value: unknown;
}

export interface ReportMetadataTableField {
    name: string;
    type?: string;
    label?: string;
    options?: string[];
    translationKey?: string;
    translationNamespace?: string;
}

export interface ReportMetadataTable {
    name: string;
    label: string;
    hidden?: boolean;
    fields?: ReportMetadataTableField[];
}

export function normalizeReportMetadataTables(
    metadata:
        | {
              tables?: ReportMetadataTable[];
          }
        | null
        | undefined
): Array<{
    name: string;
    label: string;
    fields: ReportMetadataTableField[];
}> {
    if (!metadata?.tables) {
        return [];
    }
    return metadata.tables.map((table) => ({
        name: table.name,
        label: table.label,
        fields: table.fields || [],
    }));
}

export function cloneReportFilters<T extends ReportFilterRow>(filters: T[]): T[] {
    if (typeof structuredClone === "function") {
        return structuredClone(filters);
    }
    return JSON.parse(JSON.stringify(filters)) as T[];
}

function normalizeFilterForCompare(filter: ReportFilterRow): ReportFilterRow {
    return {
        table: filter.table ?? "",
        field: filter.field ?? "",
        operator: filter.operator ?? "",
        value: filter.value,
    };
}

export function areReportFiltersEqual(
    a: ReportFilterRow[],
    b: ReportFilterRow[]
): boolean {
    if (a.length !== b.length) {
        return false;
    }
    const normalizedA = a.map(normalizeFilterForCompare);
    const normalizedB = b.map(normalizeFilterForCompare);
    return (
        JSON.stringify(normalizedA) === JSON.stringify(normalizedB)
    );
}

type ReportFilterTranslate = (
    key: string,
    defaultValueOrOptions?: string | { defaultValue?: string }
) => string;

export function validateReportFilters(
    filters: ReportFilterRow[],
    t: ReportFilterTranslate,
    options?: {
        skipTableFieldCheck?: boolean;
        formulas?: Array<{ id: string }>;
    }
): Record<number, string> {
    const errors: Record<number, string> = {};
    const skipTableFieldCheck = options?.skipTableFieldCheck === true;
    const formulaKeys =
        options?.formulas != null
            ? new Set(
                  options.formulas.map((formula) =>
                      getFormulaOutputKey(formula.id)
                  )
              )
            : null;

    filters.forEach((filter, index) => {
        if (!skipTableFieldCheck) {
            if (!filter.table?.trim() || !filter.field?.trim()) {
                errors[index] = t("validation.filter_field_required", {
                    defaultValue:
                        "Please choose a table and field for every filter, or remove unused filters.",
                });
                return;
            }
        }

        if (
            formulaKeys &&
            isFormulaFilterField(filter.field) &&
            !formulaKeys.has(filter.field as string)
        ) {
            errors[index] = t("validation.orphan_formula_filter", {
                defaultValue:
                    "A filter references a formula that is not on this report. Remove or update the filter.",
            });
            return;
        }

        if (!isReportFilterValueIncomplete(filter)) {
            return;
        }

        if (filter.operator === "between") {
            errors[index] = t("validation.between_filter_incomplete", {
                defaultValue:
                    "Filter with 'between' operator requires both start and end values to be filled",
            });
        } else {
            errors[index] = t("validation.filter_value_required", {
                defaultValue:
                    'Every filter must have a value. Choose values, switch to "Is empty" or "Is not empty" if appropriate, or remove the filter.',
            });
        }
    });

    return errors;
}
