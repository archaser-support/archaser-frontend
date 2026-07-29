import { Prisma } from "@prisma/client";

import {
    aggregateFormulaValues,
    decimalToNumberOrNull,
    evaluateFormulaExpression,
    validateFormulaDefinition,
} from "@/server/services/reportFormulaEngine";
import type { ReportConfig } from "@/server/services/ReportService";
import {
    getFormulaOperandReference,
    getFormulaOperandReferencesFromTables,
    isFormulaOperandFieldType,
    isGroupedReportConfig,
    resolveAllFormulaCurrencySources,
} from "@/shared/reportFormula/columnOrder";
import {
    getDirectFieldReferences,
    validateFormulaDependencyGraph,
    topologicalSortFormulas,
} from "@/shared/reportFormula/formulaDependencies";
import {
    extractFieldReferences,
    isFormulaOperandReference,
} from "@/shared/reportFormula/parser";
import {
    getFormulaOutputKey,
    type FormulaWarningSummary,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";
import {
    getFieldOutputKey,
    getLegacyFieldOutputKey,
    REPORT_AGGREGATION_TYPES,
    type Field,
} from "@/utils/reportTableUtils";

export interface ApplyFormulasResult {
    rows: any[];
    warnings: FormulaWarningSummary[];
}

function collectOperandCandidateKeys(
    reference: string,
    fields: Field[]
): string[] {
    const keys: string[] = [];
    const add = (key: string) => {
        if (key && !keys.includes(key)) {
            keys.push(key);
        }
    };

    add(reference);
    for (const agg of REPORT_AGGREGATION_TYPES) {
        add(`${reference}__${agg}`);
    }

    for (const field of fields) {
        const canonical = `${field.table}.${field.field}`;
        if (canonical !== reference) {
            continue;
        }
        add(getFieldOutputKey(field));
        add(getLegacyFieldOutputKey(field));
        if (field.aggregation) {
            add(`${canonical}__${field.aggregation}`);
        }
    }

    return keys;
}

/**
 * Resolve a canonical formula operand (`Invoice.amount`) from a report row.
 * Values may live under aggregated keys (`Invoice.amount__SUM`), field aliases,
 * or `row.raw` — the same places grouping already reads from.
 */
function getRowFieldValue(
    row: any,
    reference: string,
    fields: Field[] = []
): unknown {
    const keys = collectOperandCandidateKeys(reference, fields);
    const sources = [row, row?.raw].filter(Boolean);

    for (const source of sources) {
        for (const key of keys) {
            const value = source[key];
            // Explicit null must not block fallback to aggregated/alias keys.
            if (value !== undefined && value !== null && value !== "") {
                return value;
            }
        }
    }

    for (const source of sources) {
        for (const key of keys) {
            const formattedKey = `___formatted_${key}`;
            const value = source[formattedKey];
            if (value !== undefined && value !== null && value !== "") {
                return value;
            }
        }
    }

    return undefined;
}

function resolveCurrencyFromRow(
    row: any,
    currencySource: string,
    accountCurrency: string,
    fields: Field[] = []
): string {
    const operandKeys = collectOperandCandidateKeys(currencySource, fields);
    const candidates = operandKeys.map((key) => `__currency_${key}`);
    for (const currencyKey of candidates) {
        if (row[currencyKey]) {
            return String(row[currencyKey]);
        }
        if (row?.raw?.[currencyKey]) {
            return String(row.raw[currencyKey]);
        }
    }
    if (row.currency) {
        return String(row.currency);
    }
    return accountCurrency;
}

function formatFormulaValue(
    value: Prisma.Decimal | null,
    formula: ReportFormula,
    row: any,
    locale: string,
    i18nLanguage: string,
    accountCurrency: string,
    fields: Field[] = []
): { raw: number | null; formatted: string | null } {
    const num = decimalToNumberOrNull(value);
    if (num === null) {
        return { raw: null, formatted: null };
    }
    switch (formula.format) {
        case "currency": {
            const currency = formula.currencySource
                ? resolveCurrencyFromRow(
                      row,
                      formula.currencySource,
                      accountCurrency,
                      fields
                  )
                : accountCurrency;
            return {
                raw: num,
                formatted: formatCurrencyWithRTLSupport(
                    num,
                    currency,
                    locale,
                    i18nLanguage
                ),
            };
        }
        case "percentage":
            // Raw value is a fraction (0.03 = 3%). Auto-scaled rate fields
            // are already divided by 100 when read into the expression.
            return {
                raw: num,
                formatted: new Intl.NumberFormat(locale, {
                    style: "percent",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 4,
                }).format(num),
            };
        case "number":
        default:
            return {
                raw: num,
                formatted: new Intl.NumberFormat(locale, {
                    maximumFractionDigits: 10,
                }).format(num),
            };
    }
}

function graphErrorMessage(
    formulas: ReportFormula[],
    error: NonNullable<ReturnType<typeof validateFormulaDependencyGraph>>
): string {
    const labelFor = (id: string) =>
        formulas.find((f) => f.id === id)?.label || id;
    switch (error.code) {
        case "self_reference":
            return `Formula "${labelFor(error.formulaId)}" cannot reference itself`;
        case "cycle":
            return `Formula dependency cycle detected: ${error.path
                .map(labelFor)
                .join(" → ")}`;
        case "unknown_formula":
            return `Formula "${labelFor(error.formulaId)}" references unknown formula id: ${error.missingId}`;
        case "no_transitive_field":
            return `Formula "${labelFor(error.formulaId)}" must eventually reference at least one report field`;
        default:
            return "Invalid formula dependency graph";
    }
}

export function validateReportFormulas(
    config: ReportConfig,
    metadataTables: Array<{ name: string; fields: Array<{ name: string; type: string }> }>
): void {
    const formulas = config.formulas || [];
    if (formulas.length === 0) {
        return;
    }

    const allowedRefs = getFormulaOperandReferencesFromTables(
        config.tables || [],
        metadataTables
    );
    const isGrouped = isGroupedReportConfig(config);
    const knownFormulaIds = new Set(formulas.map((f) => f.id));
    const formulaLabelsLower = new Map(
        formulas.map((f) => [f.label.trim().toLowerCase(), f.label.trim()])
    );

    const graphError = validateFormulaDependencyGraph(formulas);
    if (graphError) {
        throw new Error(graphErrorMessage(formulas, graphError));
    }

    const resolvedFormulas = resolveAllFormulaCurrencySources(
        formulas,
        metadataTables
    );
    const labels = new Set<string>();

    for (const formula of resolvedFormulas) {
        validateFormulaDefinition(formula, {
            allowedFieldReferences: allowedRefs,
            knownFormulaIds,
            formulaLabelsLower,
            isGroupedReport: isGrouped,
            existingLabelsLower: labels,
        });
        labels.add(formula.label.trim().toLowerCase());
    }
}


export function mergeFormulaOperandFieldsIntoConfig(
    config: ReportConfig,
    metadataTables: Array<{ name: string; fields: Array<{ name: string; type: string }> }>
): ReportConfig {
    const formulas = config.formulas || [];
    if (formulas.length === 0) {
        return config;
    }

    const reportTables = new Set(config.tables || []);
    const fields = [...(config.fields || [])];
    const existing = new Set(fields.map((f) => `${f.table}.${f.field}`));

    const addOperandField = (table: string, fieldName: string) => {
        if (!reportTables.has(table)) {
            return;
        }
        const tableMeta = metadataTables.find((t) => t.name === table);
        const fieldMeta = tableMeta?.fields.find((f) => f.name === fieldName);
        if (!fieldMeta || !isFormulaOperandFieldType(fieldMeta.type)) {
            return;
        }
        const key = `${table}.${fieldName}`;
        if (!existing.has(key)) {
            fields.push({ table, field: fieldName });
            existing.add(key);
        }
    };

    for (const formula of formulas) {
        for (const ref of getDirectFieldReferences(formula.expression)) {
            const dot = ref.indexOf(".");
            if (dot <= 0) {
                continue;
            }
            addOperandField(ref.slice(0, dot), ref.slice(dot + 1));
        }
        if (formula.currencySource) {
            const source = formula.currencySource.replace(/__SUM$|__AVG$|__MIN$|__MAX$|__COUNT$/, "");
            const dot = source.indexOf(".");
            if (dot > 0) {
                addOperandField(source.slice(0, dot), source.slice(dot + 1));
            }
        }
    }

    return { ...config, fields };
}


export function applyFormulasToRows(
    rows: any[],
    config: ReportConfig,
    options: {
        locale?: string;
        accountCurrency?: string;
        metadataTables: Array<{ name: string; fields: Array<{ name: string; type: string }> }>;
    }
): ApplyFormulasResult {
    const formulas = config.formulas || [];
    if (formulas.length === 0) {
        return { rows, warnings: [] };
    }

    const locale = options.locale || "en-US";
    const i18nLanguage = locale.startsWith("he") ? "he" : "en";
    const accountCurrency = options.accountCurrency || "USD";
    const fields = (config.fields || []) as Field[];
    const invalidCounts = new Map<string, number>();
    const resolvedFormulas = resolveAllFormulaCurrencySources(
        formulas,
        options.metadataTables
    );
    const orderedFormulas = topologicalSortFormulas(resolvedFormulas);

    const enriched = rows.map((row) => {
        const out = { ...row };
        for (const formula of orderedFormulas) {
            const outputKey = getFormulaOutputKey(formula.id);
            const evaluated = evaluateFormulaExpression(formula.expression, {
                getFieldValue: (ref) => {
                    if (isFormulaOperandReference(ref)) {
                        // Row-level formula output already written in topo order.
                        // Null upstream → missing operand (no double-count warning).
                        const value = out[ref];
                        return value === undefined ? null : value;
                    }
                    return getRowFieldValue(out, ref, fields);
                },
            });
            if (evaluated.value === null) {
                // Missing/null operands are expected blanks — do not warn.
                // Warn only for real calculation failures (div-by-zero, non-finite, etc.).
                if (
                    evaluated.nullReason &&
                    evaluated.nullReason !== "missing_operand"
                ) {
                    invalidCounts.set(
                        formula.id,
                        (invalidCounts.get(formula.id) || 0) + 1
                    );
                }
                out[outputKey] = null;
                out[`___formatted_${outputKey}`] = null;
            } else {
                const { raw, formatted } = formatFormulaValue(
                    evaluated.value,
                    formula,
                    out,
                    locale,
                    i18nLanguage,
                    accountCurrency,
                    fields
                );
                out[outputKey] = raw;
                out[`___formatted_${outputKey}`] = formatted;
            }
        }
        return out;
    });

    const warnings: FormulaWarningSummary[] = formulas
        .map((f) => ({
            formulaId: f.id,
            label: f.label,
            invalidCount: invalidCounts.get(f.id) || 0,
        }))
        .filter((w) => w.invalidCount > 0);

    return { rows: enriched, warnings };
}

export function aggregateFormulaColumnsInGroupedRows(
    groupRows: any[],
    formulas: ReportFormula[],
    options: {
        locale?: string;
        accountCurrency?: string;
        sampleRow: any;
        fields?: Field[];
    }
): { groupedValues: Record<string, number | null>; warnings: FormulaWarningSummary[] } {
    const locale = options.locale || "en-US";
    const i18nLanguage = locale.startsWith("he") ? "he" : "en";
    const accountCurrency = options.accountCurrency || "USD";
    const groupedValues: Record<string, number | null> = {};
    const warnings: FormulaWarningSummary[] = [];

    for (const formula of formulas) {
        const outputKey = getFormulaOutputKey(formula.id);
        if (!formula.aggregation) {
            groupedValues[outputKey] = null;
            continue;
        }

        const decimals: Prisma.Decimal[] = [];
        // Null/undefined formula values were already counted in applyFormulasToRows.
        // Only count additional failures introduced during group aggregation.
        let additionalInvalidInGroup = 0;
        for (const row of groupRows) {
            const raw = row[outputKey];
            if (raw === null || raw === undefined) {
                continue;
            }
            try {
                const d =
                    typeof raw === "number"
                        ? new Prisma.Decimal(raw)
                        : new Prisma.Decimal(String(raw));
                if (d.isFinite()) {
                    decimals.push(d);
                } else {
                    additionalInvalidInGroup += 1;
                }
            } catch {
                additionalInvalidInGroup += 1;
            }
        }

        if (formula.format === "currency" && formula.currencySource) {
            const currencies = new Set<string>();
            for (const row of groupRows) {
                const raw = row[outputKey];
                if (raw === null || raw === undefined) {
                    continue;
                }
                currencies.add(
                    resolveCurrencyFromRow(
                        row,
                        formula.currencySource,
                        accountCurrency,
                        options.fields || []
                    )
                );
            }
            if (currencies.size > 1) {
                groupedValues[outputKey] = null;
                warnings.push({
                    formulaId: formula.id,
                    label: formula.label,
                    invalidCount: 1,
                });
                continue;
            }
        }

        const aggregated = aggregateFormulaValues(decimals, formula.aggregation);
        const num = decimalToNumberOrNull(aggregated);
        groupedValues[outputKey] = num;

        if (additionalInvalidInGroup > 0) {
            warnings.push({
                formulaId: formula.id,
                label: formula.label,
                invalidCount: additionalInvalidInGroup,
            });
        }

        if (num !== null) {
            const { formatted } = formatFormulaValue(
                aggregated,
                formula,
                options.sampleRow,
                locale,
                i18nLanguage,
                accountCurrency,
                options.fields || []
            );
            groupedValues[`___formatted_${outputKey}`] = formatted as any;
        } else {
            groupedValues[`___formatted_${outputKey}`] = null as any;
        }
    }

    return { groupedValues, warnings };
}

export function getFormulaDependencyReferences(
    formulas: ReportFormula[]
): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const formula of formulas) {
        map.set(formula.id, extractFieldReferences(formula.expression));
    }
    return map;
}

export function findFormulasReferencingOperand(
    formulas: ReportFormula[],
    operandReference: string
): ReportFormula[] {
    const needle = operandReference.toLowerCase();
    return formulas.filter((f) =>
        extractFieldReferences(f.expression).some(
            (ref) => ref.toLowerCase() === needle
        )
    );
}

export { getFormulaOperandReference };
