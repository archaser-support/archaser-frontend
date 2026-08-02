import { Warning, WarningAmber } from "@mui/icons-material";
import { Box, Switch, Tooltip, Typography } from "@mui/material";
import { Theme } from "@mui/material/styles";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { TFunction } from "i18next";
import { NextRouter } from "next/router";
import React from "react";

import { resolvePolicyNumberFromReportRow } from "@/shared/customerPolicyAdapter";
import { INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS } from "./invoiceGridRowFields";
import { getAggregationLabelSuffix, translateReportAggregationType } from "./reportAggregationHelpers";
import {
    getFormulaByOutputKey,
    resolveReportColumnOrder,
} from "@/shared/reportFormula/columnOrder";
import {
    isFormulaOutputKey,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import {
    AGGREGATION_OUTPUT_KEY_SUFFIX,
    getFieldOutputKey,
    getLegacyFieldOutputKey,
} from "@/utils/reportTableUtils";
import { LinkHandler } from "./viewConfigs";
import {
    getFieldLabel,
    isAmountField,
    isBooleanField,
    isDateField,
    isEnumField,
    translateEnumValue,
} from "./viewFieldHelpers";

const EMPTY_CELL_PLACEHOLDER = "—";

/** Maps report metadata table `name` to `reports.tables.*` i18n slug. */
const REPORT_TABLE_NAME_TO_I18N_SLUG: Record<string, string> = {
    Customer: "customers",
    Invoice: "invoices",
    Dispute: "disputes",
    Activity: "activities",
    Payment: "payments",
    Contact: "contacts",
    Company: "companies",
    Person: "person",
    AccountBankAccounts: "account_bank_accounts",
    Country: "country",
};

function isCustomerNameFieldConfig(
    fieldConfig: { table?: string; field?: string } | undefined,
    columnKey: string,
    primaryTableName?: string
): boolean {
    if (
        fieldConfig?.table === "Customer" &&
        (fieldConfig.field === "name" || fieldConfig.field === "Company.name")
    ) {
        return true;
    }
    return (
        columnKey === "Customer.name" ||
        columnKey === "Company.name" ||
        (columnKey === "name" &&
            (fieldConfig?.table === "Customer" ||
                primaryTableName === "Customer"))
    );
}

function resolveCustomerIdFromRow(row: any): string | number | undefined {
    if (!row) {
        return undefined;
    }
    if (row.customer_id != null && row.customer_id !== "") {
        return row.customer_id;
    }
    if (row["Customer.id"] != null && row["Customer.id"] !== "") {
        return row["Customer.id"];
    }
    const customer = row.Customer;
    if (customer) {
        const customerData = Array.isArray(customer) ? customer[0] : customer;
        if (customerData?.id != null && customerData.id !== "") {
            return customerData.id;
        }
    }
    // Customer-primary rows: id is the customer id after view transforms.
    if (row.id != null && row.id !== "" && !String(row.id).includes("-")) {
        const numeric = typeof row.id === "number" ? row.id : Number(row.id);
        if (!Number.isNaN(numeric) && numeric > 0) {
            return numeric;
        }
    }
    return undefined;
}

function getReportTableHeaderLabel(
    tableName: string,
    tablesMetadata: any[],
    t: TFunction
): string {
    const slug = REPORT_TABLE_NAME_TO_I18N_SLUG[tableName];
    if (slug) {
        const key = `tables.${slug}`;
        const translated = t(key, {
            ns: "reports",
            defaultValue: "",
        });
        if (translated && translated !== key) {
            return translated;
        }
    }
    const table = tablesMetadata.find((tbl: any) => tbl.name === tableName);
    return table?.label || tableName;
}

function humanizeFieldKey(key: string): string {
    const fieldOnly = key.includes(".") ? key.split(".").pop() || key : key;
    return fieldOnly
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shouldHumanizeLabel(label: string): boolean {
    const trimmed = String(label || "").trim();
    if (!trimmed) {
        return false;
    }
    // Normalize legacy/report-config snake_case labels like "modified_by".
    if (trimmed.includes("_")) {
        return true;
    }
    // Also catch all-lowercase labels that are likely raw keys.
    return /^[a-z0-9 ]+$/.test(trimmed);
}

interface GenerateViewColumnsOptions {
    viewConfig: any;
    rows: any[];
    tablesMetadata: any[];
    context: string;
    tableName: string;
    theme: Theme;
    router: NextRouter;
    i18n: any;
    t: TFunction;
    linkHandlers?: Record<string, LinkHandler>;
    // Optional: custom cell renderers for specific fields
    customCellRenderers?: Record<
        string,
        (params: GridRenderCellParams) => React.ReactNode
    >;
    // Optional: support for aggregation in column headers (for reports)
    enableAggregation?: boolean;
    // Optional: raw data for aggregation calculations (if different from rows)
    rawData?: any[];
    /** Fallback currency for aggregated amount headers when rows lack currency fields */
    accountCurrency?: string;
    /** Grouped report execute: full-dataset COUNT sums for column headers */
    aggregationTotals?: Record<string, number>;
    /** Credit-only accounts: blank category column and hide automation-stuck icon. */
    hideCollectionCategoryDisplay?: boolean;
}

/**
 * Get row value from multiple possible key formats
 */
function getRowValue(
    params: GridRenderCellParams,
    key: string,
    tableName: string,
    fieldConfig?: any
): any {
    // Helper for deep access
    const getDeepValue = (obj: any, path: string) => {
        if (!obj || !path.includes(".")) return undefined;
        const parts = path.split(".");
        let current = obj;
        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }
        return current;
    };

    const isCustomerPolicyNumberField =
        key === "Customer.InsurancePolicy.policy_number" ||
        key === "Customer.policy_id" ||
        key === "Invoice.InsurancePolicy.policy_number" ||
        key === "Invoice.policy_id" ||
        (fieldConfig?.table === "Customer" &&
            (fieldConfig?.field === "InsurancePolicy.policy_number" ||
                fieldConfig?.field === "policy_id")) ||
        (fieldConfig?.table === "Invoice" &&
            (fieldConfig?.field === "InsurancePolicy.policy_number" ||
                fieldConfig?.field === "policy_id"));

    if (isCustomerPolicyNumberField) {
        const policyNumber = resolvePolicyNumberFromReportRow(params.row);
        if (policyNumber != null) {
            return policyNumber;
        }
    }

    // Prefer flat keys first (report rows use "Table.field__AGG" as a single property name)
    if (params.row[key] !== undefined && params.row[key] !== null) {
        return params.row[key];
    }
    if (params.row.raw?.[key] !== undefined && params.row.raw[key] !== null) {
        return params.row.raw[key];
    }

    // Nested path fallback when the row is shaped as { Table: { field: value } }
    if (key.includes(".")) {
        const deepValue = getDeepValue(params.row, key);
        if (deepValue !== undefined && deepValue !== null) return deepValue;

        if (params.row.raw) {
            const rawDeepValue = getDeepValue(params.row.raw, key);
            if (rawDeepValue !== undefined && rawDeepValue !== null) {
                return rawDeepValue;
            }
        }
    }

    // Legacy rows: aggregated value stored under table.field (before __AGG output keys)
    if (AGGREGATION_OUTPUT_KEY_SUFFIX.test(key)) {
        const legacyKey = key.replace(AGGREGATION_OUTPUT_KEY_SUFFIX, "");
        if (legacyKey !== key) {
            if (
                params.row[legacyKey] !== undefined &&
                params.row[legacyKey] !== null
            ) {
                return params.row[legacyKey];
            }
            if (
                params.row.raw?.[legacyKey] !== undefined &&
                params.row.raw[legacyKey] !== null
            ) {
                return params.row.raw[legacyKey];
            }
        }
    }

    // Try using the original field name from fieldConfig if available
    if (fieldConfig?.field) {
        const fieldName = fieldConfig.field;
        if (params.row[fieldName] !== undefined && params.row[fieldName] !== null) {
            return params.row[fieldName];
        }
        if (params.row.raw?.[fieldName] !== undefined && params.row.raw[fieldName] !== null) {
            return params.row.raw[fieldName];
        }

        // Try Table.field if not already tried
        const fullPath = `${fieldConfig.table || tableName}.${fieldName}`;
        if (fullPath !== key) {
            if (params.row[fullPath] !== undefined && params.row[fullPath] !== null) {
                return params.row[fullPath];
            }
            if (params.row.raw?.[fullPath] !== undefined && params.row.raw[fullPath] !== null) {
                return params.row.raw[fullPath];
            }
        }
    }

    // Try alternative key formats for backward compatibility
    if (key.includes(".")) {
        // Key is in "Table.field" format
        const fieldName = key.split(".")[1];

        // Try just the field name
        if (
            params.row[fieldName] !== undefined &&
            params.row[fieldName] !== null
        ) {
            return params.row[fieldName];
        }
        if (
            params.row.raw?.[fieldName] !== undefined &&
            params.row.raw[fieldName] !== null
        ) {
            return params.row.raw[fieldName];
        }

        // Try with different table name (case-insensitive)
        const altKey = `${tableName}.${fieldName}`;
        if (altKey !== key) {
            if (
                params.row[altKey] !== undefined &&
                params.row[altKey] !== null
            ) {
                return params.row[altKey];
            }
            if (
                params.row.raw?.[altKey] !== undefined &&
                params.row.raw[altKey] !== null
            ) {
                return params.row.raw[altKey];
            }
        }
    } else {
        // Key is just field name, try "TableName.field" format
        const tableFieldKey = `${tableName}.${key}`;
        if (
            params.row[tableFieldKey] !== undefined &&
            params.row[tableFieldKey] !== null
        ) {
            return params.row[tableFieldKey];
        }
        if (
            params.row.raw?.[tableFieldKey] !== undefined &&
            params.row.raw[tableFieldKey] !== null
        ) {
            return params.row[tableFieldKey];
        }

        // Also try with common table prefixes if tableName is different
        const prefixes = ["Invoice", "Customer", "Contact", "Activity", "Dispute"];
        for (const pref of prefixes) {
            if (pref !== tableName) {
                const altPrefixKey = `${pref}.${key}`;
                if (params.row[altPrefixKey] !== undefined && params.row[altPrefixKey] !== null) {
                    return params.row[altPrefixKey];
                }
                if (params.row.raw?.[altPrefixKey] !== undefined && params.row.raw[altPrefixKey] !== null) {
                    return params.row.raw[altPrefixKey];
                }
            }
        }
    }

    // One more try: search ALL keys in the row for one ending with .fieldname
    if (!key.includes(".")) {
        const suffix = `.${key}`;
        const foundKey = Object.keys(params.row).find(k => k.endsWith(suffix));
        if (foundKey) return params.row[foundKey];

        if (params.row.raw) {
            const rawFoundKey = Object.keys(params.row.raw).find(k => k.endsWith(suffix));
            if (rawFoundKey) return params.row.raw[rawFoundKey];
        }
    }

    // Finally fallback - try params.value
    if (params.value !== undefined && params.value !== null) {
        return params.value;
    }

    return null;
}

/**
 * Format display value from row value
 */
function formatDisplayValue(
    rowValue: any,
    shouldFormatAmount: boolean,
    shouldFormatDate: boolean
): string {
    // Date and amount formatting is done in the backend
    if (
        (shouldFormatDate || shouldFormatAmount) &&
        rowValue !== null &&
        rowValue !== undefined
    ) {
        return String(rowValue);
    }

    // Handle object/array values
    if (rowValue && typeof rowValue === "object" && !Array.isArray(rowValue)) {
        if (rowValue.name) {
            return String(rowValue.name);
        }
        if (rowValue.current_category) {
            return String(rowValue.current_category);
        }
        return JSON.stringify(rowValue);
    }

    if (Array.isArray(rowValue) && rowValue.length > 0) {
        const firstItem = rowValue[0];
        if (firstItem && typeof firstItem === "object") {
            if (firstItem.current_category) {
                return String(firstItem.current_category);
            }
            if (firstItem.name) {
                return String(firstItem.name);
            }
            return `[${rowValue.length} items]`;
        }
        return String(firstItem);
    }

    return rowValue !== null && rowValue !== undefined ? String(rowValue) : "";
}

/**
 * Generate dynamic columns from view config
 */
export function generateViewColumns(
    options: GenerateViewColumnsOptions
): GridColDef[] {
    const {
        viewConfig,
        rows,
        tablesMetadata,
        context,
        tableName,
        theme,
        router,
        i18n,
        t,
        linkHandlers = {},
        customCellRenderers = {},
        enableAggregation = false,
        rawData,
        accountCurrency,
        aggregationTotals,
        hideCollectionCategoryDisplay = false,
    } = options;

    if (!viewConfig?.fields) {
        return [];
    }

    // Pre-filter viewConfig.fields to exclude any synthetic _formatted fields
    // These may have been saved in old report configs and must be ignored
    const cleanedFields = (viewConfig.fields || []).filter((f: any) => {
        const key = getFieldOutputKey(f);
        return (
            !key.endsWith("_formatted") &&
            !key.startsWith("___formatted_") &&
            !key.startsWith("__formatted_")
        );
    });

    // Drive columns from the report config (stable order), not from Object.keys
    // of the first row. Interleave ordinary fields and formula columns via columnOrder.
    const formulas = (viewConfig.formulas || []) as ReportFormula[];
    let allKeys: string[] = resolveReportColumnOrder(
        cleanedFields,
        formulas,
        viewConfig.columnOrder
    );

    // Get list of explicitly selected field keys from view config (using cleaned fields)
    const selectedFieldKeys = new Set(
        cleanedFields.map((f: any) => getFieldOutputKey(f))
    );
    for (const formula of formulas) {
        selectedFieldKeys.add(
            `formula:${formula.id}`
        );
    }

    const filteredKeys = allKeys.filter((key) => {
        if (isFormulaOutputKey(key)) {
            return selectedFieldKeys.has(key);
        }

        // Exclude ID fields and hidden metadata fields
        const normalizedKey = key.toLowerCase();

        // Check if it's an ID field:
        // 1. Exact match: "id"
        // 2. Ends with "_id": "customer_id", etc.
        // 3. Ends with ".id": "CustomerBanks.id", "Contact.id", etc.
        // 4. Last segment after dot is "id": "Table.id", "Table.field_id", etc.
        const isIdField =
            normalizedKey === "id" ||
            normalizedKey.endsWith("_id") ||
            normalizedKey.endsWith(".id") ||
            normalizedKey.split(".").pop() === "id";
        const isAllowedIdField =
            normalizedKey === "owner_id" ||
            normalizedKey === "policy_id" ||
            normalizedKey.endsWith(".owner_id") ||
            normalizedKey.endsWith(".policy_id");

        // Exclude "name" field if it wasn't explicitly selected
        const isAutoNameField =
            key === "name" && !selectedFieldKeys.has("name");

        // Exclude hidden metadata fields
        const isMetadataField =
            key.startsWith("__") || // Generic internal field prefix
            key.startsWith("___") || // Special formatted field prefix
            key.endsWith("_formatted"); // Backward compatibility for old suffix

        // Ensure the field is explicitly selected in the view configuration
        // We match by the exact key found in Object.keys() which should match alias or Table.field
        // We also allow a match for the field name itself if no table prefix is present in the data
        const isFieldInConfig = selectedFieldKeys.has(key) ||
            cleanedFields.some(
                (f: any) =>
                    f.field === key ||
                    `${f.table}.${f.field}` === key ||
                    getFieldOutputKey(f) === key ||
                    getLegacyFieldOutputKey(f) === key
            );

        // A field is valid only if it's explicitly in the config (or an alias), 
        // AND not an ID field, metadata field, or unselected name field.
        // This prevents phantom columns (like 'status') that might be in the data for formatting but not for display.
        return (
            isFieldInConfig &&
            (!isIdField || isAllowedIdField) &&
            !isMetadataField &&
            !isAutoNameField
        );
    });

    const generatedColumns = filteredKeys.map((key) => {
        if (isFormulaOutputKey(key)) {
            const formula = getFormulaByOutputKey(formulas, key);
            return {
                field: key,
                headerName: formula?.label || key,
                flex: 1,
                minWidth: 150,
                sortable: false,
                renderCell: (params: any) => {
                    const formattedKey = `___formatted_${key}`;
                    const display =
                        params.row?.[formattedKey] ??
                        params.row?.raw?.[formattedKey] ??
                        params.value;
                    return display === null || display === undefined
                        ? EMPTY_CELL_PLACEHOLDER
                        : String(display);
                },
            } as GridColDef;
        }

        // Find matching field config (use cleanedFields to exclude any _formatted fields)
        const fieldConfig = cleanedFields.find(
            (f: any) =>
                getFieldOutputKey(f) === key || getLegacyFieldOutputKey(f) === key
        );

        // Get translated label
        let label = fieldConfig?.alias;

        // If alias exists, try to translate it first, otherwise use field label
        if (label && fieldConfig) {
            // Try to translate the alias using the field's translation namespace and key
            const fieldLabel = getFieldLabel(
                fieldConfig.table,
                fieldConfig.field,
                tablesMetadata,
                t,
                context
            );
            // Use the translated field label instead of the raw alias
            label = fieldLabel;
        } else if (!label && fieldConfig) {
            const fieldLabel = getFieldLabel(
                fieldConfig.table,
                fieldConfig.field,
                tablesMetadata,
                t,
                context
            );

            label = fieldLabel;
        }

        // COUNT: show owning table in the header (not the counted field name, e.g. "id")
        if (
            enableAggregation &&
            fieldConfig?.aggregation === "COUNT" &&
            fieldConfig?.table
        ) {
            label = getReportTableHeaderLabel(
                fieldConfig.table,
                tablesMetadata,
                t
            );
        }

        // Add aggregation suffix if enabled
        if (enableAggregation && fieldConfig?.aggregation) {
            const dataForAggregation = rawData || rows;
            const omitRedundantAggInHeader = !fieldConfig?.alias;
            if (omitRedundantAggInHeader && label) {
                label = `${label} ${translateReportAggregationType(fieldConfig.aggregation, t)}`;
            }
            const aggregationSuffix = getAggregationLabelSuffix(
                fieldConfig,
                dataForAggregation,
                key,
                tablesMetadata,
                i18n,
                accountCurrency,
                omitRedundantAggInHeader,
                aggregationTotals,
                t
            );
            if (label && aggregationSuffix) {
                label = label + aggregationSuffix;
            }
        }

        if (!label) {
            // Fix common typos in field names before using as label
            const normalizedKey = key
                .replace(/^prent_customner_name$/i, "parent_customer_name") // Fix typo: prent_customner -> parent_customer
                .replace(/^parent_customner_name$/i, "parent_customer_name") // Fix typo: customner -> customer
                .replace(/^prent_customer_name$/i, "parent_customer_name"); // Fix typo: prent -> parent

            // Try to get label using the normalized key
            // First try to find field config with normalized name
            if (normalizedKey !== key) {
                const correctedFieldConfig = viewConfig.fields.find(
                    (f: any) => getFieldOutputKey(f) === normalizedKey
                );
                if (correctedFieldConfig) {
                    label = getFieldLabel(
                        correctedFieldConfig.table,
                        correctedFieldConfig.field,
                        tablesMetadata,
                        t,
                        context
                    );
                } else {
                    // Try to get label for normalized key directly
                    label = getFieldLabel(
                        tableName,
                        normalizedKey,
                        tablesMetadata,
                        t,
                        context
                    );
                    // If still no label, use normalized key
                    if (!label) {
                        label = normalizedKey;
                    }
                }
            } else {
                // No normalization needed, but still try to get translated label
                label = getFieldLabel(
                    tableName,
                    key,
                    tablesMetadata,
                    t,
                    context
                );
                // Final fallback: use key as label
                if (!label) {
                    label = humanizeFieldKey(key);
                }
            }
        }

        if (label && shouldHumanizeLabel(label)) {
            label = humanizeFieldKey(label);
        }

        // Check field types
        const shouldFormatAmount = isAmountField(fieldConfig, tablesMetadata);
        const shouldFormatDate = isDateField(fieldConfig, tablesMetadata);
        const shouldTranslateEnum =
            isEnumField(fieldConfig, tablesMetadata) ||
            fieldConfig?.field === "call_outcome" ||
            fieldConfig?.field === "call_direction";
        const shouldRenderAsSwitch = isBooleanField(fieldConfig, tablesMetadata);

        // Check if custom renderer exists
        // Match by key EXACT match (alias or Table.field)
        // Match by field name (e.g. "email" or "customer_amount")
        // Match by table.field path (e.g. "Contact.email")
        const renderer = customCellRenderers[key] ||
            (fieldConfig ? customCellRenderers[fieldConfig.field] : null) ||
            (fieldConfig ? customCellRenderers[`${fieldConfig.table}.${fieldConfig.field}`] : null);

        if (renderer) {
            // Use width/flex/minWidth from fieldConfig if provided, otherwise use defaults
            const columnWidth = fieldConfig?.width;
            const columnFlex = fieldConfig?.flex;
            const columnMinWidth = fieldConfig?.minWidth;

            return {
                field: key,
                headerName: label,
                flex: columnFlex !== undefined ? columnFlex : (columnWidth ? 0 : 1),
                width: columnWidth,
                minWidth: columnMinWidth !== undefined ? columnMinWidth : 150,
                sortable: true,
                hideable: true,
                renderCell: renderer,
                valueGetter: (params: any) => {
                    return getRowValue(
                        {
                            row: params.row,
                            value: params.value,
                            field: key,
                        } as GridRenderCellParams,
                        key,
                        tableName,
                        fieldConfig
                    );
                },
            };
        }

        const fieldShortName =
            fieldConfig?.field ??
            (key.includes(".") ? key.split(".").pop() : null) ??
            key;

        const isReportingBreachField =
            fieldShortName === "reporting_breach" ||
            key === "reporting_breach" ||
            key.endsWith(".reporting_breach");
        const isOverdueBlockField =
            fieldShortName === "overdue_block" ||
            key === "overdue_block" ||
            key.endsWith(".overdue_block");

        /** Credit-insurance violation booleans: show warning only when true; false = empty cell */
        const isCtvViolationBooleanField =
            typeof fieldShortName === "string" &&
            fieldShortName.startsWith("ctv_");

        const isBreachIconField =
            isReportingBreachField ||
            isCtvViolationBooleanField ||
            isOverdueBlockField;

        // Render boolean fields as read-only switches
        if (shouldRenderAsSwitch) {
            // Use width/flex/minWidth from fieldConfig if provided, otherwise use defaults
            const columnWidth = fieldConfig?.width;
            const columnFlex = fieldConfig?.flex;
            const columnMinWidth = fieldConfig?.minWidth;

            return {
                field: key,
                headerName: label,
                flex: columnFlex !== undefined ? columnFlex : (columnWidth ? 0 : 1),
                width: columnWidth,
                minWidth: columnMinWidth !== undefined ? columnMinWidth : 150,
                sortable: true,
                hideable: true,
                valueGetter: (params: any) => {
                    return getRowValue(
                        {
                            row: params.row,
                            value: params.value,
                            field: key,
                        } as GridRenderCellParams,
                        key,
                        tableName,
                        fieldConfig
                    );
                },
                renderCell: (params: GridRenderCellParams) => {
                    const rowValue = getRowValue(params, key, tableName, fieldConfig);
                    // Convert value to boolean (handle various formats: true/false, 1/0, "true"/"false")
                    const boolValue =
                        rowValue === true ||
                        rowValue === 1 ||
                        rowValue === "true" ||
                        rowValue === "1";

                    if (isBreachIconField) {
                        const violationMeta =
                            INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS.find(
                                (v) => v.field === fieldShortName
                            );
                        const breachTooltipWhenTrue = violationMeta
                            ? t(violationMeta.labelKey, {
                                  ns: "customers",
                              })
                            : isOverdueBlockField
                              ? t("fields.overdue_block", {
                                    ns: "customers",
                                    defaultValue: "Overdue block",
                                })
                              : fieldShortName;

                        if (!boolValue) {
                            return (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        height: "100%",
                                        width: "100%",
                                    }}
                                />
                            );
                        }

                        return (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
                                    width: "100%",
                                }}
                            >
                                <Tooltip title={breachTooltipWhenTrue} arrow>
                                    <Box
                                        component="span"
                                        sx={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                        }}
                                    >
                                        <WarningAmber
                                            sx={{
                                                fontSize: 18,
                                                color: theme.palette.error.main,
                                            }}
                                        />
                                    </Box>
                                </Tooltip>
                            </Box>
                        );
                    }
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                            }}
                        >
                            <Switch
                                checked={!!boolValue}
                                disabled
                                color="primary"
                            />
                        </Box>
                    );
                },
            };
        }

        // Use width/flex/minWidth from fieldConfig if provided, otherwise use defaults
        const columnWidth = fieldConfig?.width;
        const columnFlex = fieldConfig?.flex;
        const columnMinWidth = fieldConfig?.minWidth;

        const finalColumn = {
            field: key,
            headerName: label,
            flex: columnFlex !== undefined ? columnFlex : (columnWidth ? 0 : 1),
            width: columnWidth,
            minWidth: columnMinWidth !== undefined ? columnMinWidth : 150,
            sortable: true,
            hideable: true,
            // Use valueGetter to ensure we get the value even if the field name doesn't match exactly
            valueGetter: (params: any) => {
                return getRowValue(
                    {
                        row: params.row,
                        value: params.value,
                        field: key,
                    } as GridRenderCellParams,
                    key,
                    tableName,
                    fieldConfig
                );
            },
            renderCell: (params: GridRenderCellParams) => {
                if (
                    (fieldConfig?.table === "Customer" ||
                        fieldConfig?.table === "Invoice") &&
                    (fieldConfig?.field === "policy_id" ||
                        fieldConfig?.field === "InsurancePolicy.policy_number")
                ) {
                    const policyNumber = resolvePolicyNumberFromReportRow(
                        params.row
                    );
                    if (policyNumber != null) {
                        return (
                            <Typography variant="body2">
                                {policyNumber}
                            </Typography>
                        );
                    }
                }

                // Check if there's a pre-formatted version of this field in the row
                // This allows the backend to provide localized/formatted currency strings
                // Try three possible keys:
                // 1. Triple-underscore prefix (new standard) - handles alias and Table.field
                // 2. Double-underscore prefix (internal standard)
                // 3. _formatted suffix (legacy)
                const formattedKeyNew = `___formatted_${key}`;
                const formattedKeyAlt = `__formatted_${key}`;
                const formattedKeyLegacy = `${key}_formatted`;

                // Also check for table-prefixed key if the key doesn't already have one
                // This handles cases where backend returns "___formatted_Table.field" but frontend uses "field"
                const formattedKeyTable = !key.includes('.') && tableName ? `___formatted_${tableName}.${key}` : null;

                const formattedValue =
                    params.row[formattedKeyNew] ?? params.row.raw?.[formattedKeyNew] ??
                    (formattedKeyTable ? (params.row[formattedKeyTable] ?? params.row.raw?.[formattedKeyTable]) : undefined) ??
                    params.row[formattedKeyAlt] ?? params.row.raw?.[formattedKeyAlt] ??
                    params.row[formattedKeyLegacy] ?? params.row.raw?.[formattedKeyLegacy];

                const hasFormattedDisplay =
                    formattedValue !== undefined &&
                    formattedValue !== null &&
                    String(formattedValue).trim() !== "";

                // Prefer backend-provided display text, but do NOT return early —
                // Nest always emits ___formatted_* and early return skipped link rendering.
                let displayValue: string;
                if (hasFormattedDisplay) {
                    displayValue = String(formattedValue);
                } else {
                    const rowValue = getRowValue(
                        params,
                        key,
                        tableName,
                        fieldConfig
                    );
                    displayValue = formatDisplayValue(
                        rowValue,
                        shouldFormatAmount,
                        shouldFormatDate
                    );
                }

                const isCategoryField =
                    fieldConfig?.field === "category" ||
                    key === "category" ||
                    key === "current_category";

                if (hideCollectionCategoryDisplay && isCategoryField) {
                    return (
                        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                            —
                        </Typography>
                    );
                }

                // Handle currency display if configured (backward compatibility)
                if (
                    !hasFormattedDisplay &&
                    shouldFormatAmount &&
                    viewConfig.currencyColumns?.[key]
                ) {
                    const currencyConfig = viewConfig.currencyColumns[key];
                    if (currencyConfig.currencyField) {
                        const currencyValue = getRowValue(
                            params,
                            currencyConfig.currencyField,
                            tableName
                        );

                        if (currencyValue && displayValue !== "" && displayValue !== "-") {
                            // Format: "AUD 100.00"
                            displayValue = `${currencyValue} ${displayValue}`;
                        }
                    }
                }

                // Translate enum values if this is an enum field.
                // Deliberately not gated on hasFormattedDisplay: the backend emits
                // ___formatted_* for every field and passes enum members through
                // verbatim, so gating here left raw values like "Under_Review" on
                // screen. translateEnumValue falls back to title-casing, so running
                // it over an already-human value is a no-op.
                if (
                    shouldTranslateEnum &&
                    displayValue !== "" &&
                    displayValue !== "-"
                ) {
                    // Special handling for category field: extract base category for translation
                    const isCategoryFieldForEnum =
                        fieldConfig?.field === "category" ||
                        key === "category" ||
                        key === "current_category";

                    if (isCategoryFieldForEnum && displayValue.includes(" (")) {
                        // Extract base category and step from formatted value (e.g., "Automated (2)")
                        const match = displayValue.match(/^(.+?)\s*\((\d+)\)$/);
                        if (match) {
                            const baseCategory = match[1];
                            const stepValue = match[2];
                            const translatedCategory = translateEnumValue(
                                fieldConfig,
                                baseCategory,
                                t,
                                context,
                                tablesMetadata
                            );
                            displayValue = `${translatedCategory} (${stepValue})`;
                        } else {
                            displayValue = translateEnumValue(
                                fieldConfig,
                                displayValue,
                                t,
                                context,
                                tablesMetadata
                            );
                        }
                    } else {
                        displayValue = translateEnumValue(
                            fieldConfig,
                            displayValue,
                            t,
                            context,
                            tablesMetadata
                        );
                    }
                }

                // Check for automation_stuck metadata for category field (warning icon)
                const isCategoryFieldForStuck =
                    fieldConfig?.field === "category" ||
                    key === "category" ||
                    key === "current_category";

                let automationStuck = false;
                if (isCategoryFieldForStuck) {
                    const automationStuckKey = `__automation_stuck_${key}`;
                    automationStuck =
                        params.row[automationStuckKey] ||
                        params.row.raw?.[automationStuckKey] ||
                        params.row.automation_stuck_no_contacts ||
                        params.row.raw?.automation_stuck_no_contacts ||
                        false;
                }

                // Check if this is "Automated" category (after translation)
                const isAutomatedCategory =
                    isCategoryFieldForStuck &&
                    (displayValue.includes("Automated") ||
                        displayValue.includes(
                            t("values.category_automated", { ns: context }) ||
                            "Automated"
                        ));

                // Show warning icon for Automated category when automation_stuck is true
                if (
                    isAutomatedCategory &&
                    automationStuck &&
                    displayValue !== "" &&
                    displayValue !== "-"
                ) {
                    return (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                                gap: theme.spacing(0.5),
                            }}
                        >
                            <Typography key="automated-value" variant="body2">
                                {displayValue}
                            </Typography>
                            <Tooltip
                                key="automated-warning"
                                title={t(
                                    "messages.stuck_activity_notification"
                                )}
                                arrow
                                placement="bottom"
                                componentsProps={{
                                    tooltip: {
                                        sx: {
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        },
                                    },
                                }}
                            >
                                <Warning
                                    sx={{
                                        fontSize: 16,
                                        color: theme.palette.warning.main,
                                        cursor: "help",
                                    }}
                                />
                            </Tooltip>
                        </Box>
                    );
                }

                // Check for link metadata from backend (__link_${key} field)
                const linkKey = `__link_${key}`;
                const linkMetadata =
                    params.row[linkKey] ||
                    params.row.raw?.[linkKey] ||
                    (key === "name"
                        ? params.row["__link_Customer.name"] ||
                          params.row.raw?.["__link_Customer.name"]
                        : undefined) ||
                    (key === "Customer.name"
                        ? params.row["__link_name"] ||
                          params.row.raw?.["__link_name"]
                        : undefined);

                if (
                    linkMetadata &&
                    displayValue !== "" &&
                    displayValue !== "-" &&
                    linkMetadata.id
                ) {
                    const { type, id, tab } = linkMetadata;

                    // Use link handler if available
                    if (linkHandlers[type]) {
                        try {
                            // Validate id is a valid number
                            const numericId = typeof id === "number" ? id : Number(id);
                            if (isNaN(numericId) || numericId <= 0) {
                                // Invalid ID, don't render as link
                                return <Typography variant="body2">{displayValue}</Typography>;
                            }

                            const url = linkHandlers[type](numericId, tab);

                            // Validate URL is valid before using it
                            if (!url || typeof url !== "string" || url.trim() === "") {
                                // Invalid URL, don't render as link
                                return <Typography variant="body2">{displayValue}</Typography>;
                            }

                            return (
                                <Typography
                                    variant="body2"
                                    data-cell-link="true"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        try {
                                            router.push(url);
                                        } catch (error) {
                                            // Handle navigation errors gracefully
                                            console.error(
                                                "[viewColumnGenerator] Navigation error:",
                                                {
                                                    url,
                                                    type,
                                                    id: numericId,
                                                    error: error instanceof Error ? error.message : String(error),
                                                }
                                            );
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        // Also stop propagation on mousedown to prevent row selection
                                        e.stopPropagation();
                                    }}
                                    sx={{
                                        color: theme.palette.primary.main,
                                        cursor: "pointer",
                                        // CRITICAL: Override parent's pointerEvents: "none" to allow link to receive clicks
                                        pointerEvents: "auto",
                                        textDecoration: "underline",
                                        textUnderlineOffset: "0.125em",
                                        "&:hover": {
                                            color: theme.palette.primary.dark,
                                            textDecoration: "underline",
                                        },
                                    }}
                                >
                                    {displayValue}
                                </Typography>
                            );
                        } catch (error) {
                            // Handle link handler errors gracefully
                            console.error(
                                "[viewColumnGenerator] Link handler error:",
                                {
                                    type,
                                    id,
                                    tab,
                                    error: error instanceof Error ? error.message : String(error),
                                }
                            );
                            // Fall back to non-link display
                            return <Typography variant="body2">{displayValue}</Typography>;
                        }
                    }
                }

                // Fallback: customer name with customer_id but missing __link_ metadata (e.g. legacy grouped rows)
                if (
                    isCustomerNameFieldConfig(fieldConfig, key, tableName) &&
                    linkHandlers.customer &&
                    displayValue !== "" &&
                    displayValue !== "-"
                ) {
                    const customerId = resolveCustomerIdFromRow(
                        params.row.raw ?? params.row
                    );
                    if (customerId != null) {
                        const numericId =
                            typeof customerId === "number"
                                ? customerId
                                : Number(customerId);
                        if (!Number.isNaN(numericId) && numericId > 0) {
                            const url = linkHandlers.customer(numericId);
                            if (url?.trim()) {
                                return (
                                    <Typography
                                        variant="body2"
                                        data-cell-link="true"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            router.push(url);
                                        }}
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                        }}
                                        sx={{
                                            color: theme.palette.primary.main,
                                            cursor: "pointer",
                                            pointerEvents: "auto",
                                            textDecoration: "underline",
                                            textUnderlineOffset: "0.125em",
                                            "&:hover": {
                                                color: theme.palette.primary.dark,
                                                textDecoration: "underline",
                                            },
                                        }}
                                    >
                                        {displayValue}
                                    </Typography>
                                );
                            }
                        }
                    }
                }

                // Don't render anything if displayValue is empty
                if (!displayValue || displayValue === "" || displayValue === "-") {
                    return (
                        <Typography variant="body2">
                            {EMPTY_CELL_PLACEHOLDER}
                        </Typography>
                    );
                }

                return <Typography variant="body2">{displayValue}</Typography>;
            },
        };

        return finalColumn;
    });

    return generatedColumns;
}
