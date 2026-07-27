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
    withResolvedFormulaCurrencySource,
} from "@/shared/reportFormula/columnOrder";
import { extractFieldReferences } from "@/shared/reportFormula/parser";
import {
    getFormulaOutputKey,
    type FormulaWarningSummary,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

export interface ApplyFormulasResult {
    rows: any[];
    warnings: FormulaWarningSummary[];
}

function getRowFieldValue(row: any, reference: string): unknown {
    if (row[reference] !== undefined) {
        return row[reference];
    }
    const formattedKey = `___formatted_${reference}`;
    if (row[formattedKey] !== undefined) {
        return row[formattedKey];
    }
    return undefined;
}

function resolveCurrencyFromRow(
    row: any,
    currencySource: string,
    accountCurrency: string
): string {
    const currencyKey = `__currency_${currencySource}`;
    if (row[currencyKey]) {
        return String(row[currencyKey]);
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
    accountCurrency: string
): { raw: number | null; formatted: string | null } {
    const num = decimalToNumberOrNull(value);
    if (num === null) {
        return { raw: null, formatted: null };
    }
    switch (formula.format) {
        case "currency": {
            const currency = formula.currencySource
                ? resolveCurrencyFromRow(row, formula.currencySource, accountCurrency)
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
            return {
                raw: num,
                formatted: new Intl.NumberFormat(locale, {
                    style: "percent",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 4,
                }).format(num / 100),
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
    const labels = new Set<string>();

    for (const formula of formulas) {
        const normalizedFormula = withResolvedFormulaCurrencySource(
            formula,
            metadataTables
        );
        validateFormulaDefinition(normalizedFormula, {
            allowedFieldReferences: allowedRefs,
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
        for (const ref of extractFieldReferences(formula.expression)) {
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
    const invalidCounts = new Map<string, number>();

    const enriched = rows.map((row) => {
        const out = { ...row };
        for (const formula of formulas) {
            const outputKey = getFormulaOutputKey(formula.id);
            const result = evaluateFormulaExpression(formula.expression, {
                getFieldValue: (ref) => getRowFieldValue(row, ref),
            });
            if (result === null) {
                invalidCounts.set(
                    formula.id,
                    (invalidCounts.get(formula.id) || 0) + 1
                );
                out[outputKey] = null;
                out[`___formatted_${outputKey}`] = null;
            } else {
                const { raw, formatted } = formatFormulaValue(
                    result,
                    formula,
                    row,
                    locale,
                    i18nLanguage,
                    accountCurrency
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
        let invalidInGroup = 0;
        for (const row of groupRows) {
            const raw = row[outputKey];
            if (raw === null || raw === undefined) {
                invalidInGroup += 1;
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
                    invalidInGroup += 1;
                }
            } catch {
                invalidInGroup += 1;
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
                        accountCurrency
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

        if (invalidInGroup > 0) {
            warnings.push({
                formulaId: formula.id,
                label: formula.label,
                invalidCount: invalidInGroup,
            });
        }

        if (num !== null) {
            const { formatted } = formatFormulaValue(
                aggregated,
                formula,
                options.sampleRow,
                locale,
                i18nLanguage,
                accountCurrency
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
        const refs =
            formula.expression.match(/\[([^\]]+)\]/g)?.map((t) => t.slice(1, -1)) ||
            [];
        map.set(formula.id, refs);
    }
    return map;
}

export function findFormulasReferencingOperand(
    formulas: ReportFormula[],
    operandReference: string
): ReportFormula[] {
    const needle = operandReference.toLowerCase();
    return formulas.filter((f) =>
        (f.expression.match(/\[([^\]]+)\]/g) || []).some(
            (token) => token.slice(1, -1).toLowerCase() === needle
        )
    );
}

export { getFormulaOperandReference };
