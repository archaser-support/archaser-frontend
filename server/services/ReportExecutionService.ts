import { Prisma } from "@prisma/client";

import { LogService } from "./LogService";
import { isCreditOnlyAccount } from "@/shared/utils/accountProducts";
import {
    DATE_FIELDS_BY_TABLE,
    DATE_INDICATORS,
    getUserRelationNameForReportTable,
    IN_MEMORY_SORT_THRESHOLD,
    MODEL_NAME_MAP,
    ONE_TO_MANY_MAP,
    RELATION_MAP,
    TABLES_WITH_ACCOUNT_ID_SET,
} from "./ReportExecutionService.constants";
import {
    CreditInsuranceProductDisabledForReportError,
    DatabaseQueryError,
    QueryBuildError,
    ReportNotFoundError,
    UnauthorizedReportError,
} from "./ReportExecutionService.errors";
import {
    AggregationCalculator,
    FilterOperatorNormalizer,
    SpecialFieldHandler,
} from "./ReportExecutionService.helpers";
import {
    AggregationType,
    ExecuteReportParams,
    FieldConfig,
    Filter,
    OneToManyRelationTable,
    ReportExecutionResult,
} from "./ReportExecutionService.types";
import {
    formatTermsBreachReasonForDisplay,
    getVirtualFieldConfig,
} from "./ReportExecutionService.virtualFields";
import {
    enrichCreditDashboardCustomerRows,
    fetchTopUpExpiringReportAsCustomerRows,
    isCreditDashboardEnrichedSortField,
    reportConfigNeedsCreditDashboardEnrichment,
    sortCreditDashboardEnrichedRows,
} from "./creditInsurance/creditDashboardReportEnrichment";
import { getLimitWarningReport } from "./creditInsurance/creditInsuranceDashboardService";
import { ReportQueryBuilder } from "./ReportQueryBuilder";
import { REPORT_METADATA } from "./reportMetadata";
import { ReportConfig } from "./ReportService";
import {
    aggregateFormulaColumnsInGroupedRows,
    applyFormulasToRows, mergeFormulaOperandFieldsIntoConfig,
} from "./reportFormulaExecution";

import { prisma } from "@/lib/prisma";
import {
    extractCustomerPolicyReportField,
    isCustomerPolicyBackedReportField,
} from "@/server/utils/reportCustomerPolicyFields";
import {
    extractCustomerTrendCostReportField,
    formatCostCalculationMethodLabel,
    isTrendCostBackedReportField,
} from "@/server/utils/reportCustomerTrendCostFields";
import { resolveInvoiceAmountFieldCurrency } from "@/server/utils/reportInvoiceAmountCurrency";
import {
    isCustomerReportCurrencyAmountField,
    resolveCustomerAmountFieldCurrency,
} from "@/server/utils/reportCustomerAmountCurrency";
import {
    extractInvoicePolicyReportField,
    isInvoicePolicyReportField,
    isInvoiceReportPolicyNumberField,
    resolvePolicyNumberForInvoiceReportRow,
} from "@/server/utils/reportInvoicePolicyFields";
import {
    getFieldOutputKey,
    getLegacyFieldOutputKey,
    resolveLegacyFieldOutputKey,
} from "@/utils/reportTableUtils";
import {
    isDatePresetValue,
    isPeriodPreset,
    resolveDatePreset,
    resolveDatePresetRange,
} from "@/utils/datePresetUtils";
import { LogLevel } from "@/types/enums";
import { formatDateForDisplay } from "@/utils/datetimeOperations";
import { reportConfigReferencesCreditInsuranceFields } from "@/server/utils/reportCreditInsuranceFieldUsage";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

export class ReportExecutionService {
    private static instance: ReportExecutionService;
    private logService = LogService.getInstance();
    private queryBuilder: ReportQueryBuilder;

    public static getInstance(): ReportExecutionService {
        if (!ReportExecutionService.instance) {
            ReportExecutionService.instance = new ReportExecutionService();
        }
        return ReportExecutionService.instance;
    }

    private constructor() {
        this.queryBuilder = new ReportQueryBuilder(this.logService);
    }

    /**
     * Get report by ID
     */
    private async getReport(reportId: number): Promise<any> {
        const report = await (prisma as any).report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            throw new ReportNotFoundError(reportId, 0); // accountId not available here
        }

