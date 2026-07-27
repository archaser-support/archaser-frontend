import { extractFieldReferences } from "@/shared/reportFormula/parser";
import {
    getFormulaOutputKey,
    isFormulaOutputKey,
    type FormulaResultFormat,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import { getFieldOutputKey, type Field } from "@/utils/reportTableUtils";

/** Metadata field types eligible as formula operands (numeric / amount). */
export function isFormulaOperandFieldType(fieldType?: string): boolean {
    if (!fieldType) {
        return false;
    }
    const t = fieldType.toLowerCase();
    return (
        t === "number" ||
        t === "decimal" ||
        t === "integer" ||
        t === "amount" ||
        t === "currency"
    );
}

/**
 * Canonical operand key for formulas — always the non-aggregated output key
 * (`table.field`), even when the visible column uses `table.field__SUM`.
 */

/** Fields that can supply row currency for currency-format formulas. */
export function isFormulaCurrencySourceField(
    tableName: string,
    fieldName: string,
    metadataTables: Array<{
        name: string;
        fields: Array<{ name: string; type: string }>;
    }>
): boolean {
    const tableMeta = metadataTables.find((t) => t.name === tableName);
    const fieldMeta = tableMeta?.fields.find((f) => f.name === fieldName);
    if (!fieldMeta) {
        return false;
    }
    const t = fieldMeta.type?.toLowerCase() || "";
    if (t === "amount" || t === "currency") {
        return true;
    }
    return fieldName.toLowerCase().includes("amount");
}

/** Rate / percentage operands (e.g. cost_percent, labels with %). */
export function isFormulaPercentageOperandField(
    fieldName: string,
    fieldMeta?: { label?: string }
): boolean {
    const name = fieldName.toLowerCase();
    const label = (fieldMeta?.label || "").toLowerCase();
    return name.includes("percent") || label.includes("%");
}

export function isFormulaOperandEligibleForFormat(
    tableName: string,
    fieldName: string,
    format: FormulaResultFormat,
    metadataTables: Array<{
        name: string;
        fields: Array<{ name: string; type: string; label?: string }>;
    }>
): boolean {
    const tableMeta = metadataTables.find((t) => t.name === tableName);
    const fieldMeta = tableMeta?.fields.find((f) => f.name === fieldName);
    if (!fieldMeta || !isFormulaOperandFieldType(fieldMeta.type)) {
        return false;
    }

    switch (format) {
        case "currency":
            return isFormulaCurrencySourceField(
                tableName,
                fieldName,
                metadataTables
            );
        case "percentage":
            return isFormulaPercentageOperandField(fieldName, fieldMeta);
        case "number":
        default:
            return true;
    }
}

export function filterFormulaOperandOptionsForFormat<
    T extends { reference: string }
>(
    options: T[],
    format: FormulaResultFormat,
    metadataTables: Array<{
        name: string;
        fields: Array<{ name: string; type: string; label?: string }>;
    }>
): T[] {
    return options.filter((option) => {
        const dot = option.reference.indexOf(".");
        if (dot <= 0) {
            return false;
        }
        const tableName = option.reference.slice(0, dot);
        const fieldName = option.reference.slice(dot + 1);
        return isFormulaOperandEligibleForFormat(
            tableName,
            fieldName,
            format,
            metadataTables
        );
    });
}

/** First amount/currency-capable field referenced in the expression (left-to-right). */
export function resolveFormulaCurrencySourceFromExpression(
    expression: string,
    metadataTables: Array<{
        name: string;
        fields: Array<{ name: string; type: string }>;
    }>
): string | null {
    for (const ref of extractFieldReferences(expression)) {
        const dot = ref.indexOf(".");
        if (dot <= 0) {
            continue;
        }
        const tableName = ref.slice(0, dot);
        const fieldName = ref.slice(dot + 1);
        if (isFormulaCurrencySourceField(tableName, fieldName, metadataTables)) {
            return ref;
        }
    }
    return null;
}

export function withResolvedFormulaCurrencySource(
    formula: ReportFormula,
    metadataTables: Array<{
        name: string;
        fields: Array<{ name: string; type: string }>;
    }>
): ReportFormula {
    if (formula.format !== "currency") {
        return formula;
    }
    const currencySource =
        resolveFormulaCurrencySourceFromExpression(
            formula.expression,
            metadataTables
        ) || undefined;
    return currencySource
        ? { ...formula, currencySource }
        : { ...formula, currencySource: undefined };
}

export function getFormulaOperandReference(field: Field): string {
    return `${field.table}.${field.field}`;
}

export function getFormulaOperandReferencesFromFields(
    fields: Field[],
    fieldTypeByKey: Map<string, string>
): Set<string> {
    const refs = new Set<string>();
    for (const field of fields) {
        if (field.aggregation) {
            continue;
        }
        const outputKey = getFieldOutputKey(field);
        const type =
            fieldTypeByKey.get(outputKey) ||
            fieldTypeByKey.get(`${field.table}.${field.field}`);
        if (isFormulaOperandFieldType(type)) {
            refs.add(getFormulaOperandReference(field));
        }
    }
    return refs;
}


export function getFormulaOperandReferencesFromTables(
    tableNames: string[],
    metadataTables: Array<{
        name: string;
        fields: Array<{ name: string; type: string }>;
    }>
): Set<string> {
    const refs = new Set<string>();
    for (const tableName of tableNames) {
        const tableMeta = metadataTables.find((t) => t.name === tableName);
        if (!tableMeta) {
            continue;
        }
        for (const fieldMeta of tableMeta.fields) {
            if (isFormulaOperandFieldType(fieldMeta.type)) {
                refs.add(`${tableName}.${fieldMeta.name}`);
            }
        }
    }
    return refs;
}

export function buildDefaultColumnOrder(
    fields: Field[],
    formulas: ReportFormula[] = []
): string[] {
    const fieldKeys = fields.map((f) => getFieldOutputKey(f));
    const formulaKeys = formulas.map((f) => getFormulaOutputKey(f.id));
    return [...fieldKeys, ...formulaKeys];
}

export function resolveReportColumnOrder(
    fields: Field[],
    formulas: ReportFormula[] = [],
    columnOrder?: string[]
): string[] {
    const defaultOrder = buildDefaultColumnOrder(fields, formulas);
    if (!columnOrder || columnOrder.length === 0) {
        return defaultOrder;
    }
    const valid = new Set(defaultOrder);
    const resolved: string[] = [];
    for (const key of columnOrder) {
        if (valid.has(key) && !resolved.includes(key)) {
            resolved.push(key);
        }
    }
    for (const key of defaultOrder) {
        if (!resolved.includes(key)) {
            resolved.push(key);
        }
    }
    return resolved;
}

export type ColumnListItem =
    | {
          kind: "field";
          outputKey: string;
          field: Field;
          fieldIndex: number;
      }
    | {
          kind: "formula";
          outputKey: string;
          formula: ReportFormula;
      };

export function buildColumnListItems(
    fields: Field[],
    formulas: ReportFormula[] = [],
    columnOrder?: string[]
): ColumnListItem[] {
    const order = resolveReportColumnOrder(fields, formulas, columnOrder);
    const fieldByKey = new Map<string, { field: Field; fieldIndex: number }>();
    fields.forEach((field, fieldIndex) => {
        const key = getFieldOutputKey(field);
        if (!fieldByKey.has(key)) {
            fieldByKey.set(key, { field, fieldIndex });
        }
    });

    const items: ColumnListItem[] = [];
    for (const key of order) {
        if (isFormulaOutputKey(key)) {
            const formula = getFormulaByOutputKey(formulas, key);
            if (formula) {
                items.push({ kind: "formula", outputKey: key, formula });
            }
            continue;
        }
        const entry = fieldByKey.get(key);
        if (entry) {
            items.push({
                kind: "field",
                outputKey: key,
                field: entry.field,
                fieldIndex: entry.fieldIndex,
            });
        }
    }
    return items;
}

export function reorderColumnOrder(
    columnOrder: string[],
    fromIndex: number,
    toIndex: number
): string[] {
    if (
        fromIndex < 0 ||
        fromIndex >= columnOrder.length ||
        toIndex < 0 ||
        toIndex > columnOrder.length
    ) {
        return columnOrder;
    }
    const next = [...columnOrder];
    const [removed] = next.splice(fromIndex, 1);
    const adjustedTo = toIndex > fromIndex ? toIndex - 1 : toIndex;
    next.splice(adjustedTo, 0, removed);
    return next;
}

export function syncFieldsOrderFromColumnOrder(
    fields: Field[],
    columnOrder: string[]
): Field[] {
    const fieldByKey = new Map<string, Field>();
    for (const field of fields) {
        fieldByKey.set(getFieldOutputKey(field), field);
    }
    const ordered: Field[] = [];
    const used = new Set<string>();
    for (const key of columnOrder) {
        if (isFormulaOutputKey(key)) {
            continue;
        }
        const field = fieldByKey.get(key);
        if (field && !used.has(key)) {
            ordered.push(field);
            used.add(key);
        }
    }
    for (const field of fields) {
        const key = getFieldOutputKey(field);
        if (!used.has(key)) {
            ordered.push(field);
            used.add(key);
        }
    }
    return ordered;
}

export function insertKeyIntoColumnOrder(
    columnOrder: string[],
    key: string,
    index: number
): string[] {
    const next = columnOrder.filter((entry) => entry !== key);
    const clamped = Math.max(0, Math.min(index, next.length));
    next.splice(clamped, 0, key);
    return next;
}

export function removeKeyFromColumnOrder(
    columnOrder: string[],
    key: string
): string[] {
    return columnOrder.filter((entry) => entry !== key);
}

export function findFormulasDependingOnField(
    formulas: ReportFormula[],
    operandReference: string
): ReportFormula[] {
    const needle = operandReference.toLowerCase();
    return formulas.filter((formula) => {
        const refs = formula.expression.match(/\[([^\]]+)\]/g) || [];
        return refs.some((token) => {
            const inner = token.slice(1, -1).toLowerCase();
            return inner === needle;
        });
    });
}

export function getFormulaByOutputKey(
    formulas: ReportFormula[],
    outputKey: string
): ReportFormula | undefined {
    if (!isFormulaOutputKey(outputKey)) {
        return undefined;
    }
    const id = outputKey.slice("formula:".length);
    return formulas.find((f) => f.id === id);
}

export function generateFormulaId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `f_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isGroupedReportConfig(config: {
    grouping?: string[];
    fields?: Field[];
}): boolean {
    const hasGrouping = (config.grouping?.length ?? 0) > 0;
    const hasAggregatedField = (config.fields || []).some((f) => !!f.aggregation);
    return hasGrouping || hasAggregatedField;
}