        return report;
    }

    /**
     * Validate user has access to execute the report
     */
    private validateReportAccess(report: any, accountId: number): void {
        const isOwnReport = report.account_id === accountId;
        const isSystemReport = (report as any).is_system === true;
        const isPublicReport = (report as any).is_public === true;

        if (!isOwnReport && !isSystemReport && !isPublicReport) {
            throw new UnauthorizedReportError(report.id, accountId);
        }
    }

    private static readonly INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS: string[] =
        [
            "reporting_breach",
            "ctv_payment_term",
            "ctv_customer_overdue_mep",
            "ctv_customer_excluded_from_policy",
            "ctv_outdated_dcl",
            "ctv_invoice_after_policy_end",
        ];

    /**
     * Merge Invoice violation booleans into the report select so grids can show a
     * summary column without editing each saved view.
     */
    private mergeInvoiceCreditInsuranceViolationFieldsIntoConfig(
        config: ReportConfig
    ): ReportConfig {
        const fields = [...(config.fields || [])];
        const existing = new Set(
            fields.map((f: FieldConfig) => `${f.table}.${f.field}`)
        );
        for (const fieldName of ReportExecutionService.INVOICE_CREDIT_INSURANCE_VIOLATION_FIELDS) {
            const key = `Invoice.${fieldName}`;
            if (!existing.has(key)) {
                fields.push({ table: "Invoice", field: fieldName });
                existing.add(key);
            }
        }
        return { ...config, fields };
    }

    /**
     * Check if a field is an ID field
     */
    private isIdField(fieldName: string): boolean {
        const normalizedName = fieldName.toLowerCase();
        // Check for exact match: "id"
        if (normalizedName === "id") {
            return true;
        }
        // Check for fields ending with "_id"
        if (normalizedName.endsWith("_id")) {
            return true;
        }
        return false;
    }

    /**
     * Normalize enum filter values based on REPORT_METADATA so Prisma receives
     * canonical enum values (e.g. SCHEDULED, SENT) even if filters contain
     * human-readable variants (e.g. "Scheduled", "Sent").
     */
    private normalizeEnumFilterValue(
        table: string,
        field: string,
        value: any
    ): any {
        if (value === null || value === undefined) return value;

        const tableMeta = REPORT_METADATA.tables.find(
            (t) => t.name === table
        );
        if (!tableMeta) return value;

        const fieldMeta = tableMeta.fields.find((f) => f.name === field);
        if (!fieldMeta || fieldMeta.type !== "enum") {
            return value;
        }

        const normalizeKey = (v: string) =>
            v.toString().trim().toLowerCase().replace(/\s+/g, "_");

        // Build lookup from normalized form to canonical option
        const optionMap = new Map<string, string>();
        const options = fieldMeta.options || [];
        if (options.length === 0) {
            return value;
        }

        for (const opt of options) {
            optionMap.set(normalizeKey(opt), opt);
        }

        const normalizeSingle = (v: any) => {
            if (typeof v !== "string") return v;

            // First try direct case-insensitive match against options
            const direct = options.find(
                (opt) => opt.toLowerCase() === v.toLowerCase()
            );
            if (direct) return direct;

            // Then try normalized key mapping (handles spaces/underscores)
            const mapped = optionMap.get(normalizeKey(v));
            return mapped ?? v;
        };

        if (Array.isArray(value)) {
            return value.map((v) => normalizeSingle(v));
        }

        return normalizeSingle(value);
    }

    /**
     * Check if a field is a date or datetime field
     */
    private isDateField(table: string, field: string): boolean {
        // Check if field name suggests it's a date field
        const fieldLower = field.toLowerCase();
        if (
            DATE_INDICATORS.some((indicator) => fieldLower.includes(indicator))
        ) {
            return true;
        }

        // Check table-specific date fields
        return DATE_FIELDS_BY_TABLE[table]?.includes(field) || false;
    }

    /**
     * Check if a field is an amount/currency field
     */
    private isAmountField(field: string): boolean {
        const fieldLower = field.toLowerCase();
        return (
            fieldLower.includes("amount") ||
            fieldLower.includes("price") ||
            fieldLower.includes("cost") ||
            fieldLower.includes("debt") ||
            fieldLower.includes("balance") ||
            fieldLower.includes("total_invoices_overdue") ||
            fieldLower === "overdue_sum" ||
            fieldLower.includes("outstanding")
        );
    }

    /** Trend cost amounts use separate currency columns — no combined FX formatting. */
    private shouldFormatFieldAsCurrency(
        table: string,
        field: string
    ): boolean {
        if (
            table === "Customer" &&
            isCustomerReportCurrencyAmountField(field)
        ) {
            return true;
        }
        return (
            this.isAmountField(field) &&
            !(table === "Customer" && isTrendCostBackedReportField(field))
        );
    }

    /**
     * Determine if a field should be clickable and return link metadata
     * Returns { type: string, id: number | string } | null
     *
     * @param fieldConfig - The field configuration
     * @param row - The primary row data (may contain relations)
     * @param primaryTable - The primary table name
     * @param outputKey - The output key for the field (alias or table.field)
     * @param relatedRecord - Optional related record (for one-to-many relations)
     */
    private getFieldLinkMetadata(
        fieldConfig: FieldConfig,
        row: any,
        primaryTable: string,
        outputKey: string,
        relatedRecord?: any
    ): { type: string; id: number | string; tab?: string } | null {
        // Helper to get customer ID from various locations
        const getCustomerId = (): number | string | undefined => {
            // If Customer is primary table
            if (primaryTable === "Customer") {
                return row.id || row.customer_id;
            }

            // If Customer is joined table, try various locations
            if (row.Customer) {
                const customerData = Array.isArray(row.Customer)
                    ? row.Customer[0]
                    : row.Customer;
                if (customerData?.id) {
                    return customerData.id;
                }
            }

            // Try direct customer_id field
            if (row.customer_id) {
                return row.customer_id;
            }

            // Try Customer.id format
            if (row["Customer.id"]) {
                return row["Customer.id"];
            }

            return undefined;
        };

        // Customer name fields - handle all variations
        const isCustomerNameField =
            (fieldConfig.table === "Customer" &&
                (fieldConfig.field === "name" ||
                    fieldConfig.field === "Company.name" ||
                    SpecialFieldHandler.shouldMapToCompany(
                        fieldConfig.table,
                        fieldConfig.field
                    ))) ||
            outputKey === "Customer.name" ||
            outputKey === "Company.name" ||
            (primaryTable === "Customer" && outputKey === "name");

        if (isCustomerNameField) {
            const customerId = getCustomerId();
            if (customerId) {
                // Customer name links should not include tab parameter
                return { type: "customer", id: customerId };
            }
        }

        // Parent customer name field
        const isParentCustomerNameField =
            (fieldConfig.table === "Customer" &&
                fieldConfig.field === "parent_customer_name") ||
            outputKey === "Customer.parent_customer_name" ||
            outputKey === "parent_customer_name";

        if (isParentCustomerNameField) {
            // Get parent customer ID from various locations
            let parentCustomerId: number | string | undefined;

            // Try direct field first
            if (row.parent_customer_id) {
                parentCustomerId = row.parent_customer_id;
            }
            // Try ParentCustomer relation
            else if (row.ParentCustomer) {
                const parentCustomer = Array.isArray(row.ParentCustomer)
                    ? row.ParentCustomer[0]
                    : row.ParentCustomer;
                if (parentCustomer?.id) {
                    parentCustomerId = parentCustomer.id;
                }
            }
            // Try ParentCustomer.id format
            else if (row["ParentCustomer.id"]) {
                parentCustomerId = row["ParentCustomer.id"];
            }

            if (parentCustomerId) {
                return {
                    type: "customer",
                    id: parentCustomerId,
                    tab: "aggregated_data",
                };
            }
        }

        // Contact name fields (first_name, last_name)
        const isContactNameField =
            (fieldConfig.table === "Contact" &&
                (fieldConfig.field === "first_name" ||
                    fieldConfig.field === "last_name")) ||
            outputKey === "Contact.first_name" ||
            outputKey === "Contact.last_name" ||
            (primaryTable === "Contact" &&
                (outputKey === "first_name" || outputKey === "last_name"));

        if (isContactNameField) {
            let customerId: number | string | undefined;

            if (primaryTable === "Contact") {
                // Contact is primary - customer_id should be directly in row
                customerId = row.customer_id;
            } else if (relatedRecord && fieldConfig.table === "Contact") {
                // Contact is in a one-to-many relation - get customer_id from related record
                customerId = relatedRecord.customer_id;
            } else {
                // Contact is joined - try various locations
                // First try Contact relation
                if (row.Contact) {
                    const contactData = Array.isArray(row.Contact)
                        ? row.Contact[0]
                        : row.Contact;
                    if (contactData?.customer_id) {
                        customerId = contactData.customer_id;
                    }
                }

                // If not found, try other locations
                if (!customerId) {
                    customerId =
                        row.customer_id ||
                        row["Contact.customer_id"] ||
                        getCustomerId(); // Fallback to general customer ID lookup
                }
            }

            if (customerId) {
                return { type: "customer", id: customerId, tab: "general" };
            }
        }

        // Dispute number field - link to customer page with dispute dialog open
        const isDisputeNumberField =
            (fieldConfig.table === "Dispute" &&
                fieldConfig.field === "dispute_number") ||
            outputKey === "Dispute.dispute_number" ||
            (primaryTable === "Dispute" && outputKey === "dispute_number");

        if (isDisputeNumberField) {
            // Get the customer ID from the Dispute's Customer relation
            let customerId: number | string | undefined;
            const disputeId = row.id;

            // Try to get customer_id from various locations
            if (row.Customer) {
                const customerData = Array.isArray(row.Customer)
                    ? row.Customer[0]
                    : row.Customer;
                if (customerData?.id) {
                    customerId = customerData.id;
                }
            } else if (row.customer_id) {
                customerId = row.customer_id;
            } else if (row["Customer.id"]) {
                customerId = row["Customer.id"];
            }

            if (customerId && disputeId) {
                return {
                    type: "dispute",
                    id: customerId,
                    tab: `outstanding-activities-tab&openDispute=${disputeId}`,
                };
            }
        }

        return null;
    }


    /**
     * Get Prisma relation name from table names
     * Maps table names to Prisma relation field names
     * Uses caching for performance
     */
    private getRelationName(fromTable: string, toTable: string): string | null {
        return RELATION_MAP[fromTable]?.[toTable] || null;
    }

    /**
     * Check if a relation is one-to-many (returns array) or one-to-one
     * For now, we assume Customer -> Person/Company are one-to-one
     * and Customer -> Invoice/Contact are one-to-many
     */
    private isOneToManyRelation(fromTable: string, toTable: string): boolean {
        return ONE_TO_MANY_MAP[fromTable]?.includes(toTable) || false;
    }

    /**
     * Get foreign key field name for a relation
     * e.g., Customer -> Invoice: returns "customer_id"
     */
    private getForeignKeyFieldName(fromTable: string): string {
        // Convert table name to lowercase and add _id suffix
        return `${fromTable.toLowerCase()}_id`;
    }

    /**
     * Extract nested value from data row for sorting
     */
    private extractNestedValue(row: any, fieldPath: string): any {
        if (!fieldPath.includes(".")) {
            return row[fieldPath];
        }

        const [relationName, ...relationFieldParts] = fieldPath.split(".");
        const relationFieldPath = relationFieldParts.join(".");
        const relationData = row[relationName];

        if (!relationData) {
            return null;
        }

        // Handle array (one-to-many)
        if (Array.isArray(relationData)) {
            return relationData.length > 0
                ? this.extractNestedValueFromObject(
                      relationData[0],
                      relationFieldPath
                  )
                : null;
        }

        // Handle object (one-to-one or many-to-one)
        // Keep falsy-but-valid values (0/false/"") instead of collapsing to null.
        return (
            this.extractNestedValueFromObject(relationData, relationFieldPath) ??
            null
        );
    }

    private extractNestedValueFromObject(
        value: any,
        path: string
    ): any {
        if (value == null) {
            return null;
        }
        if (!path) {
            return value;
        }
        return path
            .split(".")
            .reduce(
                (current: any, segment: string) =>
                    current == null ? null : current[segment],
                value
            );
    }

    private isLegacyLocationField(table: string, field: string): boolean {
        return (
            (table === "Customer" || table === "Company") &&
            (field === "country" || field === "state")
        );
    }

    private extractLegacyLocationValue(row: any, field: string): any {
        if (!row) {
            return null;
        }
        if (field === "country") {
            return (
                row.Country?.name ??
                row.country?.name ??
                row["Country.name"] ??
                null
            );
        }
        if (field === "state") {
            return (
                row.State?.name ??
                row.state?.name ??
                row["State.name"] ??
                null
            );
        }
        return null;
    }

    /**
     * Check if a field config has aggregation
     */
    private isAggregatedField(fieldConfig: FieldConfig | any): boolean {
        return !!(fieldConfig?.aggregation && fieldConfig.aggregation !== "");
    }

    /**
     * Sort data in-memory by one-to-many relation field
     * Approach 2: For small datasets (< 1000 records)
     */
    private sortDataInMemory(
        data: any[],
        sortConfig: {
            relationName: string;
            relationField: string;
            sortDirection: string;
            fieldConfig: any;
        },
        primaryTable: string
    ): any[] {
        const { relationName, relationField, sortDirection, fieldConfig } =
            sortConfig;
        const isAsc = sortDirection === "asc";

        return data.sort((a, b) => {
            let aValue: any = null;
            let bValue: any = null;

            // Extract values from the relation
            const aRelation = a[relationName];
            const bRelation = b[relationName];

            if (fieldConfig && this.isAggregatedField(fieldConfig)) {
                // For aggregated fields, calculate aggregation first
                const aValues = this.extractRelationValues(
                    aRelation,
                    relationField
                );
                const bValues = this.extractRelationValues(
                    bRelation,
                    relationField
                );

                aValue = this.calculateAggregation(
                    aValues,
                    fieldConfig.aggregation
                );
                bValue = this.calculateAggregation(
                    bValues,
                    fieldConfig.aggregation
                );
            } else {
                // Check if this is a virtual field
                const virtualConfig = fieldConfig
                    ? getVirtualFieldConfig(
                        fieldConfig.table || primaryTable,
                        fieldConfig.field
                    )
                    : null;

                if (virtualConfig && virtualConfig.extractor) {
                    // Use the registered extractor for virtual fields
                    aValue = virtualConfig.extractor(a);
                    bValue = virtualConfig.extractor(b);
                } else {
                    const getNestedVal = (obj: any, path: string) => {
                        if (!obj) return undefined;
                        if (!path.includes(".")) return obj[path];
                        return path.split(".").reduce((acc, part) => acc && acc[part], obj);
                    };

                    // For non-aggregated fields, use first related record
                    if (Array.isArray(aRelation) && aRelation.length > 0) {
                        aValue = getNestedVal(aRelation[0], relationField);
                    } else if (aRelation && !Array.isArray(aRelation)) {
                        // Handle many-to-one relations (single object, not array)
                        aValue = getNestedVal(aRelation, relationField);
                    }
                    if (Array.isArray(bRelation) && bRelation.length > 0) {
                        bValue = getNestedVal(bRelation[0], relationField);
                    } else if (bRelation && !Array.isArray(bRelation)) {
                        // Handle many-to-one relations (single object, not array)
                        bValue = getNestedVal(bRelation, relationField);
                    }
                }
            }

            // Handle null/undefined values
            if (aValue === null || aValue === undefined) {
                return isAsc ? 1 : -1;
            }
            if (bValue === null || bValue === undefined) {
                return isAsc ? -1 : 1;
            }

            // Compare values
            let comparison = 0;
            if (typeof aValue === "string" && typeof bValue === "string") {
                comparison = aValue.localeCompare(bValue);
            } else {
                comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            }

            return isAsc ? comparison : -comparison;
        });
    }

    /**
     * Extract all values from a relation array for aggregation
     */
    private extractRelationValues(relation: any, field: string): any[] {
        if (!relation) {
            return [];
        }

        if (Array.isArray(relation)) {
            return relation
                .map((r: any) => r[field])
                .filter((v: any) => v !== null && v !== undefined);
        }

        return relation[field] !== null && relation[field] !== undefined
            ? [relation[field]]
            : [];
    }

    /**
     * Coerce Prisma Decimal, bigint, and numeric strings to a number for filters/aggregations.
     */
    private coerceToNumber(value: unknown): number | null {
        if (value === null || value === undefined || value === "") {
            return null;
        }
        if (typeof value === "number") {
            return Number.isNaN(value) ? null : value;
        }
        if (typeof value === "bigint") {
            const n = Number(value);
            return Number.isNaN(n) ? null : n;
        }
        if (typeof value === "object") {
            const obj = value as {
                toNumber?: () => number;
                toString?: () => string;
            };
            if (typeof obj.toNumber === "function") {
                const n = obj.toNumber();
                return typeof n === "number" && !Number.isNaN(n) ? n : null;
            }
            if (typeof obj.toString === "function") {
                const n = parseFloat(obj.toString());
                return Number.isNaN(n) ? null : n;
            }
        }
        const n = parseFloat(String(value));
        return Number.isNaN(n) ? null : n;
    }

    private extractAggregationSourceValue(
        row: any,
        outputKey: string,
        legacyKey: string | null
    ): number | null {
        const candidates = [
            row?.[outputKey],
            ...(legacyKey ? [row?.[legacyKey]] : []),
            row?.raw?.[outputKey],
            ...(legacyKey ? [row?.raw?.[legacyKey]] : []),
        ];
        for (const value of candidates) {
            const n = this.coerceToNumber(value);
            if (n !== null) {
                return n;
            }
        }
        return null;
    }

    /**
     * Calculate aggregation value
     */
    private calculateAggregation(
        values: any[],
        aggregation: AggregationType
    ): number | null {
        const numValues = values
            .map((v) => this.coerceToNumber(v))
            .filter((v): v is number => v !== null);
        return AggregationCalculator.calculate(numValues, aggregation);
    }

    private getSortFieldFromParamsOrConfig(
        params: ExecuteReportParams,
        config: ReportConfig
    ): string | undefined {
        if (params.sortField) {
            return params.sortField
                .replace("___formatted_", "")
                .replace("__formatted_", "")
                .replace("_formatted", "");
        }
        const fallbackSort = config.sorting?.[0]?.field;
        if (!fallbackSort) {
            return undefined;
        }
        return fallbackSort
            .replace("___formatted_", "")
            .replace("__formatted_", "")
            .replace("_formatted", "");
    }

    private compareSortValues(aValue: any, bValue: any, isAsc: boolean): number {
        if (aValue === null || aValue === undefined || aValue === "") {
            return isAsc ? 1 : -1;
        }
        if (bValue === null || bValue === undefined || bValue === "") {
            return isAsc ? -1 : 1;
        }
        const comparison =
            typeof aValue === "string" && typeof bValue === "string"
                ? aValue.localeCompare(bValue)
                : aValue > bValue
                    ? 1
                    : aValue < bValue
                        ? -1
                        : 0;
        return isAsc ? comparison : -comparison;
    }

    /**
     * Resolve display currency for an amount field (aligned with formatSingleRow).
     */
    private resolveCurrencyForAmountFromRow(
        row: any,
        field: { table: string; field: string },
        primaryTable: string,
        accountCurrency: string,
        relatedRecord?: any | null
    ): string {
        if (field.table === "Invoice") {
            let invoiceRow =
                field.table === primaryTable ? row : relatedRecord;
            if (!invoiceRow) {
                invoiceRow = this.getRelationRow(row, primaryTable, "Invoice");
            }
            return resolveInvoiceAmountFieldCurrency(
                invoiceRow,
                field.field,
                accountCurrency
            );
        }

        if (field.table === "Customer" || primaryTable === "Customer") {
            return resolveCustomerAmountFieldCurrency(
                row,
                field.field,
                accountCurrency
            );
        }

        let currency = accountCurrency;
        if (field.table === primaryTable) {
            currency =
                row?.customer_currency || row?.currency || currency;
        } else {
            const relationName = this.getRelationName(
                primaryTable,
                field.table
            );
            if (relationName && row?.[relationName]) {
                const relationData = Array.isArray(row[relationName])
                    ? row[relationName][0]
                    : row[relationName];
                if (relationData) {
                    currency =
                        relationData.customer_currency ||
                        relationData.currency ||
                        currency;
                }
            }
        }
        return currency;
    }

    private hasLatestTrendCostCustomerFilters(
        config: ReportConfig,
        primaryTable: string
    ): boolean {
        return (
            primaryTable === "Customer" &&
            (config.filters || []).some(
                (filter) =>
                    filter.table === "Customer" &&
                    isTrendCostBackedReportField(filter.field)
            )
        );
    }

    /**
     * Re-apply trend-cost filters against latest-row extracted values (not any historical trend row).
     */
    private filterRawDataByLatestTrendCost(
        rawData: any[],
        filters: Filter[] | undefined
    ): any[] {
        const trendCostFilters = (filters || []).filter(
            (filter) =>
                filter.table === "Customer" &&
                isTrendCostBackedReportField(filter.field)
        );
        if (trendCostFilters.length === 0) {
            return rawData;
        }

        return rawData.filter((row) =>
            trendCostFilters.every((filter) =>
                this.matchesFilter(row, filter, "Customer")
            )
        );
    }

    private getRelationRow(
        row: any,
        primaryTable: string,
        targetTable: string
    ): unknown {
        const relationName = this.getRelationName(primaryTable, targetTable);
        if (!relationName || !row?.[relationName]) {
            return null;
        }
        const relationData = Array.isArray(row[relationName])
            ? row[relationName][0]
            : row[relationName];
        return relationData ?? null;
    }

    private applyGroupingAndAggregation(
        rows: any[],
        config: ReportConfig,
        primaryTable: string,
        locale?: string,
        accountCurrency: string = "USD",
        formulaWarningAccumulator?: Map<string, { label: string; invalidCount: number }>
    ): any[] {
        const fields = config.fields || [];
        const groupingKeys = config.grouping || [];
        const aggregatedFields = fields.filter((field) =>
            this.isAggregatedField(field)
        );
        const hasAggregatedFields = aggregatedFields.length > 0;
        const hasGrouping = groupingKeys.length > 0;

        if (!hasGrouping && !hasAggregatedFields) {
            return rows;
        }

        const groups = new Map<string, any[]>();
        for (const row of rows) {
            const groupKey = hasGrouping
                ? groupingKeys
                    .map((key) => {
                        const value = row[key];
                        return value === undefined ? "__undefined__" : String(value);
                    })
                    .join("|")
                : "__all__";
            const existing = groups.get(groupKey);
            if (existing) {
                existing.push(row);
            } else {
                groups.set(groupKey, [row]);
            }
        }

        const userLocale = locale || "en-US";
        const i18nLanguage = userLocale.startsWith("he") ? "he" : "en";

        const groupedRows: any[] = [];
        for (const [groupKey, groupRows] of Array.from(groups.entries())) {
            const sampleRow = groupRows[0];
            const groupedRow: any = {
                id: `group-${groupKey}`,
            };

            for (const groupingKey of groupingKeys) {
                groupedRow[groupingKey] = sampleRow?.[groupingKey] ?? null;
                // Preserve pre-formatted display from formatted rows (e.g. amount group keys)
                const gfk = `___formatted_${groupingKey}`;
                if (
                    sampleRow?.[gfk] !== undefined &&
                    sampleRow?.[gfk] !== null
                ) {
                    groupedRow[gfk] = sampleRow[gfk];
                } else if (
                    sampleRow?.raw?.[gfk] !== undefined &&
                    sampleRow?.raw?.[gfk] !== null
                ) {
                    groupedRow[gfk] = sampleRow.raw[gfk];
                }
                // Grouped rows skip formatSingleRow — preserve link metadata for grouping columns
                const linkKey = `__link_${groupingKey}`;
                if (sampleRow?.[linkKey] != null) {
                    groupedRow[linkKey] = sampleRow[linkKey];
                } else if (sampleRow?.raw?.[linkKey] != null) {
                    groupedRow[linkKey] = sampleRow.raw[linkKey];
                }
            }

            if (sampleRow?.customer_id != null) {
                groupedRow.customer_id = sampleRow.customer_id;
            } else if (sampleRow?.raw?.customer_id != null) {
                groupedRow.customer_id = sampleRow.raw.customer_id;
            }
            if (sampleRow?.parent_customer_id != null) {
                groupedRow.parent_customer_id = sampleRow.parent_customer_id;
            } else if (sampleRow?.raw?.parent_customer_id != null) {
                groupedRow.parent_customer_id = sampleRow.raw.parent_customer_id;
            }

            for (const field of aggregatedFields) {
                const outputKey = getFieldOutputKey(field);
                const legacyKey =
                    field.aggregation && !field.alias
                        ? getLegacyFieldOutputKey(field)
                        : null;
                const values = groupRows
                    .map((row: any) =>
                        this.extractAggregationSourceValue(
                            row,
                            outputKey,
                            legacyKey
                        )
                    )
                    .filter((value): value is number => value !== null);
                if (field.aggregation === "COUNT") {
                    groupedRow[outputKey] = values.length;
                } else {
                    groupedRow[outputKey] = this.calculateAggregation(
                        values,
                        field.aggregation as AggregationType
                    );
                }

                // Grouped rows skip formatSingleRow — set ___formatted_* so the report viewer matches non-aggregated reports
                if (
                    field.aggregation !== "COUNT" &&
                    this.shouldFormatFieldAsCurrency(field.table, field.field)
                ) {
                    const numVal = groupedRow[outputKey];
                    if (numVal !== null && numVal !== undefined) {
                        const n =
                            typeof numVal === "number"
                                ? numVal
                                : parseFloat(String(numVal));
                        if (!Number.isNaN(n)) {
                            const currency = this.resolveCurrencyForAmountFromRow(
                                sampleRow,
                                field,
                                primaryTable,
                                accountCurrency
                            );
                            groupedRow[`___formatted_${outputKey}`] =
                                formatCurrencyWithRTLSupport(
                                    n,
                                    currency,
                                    userLocale,
                                    i18nLanguage
                                );
                        }
                    }
                }
            }

            const formulas = config.formulas || [];
            if (formulas.length > 0) {
                const { groupedValues, warnings } =
                    aggregateFormulaColumnsInGroupedRows(groupRows, formulas, {
                        locale: userLocale,
                        accountCurrency,
                        sampleRow,
                    });
                for (const [key, value] of Object.entries(groupedValues)) {
                    groupedRow[key] = value;
                }
                if (formulaWarningAccumulator) {
                    for (const w of warnings) {
                        const existing = formulaWarningAccumulator.get(w.formulaId);
                        if (existing) {
                            existing.invalidCount += w.invalidCount;
                        } else {
                            formulaWarningAccumulator.set(w.formulaId, {
                                label: w.label,
                                invalidCount: w.invalidCount,
                            });
                        }
                    }
                }
            }

            groupedRows.push(groupedRow);
        }

        return groupedRows;
    }

    /**
     * Sort by one-to-many field using raw SQL subquery
     * Approach 3: For larger datasets (>= 1000 records)
     */
    private async sortByOneToManyFieldWithRawSQL(
        model: any,
        primaryTable: string,
        sortConfig: {
            relationName: string;
            relationField: string;
            relationTable: string;
            sortDirection: string;
            fieldConfig: any;
        },
        whereClause: any,
        skip: number,
        take: number,
        includeOrSelect: any
    ): Promise<any[]> {
        const { relationTable, relationField, sortDirection, fieldConfig } =
            sortConfig;
        const foreignKeyField = this.getForeignKeyFieldName(primaryTable);
        const primaryTableLower = primaryTable.toLowerCase();
        const relationTableLower = relationTable.toLowerCase();
        const isAsc = sortDirection === "asc";

        try {
            // Build WHERE clause for account_id
            const accountId = whereClause.account_id;

            // Get primary record IDs sorted by related record's field
            const sortSQL = isAsc ? "ASC" : "DESC";
            const aggregationSQL =
                fieldConfig && this.isAggregatedField(fieldConfig)
                    ? this.getAggregationSQL(
                        fieldConfig.aggregation,
                        relationField
                    )
                    : `MIN(${relationTableLower}.${relationField})`;

            // Build parameterized query using Prisma.sql
            const tableName = Prisma.raw(primaryTableLower);
            const relTableName = Prisma.raw(relationTableLower);
            const fkField = Prisma.raw(foreignKeyField);
            const aggSQL = Prisma.raw(aggregationSQL);
            const sortOrder = Prisma.raw(sortSQL);

            let idsQuery;
            if (accountId) {
                idsQuery = Prisma.sql`
                    SELECT ${tableName}.id
                    FROM ${tableName}
                    LEFT JOIN LATERAL (
                        SELECT ${aggSQL} as sort_value
                        FROM ${relTableName}
                        WHERE ${relTableName}.${fkField} = ${tableName}.id
                        AND ${relTableName}.account_id = ${accountId}
                    ) AS sort_subquery ON true
                    WHERE ${tableName}.account_id = ${accountId}
                    ORDER BY sort_subquery.sort_value ${sortOrder} NULLS LAST
                    LIMIT ${take} OFFSET ${skip}
                `;
            } else {
                idsQuery = Prisma.sql`
                    SELECT ${tableName}.id
                    FROM ${tableName}
                    LEFT JOIN LATERAL (
                        SELECT ${aggSQL} as sort_value
                        FROM ${relTableName}
                        WHERE ${relTableName}.${fkField} = ${tableName}.id
                    ) AS sort_subquery ON true
                    ORDER BY sort_subquery.sort_value ${sortOrder} NULLS LAST
                    LIMIT ${take} OFFSET ${skip}
                `;
            }

            const result = await prisma.$queryRaw(idsQuery);
            const ids = (result as any[]).map((r: any) => r.id);

            if (ids.length === 0) {
                return [];
            }

            // Fetch full data for these IDs
            const fullDataQuery: any = {
                where: {
                    id: { in: ids },
                    ...whereClause,
                },
            };

            if (includeOrSelect) {
                if (includeOrSelect.include) {
                    fullDataQuery.include = includeOrSelect.include;
                } else if (includeOrSelect.select) {
                    fullDataQuery.select = includeOrSelect.select;
                }
            }

            const fullData = await model.findMany(fullDataQuery);

            // Maintain sort order from SQL query
            const dataMap = new Map(fullData.map((d: any) => [d.id, d]));
            return ids
                .map((id) => dataMap.get(id))
                .filter((d) => d !== undefined);
        } catch (error: any) {
            this.logService.logMessage(
                LogLevel.ERROR,
                `Raw SQL sorting failed, falling back to in-memory: ${error.message}`,
                "ReportExecutionService"
            );
            // Fallback: fetch all and sort in memory
            const allData = await model.findMany({
                where: whereClause,
                ...includeOrSelect,
            });
            return this.sortDataInMemory(
                allData,
                sortConfig,
                primaryTable
            ).slice(skip, skip + take);
        }
    }

    /**
     * Get SQL aggregation function
     */
    private getAggregationSQL(
        aggregation: AggregationType,
        field: string
    ): string {
        return AggregationCalculator.getSQLFunction(aggregation, field);
    }

    /**
     * Get User relation name for created_by or modified_by fields
     * Prisma relation names follow pattern: User_{TableName}_{field}ToUser
     */
    private getUserRelationName(
        tableName: string,
        fieldName: "created_by" | "modified_by"
    ): string {
        return getUserRelationNameForReportTable(tableName, fieldName);
    }

    /**
     * Extract user name from User relation for created_by or modified_by fields
     * Returns user name, email, or the original value as fallback
     */
    private extractUserName(
        row: any,
        tableName: string,
        fieldName: "created_by" | "modified_by"
    ): any {
        const userRelationName = this.getUserRelationName(tableName, fieldName);
        const userRelation = row[userRelationName];

        if (userRelation) {
            // Prefer name, then email, then fallback to the ID
            return userRelation.name || userRelation.email || row[fieldName];
        }

        // Fallback to the field value itself (ID)
        return row[fieldName];
    }


    /**
     * Execute report and return data
     */
    async executeReport(
        params: ExecuteReportParams
    ): Promise<ReportExecutionResult> {
        const startTime = Date.now();

        try {
            // Get report (Prisma client needs to be regenerated after schema changes)
            const report = await this.getReport(params.reportId);
            this.validateReportAccess(report, params.accountId);

            const config = report.report_config as unknown as ReportConfig;

            // Fetch account settings for formatting defaults + product flags
            let accountCurrency = "USD";
            let accountHasCreditInsurance = false;
            let isCreditOnlyAccountForReport = false;
            try {
                const account = await (prisma as any).Account.findUnique({
                    where: { id: params.accountId },
                    select: {
                        currency: true,
                        has_collection: true,
                        has_credit_insurance: true,
                    } as any,
                });
                if (account?.currency) {
                    accountCurrency = account.currency;
                }
                accountHasCreditInsurance =
                    (account as any)?.has_credit_insurance === true;
                isCreditOnlyAccountForReport = isCreditOnlyAccount({
                    has_collection: (account as any)?.has_collection,
                    has_credit_insurance: (account as any)?.has_credit_insurance,
                });
            } catch (error) {
                // Ignore error and use default
            }

            if (
                !accountHasCreditInsurance &&
                reportConfigReferencesCreditInsuranceFields(report.report_config)
            ) {
                throw new CreditInsuranceProductDisabledForReportError(
                    params.reportId,
                    params.accountId
                );
            }

            // Helper function to process filters - replaces __CURRENT_USER__, resolves __datePreset,
            // normalizes enum values based on metadata, and maps virtual fields
            const processFilters = (
                filters: any[] | undefined,
                userId: string | undefined
            ): any[] | undefined => {
                if (!filters || !Array.isArray(filters)) return filters;

                return filters.map((filter) => {
                    const newFilter = { ...filter };

                    // Resolve date preset to actual date at execution time
                    if (isDatePresetValue(newFilter.value)) {
                        const preset = newFilter.value.__datePreset;
                        const input = newFilter.value.__datePresetInput;
                        const isDateTime = false;
                        const comparisonOps = [
                            "greater_than",
                            "greater_than_or_equal",
                            "less_than",
                            "less_than_or_equal",
                        ];
                        const isComparisonOp =
                            comparisonOps.includes(newFilter.operator);

                        if (isPeriodPreset(preset) && !isComparisonOp) {
                            const range = resolveDatePresetRange(
                                preset,
                                input,
                                isDateTime
                            );
                            if (range) {
                                newFilter.operator = "between";
                                newFilter.value = range;
                            } else {
                                newFilter.value = resolveDatePreset(
                                    preset,
                                    input,
                                    isDateTime
                                );
                            }
                        } else if (isPeriodPreset(preset) && isComparisonOp) {
                            const range = resolveDatePresetRange(
                                preset,
                                input,
                                isDateTime
                            );
                            if (range) {
                                const [start, end] = range;
                                const useEnd =
                                    newFilter.operator === "greater_than" ||
                                    newFilter.operator ===
                                    "less_than_or_equal";
                                newFilter.value = useEnd ? end : start;
                            } else {
                                newFilter.value = resolveDatePreset(
                                    preset,
                                    input,
                                    isDateTime
                                );
                            }
                        } else {
                            newFilter.value = resolveDatePreset(
                                preset,
                                input,
                                isDateTime
                            );
                        }
                    }
                    // Replace "__CURRENT_USER__" in single values
                    else if (
                        newFilter.value === "__CURRENT_USER__" &&
                        userId
                    ) {
                        newFilter.value = userId;
                    }
                    // Replace "__CURRENT_USER__" in array values (for "in" operator)
                    else if (Array.isArray(newFilter.value) && userId) {
                        newFilter.value = newFilter.value.map((v: any) =>
                            v === "__CURRENT_USER__" ? userId : v
                        );
                    }

                    // Normalize enum values generically using report metadata
                    if (newFilter.table && newFilter.field) {
                        newFilter.value = this.normalizeEnumFilterValue(
                            newFilter.table,
                            newFilter.field,
                            newFilter.value
                        );
                    }

                    // Map virtual field names to actual database column names
                    // assigned_to is a virtual field that maps to owner_id in CustomerDispute
                    if (
                        newFilter.field === "assigned_to" &&
                        (newFilter.table === "Dispute" ||
                            newFilter.table === "CustomerDispute")
                    ) {
                        newFilter.field = "owner_id";
                    }

                    return newFilter;
                });
            };

            const hasReplacementFilters =
                params.replaceConfigFilters === true &&
                Array.isArray(params.filters) &&
                params.filters.length > 0;

            let normalizedFilters: ReturnType<typeof processFilters> | undefined;
            let processedConfig: ReportConfig;

            if (hasReplacementFilters) {
                processedConfig = {
                    ...config,
                    filters: processFilters(params.filters, params.userId),
                };
                normalizedFilters = undefined;
            } else {
                normalizedFilters = processFilters(
                    Array.isArray(params.filters) ? params.filters : undefined,
                    params.userId
                );
                processedConfig = {
                    ...config,
                    filters: processFilters(config.filters, params.userId),
                };
            }
            const shouldApplyGroupedExecution =
                Array.isArray(processedConfig.grouping) &&
                processedConfig.grouping.length > 0 ||
                (processedConfig.fields || []).some((field) =>
                    this.isAggregatedField(field)
                );

            // Client only requests this for credit-insurance accounts (unpaid invoice grid).
            // Do not re-check Account.has_credit_insurance here: a failed/mismatched lookup
            // would skip merging and the API would omit booleans while the UI still shows the column.
            if (
                accountHasCreditInsurance &&
                params.includeInvoiceCreditInsuranceViolationFields &&
                config.tables?.[0] === "Invoice"
            ) {
                processedConfig =
                    this.mergeInvoiceCreditInsuranceViolationFieldsIntoConfig(
                        processedConfig
                    );
            }


            if ((processedConfig.formulas?.length ?? 0) > 0) {
                processedConfig = mergeFormulaOperandFieldsIntoConfig(
                    processedConfig,
                    REPORT_METADATA.tables as Array<{
                        name: string;
                        fields: Array<{ name: string; type: string }>;
                    }>
                );
            }

            // Build query
            // Always use the executing user's account_id to ensure data isolation
            // This applies to both regular reports and system reports
            let query;
            try {
                query = this.queryBuilder.buildQuery(
                    processedConfig,
                    params.accountId, // Always use executing user's account_id
                    normalizedFilters,
                    params.search,
                    params.businessUnitFilter, // Apply business unit restrictions
                    params.customerAccessFilter,
                    params.primaryWhereExtras
                );
            } catch (queryError: any) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Failed to build query: ${queryError?.message || String(queryError)}`,
                    "ReportExecutionService",
                    JSON.stringify(
                        {
                            reportId: params.reportId,
                            accountId: params.accountId,
                            config: JSON.stringify(config, null, 2),
                            error: queryError?.message,
                            stack: queryError?.stack,
                        },
                        null,
                        2
                    ) as any,
                    params.accountId
                );
                throw new QueryBuildError(
                    queryError?.message || String(queryError),
                    params.reportId,
                    params.accountId,
                    queryError instanceof Error ? queryError : undefined
                );
            }

            // Get table model name
            const primaryTable = config.tables[0];
            const modelName = this.getModelName(primaryTable);

            // Execute query using Prisma client
            const model = (prisma as any)[modelName];
            if (!model) {
                throw new Error(
                    `Unknown table: ${primaryTable} (model: ${modelName})`
                );
            }

            // Apply pagination
            const page = params.page || 1;
            const limit = params.limit || 20;
            const skip = (page - 1) * limit;

            // Apply sorting
            // Map sortField (which might be an alias like "Customer.id") back to actual field name
            const orderBy: any = {};
            let needsInMemorySort = false;
            const reportUniqueNameEarly = (report as {
                unique_name?: string | null;
            }).unique_name;
            if (
                reportUniqueNameEarly ===
                "dashboard_credit_customers_top_up_expiring"
            ) {
                needsInMemorySort = true;
            }
            let needsLatestTrendCostFilter = this.hasLatestTrendCostCustomerFilters(
                processedConfig,
                primaryTable
            );
            let oneToManySortConfig: {
                relationName: string;
                relationField: string;
                relationTable: string;
                sortDirection: "asc" | "desc";
                fieldConfig: any;
            } | null = null;

            if (params.sortField) {
                // Normalize sortField: if it's a synthetic formatted field, strip the prefix/suffix to sort by the raw field
                const effectiveSortField = params.sortField
                    .replace("___formatted_", "")
                    .replace("__formatted_", "")
                    .replace("_formatted", "");

                if (isCreditDashboardEnrichedSortField(effectiveSortField)) {
                    needsInMemorySort = true;
                }

                // Check if this is a customer policy-backed field
                const isSortFieldCustomerPolicyBacked =
                    (primaryTable === "Customer" &&
                        isCustomerPolicyBackedReportField(effectiveSortField)) ||
                    (effectiveSortField.includes(".") &&
                        effectiveSortField.split(".")[0].toLowerCase() === "customer" &&
                        isCustomerPolicyBackedReportField(effectiveSortField.slice(effectiveSortField.indexOf(".") + 1)));

                const isSortFieldTrendCostBacked =
                    (primaryTable === "Customer" &&
                        isTrendCostBackedReportField(effectiveSortField)) ||
                    (effectiveSortField.includes(".") &&
                        effectiveSortField.split(".")[0].toLowerCase() === "customer" &&
                        isTrendCostBackedReportField(
                            effectiveSortField.slice(
                                effectiveSortField.indexOf(".") + 1
                            )
                        ));

                if (isSortFieldCustomerPolicyBacked) {
                    const sortDirection: "asc" | "desc" =
                        (params.sortDirection?.toLowerCase() as
                            | "asc"
                            | "desc") || "asc";

                    const fieldConfig = config.fields?.find(
                        (f: any) =>
                            f.alias === effectiveSortField ||
                            getFieldOutputKey(f) === effectiveSortField ||
                            `${f.table}.${f.field}` === effectiveSortField ||
                            f.field === effectiveSortField
                    );

                    needsInMemorySort = true;
                    oneToManySortConfig = {
                        relationName: "CustomerPolicy",
                        relationField: fieldConfig
                            ? fieldConfig.field
                            : effectiveSortField.includes(".")
                                ? effectiveSortField.slice(effectiveSortField.indexOf(".") + 1)
                                : effectiveSortField,
                        relationTable: "CustomerPolicy",
                        sortDirection,
                        fieldConfig: fieldConfig || null,
                    };
                } else if (isSortFieldTrendCostBacked) {
                    const sortDirection: "asc" | "desc" =
                        (params.sortDirection?.toLowerCase() as
                            | "asc"
                            | "desc") || "asc";

                    const fieldConfig = config.fields?.find(
                        (f: any) =>
                            f.alias === effectiveSortField ||
                            getFieldOutputKey(f) === effectiveSortField ||
                            `${f.table}.${f.field}` === effectiveSortField ||
                            f.field === effectiveSortField
                    );

                    needsInMemorySort = true;
                    oneToManySortConfig = {
                        relationName: "CustomerPolicyTrend",
                        relationField: fieldConfig
                            ? fieldConfig.field
                            : effectiveSortField.includes(".")
                                ? effectiveSortField.slice(
                                      effectiveSortField.indexOf(".") + 1
                                  )
                                : effectiveSortField,
                        relationTable: "Customer",
                        sortDirection,
                        fieldConfig: fieldConfig || null,
                    };
                } else {
                    // Find the field config that matches the sortField (could be alias or table.field format)
                    const fieldConfig = config.fields?.find(
                        (f: any) =>
                            f.alias === effectiveSortField ||
                            getFieldOutputKey(f) === effectiveSortField ||
                            `${f.table}.${f.field}` === effectiveSortField ||
                            f.field === effectiveSortField
                    );

                    if (fieldConfig) {
                    const sortDirection: "asc" | "desc" =
                        (params.sortDirection?.toLowerCase() as
                            | "asc"
                            | "desc") || "asc";

                    // Check if this is a virtual field
                    // First, try to find a virtual field on the primary table for cross-table fields
                    // This handles cases like sorting by "Customer.name" when primary table is "Dispute"
                    let virtualConfig = getVirtualFieldConfig(
                        primaryTable,
                        `${fieldConfig.table}.${fieldConfig.field}`
                    );

                    // If not found, check the original table.field combination
                    if (!virtualConfig) {
                        virtualConfig = getVirtualFieldConfig(
                            fieldConfig.table || primaryTable,
                            fieldConfig.field
                        );
                    }

                    if (virtualConfig) {
                        // Handle virtual field sorting
                        if (virtualConfig.requiresInMemorySort) {
                            needsInMemorySort = true;
                            oneToManySortConfig = {
                                relationName: virtualConfig.relationName,
                                relationField:
                                    virtualConfig.relationField ||
                                    virtualConfig.field,
                                relationTable: virtualConfig.relationName,
                                sortDirection,
                                fieldConfig,
                            };
                        } else {
                            // Virtual field that can use Prisma orderBy directly
                            if (virtualConfig.relationType === "many-to-one") {
                                orderBy[virtualConfig.relationName] = {
                                    [virtualConfig.relationField ||
                                        virtualConfig.field]: sortDirection,
                                };
                            } else {
                                // Fallback: use in-memory sort
                                needsInMemorySort = true;
                                oneToManySortConfig = {
                                    relationName: virtualConfig.relationName,
                                    relationField:
                                        virtualConfig.relationField ||
                                        virtualConfig.field,
                                    relationTable: virtualConfig.relationName,
                                    sortDirection,
                                    fieldConfig,
                                };
                            }
                        }
                    } else if (fieldConfig.field.includes(".")) {
                        // Check if field has a prefix - this means it's a nested relation field
                        const [relationName, relationField] =
                            fieldConfig.field.split(".", 2);

                        // Check if this is a one-to-many relation
                        if (
                            this.isOneToManyRelation(primaryTable, relationName)
                        ) {
                            // Check if it's an aggregated field - use aggregation-based sorting
                            if (this.isAggregatedField(fieldConfig)) {
                                // For aggregated fields, we'll sort in-memory after calculating aggregations
                                needsInMemorySort = true;
                                oneToManySortConfig = {
                                    relationName,
                                    relationField,
                                    relationTable: relationName,
                                    sortDirection,
                                    fieldConfig,
                                };
                            } else {
                                // For non-aggregated one-to-many fields, use hybrid approach
                                needsInMemorySort = true;
                                oneToManySortConfig = {
                                    relationName,
                                    relationField,
                                    relationTable: relationName,
                                    sortDirection,
                                    fieldConfig,
                                };
                            }
                        } else {
                            // Handle nested relations (one-to-one or many-to-one)
                            // Use nested orderBy syntax for Prisma
                            orderBy[relationName] = {
                                [relationField]: sortDirection,
                            };
                        }
                    } else if (
                        fieldConfig.table === primaryTable ||
                        fieldConfig.table?.toLowerCase() ===
                        primaryTable?.toLowerCase()
                    ) {
                        // Use the actual field name for sorting (not the alias)
                        // Ensure we strip _formatted if it somehow got into the field config
                        const fieldName = fieldConfig.field
                            .replace("___formatted_", "")
                            .replace("__formatted_", "")
                            .replace("_formatted", "");
                        orderBy[fieldName] = sortDirection;
                    } else {
                        // Field from a joined table - use relation name
                        const relationName = this.getRelationName(
                            primaryTable,
                            fieldConfig.table
                        );
                        if (relationName) {
                            // Check if this is a one-to-many relation
                            if (
                                this.isOneToManyRelation(
                                    primaryTable,
                                    fieldConfig.table
                                )
                            ) {
                                // Check if it's an aggregated field
                                if (this.isAggregatedField(fieldConfig)) {
                                    needsInMemorySort = true;
                                    oneToManySortConfig = {
                                        relationName,
                                        relationField: fieldConfig.field,
                                        relationTable: fieldConfig.table,
                                        sortDirection,
                                        fieldConfig,
                                    };
                                } else {
                                    needsInMemorySort = true;
                                    oneToManySortConfig = {
                                        relationName,
                                        relationField: fieldConfig.field,
                                        relationTable: fieldConfig.table,
                                        sortDirection,
                                        fieldConfig,
                                    };
                                }
                            } else {
                                const fieldName = fieldConfig.field
                                    .replace("___formatted_", "")
                                    .replace("__formatted_", "")
                                    .replace("_formatted", "");
                                orderBy[relationName] = {
                                    [fieldName]: sortDirection,
                                };
                            }
                        } else {
                            // Cannot determine valid sort field - skip sorting to avoid errors
                            // Log warning but don't throw error
                            console.warn(
                                `[ReportExecutionService] Cannot determine valid sort field for "${effectiveSortField}" on table "${primaryTable}". Skipping sort.`
                            );
                        }
                    }
                } else {
                    // Fallback: try to use sortField directly (in case it's already the field name)
                    // Check if it contains a dot for nested sorting
                    if (effectiveSortField.includes(".")) {
                        let [relationName, relationField] =
                            effectiveSortField.split(".", 2);

                        // If relationName matches primaryTable, resolve virtual fields first
                        // (e.g. Customer.name is computed from Company/Person, not a DB column).
                        if (
                            relationName === primaryTable ||
                            relationName.toLowerCase() ===
                            primaryTable.toLowerCase()
                        ) {
                            const sortDirection =
                                (params.sortDirection?.toLowerCase() as
                                    | "asc"
                                    | "desc") || "asc";
                            const virtualConfig =
                                getVirtualFieldConfig(
                                    primaryTable,
                                    effectiveSortField
                                ) ||
                                getVirtualFieldConfig(
                                    primaryTable,
                                    relationField
                                );

                            if (virtualConfig) {
                                if (virtualConfig.requiresInMemorySort) {
                                    needsInMemorySort = true;
                                    oneToManySortConfig = {
                                        relationName:
                                            virtualConfig.relationName,
                                        relationField:
                                            virtualConfig.relationField ||
                                            virtualConfig.field,
                                        relationTable:
                                            virtualConfig.relationName,
                                        sortDirection,
                                        fieldConfig:
                                            config.fields?.find(
                                                (f: any) =>
                                                    f.table ===
                                                        virtualConfig.table &&
                                                    f.field ===
                                                        virtualConfig.field
                                            ) || null,
                                    };
                                } else if (
                                    virtualConfig.relationType === "many-to-one"
                                ) {
                                    orderBy[virtualConfig.relationName] = {
                                        [virtualConfig.relationField ||
                                            virtualConfig.field]: sortDirection,
                                    };
                                } else {
                                    needsInMemorySort = true;
                                    oneToManySortConfig = {
                                        relationName:
                                            virtualConfig.relationName,
                                        relationField:
                                            virtualConfig.relationField ||
                                            virtualConfig.field,
                                        relationTable:
                                            virtualConfig.relationName,
                                        sortDirection,
                                        fieldConfig: null,
                                    };
                                }
                            } else {
                                orderBy[relationField] = sortDirection;
                            }
                        } else {
                            // First check if there's a virtual field on the primary table for the full sortField
                            // This handles cases like "Customer.name" when primary table is "Dispute"
                            let virtualConfig = getVirtualFieldConfig(
                                primaryTable,
                                effectiveSortField
                            );

                            // If not found on primary table, check the relation table
                            if (!virtualConfig) {
                                virtualConfig = getVirtualFieldConfig(
                                    relationName,
                                    relationField
                                );
                            }

                            if (virtualConfig) {
                                if (virtualConfig.requiresInMemorySort) {
                                    needsInMemorySort = true;
                                    oneToManySortConfig = {
                                        relationName: virtualConfig.relationName,
                                        relationField:
                                            virtualConfig.relationField ||
                                            virtualConfig.field,
                                        relationTable: virtualConfig.relationName,
                                        sortDirection:
                                            (params.sortDirection?.toLowerCase() as
                                                | "asc"
                                                | "desc") || "asc",
                                        fieldConfig: null,
                                    };
                                } else if (
                                    virtualConfig.relationType === "many-to-one"
                                ) {
                                    orderBy[virtualConfig.relationName] = {
                                        [virtualConfig.relationField ||
                                            virtualConfig.field]:
                                            params.sortDirection?.toLowerCase() ||
                                            "asc",
                                    };
                                } else {
                                    // Fallback: use in-memory sort
                                    needsInMemorySort = true;
                                    oneToManySortConfig = {
                                        relationName: virtualConfig.relationName,
                                        relationField:
                                            virtualConfig.relationField ||
                                            virtualConfig.field,
                                        relationTable: virtualConfig.relationName,
                                        sortDirection:
                                            (params.sortDirection?.toLowerCase() as
                                                | "asc"
                                                | "desc") || "asc",
                                        fieldConfig: null,
                                    };
                                }
                            } else {
                                // Check if this is a one-to-many relation
                                if (
                                    this.isOneToManyRelation(
                                        primaryTable,
                                        relationName
                                    )
                                ) {
                                    needsInMemorySort = true;
                                    oneToManySortConfig = {
                                        relationName,
                                        relationField,
                                        relationTable: relationName,
                                        sortDirection:
                                            (params.sortDirection?.toLowerCase() as
                                                | "asc"
                                                | "desc") || "asc",
                                        fieldConfig: null,
                                    };
                                } else {
                                    orderBy[relationName] = {
                                        [relationField]:
                                            (params.sortDirection?.toLowerCase() as
                                                | "asc"
                                                | "desc") || "asc",
                                    };
                                }
                            }
                        }
                    } else {
                        // Check if sortField is a virtual field
                        const sortFieldTable = effectiveSortField.includes(".")
                            ? effectiveSortField.split(".")[0]
                            : primaryTable;
                        const sortFieldName = effectiveSortField.includes(".")
                            ? effectiveSortField.split(".")[1]
                            : effectiveSortField;

                        const virtualConfig = getVirtualFieldConfig(
                            sortFieldTable,
                            sortFieldName
                        );

                        if (virtualConfig) {
                            if (virtualConfig.requiresInMemorySort) {
                                needsInMemorySort = true;
                                oneToManySortConfig = {
                                    relationName: virtualConfig.relationName,
                                    relationField:
                                        virtualConfig.relationField ||
                                        virtualConfig.field,
                                    relationTable: virtualConfig.relationName,
                                    sortDirection:
                                        (params.sortDirection?.toLowerCase() as
                                            | "asc"
                                            | "desc") || "asc",
                                    fieldConfig: null,
                                };
                            } else if (
                                virtualConfig.relationType === "many-to-one"
                            ) {
                                orderBy[virtualConfig.relationName] = {
                                    [virtualConfig.relationField ||
                                        virtualConfig.field]:
                                        params.sortDirection?.toLowerCase() ||
                                        "asc",
                                };
                            } else {
                                // Fallback: use in-memory sort
                                needsInMemorySort = true;
                                oneToManySortConfig = {
                                    relationName: virtualConfig.relationName,
                                    relationField:
                                        virtualConfig.relationField ||
                                        virtualConfig.field,
                                    relationTable: virtualConfig.relationName,
                                    sortDirection:
                                        (params.sortDirection?.toLowerCase() as
                                            | "asc"
                                            | "desc") || "asc",
                                    fieldConfig: null,
                                };
                            }
                        } else {
                            // Direct field or already normalized
                            orderBy[effectiveSortField] =
                                params.sortDirection?.toLowerCase() || "asc";
                        }
                    }
                }
                }
            } else if (config.sorting && config.sorting.length > 0) {
                const sort = config.sorting[0];
                const effectiveSortField = sort.field;
                const isSortFieldCustomerPolicyBacked =
                    (primaryTable === "Customer" &&
                        isCustomerPolicyBackedReportField(effectiveSortField)) ||
                    (effectiveSortField.includes(".") &&
                        effectiveSortField.split(".")[0].toLowerCase() === "customer" &&
                        isCustomerPolicyBackedReportField(effectiveSortField.slice(effectiveSortField.indexOf(".") + 1)));

                const isSortFieldTrendCostBacked =
                    (primaryTable === "Customer" &&
                        isTrendCostBackedReportField(effectiveSortField)) ||
                    (effectiveSortField.includes(".") &&
                        effectiveSortField.split(".")[0].toLowerCase() === "customer" &&
                        isTrendCostBackedReportField(
                            effectiveSortField.slice(
                                effectiveSortField.indexOf(".") + 1
                            )
                        ));

                if (isSortFieldCustomerPolicyBacked) {
                    const sortDirection: "asc" | "desc" =
                        (sort.direction.toLowerCase() as "asc" | "desc") || "asc";

                    const fieldConfig = config.fields?.find(
                        (f: any) =>
                            f.alias === effectiveSortField ||
                            getFieldOutputKey(f) === effectiveSortField ||
                            `${f.table}.${f.field}` === effectiveSortField ||
                            f.field === effectiveSortField
                    );

                    needsInMemorySort = true;
                    oneToManySortConfig = {
                        relationName: "CustomerPolicy",
                        relationField: fieldConfig
                            ? fieldConfig.field
                            : effectiveSortField.includes(".")
                                ? effectiveSortField.slice(effectiveSortField.indexOf(".") + 1)
                                : effectiveSortField,
                        relationTable: "CustomerPolicy",
                        sortDirection,
                        fieldConfig: fieldConfig || null,
                    };
                } else if (isSortFieldTrendCostBacked) {
                    const sortDirection: "asc" | "desc" =
                        (sort.direction.toLowerCase() as "asc" | "desc") || "asc";

                    const fieldConfig = config.fields?.find(
                        (f: any) =>
                            f.alias === effectiveSortField ||
                            getFieldOutputKey(f) === effectiveSortField ||
                            `${f.table}.${f.field}` === effectiveSortField ||
                            f.field === effectiveSortField
                    );

                    needsInMemorySort = true;
                    oneToManySortConfig = {
                        relationName: "CustomerPolicyTrend",
                        relationField: fieldConfig
                            ? fieldConfig.field
                            : effectiveSortField.includes(".")
                                ? effectiveSortField.slice(
                                      effectiveSortField.indexOf(".") + 1
                                  )
                                : effectiveSortField,
                        relationTable: "Customer",
                        sortDirection,
                        fieldConfig: fieldConfig || null,
                    };
                } else {
                    // Check if sort field contains a dot for nested sorting
                    if (sort.field.includes(".")) {
                    const [relationName, relationField] = sort.field.split(
                        ".",
                        2
                    );

                    // Check if this is a virtual field
                    const virtualConfig = getVirtualFieldConfig(
                        relationName,
                        relationField
                    );

                    if (virtualConfig) {
                        if (virtualConfig.requiresInMemorySort) {
                            needsInMemorySort = true;
                            oneToManySortConfig = {
                                relationName: virtualConfig.relationName,
                                relationField:
                                    virtualConfig.relationField ||
                                    virtualConfig.field,
                                relationTable: virtualConfig.relationName,
                                sortDirection: sort.direction.toLowerCase() as
                                    | "asc"
                                    | "desc",
                                fieldConfig: null,
                            };
                        } else if (
                            virtualConfig.relationType === "many-to-one"
                        ) {
                            orderBy[virtualConfig.relationName] = {
                                [virtualConfig.relationField ||
                                    virtualConfig.field]:
                                    sort.direction.toLowerCase(),
                            };
                        } else {
                            // Fallback: use in-memory sort
                            needsInMemorySort = true;
                            oneToManySortConfig = {
                                relationName: virtualConfig.relationName,
                                relationField:
                                    virtualConfig.relationField ||
                                    virtualConfig.field,
                                relationTable: virtualConfig.relationName,
                                sortDirection: sort.direction.toLowerCase() as
                                    | "asc"
                                    | "desc",
                                fieldConfig: null,
                            };
                        }
                    } else {
                        // Check if this is a one-to-many relation
                        if (
                            this.isOneToManyRelation(primaryTable, relationName)
                        ) {
                            needsInMemorySort = true;
                            oneToManySortConfig = {
                                relationName,
                                relationField,
                                relationTable: relationName,
                                sortDirection: sort.direction.toLowerCase() as
                                    | "asc"
                                    | "desc",
                                fieldConfig: null,
                            };
                        } else {
                            orderBy[relationName] = {
                                [relationField]: sort.direction.toLowerCase(),
                            };
                        }
                    }
                } else {
                    if (isCreditDashboardEnrichedSortField(sort.field)) {
                        needsInMemorySort = true;
                    } else {
                    // Check if sort field is a virtual field
                    const virtualConfig = getVirtualFieldConfig(
                        primaryTable,
                        sort.field
                    );

                    if (virtualConfig) {
                        if (virtualConfig.requiresInMemorySort) {
                            needsInMemorySort = true;
                            oneToManySortConfig = {
                                relationName: virtualConfig.relationName,
                                relationField:
                                    virtualConfig.relationField ||
                                    virtualConfig.field,
                                relationTable: virtualConfig.relationName,
                                sortDirection: sort.direction.toLowerCase() as
                                    | "asc"
                                    | "desc",
                                fieldConfig: null,
                            };
                        } else if (
                            virtualConfig.relationType === "many-to-one"
                        ) {
                            orderBy[virtualConfig.relationName] = {
                                [virtualConfig.relationField ||
                                    virtualConfig.field]:
                                    sort.direction.toLowerCase(),
                            };
                        } else {
                            // Fallback: use in-memory sort
                            needsInMemorySort = true;
                            oneToManySortConfig = {
                                relationName: virtualConfig.relationName,
                                relationField:
                                    virtualConfig.relationField ||
                                    virtualConfig.field,
                                relationTable: virtualConfig.relationName,
                                sortDirection: sort.direction.toLowerCase() as
                                    | "asc"
                                    | "desc",
                                fieldConfig: null,
                            };
                        }
                    } else {
                        // Validate that the sort field exists in the report config fields
                        const sortFieldExists = config.fields?.some(
                            (f: any) =>
                                f.field === sort.field ||
                                f.alias === sort.field ||
                                getFieldOutputKey(f) === sort.field ||
                                `${f.table}.${f.field}` === sort.field
                        );

                        if (sortFieldExists) {
                            orderBy[sort.field] = sort.direction.toLowerCase();
                        } else {
                            // Cannot determine valid sort field - skip sorting to avoid errors
                            console.warn(
                                `[ReportExecutionService] Sort field "${sort.field}" from report config not found in fields. Skipping sort.`
                            );
                        }
                    }
                    }
                }
                }
            }

            // Get total count of primary records first
            // For Contact table, use count() with the nested relation structure
            const primaryCount = await model.count({ where: query.where });

            // Get a sample of data to detect one-to-many relationships
            const sampleQuery: any = {
                where: query.where,
                take: 1,
            };

            if (
                (query as any).include &&
                Object.keys((query as any).include).length > 0
            ) {
                sampleQuery.include = (query as any).include;
            } else if (query.select && Object.keys(query.select).length > 0) {
                sampleQuery.select = query.select;
            }

            const sampleData = await model.findMany(sampleQuery);

            // Detect if we have fields from a one-to-many relation (like Invoice when Customer is primary)
            let oneToManyRelationTable: OneToManyRelationTable | null = null;
            if (
                config.fields &&
                config.fields.length > 0 &&
                sampleData.length > 0
            ) {
                // Find fields that come from tables other than the primary table
                const nonPrimaryFields = config.fields.filter(
                    (f: any) =>
                        f.table !== primaryTable && !f.field.includes(".")
                );

                if (nonPrimaryFields.length > 0) {
                    // Check if any of these tables have a one-to-many relationship
                    for (const fieldConfig of nonPrimaryFields) {
                        const relationName = this.getRelationName(
                            primaryTable,
                            fieldConfig.table
                        );
                        if (
                            relationName &&
                            Array.isArray(sampleData[0][relationName])
                        ) {
                            oneToManyRelationTable = {
                                relationName,
                                table: fieldConfig.table,
                            };
                            break;
                        }
                    }
                }
            }

            // Calculate totalRecords based on whether we have a one-to-many relationship
            let totalRecords: number;
            if (oneToManyRelationTable) {
                // For one-to-many relationships, we need to count all related records
                const relationModel = (prisma as any)[
                    this.getModelName(oneToManyRelationTable.table)
                ];
                if (relationModel) {
                    // Get the foreign key field name (e.g., customer_id for Invoice or Contact)
                    const foreignKeyField =
                        this.getForeignKeyFieldName(primaryTable);

                    // Get primary record IDs that match the query
                    const primaryIds = await model.findMany({
                        where: query.where,
                        select: { id: true },
                    });

                    if (primaryIds.length > 0) {
                        const ids = primaryIds.map((r: any) => r.id);

                        // Build where clause for related records
                        const relationWhere: any = {
                            [foreignKeyField]: { in: ids },
                        };

                        // Only add account_id if the related table has that field
                        // Some tables like Contact don't have account_id directly,
                        // they're filtered through the relationship to Customer
                        if (
                            TABLES_WITH_ACCOUNT_ID_SET.has(
                                oneToManyRelationTable.table as any
                            )
                        ) {
                            relationWhere.account_id = params.accountId;
                        } else {
                            // For tables without account_id (like Contact), filter through the relationship
                            // The primary table (Customer) already has account_id in the query.where
                            // So we just need to filter by the foreign key
                        }

                        totalRecords = await relationModel.count({
                            where: relationWhere,
                        });
                    } else {
                        totalRecords = 0;
                    }
                } else {
                    // Fallback: count primary records
                    totalRecords = primaryCount;
                }
            } else {
                // For normal relationships, count primary records
                totalRecords = primaryCount;
            }

            // Get data
            // If select is empty or undefined, don't pass it (Prisma will return all fields)
            const queryOptions: any = {
                where: query.where,
            };
            let wasPaginatedInMemory = false;

            // For one-to-many sorting, we need to fetch all data, explode it, then sort and paginate
            // Check if we're sorting by the same relation that will be exploded
            const willExplodeData = config.fields?.some(
                (f: any) =>
                    f.table !== primaryTable &&
                    !f.field.includes(".") &&
                    this.isOneToManyRelation(primaryTable, f.table)
            );

            if (shouldApplyGroupedExecution) {
                queryOptions.take = undefined;
                queryOptions.skip = undefined;
            } else if (needsInMemorySort && oneToManySortConfig && willExplodeData) {
                // We're sorting by a field that will be exploded - fetch all data without pagination
                // We'll sort and paginate after explosion
                queryOptions.take = undefined;
                queryOptions.skip = undefined;
            } else if (needsInMemorySort && oneToManySortConfig) {
                // Sorting by a virtual/policy/trend field — fetch all for small datasets
                const recordCount = await model.count({ where: query.where });

                if (
                    recordCount < IN_MEMORY_SORT_THRESHOLD ||
                    needsLatestTrendCostFilter
                ) {
                    // Small dataset: fetch all and sort in memory
                    queryOptions.take = undefined;
                    queryOptions.skip = undefined;
                } else {
                    // Large dataset: use raw SQL subquery approach
                    queryOptions.skip = skip;
                    queryOptions.take = limit;
                }
            } else if (needsLatestTrendCostFilter) {
                queryOptions.take = undefined;
                queryOptions.skip = undefined;
            } else {
                const enrichedSortCandidate =
                    params.sortField ||
                    processedConfig.sorting?.[0]?.field;
                const enrichedSortField = enrichedSortCandidate?.includes(".")
                    ? enrichedSortCandidate.split(".").pop()
                    : enrichedSortCandidate;
                if (
                    primaryTable === "Customer" &&
                    isCreditDashboardEnrichedSortField(enrichedSortField)
                ) {
                    queryOptions.take = undefined;
                    queryOptions.skip = undefined;
                } else {
                    // Normal pagination
                    queryOptions.skip = skip;
                    queryOptions.take = limit;
                }
            }

            // Add include or select based on what we built
            if (
                (query as any).include &&
                Object.keys((query as any).include).length > 0
            ) {
                queryOptions.include = (query as any).include;
            } else if (query.select && Object.keys(query.select).length > 0) {
                queryOptions.select = query.select;
            }

            // Only add explicit orderBy when we're not doing in-memory sort.
            // If no sort is configured, enforce a deterministic fallback order so
            // skip/take pagination cannot return overlapping rows across pages.
            if (!needsInMemorySort) {
                let resolvedOrderBy: any =
                    Object.keys(orderBy).length > 0 ? orderBy : { id: "asc" };

                // For the Invoice table, always add a secondary tiebreaker sort by invoice_number asc
                // so that invoices with the same invoice_date appear in consistent ascending order.
                if (
                    primaryTable === "Invoice" &&
                    !("invoice_number" in (resolvedOrderBy as Record<string, any>))
                ) {
                    resolvedOrderBy = [
                        resolvedOrderBy,
                        { invoice_number: "asc" },
                    ];
                }

                queryOptions.orderBy = resolvedOrderBy;
            }

            let rawData: any[] = [];
            try {
                // For large datasets with one-to-many sorting, use raw SQL
                if (needsInMemorySort && oneToManySortConfig) {
                    const recordCount = await model.count({
                        where: query.where,
                    });
                    if (recordCount >= IN_MEMORY_SORT_THRESHOLD) {
                        // Use raw SQL subquery for large datasets
                        if (
                            oneToManySortConfig &&
                            oneToManySortConfig.relationName &&
                            oneToManySortConfig.relationField &&
                            oneToManySortConfig.relationTable
                        ) {
                            rawData = await this.sortByOneToManyFieldWithRawSQL(
                                model,
                                primaryTable,
                                {
                                    relationName:
                                        oneToManySortConfig.relationName,
                                    relationField:
                                        oneToManySortConfig.relationField,
                                    relationTable:
                                        oneToManySortConfig.relationTable,
                                    sortDirection:
                                        oneToManySortConfig.sortDirection,
                                    fieldConfig:
                                        oneToManySortConfig.fieldConfig,
                                },
                                query.where,
                                skip,
                                limit,
                                queryOptions.include || queryOptions.select
                            );
                        }
                    } else {
                        // Fetch all data for in-memory sorting
                        rawData = await model.findMany(queryOptions);
                    }
                } else {
                    rawData = await model.findMany(queryOptions);
                }

                if (needsLatestTrendCostFilter) {
                    rawData = this.filterRawDataByLatestTrendCost(
                        rawData,
                        processedConfig.filters
                    );
                }

                // Apply in-memory sorting for small datasets with one-to-many relations
                // But only if we're NOT sorting by the exploded relation (that will be sorted after explosion)
                const willExplodeData = config.fields?.some(
                    (f: any) =>
                        f.table !== primaryTable &&
                        !f.field.includes(".") &&
                        this.isOneToManyRelation(primaryTable, f.table)
                );

                const isSortingByExplodedRelation =
                    willExplodeData &&
                    oneToManySortConfig &&
                    (oneToManySortConfig.relationTable ===
                        config.fields?.find(
                            (f: any) =>
                                f.table !== primaryTable &&
                                !f.field.includes(".") &&
                                this.isOneToManyRelation(primaryTable, f.table)
                        )?.table ||
                        oneToManySortConfig.relationName ===
                        config.fields?.find(
                            (f: any) =>
                                f.table !== primaryTable &&
                                !f.field.includes(".") &&
                                this.isOneToManyRelation(
                                    primaryTable,
                                    f.table
                                )
                        )?.table);

                if (
                    needsInMemorySort &&
                    oneToManySortConfig &&
                    rawData.length > 0 &&
                    !isSortingByExplodedRelation &&
                    !shouldApplyGroupedExecution
                ) {
                    const recordCount = await model.count({
                        where: query.where,
                    });
                    if (
                        recordCount < IN_MEMORY_SORT_THRESHOLD &&
                        oneToManySortConfig &&
                        oneToManySortConfig.relationName &&
                        oneToManySortConfig.relationField
                    ) {
                        // Small dataset: sort in memory
                        rawData = this.sortDataInMemory(
                            rawData,
                            {
                                relationName: oneToManySortConfig.relationName,
                                relationField:
                                    oneToManySortConfig.relationField,
                                sortDirection:
                                    oneToManySortConfig.sortDirection,
                                fieldConfig: oneToManySortConfig.fieldConfig,
                            },
                            primaryTable
                        );

                        // Apply pagination after sorting
                        rawData = rawData.slice(skip, skip + limit);
                        wasPaginatedInMemory = true;
                    }
                } else if (
                    needsLatestTrendCostFilter &&
                    !needsInMemorySort &&
                    !shouldApplyGroupedExecution
                ) {
                    rawData = rawData.slice(skip, skip + limit);
                }
            } catch (queryError: any) {
                // Log Prisma query errors with full context
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    `Database query failed: ${queryError?.message || String(queryError)}`,
                    "ReportExecutionService",
                    JSON.stringify(
                        {
                            reportId: params.reportId,
                            accountId: params.accountId,
                            model: modelName,
                            primaryTable,
                            queryOptions: JSON.stringify(queryOptions, null, 2),
                            error: queryError?.message,
                            stack: queryError?.stack,
                            code: queryError?.code,
                            meta: queryError?.meta,
                        },
                        null,
                        2
                    ) as any,
                    params.accountId
                );
                throw new DatabaseQueryError(
                    queryError?.message || String(queryError),
                    params.reportId,
                    params.accountId,
                    queryError instanceof Error ? queryError : undefined
                );
            }

            // Verify one-to-many relationship from actual data (for safety)
            if (!oneToManyRelationTable && rawData.length > 0) {
                if (config.fields && config.fields.length > 0) {
                    const nonPrimaryFields = config.fields.filter(
                        (f: any) =>
                            f.table !== primaryTable && !f.field.includes(".")
                    );

                    if (nonPrimaryFields.length > 0) {
                        for (const fieldConfig of nonPrimaryFields) {
                            const relationName = this.getRelationName(
                                primaryTable,
                                fieldConfig.table
                            );
                            if (
                                relationName &&
                                Array.isArray(rawData[0][relationName])
                            ) {
                                oneToManyRelationTable = {
                                    relationName,
                                    table: fieldConfig.table,
                                };
                                break;
                            }
                        }
                    }
                }
            }

            const reportUniqueName = (report as { unique_name?: string | null })
                .unique_name;
            const requestedCustomerFields = (processedConfig.fields || [])
                .filter((f: FieldConfig) => f.table === primaryTable)
                .map((f: FieldConfig) => f.field);

            if (
                reportUniqueName === "dashboard_credit_customers_top_up_expiring"
            ) {
                const topUpResult = await fetchTopUpExpiringReportAsCustomerRows(
                    {
                        accountId: params.accountId,
                        page: params.page || 1,
                        limit: params.limit || 20,
                        search: params.search,
                        sortField: params.sortField,
                        sortDirection: params.sortDirection,
                        policyId: params.creditDashboardPolicyId,
                        withinDays: params.creditDashboardWithinDays,
                        businessUnitFilter: params.businessUnitFilter,
                    }
                );
                rawData = topUpResult.rows;
                totalRecords = topUpResult.total;
            } else if (
                primaryTable === "Customer" &&
                reportConfigNeedsCreditDashboardEnrichment(
                    processedConfig.fields
                )
            ) {
                let limitWarningByCustomerId:
                    | Map<number, import("./creditInsurance/creditInsuranceDashboardService").LimitWarningRow>
                    | undefined;
                if (requestedCustomerFields.includes("limit_warning_summary")) {
                    const { rows: warningRows } = await getLimitWarningReport(
                        params.accountId,
                        100_000,
                        0,
                        { policyId: params.creditDashboardPolicyId }
                    );
                    limitWarningByCustomerId = new Map(
                        warningRows.map((r) => [r.customerId, r])
                    );
                }
                rawData = await enrichCreditDashboardCustomerRows(rawData, {
                    accountId: params.accountId,
                    policyId: params.creditDashboardPolicyId,
                    accountLanguage: params.language,
                    requestedFields: requestedCustomerFields,
                    limitWarningByCustomerId,
                });
                const sortField =
                    params.sortField ||
                    processedConfig.sorting?.[0]?.field;
                const sortDirection =
                    params.sortDirection ||
                    processedConfig.sorting?.[0]?.direction ||
                    "desc";
                if (
                    sortField &&
                    isCreditDashboardEnrichedSortField(sortField)
                ) {
                    rawData = sortCreditDashboardEnrichedRows(
                        rawData,
                        sortField,
                        sortDirection as "asc" | "desc"
                    );
                    totalRecords = rawData.length;
                    rawData = rawData.slice(skip, skip + limit);
                }
            }

            // Format data to match report field configuration
            // If we have a one-to-many relation, explode the data (one row per related record)
            // rowOffset ensures fallback ids (row-N) are unique across pages for infinite scroll
            const rowOffset =
                ((params.page || 1) - 1) * (params.limit || 20);
            const formattedData = await this.formatData(
                rawData,
                processedConfig,
                primaryTable,
                oneToManyRelationTable,
                params.locale,
                params.timezone,
                rowOffset,
                accountCurrency,
                isCreditOnlyAccountForReport,
                params.language
            );


            // Sort formatted data if we're sorting by a one-to-many relation field
            // This needs to happen after explosion because we're sorting the exploded rows
            if (
                needsInMemorySort &&
                oneToManySortConfig &&
                formattedData.length > 0 &&
                !shouldApplyGroupedExecution &&
                !wasPaginatedInMemory
            ) {
                // Check if we're sorting by the one-to-many relation that was exploded
                const isSortingByExplodedRelation =
                    oneToManyRelationTable &&
                    (oneToManySortConfig.relationTable ===
                    oneToManyRelationTable.table ||
                    oneToManySortConfig.relationName ===
                    oneToManyRelationTable.relationName);

                if (isSortingByExplodedRelation) {
                    // Find the output key for the sort field
                    // Check if this is a virtual field first
                    let sortFieldConfig: any = null;
                    const virtualConfig = oneToManySortConfig.fieldConfig
                        ? getVirtualFieldConfig(
                            oneToManySortConfig.fieldConfig.table ||
                            primaryTable,
                            oneToManySortConfig.fieldConfig.field
                        )
                        : null;

                    if (virtualConfig) {
                        // For virtual fields, find the fieldConfig that matches the virtual field
                        sortFieldConfig = config.fields?.find(
                            (f: any) =>
                                f.table === virtualConfig.table &&
                                f.field === virtualConfig.field
                        );
                    } else {
                        // For other fields, use the original logic
                        const sortConfig = oneToManySortConfig;
                        sortFieldConfig = config.fields?.find(
                            (f: any) =>
                                (f.table ===
                                    sortConfig.relationTable &&
                                    f.field ===
                                    sortConfig.relationField) ||
                                f.field ===
                                    `${sortConfig.relationName}.${sortConfig.relationField}`
                        );
                    }

                    const sortOutputKey = sortFieldConfig
                        ? getFieldOutputKey(sortFieldConfig)
                        : `${oneToManySortConfig.relationTable}.${oneToManySortConfig.relationField}`;

                    const sortDirection = oneToManySortConfig.sortDirection;
                    const isAsc = sortDirection === "asc";

                    // Sort the exploded data
                    formattedData.sort((a, b) => {
                        const aValue = a[sortOutputKey];
                        const bValue = b[sortOutputKey];

                        // Handle null/undefined values
                        if (aValue === null || aValue === undefined) {
                            return isAsc ? 1 : -1;
                        }
                        if (bValue === null || bValue === undefined) {
                            return isAsc ? -1 : 1;
                        }

                        // Compare values
                        let comparison = 0;
                        if (
                            typeof aValue === "string" &&
                            typeof bValue === "string"
                        ) {
                            comparison = aValue.localeCompare(bValue);
                        } else {
                            comparison =
                                aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                        }

                        return isAsc ? comparison : -comparison;
                    });

                    // Apply pagination after sorting exploded data
                    const paginatedData = formattedData.slice(
                        skip,
                        skip + limit
                    );

                    // Replace formattedData with sorted and paginated version
                    formattedData.length = 0;
                    formattedData.push(...paginatedData);
                } else {
                    // Check if this is a virtual field that needs sorting on formatted data
                    const virtualConfig = oneToManySortConfig.fieldConfig
                        ? getVirtualFieldConfig(
                            oneToManySortConfig.fieldConfig.table ||
                            primaryTable,
                            oneToManySortConfig.fieldConfig.field
                        )
                        : null;

                    if (virtualConfig && virtualConfig.requiresInMemorySort) {
                        // Sort formatted data using the computed virtual field value
                        const sortFieldConfig = config.fields?.find(
                            (f: any) =>
                                f.table === virtualConfig.table &&
                                f.field === virtualConfig.field
                        );
                        const sortOutputKey = sortFieldConfig
                            ? getFieldOutputKey(sortFieldConfig)
                            : `${virtualConfig.table}.${virtualConfig.field}`;
                        const sortDirection = oneToManySortConfig.sortDirection;
                        const isAsc = sortDirection === "asc";

                        // If the field is not in the report config, we need to add it to each row before sorting
                        // We'll need to extract it from the raw data using the row ID
                        if (
                            !sortFieldConfig &&
                            formattedData.length > 0 &&
                            rawData.length > 0
                        ) {
                            // Create a map of formatted row IDs to raw data rows
                            const rawDataMap = new Map();
                            rawData.forEach((rawRow: any) => {
                                const rawId =
                                    rawRow.id || rawRow[`${primaryTable}_id`];
                                if (rawId !== undefined && rawId !== null) {
                                    rawDataMap.set(String(rawId), rawRow);
                                }
                            });

                            // Add the virtual field value to each formatted row
                            for (let i = 0; i < formattedData.length; i++) {
                                const formattedRow = formattedData[i];
                                const formattedId = formattedRow.id;

                                // Try to find the raw row by ID (handle cases where ID might be composite)
                                let rawRow: any = null;
                                if (formattedId) {
                                    // Try exact match first
                                    rawRow = rawDataMap.get(
                                        String(formattedId)
                                    );

                                    // If not found and ID contains a dash (composite ID from one-to-many), try the base ID
                                    if (
                                        !rawRow &&
                                        String(formattedId).includes("-")
                                    ) {
                                        const baseId =
                                            String(formattedId).split("-")[0];
                                        rawRow = rawDataMap.get(baseId);
                                    }

                                    // If still not found, try to find by matching the first part of composite ID
                                    if (!rawRow) {
                                        for (const [id, row] of Array.from(
                                            rawDataMap.entries()
                                        )) {
                                            if (
                                                String(formattedId).startsWith(
                                                    id
                                                )
                                            ) {
                                                rawRow = row;
                                                break;
                                            }
                                        }
                                    }
                                }

                                if (rawRow) {
                                    const extractedValue =
                                        virtualConfig.extractor(rawRow);
                                    formattedRow[sortOutputKey] =
                                        extractedValue;
                                } else {
                                    // If we can't find the raw row, set to null
                                    formattedRow[sortOutputKey] = null;
                                }
                            }
                        }

                        formattedData.sort((a, b) => {
                            const aValue = a[sortOutputKey];
                            const bValue = b[sortOutputKey];

                            // Handle null/undefined values
                            if (
                                aValue === null ||
                                aValue === undefined ||
                                aValue === ""
                            ) {
                                return isAsc ? 1 : -1;
                            }
                            if (
                                bValue === null ||
                                bValue === undefined ||
                                bValue === ""
                            ) {
                                return isAsc ? -1 : 1;
                            }

                            // Compare values
                            let comparison = 0;
                            if (
                                typeof aValue === "string" &&
                                typeof bValue === "string"
                            ) {
                                comparison = aValue.localeCompare(bValue);
                            } else {
                                comparison =
                                    aValue > bValue
                                        ? 1
                                        : aValue < bValue
                                            ? -1
                                            : 0;
                            }

                            return isAsc ? comparison : -comparison;
                        });

                        // Apply pagination after sorting
                        const paginatedData = formattedData.slice(
                            skip,
                            skip + limit
                        );
                        formattedData.length = 0;
                        formattedData.push(...paginatedData);
                    } else {
                        // General in-memory sort for non-virtual or already formatted fields (like CustomerPolicy backed fields)
                        const sortFieldConfig = oneToManySortConfig.fieldConfig || config.fields?.find(
                            (f: any) =>
                                (f.table === oneToManySortConfig.relationTable &&
                                    f.field === oneToManySortConfig.relationField) ||
                                f.field === `${oneToManySortConfig.relationName}.${oneToManySortConfig.relationField}`
                        );

                        const sortOutputKey = sortFieldConfig
                            ? getFieldOutputKey(sortFieldConfig)
                            : oneToManySortConfig.fieldConfig
                                ? getFieldOutputKey(oneToManySortConfig.fieldConfig)
                                : `${oneToManySortConfig.relationName}.${oneToManySortConfig.relationField}`;

                        const sortDirection = oneToManySortConfig.sortDirection;
                        const isAsc = sortDirection === "asc";

                        formattedData.sort((a, b) => {
                            const aValue = a[sortOutputKey];
                            const bValue = b[sortOutputKey];

                            // Handle null/undefined/empty values
                            if (aValue === null || aValue === undefined || aValue === "") {
                                return isAsc ? 1 : -1;
                            }
                            if (bValue === null || bValue === undefined || bValue === "") {
                                return isAsc ? -1 : 1;
                            }

                            // Compare values
                            let comparison = 0;
                            if (typeof aValue === "string" && typeof bValue === "string") {
                                comparison = aValue.localeCompare(bValue);
                            } else {
                                comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                            }

                            return isAsc ? comparison : -comparison;
                        });

                        // Apply pagination after sorting
                        const paginatedData = formattedData.slice(
                            skip,
                            skip + limit
                        );
                        formattedData.length = 0;
                        formattedData.push(...paginatedData);
                    }
                }
            }

            let resultData = formattedData;
            let aggregationTotals: Record<string, number> | undefined;
            let formulaWarnings: import("@/shared/reportFormula/types").FormulaWarningSummary[] =
                [];

            const metadataTables = REPORT_METADATA.tables as Array<{
                name: string;
                fields: Array<{ name: string; type: string }>;
            }>;
            const formulaApplyResult = applyFormulasToRows(
                formattedData,
                processedConfig,
                {
                    locale: params.locale,
                    accountCurrency,
                    metadataTables,
                }
            );
            resultData = formulaApplyResult.rows;
            formulaWarnings = [...formulaApplyResult.warnings];

            if (shouldApplyGroupedExecution) {
                const groupedFormulaWarnings = new Map<
                    string,
                    { label: string; invalidCount: number }
                >();
                const groupedRows = this.applyGroupingAndAggregation(
                    resultData,
                    processedConfig,
                    primaryTable,
                    params.locale,
                    accountCurrency,
                    groupedFormulaWarnings
                );
                for (const [formulaId, summary] of Array.from(
                    groupedFormulaWarnings.entries()
                )) {
                    const existing = formulaWarnings.find(
                        (w) => w.formulaId === formulaId
                    );
                    if (existing) {
                        existing.invalidCount += summary.invalidCount;
                    } else if (summary.invalidCount > 0) {
                        formulaWarnings.push({
                            formulaId,
                            label: summary.label,
                            invalidCount: summary.invalidCount,
                        });
                    }
                }
                const effectiveSortField = this.getSortFieldFromParamsOrConfig(
                    params,
                    processedConfig
                );
                const sortDirection =
                    (params.sortDirection?.toLowerCase() as "asc" | "desc") ||
                    (processedConfig.sorting?.[0]?.direction?.toLowerCase() as
                        | "asc"
                        | "desc") ||
                    "asc";
                const isAsc = sortDirection === "asc";

                if (effectiveSortField) {
                    groupedRows.sort((a, b) =>
                        this.compareSortValues(
                            a[effectiveSortField],
                            b[effectiveSortField],
                            isAsc
                        )
                    );
                }

                totalRecords = groupedRows.length;

                const countTotals: Record<string, number> = {};
                for (const field of processedConfig.fields || []) {
                    if (field.aggregation !== "COUNT") continue;
                    const outputKey = getFieldOutputKey(field);
                    countTotals[outputKey] = groupedRows.reduce((sum, row) => {
                        const raw = row[outputKey];
                        if (raw === null || raw === undefined) return sum;
                        const n =
                            typeof raw === "number"
                                ? raw
                                : parseFloat(String(raw));
                        return sum + (Number.isNaN(n) ? 0 : n);
                    }, 0);
                }
                if (Object.keys(countTotals).length > 0) {
                    aggregationTotals = countTotals;
                }

                resultData = groupedRows.slice(skip, skip + limit);
            }

            const executionTimeMs = Date.now() - startTime;

            // Log execution (will be set by API with executed_by)
            // Note: Prisma client needs to be regenerated after schema changes
            try {
                await (prisma as any).reportExecution.create({
                    data: {
                        report_id: params.reportId,
                        executed_by: null,
                        execution_config: params.filters || {},
                        result_count: resultData.length,
                        execution_time_ms: executionTimeMs,
                    },
                });
            } catch (_execError) {
                // Log but don't fail execution if logging fails
                // Error is silently ignored to not break report execution
            }

            // Add standardized 'name' field to each row for generic display
            // This ensures all list pages can use row.name regardless of entity type
            resultData.forEach((row: any) => {
                if (!row.name) {
                    // Try to extract name based on primary table type
                    row.name = this.extractEntityName(row, primaryTable);
                }
            });

            return {
                data: resultData,
                totalRecords,
                executionTimeMs,
                ...(aggregationTotals ? { aggregationTotals } : {}),
                ...(formulaWarnings.length > 0 ? { formulaWarnings } : {}),
            };
        } catch (error) {
            if (error instanceof CreditInsuranceProductDisabledForReportError) {
                throw error;
            }
            // Enhanced error logging with full context
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            // Get report config for context
            let reportConfig = null;
            try {
                const report = await (prisma as any).report.findUnique({
                    where: { id: params.reportId },
                    select: { report_config: true, name: true },
                });
                reportConfig = report?.report_config;
            } catch (_e) {
                // Ignore errors when fetching report for logging
            }

            // Build detailed error context
            const errorContext = {
                reportId: params.reportId,
                accountId: params.accountId,
                reportName: reportConfig
                    ? (reportConfig as any).name
                    : "unknown",
                reportConfig: reportConfig,
                filters: params.filters,
                page: params.page,
                limit: params.limit,
                sortField: params.sortField,
                sortDirection: params.sortDirection,
                search: params.search,
                errorMessage,
                errorStack,
                errorType: error?.constructor?.name || typeof error,
            };

            // Log detailed error
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to execute report ${params.reportId}: ${errorMessage}`,
                "ReportExecutionService",
                JSON.stringify(errorContext, null, 2) as any,
                params.accountId
            );

            // Error logged via LogService above

            // Re-throw with enhanced error message
            const enhancedError = new Error(
                `Report execution failed: ${errorMessage}${errorStack ? `\nStack: ${errorStack}` : ""}`
            );
            (enhancedError as any).originalError = error;
            (enhancedError as any).context = errorContext;
            throw enhancedError;
        }
    }

    /**
     * Format raw database data to report format
     */
    private async formatData(
        rawData: any[],
        config: ReportConfig,
        primaryTable: string,
        oneToManyRelationTable: OneToManyRelationTable | null,
        locale?: string,
        timezone?: string,
        rowOffset: number = 0,
        accountCurrency: string = "USD",
        isCreditOnlyAccountForReport: boolean = false,
        accountLanguage?: string
    ): Promise<any[]> {
        const formattedData: any[] = [];

        for (let rowIndex = 0; rowIndex < rawData.length; rowIndex++) {
            const row = rawData[rowIndex];
            const globalIndex = rowOffset + rowIndex;
            // If we have a one-to-many relation, create one row per related record
            if (oneToManyRelationTable) {
                let relationArray =
                    row[oneToManyRelationTable.relationName] || [];

                // Generic solution: Filter related records based on filters applied to the one-to-many table
                // This ensures that when we explode the data (one row per related record),
                // we only show records that match ALL filters on the child table.
                // 
                // Example: If Customer is primary and Activity is one-to-many:
                // - Query finds customers with at least one activity matching the filter (using Activity.some)
                // - But when exploding, we need to filter activities to only those matching the filter
                // - This works for ANY one-to-many relation table (Activity, Invoice, Contact, etc.)
                // - And for ANY filter field and operator on that table
                const oneToManyFilters = config.filters?.filter(
                    (f) => f.table === oneToManyRelationTable.table
                );
                if (oneToManyFilters && oneToManyFilters.length > 0) {
                    relationArray = relationArray.filter((relatedRecord: any) => {
                        // All filters must match (AND logic)
                        return oneToManyFilters.every((filter) => {
                            const fieldName = filter.field.includes(".")
                                ? filter.field.split(".").pop() ||
                                  filter.field
                                : filter.field;
                            // Parent rows already matched via Prisma WHERE; if the
                            // filter column was not included in relation select,
                            // do not drop rows in memory (would zero out aggregations).
                            if (
                                relatedRecord[fieldName] === undefined &&
                                !filter.field.includes(".")
                            ) {
                                return true;
                            }
                            return this.matchesFilter(
                                relatedRecord,
                                filter,
                                oneToManyRelationTable.table
                            );
                        });
                    });
                }

                // If no related records, still create one row with null values for related fields
                if (relationArray.length === 0) {
                    const formatted = await this.formatSingleRow(
                        row,
                        config,
                        primaryTable,
                        globalIndex,
                        oneToManyRelationTable,
                        null,
                        undefined,
                        locale,
                        timezone,
                        accountCurrency,
                        isCreditOnlyAccountForReport,
                        accountLanguage
                    );
                    formattedData.push(formatted);
                } else {
                    // Create one row per related record (now filtered)
                    for (let relatedIndex = 0; relatedIndex < relationArray.length; relatedIndex++) {
                        const relatedRecord = relationArray[relatedIndex];
                        const formatted = await this.formatSingleRow(
                            row,
                            config,
                            primaryTable,
                            globalIndex,
                            oneToManyRelationTable,
                            relatedRecord,
                            relatedIndex,
                            locale,
                            timezone,
                            accountCurrency,
                            isCreditOnlyAccountForReport,
                            accountLanguage
                        );
                        formattedData.push(formatted);
                    }
                }
            } else {
                // No one-to-many relation - process normally (one row per primary record)
                const formatted = await this.formatSingleRow(
                    row,
                    config,
                    primaryTable,
                    globalIndex,
                    null,
                    null,
                    undefined,
                    locale,
                    timezone,
                    accountCurrency,
                    isCreditOnlyAccountForReport,
                    accountLanguage
                );
                formattedData.push(formatted);
            }
        }

        return formattedData;
    }

    /**
     * Format a single row of data
     */
    private async formatSingleRow(
        row: any,
        config: ReportConfig,
        primaryTable: string,
        rowIndex: number,
        oneToManyRelationTable: OneToManyRelationTable | null,
        relatedRecord: any | null,
        relatedIndex?: number,
        locale?: string,
        timezone?: string,
        accountCurrency: string = "USD",
        isCreditOnlyAccountForReport: boolean = false,
        accountLanguage?: string
    ): Promise<any> {
        const formatted: any = {};

        // Set ID
        if (oneToManyRelationTable && relatedRecord) {
            formatted.id = `${row.id || rowIndex}-${relatedRecord.id || relatedIndex || 0}`;
        } else {
            formatted.id =
                row.id || row[`${primaryTable}_id`] || `row-${rowIndex}`;
        }

        // Always include customer_id when Customer table is in the report (for linking)
        // This is a special case for navigation/linking purposes, not just for display
        if (primaryTable === "Customer") {
            formatted.customer_id = row.id;
        } else if (primaryTable === "Contact") {
            // Contact is primary - include customer_id for linking
            if (row.customer_id) {
                formatted.customer_id = row.customer_id;
            }
        } else if (config.tables.includes("Customer")) {
            // Customer is a joined table - try to get customer_id from relation
            const customerRelationName = this.getRelationName(
                primaryTable,
                "Customer"
            );
            if (customerRelationName && row[customerRelationName]) {
                const customerData = Array.isArray(row[customerRelationName])
                    ? row[customerRelationName][0]
                    : row[customerRelationName];
                if (customerData) {
                    formatted.customer_id = customerData.id;
                }
            }
            if (!formatted.customer_id && row.customer_id != null) {
                formatted.customer_id = row.customer_id;
            }
        }

        // Note: ID fields are no longer filtered here - they are kept in data for operations
        // but filtered from display in the frontend (viewColumnGenerator.tsx)
        // This allows ID fields to be available for delete/edit operations while keeping UI clean
        // Any ID fields explicitly included in the report config will now be included in the data

        if (config.fields && config.fields.length > 0) {
            for (const fieldConfig of config.fields) {
                // Include all fields including ID fields - filtering happens in frontend display

                let fieldValue: any = null;

                if (
                    fieldConfig.field.includes(".") &&
                    fieldConfig.table === primaryTable
                ) {
                    const [relationName, ...relationFieldParts] =
                        fieldConfig.field.split(".");
                    const relationFieldPath = relationFieldParts.join(".");
                    if (
                        primaryTable === "Customer" &&
                        isCustomerPolicyBackedReportField(fieldConfig.field)
                    ) {
                        fieldValue = extractCustomerPolicyReportField(
                            row,
                            fieldConfig.field,
                            oneToManyRelationTable?.table === "Invoice" ? relatedRecord : undefined
                        );
                    } else if (
                        primaryTable === "Customer" &&
                        isTrendCostBackedReportField(fieldConfig.field)
                    ) {
                        fieldValue = extractCustomerTrendCostReportField(
                            row,
                            fieldConfig.field
                        );
                    } else if (
                        primaryTable === "Invoice" &&
                        isInvoicePolicyReportField(fieldConfig.field)
                    ) {
                        fieldValue = extractInvoicePolicyReportField(
                            row,
                            fieldConfig.field
                        );
                    } else if (
                        primaryTable === "Customer" &&
                        (relationName === "Person" ||
                            relationName === "Company")
                    ) {
                        if (row[relationName]) {
                            fieldValue = this.extractNestedValueFromObject(
                                row[relationName],
                                relationFieldPath
                            );
                        }
                    } else if (row[relationName]) {
                        // General handling for other relation fields (Country, State, Owner, BusinessUnit, ParentCustomer)
                        const relationData = Array.isArray(row[relationName])
                            ? row[relationName][0]
                            : row[relationName];
                        if (relationData) {
                            fieldValue = this.extractNestedValueFromObject(
                                relationData,
                                relationFieldPath
                            );
                        }
                    }

                    // Customer address fields can be stored on Company.
                    if (
                        fieldValue == null &&
                        primaryTable === "Customer" &&
                        relationFieldPath === "name"
                    ) {
                        if (relationName === "Country") {
                            fieldValue =
                                row.Company?.Country?.name ??
                                row.Company?.country?.name ??
                                null;
                        } else if (relationName === "State") {
                            fieldValue =
                                row.Company?.State?.name ??
                                row.Company?.state?.name ??
                                null;
                        }
                    }
                } else if (fieldConfig.table === primaryTable) {
                    // Check if this is created_by or modified_by field
                    if (
                        fieldConfig.field === "created_by" ||
                        fieldConfig.field === "modified_by"
                    ) {
                        fieldValue = this.extractUserName(
                            row,
                            primaryTable,
                            fieldConfig.field
                        );
                    } else if (
                        this.isLegacyLocationField(
                            primaryTable,
                            fieldConfig.field
                        )
                    ) {
                        fieldValue = this.extractLegacyLocationValue(
                            row,
                            fieldConfig.field
                        );
                    } else if (fieldConfig.field === "parent_customer_name") {
                        // Special handling: parent_customer_name is computed from ParentCustomer relation
                        fieldValue =
                            SpecialFieldHandler.extractParentCustomerName(row);
                        // Also include parent_customer_id for linking purposes
                        if (row.parent_customer_id) {
                            formatted.parent_customer_id =
                                row.parent_customer_id;
                        } else if (row.ParentCustomer?.id) {
                            formatted.parent_customer_id =
                                row.ParentCustomer.id;
                        }
                    } else if (fieldConfig.field === "category") {
                        if (isCreditOnlyAccountForReport) {
                            fieldValue = null;
                            const outputKey = getFieldOutputKey(fieldConfig);
                            formatted[`__automation_stuck_${outputKey}`] = false;
                        } else if (
                            row.CustomerCollectionPeriod &&
                            Array.isArray(row.CustomerCollectionPeriod) &&
                            row.CustomerCollectionPeriod.length > 0
                        ) {
                            // Get the first collection period (should only be one since we filtered for period_end_date null)
                            const activePeriod =
                                row.CustomerCollectionPeriod[0];
                            const category =
                                activePeriod.current_category || null;
                            const step = activePeriod.last_automated_step;
                            const automationStuck =
                                (row as { automation_stuck_no_contacts?: boolean })
                                    ?.automation_stuck_no_contacts ??
                                (row as { Customer?: { automation_stuck_no_contacts?: boolean } })
                                    ?.Customer?.automation_stuck_no_contacts ??
                                false;

                            // Only Automated shows last_automated_step in the grid (e.g. "Automated (2)").
                            if (category) {
                                fieldValue =
                                    category === "Automated"
                                        ? `${category} (${step || 1})`
                                        : category;
                            } else {
                                fieldValue = null;
                            }

                            // Store automation_stuck flag as metadata for frontend to display warning icon
                            const outputKey = getFieldOutputKey(fieldConfig);
                            formatted[`__automation_stuck_${outputKey}`] =
                                automationStuck;
                        } else if (
                            row.CustomerCollectionPeriod &&
                            !Array.isArray(row.CustomerCollectionPeriod)
                        ) {
                            // Handle case where it's not an array (shouldn't happen, but just in case)
                            const category =
                                row.CustomerCollectionPeriod.current_category ||
                                null;
                            const step =
                                row.CustomerCollectionPeriod
                                    .last_automated_step;
                            const automationStuck =
                                (row as { automation_stuck_no_contacts?: boolean })
                                    ?.automation_stuck_no_contacts ??
                                (row as { Customer?: { automation_stuck_no_contacts?: boolean } })
                                    ?.Customer?.automation_stuck_no_contacts ??
                                false;

                            if (category) {
                                fieldValue =
                                    category === "Automated"
                                        ? `${category} (${step || 1})`
                                        : category;
                            } else {
                                fieldValue = null;
                            }

                            // Store automation_stuck flag as metadata
                            const outputKey = getFieldOutputKey(fieldConfig);
                            formatted[`__automation_stuck_${outputKey}`] =
                                automationStuck;
                        } else {
                            fieldValue = null;
                        }
                    } else if (
                        SpecialFieldHandler.shouldMapToCompany(
                            primaryTable,
                            fieldConfig.field
                        )
                    ) {
                        // Special handling: Customer.name and Customer.company_number are actually Company fields
                        fieldValue = SpecialFieldHandler.extractCustomerName(
                            row,
                            fieldConfig.field
                        );
                    } else if (
                        primaryTable === "Customer" &&
                        isCustomerPolicyBackedReportField(fieldConfig.field)
                    ) {
                        fieldValue = extractCustomerPolicyReportField(
                            row,
                            fieldConfig.field,
                            oneToManyRelationTable?.table === "Invoice" ? relatedRecord : undefined
                        );
                    } else if (
                        primaryTable === "Customer" &&
                        isTrendCostBackedReportField(fieldConfig.field)
                    ) {
                        fieldValue = extractCustomerTrendCostReportField(
                            row,
                            fieldConfig.field
                        );
                    } else if (
                        primaryTable === "Dispute" &&
                        fieldConfig.field === "dispute_number"
                    ) {
                        // Special handling: dispute_number is an alias for the id field
                        // Format as "DIS-XXXXXX" to match DisputeList.tsx
                        fieldValue = `DIS-${row.id.toString().padStart(6, "0")}`;
                    } else if (
                        primaryTable === "Dispute" &&
                        fieldConfig.field === "dispute_reason"
                    ) {
                        // Special handling: dispute_reason comes from DisputeReason relation
                        fieldValue = row.DisputeReason?.name ?? null;
                    } else if (
                        primaryTable === "Dispute" &&
                        fieldConfig.field === "assigned_to"
                    ) {
                        // Special handling: assigned_to comes from User relation via owner_id
                        fieldValue =
                            row.User_CustomerDispute_owner_idToUser?.name ??
                            null;
                    } else if (
                        primaryTable === "Dispute" &&
                        fieldConfig.field === "amount_in_dispute"
                    ) {
                        // Special handling: amount_in_dispute calculated from DisputeInvoice
                        if (
                            row.DisputeInvoice &&
                            Array.isArray(row.DisputeInvoice)
                        ) {
                            const totalAmount = row.DisputeInvoice.reduce(
                                (sum: number, di: any) => {
                                    const debt =
                                        di.Invoice?.outstanding_debt || 0;
                                    return (
                                        sum +
                                        (typeof debt === "number" ? debt : 0)
                                    );
                                },
                                0
                            );
                            fieldValue = totalAmount;
                        } else {
                            fieldValue = 0;
                        }
                    } else if (
                        primaryTable === "Dispute" &&
                        fieldConfig.field === "days_past_due"
                    ) {
                        // Special handling: days_past_due calculated from oldest Invoice due_date
                        if (
                            row.DisputeInvoice &&
                            Array.isArray(row.DisputeInvoice)
                        ) {
                            const invoiceDueDates = row.DisputeInvoice.map(
                                (di: any) => di.Invoice?.due_date
                            )
                                .filter(
                                    (date: any) =>
                                        date !== null && date !== undefined
                                )
                                .map((date: any) => new Date(date));

                            if (invoiceDueDates.length > 0) {
                                const oldestDueDate = new Date(
                                    Math.min(
                                        ...invoiceDueDates.map((d: Date) =>
                                            d.getTime()
                                        )
                                    )
                                );
                                const today = new Date();
                                const diffTime =
                                    today.getTime() - oldestDueDate.getTime();
                                const diffDays = Math.ceil(
                                    diffTime / (1000 * 60 * 60 * 24)
                                );
                                fieldValue = diffDays > 0 ? diffDays : 0;
                            } else {
                                fieldValue = null;
                            }
                        } else {
                            fieldValue = null;
                        }
                    } else if (
                        primaryTable === "Activity" &&
                        fieldConfig.field === "title"
                    ) {
                        // Special handling: Activity.title needs parameter replacement using ActivityService
                        fieldValue = await this.formatActivityTitleWithService(
                            row,
                            locale,
                            timezone
                        );
                    } else {
                        const primaryVirtualConfig = getVirtualFieldConfig(
                            primaryTable,
                            fieldConfig.field
                        );
                        fieldValue = primaryVirtualConfig
                            ? primaryVirtualConfig.extractor(row)
                            : row[fieldConfig.field];
                    }
                } else if (
                    oneToManyRelationTable &&
                    fieldConfig.table === oneToManyRelationTable.table
                ) {
                    // Field from the one-to-many relation table
                    if (relatedRecord) {
                        // Check if this is created_by or modified_by field
                        if (
                            fieldConfig.field === "created_by" ||
                            fieldConfig.field === "modified_by"
                        ) {
                            fieldValue = this.extractUserName(
                                relatedRecord,
                                oneToManyRelationTable.table,
                                fieldConfig.field
                            );
                        } else if (
                            oneToManyRelationTable.table === "Activity" &&
                            fieldConfig.field === "title"
                        ) {
                            // Special handling: Activity.title needs parameter replacement using ActivityService
                            fieldValue = await this.formatActivityTitleWithService(
                                relatedRecord,
                                locale,
                                timezone
                            );
                        } else {
                            const oneToManyVirtualConfig = getVirtualFieldConfig(
                                oneToManyRelationTable.table,
                                fieldConfig.field
                            );
                            fieldValue = oneToManyVirtualConfig
                                ? oneToManyVirtualConfig.extractor(relatedRecord)
                                : relatedRecord[fieldConfig.field];
                        }
                    } else {
                        // No related record - null value
                        fieldValue = null;
                    }
                } else {
                    // Field from another joined table (one-to-one or many-to-one)
                    const relationName = this.getRelationName(
                        primaryTable,
                        fieldConfig.table
                    );
                    if (relationName && row[relationName]) {
                        const relationData = Array.isArray(row[relationName])
                            ? row[relationName][0]
                            : row[relationName];
                        if (relationData) {
                            // Check if this is created_by or modified_by field
                            if (
                                fieldConfig.field === "created_by" ||
                                fieldConfig.field === "modified_by"
                            ) {
                                fieldValue = this.extractUserName(
                                    relationData,
                                    fieldConfig.table,
                                    fieldConfig.field
                                );
                            } else if (
                                fieldConfig.table === "Activity" &&
                                fieldConfig.field === "title"
                            ) {
                                // Special handling: Activity.title needs parameter replacement using ActivityService
                                fieldValue = await this.formatActivityTitleWithService(
                                    relationData,
                                    locale,
                                    timezone
                                );
                            } else if (
                                SpecialFieldHandler.shouldMapToCompany(
                                    fieldConfig.table,
                                    fieldConfig.field
                                )
                            ) {
                                // Special handling: Customer.name and Customer.company_number are actually Company fields
                                fieldValue =
                                    SpecialFieldHandler.extractCustomerNameFromRelation(
                                        relationData,
                                        fieldConfig.field
                                    );
                            } else if (
                                fieldConfig.table === "Customer" &&
                                isCustomerPolicyBackedReportField(
                                    fieldConfig.field
                                )
                            ) {
                                fieldValue =
                                    primaryTable === "Invoice" &&
                                    isInvoiceReportPolicyNumberField(
                                        fieldConfig.field
                                    )
                                        ? resolvePolicyNumberForInvoiceReportRow(
                                              row,
                                              fieldConfig.field,
                                              relationData
                                          )
                                        : extractCustomerPolicyReportField(
                                              relationData,
                                              fieldConfig.field,
                                              primaryTable === "Invoice" ? row : undefined
                                          );
                            } else if (
                                fieldConfig.table === "Customer" &&
                                isTrendCostBackedReportField(fieldConfig.field)
                            ) {
                                fieldValue = extractCustomerTrendCostReportField(
                                    relationData,
                                    fieldConfig.field
                                );
                            } else if (
                                fieldConfig.table === "Invoice" &&
                                isInvoicePolicyReportField(fieldConfig.field)
                            ) {
                                fieldValue = extractInvoicePolicyReportField(
                                    row,
                                    fieldConfig.field
                                );
                            } else {
                                const joinedVirtualConfig = getVirtualFieldConfig(
                                    fieldConfig.table,
                                    fieldConfig.field
                                );
                                fieldValue = joinedVirtualConfig
                                    ? joinedVirtualConfig.extractor(relationData)
                                    : this.isLegacyLocationField(
                                            fieldConfig.table,
                                            fieldConfig.field
                                        )
                                      ? this.extractLegacyLocationValue(
                                            relationData,
                                            fieldConfig.field
                                        )
                                    : this.extractNestedValueFromObject(
                                          relationData,
                                          fieldConfig.field
                                      );
                            }
                        }
                    } else if (
                        !relationName &&
                        oneToManyRelationTable &&
                        relatedRecord
                    ) {
                        // Nested relation: e.g. InvoiceStatus when primary is Customer (row is Customer, relatedRecord is Invoice)
                        const nestedRelationName = this.getRelationName(
                            oneToManyRelationTable.table,
                            fieldConfig.table
                        );
                        if (
                            nestedRelationName &&
                            relatedRecord[nestedRelationName]
                        ) {
                            const nestedData =
                                relatedRecord[nestedRelationName];
                            if (
                                fieldConfig.field === "created_by" ||
                                fieldConfig.field === "modified_by"
                            ) {
                                fieldValue = this.extractUserName(
                                    nestedData,
                                    fieldConfig.table,
                                    fieldConfig.field
                                );
                            } else {
                                fieldValue = nestedData[fieldConfig.field];
                            }
                        }
                    }
                }

                // Format field value based on type (date or amount)
                if (fieldValue !== null && fieldValue !== undefined) {
                    // Format date/datetime fields
                    if (
                        this.isDateField(fieldConfig.table, fieldConfig.field)
                    ) {
                        try {
                            const dateValue =
                                fieldValue instanceof Date
                                    ? fieldValue
                                    : new Date(fieldValue);

                            if (!isNaN(dateValue.getTime())) {
                                // Determine format type: date vs datetime
                                const fieldNameLower =
                                    fieldConfig.field.toLowerCase();
                                const formatType =
                                    fieldNameLower.includes("date") &&
                                        !fieldNameLower.includes("datetime")
                                        ? "date"
                                        : "datetime";

                                // Use provided locale/timezone or defaults
                                const userLocale = locale || "en-US";
                                const userTimezone = timezone || undefined;

                                const formattedDate = formatDateForDisplay(
                                    dateValue,
                                    formatType,
                                    userLocale,
                                    userTimezone
                                );
                                // Store pre-formatted version for DataGrid display using an internal prefix
                                // Use ___formatted_ prefix so the column generator automatically hides it
                                const formattedKey =
                                    getFieldOutputKey(fieldConfig);

                                formatted[`___formatted_${formattedKey}`] =
                                    formattedDate;
                            }
                        } catch (_error) {
                            // If formatting fails, keep original value
                        }
                    }
                    // Format amount/currency fields
                    else if (
                        this.shouldFormatFieldAsCurrency(
                            fieldConfig.table,
                            fieldConfig.field
                        )
                    ) {
                        try {
                            const numValue =
                                typeof fieldValue === "number"
                                    ? fieldValue
                                    : parseFloat(String(fieldValue));

                            if (!isNaN(numValue)) {
                                const currency =
                                    this.resolveCurrencyForAmountFromRow(
                                        row,
                                        fieldConfig,
                                        primaryTable,
                                        accountCurrency,
                                        relatedRecord
                                    );

                                // Use provided locale or default
                                const userLocale = locale || "en-US";
                                // Determine language from locale (he-IL -> he, en-US -> en)
                                const i18nLanguage = userLocale.startsWith("he")
                                    ? "he"
                                    : "en";

                                const formattedAmount =
                                    formatCurrencyWithRTLSupport(
                                        numValue,
                                        currency,
                                        userLocale,
                                        i18nLanguage
                                    );
                                // Store pre-formatted version for DataGrid display using an internal prefix
                                // We use ___formatted_ (triple underscore) to make it even more obvious and distinct
                                const outputKey =
                                    getFieldOutputKey(fieldConfig);
                                formatted[`___formatted_${outputKey}`] =
                                    formattedAmount;
                            }
                        } catch (_error) {
                            // If formatting fails, keep original value
                        }
                    } else if (
                        fieldConfig.table === "Customer" &&
                        fieldConfig.field === "cost_calculation_method"
                    ) {
                        const label = formatCostCalculationMethodLabel(fieldValue);
                        if (label) {
                            formatted[`___formatted_${getFieldOutputKey(fieldConfig)}`] =
                                label;
                        }
                    } else if (
                        fieldConfig.table === "Invoice" &&
                        fieldConfig.field === "terms_breach_reason"
                    ) {
                        const label = formatTermsBreachReasonForDisplay(
                            String(fieldValue),
                            locale,
                            accountLanguage
                        );
                        if (label) {
                            formatted[
                                `___formatted_${getFieldOutputKey(fieldConfig)}`
                            ] = label;
                            // Also replace raw codes so exports / non-grid consumers show labels.
                            fieldValue = label;
                        }
                    }
                }

                const outputKey = getFieldOutputKey(fieldConfig);
                formatted[outputKey] = fieldValue;
                if (
                    fieldConfig.table === "Customer" &&
                    fieldConfig.field === "policy_id"
                ) {
                    // Keep canonical report key aligned to policy number display.
                    // Avoid duplicating "policy_id" bare key, which creates duplicate columns.
                    formatted["Customer.policy_id"] = fieldValue;
                }

                // Store link metadata if this field should be clickable
                // Pass relatedRecord for one-to-many relations (e.g., Contact fields)
                const linkMetadata = this.getFieldLinkMetadata(
                    fieldConfig,
                    formatted.customer_id != null
                        ? { ...row, customer_id: formatted.customer_id }
                        : row,
                    primaryTable,
                    outputKey,
                    relatedRecord
                );
                if (linkMetadata) {
                    // Store link metadata with a special prefix that won't be displayed as a column
                    formatted[`__link_${outputKey}`] = linkMetadata;
                }

                // Store currency in a hidden format for frontend formatting (not as a separate column)
                const fieldNameLower = fieldConfig.field.toLowerCase();
                if (fieldNameLower.includes("amount")) {
                    if (fieldConfig.table === primaryTable) {
                        // For primary table, check if there's a currency field
                        // This would need to be explicitly selected
                    } else {
                        // For joined tables, try to get currency from relation
                        const relationName = this.getRelationName(
                            primaryTable,
                            fieldConfig.table
                        );
                        if (relationName && row[relationName]) {
                            const relationData = Array.isArray(
                                row[relationName]
                            )
                                ? row[relationName][0]
                                : row[relationName];
                            if (relationData) {
                                if (relationData.customer_currency) {
                                    // Store currency with a special prefix that won't be displayed as a column
                                    formatted[`__currency_${outputKey}`] =
                                        relationData.customer_currency;
                                } else if (relationData.currency) {
                                    formatted[`__currency_${outputKey}`] =
                                        relationData.currency;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            Object.assign(formatted, row);
            if (!formatted.id) {
                formatted.id = row.id || `row-${rowIndex}`;
            }
        }

        return formatted;
    }

    /**
     * Extract entity name from formatted row data
     * Generic function that works for all entity types
     */
    private extractEntityName(row: any, primaryTable: string): string {
        // Check if name already exists in row (from field aliases)
        // Try common name field formats
        const nameKeys = [
            "name",
            `${primaryTable}.name`,
            `Customer.name`,
            `Company.name`,
            `Person.first_name`,
            `Person.last_name`,
        ];

        for (const key of nameKeys) {
            if (
                row[key] !== undefined &&
                row[key] !== null &&
                row[key] !== ""
            ) {
                // If it's a Person name field, try to construct full name
                if (key === "Person.first_name") {
                    const lastName = row["Person.last_name"] || "";
                    return `${row[key]} ${lastName}`.trim();
                }
                if (key === "Person.last_name") {
                    const firstName = row["Person.first_name"] || "";
                    return `${firstName} ${row[key]}`.trim();
                }
                return String(row[key]);
            }
        }

        // Special handling for Customer: construct from Person or Company
        if (primaryTable === "Customer") {
            // Try Person fields
            const firstName =
                row["Person.first_name"] ||
                row["Customer.Person.first_name"] ||
                "";
            const lastName =
                row["Person.last_name"] ||
                row["Customer.Person.last_name"] ||
                "";
            if (firstName || lastName) {
                return `${firstName} ${lastName}`.trim();
            }

            // Try Company name
            const companyName =
                row["Company.name"] ||
                row["Customer.Company.name"] ||
                row.Company?.name ||
                "";
            if (companyName) {
                return companyName;
            }
        }

        // For other entities, try to find any name-like field
        // Check all keys in the row for potential name fields
        const namePatterns = [
            /name/i,
            /title/i,
            /description/i,
            /label/i,
            /number/i, // invoice_number, customer_number, etc.
        ];

        for (const key in row) {
            if (
                namePatterns.some((pattern) => pattern.test(key)) &&
                row[key] !== undefined &&
                row[key] !== null &&
                row[key] !== ""
            ) {
                return String(row[key]);
            }
        }

        // Fallback: use ID if available
        const id =
            row.id || row[`${primaryTable}.id`] || row[`${primaryTable}_id`];
        if (id) {
            return `${primaryTable} ${id}`;
        }

        return `${primaryTable} row`;
    }

    /**
     * Get Prisma model name from table name
     */
    private getModelName(table: string): string {
        return MODEL_NAME_MAP[table] || table;
    }

    /**
     * Format Activity title by replacing parameters using ActivityService.generateActivityTitle
     */
    private async formatActivityTitleWithService(
        activityRecord: any,
        locale?: string,
        timezone?: string
    ): Promise<string> {
        if (!activityRecord || !activityRecord.title) {
            return activityRecord?.title || "";
        }

        try {
            const { ActivityService } = await import("./ActivityService");
            const activityService = new ActivityService();
            const title = activityRecord.title;

            // Parse title_params if it's a string (JSON)
            let titleParams = {};
            if (activityRecord.title_params) {
                if (typeof activityRecord.title_params === "string") {
                    try {
                        titleParams = JSON.parse(activityRecord.title_params);
                    } catch {
                        titleParams = {};
                    }
                } else if (typeof activityRecord.title_params === "object") {
                    titleParams = activityRecord.title_params;
                }
            }

            // Load translation resources and create a proper translate function
            let translate: (key: string) => string = (key: string) => key;
            let resources: any = undefined;

            try {
                // Determine language from locale (e.g., "en-US" -> "en", "he-IL" -> "he")
                const language = locale?.split("-")[0] || "en";

                // Load translation files needed for activity titles (incl. dispute/portal templates)
                const [
                    activitiesTranslations,
                    customersTranslations,
                    disputesTranslations,
                    usersTranslations,
                ] = await Promise.all([
                    import(`@/locales/${language}/activities.json`).catch(
                        () => null
                    ),
                    import(`@/locales/${language}/customers.json`).catch(
                        () => null
                    ),
                    import(`@/locales/${language}/disputes.json`).catch(
                        () => null
                    ),
                    import(`@/locales/${language}/users.json`).catch(() => null),
                ]);

                const namespaceDefaults: Record<string, any> = {};
                if (activitiesTranslations?.default) {
                    namespaceDefaults.activities = activitiesTranslations.default;
                }
                if (customersTranslations?.default) {
                    namespaceDefaults.customers = customersTranslations.default;
                }
                if (disputesTranslations?.default) {
                    namespaceDefaults.disputes = disputesTranslations.default;
                }
                if (usersTranslations?.default) {
                    namespaceDefaults.users = usersTranslations.default;
                }

                // Build resources object with all loaded translations
                if (Object.keys(namespaceDefaults).length > 0) {
                    resources = {
                        [language]: namespaceDefaults,
                    };

                    const lookupInNamespace = (
                        nsData: any,
                        keyPath: string
                    ): string | null => {
                        const parts = keyPath.split(".");
                        let value: any = nsData;
                        for (const part of parts) {
                            if (
                                value &&
                                typeof value === "object" &&
                                part in value
                            ) {
                                value = value[part];
                            } else {
                                return null;
                            }
                        }
                        return typeof value === "string" ? value : null;
                    };

                    // Create translate function that can handle nested keys from multiple namespaces
                    translate = (key: string): string => {
                        try {
                            let namespace: string | null = null;
                            let keyToTranslate = key;

                            // i18next "ns:key.path" form
                            if (key.includes(":") && !key.startsWith("http")) {
                                const colonIdx = key.indexOf(":");
                                namespace = key.slice(0, colonIdx);
                                keyToTranslate = key.slice(colonIdx + 1);
                            } else if (key.startsWith("activities.")) {
                                namespace = "activities";
                                keyToTranslate = key.substring(
                                    "activities.".length
                                );
                            } else if (key.startsWith("customers.")) {
                                namespace = "customers";
                                keyToTranslate = key.substring(
                                    "customers.".length
                                );
                            } else if (key.startsWith("disputes.")) {
                                namespace = "disputes";
                                keyToTranslate = key.substring(
                                    "disputes.".length
                                );
                            } else if (key.startsWith("users.")) {
                                namespace = "users";
                                keyToTranslate = key.substring("users.".length);
                            }

                            if (namespace && namespaceDefaults[namespace]) {
                                return (
                                    lookupInNamespace(
                                        namespaceDefaults[namespace],
                                        keyToTranslate
                                    ) || key
                                );
                            }

                            // Try known namespaces in order
                            for (const ns of [
                                "activities",
                                "disputes",
                                "customers",
                                "users",
                            ]) {
                                if (!namespaceDefaults[ns]) continue;
                                const found = lookupInNamespace(
                                    namespaceDefaults[ns],
                                    key
                                );
                                if (found) return found;
                            }

                            return key;
                        } catch {
                            return key;
                        }
                    };
                }
            } catch (error) {
                // Fallback to key-as-is if translations can't be loaded
            }

            // Get ActivityContacts from various possible relation names
            const activityContacts =
                activityRecord.ActivityContact ||
                activityRecord.ActivityContacts ||
                activityRecord.activityContact ||
                activityRecord.activityContacts ||
                [];

            // Reference ActivityService.generateActivityTitle directly to replace parameters
            const formattedTitle = await activityService.generateActivityTitle({
                type: activityRecord.type || "Email",
                status: activityRecord.status || 1,
                ActivitiesSequence: activityRecord.ActivitiesSequence || null,
                Account: activityRecord.Account || null,
                schedule_time: activityRecord.schedule_time || new Date(),
                title: title,
                content: activityRecord.content || "",
                ActivityContacts: activityContacts,
                translate: translate,
                resources: resources, // Translation resources loaded from JSON files
                titleParams: titleParams,
                locale: locale,
                timezone: timezone,
            });

            return formattedTitle || title;
        } catch (error) {
            this.logService.logMessage(
                LogLevel.WARNING,
                `Error formatting Activity title: ${error instanceof Error ? error.message : "Unknown error"}`,
                "ReportExecutionService",
                undefined,
                undefined
            );
            return activityRecord.title || "";
        }
    }

    /**
     * Format data for chart
     */
    public formatForChart(data: any[], config: ReportConfig): any {
        if (!config.chart) {
            return data;
        }

        const { chart } = config;

        // Simple formatting - can be enhanced
        if (chart.type === "table") {
            return data;
        }

        // For charts, group and aggregate data
        if (chart.xAxis && chart.yAxis) {
            const grouped: Record<string, number> = {};
            const xAxisKey =
                resolveLegacyFieldOutputKey(chart.xAxis, config.fields) ||
                chart.xAxis;
            const yAxisKey =
                resolveLegacyFieldOutputKey(chart.yAxis, config.fields) ||
                chart.yAxis;

            for (const row of data) {
                const xValue: any = this.getNestedValue(row, xAxisKey);
                const yValue: any = this.getNestedValue(row, yAxisKey);

                if (xValue !== undefined && yValue !== undefined) {
                    const key = String(xValue);
                    grouped[key] = (grouped[key] || 0) + Number(yValue);
                }
            }

            return Object.entries(grouped).map(([name, value]) => ({
                name,
                value,
            }));
        }

        return data;
    }

    /**
     * Get nested value from object
     */
    private getNestedValue(obj: any, path: string): any {
        if (obj != null && Object.prototype.hasOwnProperty.call(obj, path)) {
            return obj[path];
        }
        return path.split(".").reduce((current, part) => current?.[part], obj);
    }

    /**
     * Check if a record matches a filter condition
     * This is a generic method that works with any table, field, and operator
     * 
     * @param record - The record to check (e.g., an Activity object from the relation array)
     * @param filter - The filter to apply (has table, field, operator, value)
     * @param table - The table name (used for date field detection)
     * @returns true if the record matches the filter, false otherwise
     */
    private matchesFilter(record: any, filter: Filter, table: string): boolean {
        // Get field value - handle cases where field might have table prefix (e.g., "Activity.status")
        // When record is from relation array, it's already the child object, so use just the field name
        let fieldValue: unknown;
        if (table === "Invoice" && isInvoicePolicyReportField(filter.field)) {
            fieldValue = extractInvoicePolicyReportField(record, filter.field);
        } else if (
            table === "Customer" &&
            isCustomerPolicyBackedReportField(filter.field)
        ) {
            fieldValue = extractCustomerPolicyReportField(record, filter.field);
        } else if (
            table === "Customer" &&
            isTrendCostBackedReportField(filter.field)
        ) {
            fieldValue = extractCustomerTrendCostReportField(
                record,
                filter.field
            );
        } else {
            const fieldName = filter.field.includes(".")
                ? filter.field.split(".").pop() || filter.field
                : filter.field;
            fieldValue = record[fieldName];
        }

        // Check if this is a date field using the same logic as ReportQueryBuilder
        const isDate = this.isDateField(table, filter.field);

        // Handle null/undefined values
        if (fieldValue == null) {
            const normalizedOp = FilterOperatorNormalizer.normalize(filter.operator);
            if (normalizedOp === "is_empty" || normalizedOp === "is_null") {
                return true;
            }
            if (normalizedOp === "is_not_empty" || normalizedOp === "is_not_null") {
                return false;
            }
            // For other operators, null values don't match (except is_empty/is_null)
            return false;
        }

        const normalizedOp = FilterOperatorNormalizer.normalize(filter.operator);

        // Handle date comparisons
        if (isDate) {
            return this.matchesDateFilter(fieldValue, filter.value, normalizedOp);
        }

        // Handle string comparisons
        if (typeof fieldValue === "string") {
            return this.matchesStringFilter(fieldValue, filter.value, normalizedOp);
        }

        const numericValue = this.coerceToNumber(fieldValue);
        if (numericValue !== null && !isDate) {
            return this.matchesNumericFilter(
                numericValue,
                filter.value,
                normalizedOp
            );
        }

        // Handle boolean comparisons
        if (typeof fieldValue === "boolean") {
            return this.matchesBooleanFilter(fieldValue, filter.value, normalizedOp);
        }

        // For other types, use generic comparison
        return this.matchesGenericFilter(
            fieldValue,
            filter.value,
            normalizedOp
        );
    }

    /**
     * Check if a date value matches a date filter
     */
    private matchesDateFilter(fieldValue: any, filterValue: any, operator: string): boolean {
        try {
            const recordDate = new Date(fieldValue);
            if (isNaN(recordDate.getTime())) {
                return false; // Invalid date
            }

            switch (operator) {
                case "equals":
                    // Handle date-only strings (YYYY-MM-DD) - check if date falls within the day
                    if (typeof filterValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filterValue)) {
                        const filterDateStart = new Date(filterValue + "T00:00:00.000Z");
                        const filterDateEnd = new Date(filterValue + "T23:59:59.999Z");
                        return recordDate >= filterDateStart && recordDate <= filterDateEnd;
                    }
                    // Handle ISO datetime strings
                    const filterDate = new Date(filterValue);
                    if (isNaN(filterDate.getTime())) {
                        return false;
                    }
                    return recordDate.getTime() === filterDate.getTime();

                case "not_equals":
                    if (typeof filterValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filterValue)) {
                        const filterDateStart = new Date(filterValue + "T00:00:00.000Z");
                        const filterDateEnd = new Date(filterValue + "T23:59:59.999Z");
                        return recordDate < filterDateStart || recordDate > filterDateEnd;
                    }
                    const filterDateNE = new Date(filterValue);
                    if (isNaN(filterDateNE.getTime())) {
                        return true; // Invalid filter date means not equal
                    }
                    return recordDate.getTime() !== filterDateNE.getTime();

                case "less_than":
                    const filterDateLT = new Date(filterValue);
                    if (isNaN(filterDateLT.getTime())) {
                        return false;
                    }
                    return recordDate < filterDateLT;

                case "less_than_or_equal":
                    const filterDateLTE = new Date(filterValue);
                    if (isNaN(filterDateLTE.getTime())) {
                        return false;
                    }
                    return recordDate <= filterDateLTE;

                case "greater_than":
                    const filterDateGT = new Date(filterValue);
                    if (isNaN(filterDateGT.getTime())) {
                        return false;
                    }
                    return recordDate > filterDateGT;

                case "greater_than_or_equal":
                    const filterDateGTE = new Date(filterValue);
                    if (isNaN(filterDateGTE.getTime())) {
                        return false;
                    }
                    return recordDate >= filterDateGTE;

                case "between":
                    if (Array.isArray(filterValue) && filterValue.length === 2) {
                        const startDate = typeof filterValue[0] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filterValue[0])
                            ? new Date(filterValue[0] + "T00:00:00.000Z")
                            : new Date(filterValue[0]);
                        const endDate = typeof filterValue[1] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(filterValue[1])
                            ? new Date(filterValue[1] + "T23:59:59.999Z")
                            : new Date(filterValue[1]);
                        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                            return false;
                        }
                        return recordDate >= startDate && recordDate <= endDate;
                    }
                    return false;

                case "is_empty":
                case "is_null":
                    return false; // Already handled above for null values

                case "is_not_empty":
                case "is_not_null":
                    return true; // Already handled above for null values

                default:
                    return true; // Unknown operator, include the record
            }
        } catch {
            return false; // Invalid date conversion
        }
    }

    /**
     * Check if a string value matches a string filter
     */
    private matchesStringFilter(fieldValue: string, filterValue: any, operator: string): boolean {
        const fieldStr = String(fieldValue).toLowerCase();
        const filterStr = String(filterValue).toLowerCase();

        switch (operator) {
            case "equals":
                return fieldStr === filterStr;

            case "not_equals":
                return fieldStr !== filterStr;

            case "contains":
                return fieldStr.includes(filterStr);

            case "not_contains":
                return !fieldStr.includes(filterStr);

            case "starts_with":
                return fieldStr.startsWith(filterStr);

            case "ends_with":
                return fieldStr.endsWith(filterStr);

            case "in":
                const filterArray = Array.isArray(filterValue) ? filterValue : [filterValue];
                return filterArray.some((v: any) => String(v).toLowerCase() === fieldStr);

            case "is_empty":
            case "is_null":
                return fieldValue.trim() === "";

            case "is_not_empty":
            case "is_not_null":
                return fieldValue.trim() !== "";

            default:
                return true; // Unknown operator, include the record
        }
    }

    /**
     * Check if a numeric value matches a numeric filter
     */
    private matchesNumericFilter(fieldValue: number, filterValue: any, operator: string): boolean {
        const filterNum = Number(filterValue);
        if (isNaN(filterNum)) {
            return false; // Invalid filter value
        }

        switch (operator) {
            case "equals":
                return fieldValue === filterNum;

            case "not_equals":
                return fieldValue !== filterNum;

            case "less_than":
                return fieldValue < filterNum;

            case "less_than_or_equal":
                return fieldValue <= filterNum;

            case "greater_than":
                return fieldValue > filterNum;

            case "greater_than_or_equal":
                return fieldValue >= filterNum;

            case "between":
                if (Array.isArray(filterValue) && filterValue.length === 2) {
                    const startNum = Number(filterValue[0]);
                    const endNum = Number(filterValue[1]);
                    if (isNaN(startNum) || isNaN(endNum)) {
                        return false;
                    }
                    return fieldValue >= startNum && fieldValue <= endNum;
                }
                return false;

            case "in":
                const filterArray = Array.isArray(filterValue) ? filterValue : [filterValue];
                return filterArray.some((v: any) => Number(v) === fieldValue);

            default:
                return true; // Unknown operator, include the record
        }
    }

    /**
     * Check if a boolean value matches a boolean filter
     */
    private matchesBooleanFilter(fieldValue: boolean, filterValue: any, operator: string): boolean {
        const filterBool = filterValue === true || filterValue === "true" || filterValue === 1;

        switch (operator) {
            case "equals":
                return fieldValue === filterBool;

            case "not_equals":
                return fieldValue !== filterBool;

            default:
                return true; // Unknown operator, include the record
        }
    }

    /**
     * Check if a generic value matches a generic filter
     */
    private matchesGenericFilter(fieldValue: any, filterValue: any, operator: string): boolean {
        switch (operator) {
            case "equals":
                return fieldValue === filterValue;

            case "not_equals":
                return fieldValue !== filterValue;

            case "in":
                const filterArray = Array.isArray(filterValue) ? filterValue : [filterValue];
                return filterArray.includes(fieldValue);

            case "is_empty":
            case "is_null":
                return fieldValue == null;

            case "is_not_empty":
            case "is_not_null":
                return fieldValue != null;

            default:
                return true; // Unknown operator, include the record
        }
    }
}
