/**
 * Query builder for report execution
 * Handles building Prisma where, select, and include clauses from report config
 */

import { LogService } from "./LogService";
import {
    DATE_FIELDS_BY_TABLE,
    DATE_INDICATORS,
    DATE_ONLY_FIELDS_BY_TABLE,
    getUserRelationNameForReportTable,
    ONE_TO_MANY_MAP,
    RELATION_MAP,
} from "./ReportExecutionService.constants";
import {
    FilterConditionBuilder,
    FilterOperatorNormalizer,
    SpecialFieldHandler,
} from "./ReportExecutionService.helpers";
import { FieldConfig, Filter } from "./ReportExecutionService.types";
import {
    getVirtualFieldConfig,
    VirtualFieldConfig,
} from "./ReportExecutionService.virtualFields";
import { REPORT_METADATA } from "./reportMetadata";
import { ReportConfig } from "./ReportService";
import {
    isCustomerPolicyBackedReportField,
    mergeActiveCustomerPolicySelect,
} from "@/server/utils/reportCustomerPolicyFields";
import {
    getTrendCostTrendColumn,
    isTrendCostBackedReportField,
    mergeLatestCustomerPolicyTrendSelect,
} from "@/server/utils/reportCustomerTrendCostFields";
import {
    isInvoicePolicyReportField,
    mergeInvoicePolicySelect,
} from "@/server/utils/reportInvoicePolicyFields";
import { isCreditDashboardEnrichedCustomerField } from "./creditInsurance/creditDashboardReportEnrichment";

import { LogLevel } from "@/types/enums";

// Type definitions for Prisma query building
interface QueryResult {
    where: any;
    select?: any;
}

export class ReportQueryBuilder {
    private logService: LogService;
    private relationCache = new Map<string, string | null>();
    private readonly MAX_CACHE_SIZE = 100;

    // Constants for field type detection
    private static readonly KNOWN_STRING_FIELDS = [
        "name",
        "parent_customer_name",
        "customer_number",
        "email",
        "phone",
        "address_line1",
        "address_line2",
        "city",
        "postal_code",
    ] as const;

    private static readonly RELATION_STRING_FIELDS = [
        "first_name",
        "last_name",
        "full_name",
        "name",
        "email",
        "phone",
        "policy_number",
    ] as const;

    private static readonly NUMERIC_PATTERNS = [
        "amount",
        "count",
        "number_of",
        "no_of",
        "total_",
        "id",
        "_id",
    ] as const;

    private static readonly SEARCH_MODE = "insensitive" as const;

    constructor(logService: LogService) {
        this.logService = logService;
    }

    private isLegacyLocationField(table: string, field: string): boolean {
        return (
            (table === "Customer" || table === "Company") &&
            (field === "country" || field === "state")
        );
    }

    private addLegacyLocationSelect(select: any, field: string): void {
        const relationName = field === "country" ? "Country" : "State";
        if (!select[relationName]) {
            select[relationName] = { select: {} };
        }
        if (!select[relationName].select) {
            select[relationName].select = {};
        }
        select[relationName].select.name = true;
    }

    /**
     * Build complete Prisma query from report config
     */
    buildQuery(
        config: ReportConfig,
        accountId: number,
        additionalFilters?: Filter[],
        search?: string,
        businessUnitFilter?: any,
        customerAccessFilter?: Record<string, unknown>,
        primaryWhereExtras?: Record<string, unknown>
    ): QueryResult {
        this.validateConfig(config);
        this.validateAccountId(accountId);

        const primaryTable = config.tables[0];
        if (!primaryTable) {
            throw new Error("No primary table specified");
        }

        const where = this.buildWhereClause(
            config,
            primaryTable,
            accountId,
            additionalFilters,
            search,
            businessUnitFilter,
            customerAccessFilter,
            primaryWhereExtras
        );
        const filtersForSelect = [
            ...(config.filters || []),
            ...(additionalFilters || []),
        ];
        const select = this.buildSelectClause(
            config,
            primaryTable,
            filtersForSelect
        );

        return { where, select };
    }

    /**
     * Validate report configuration
     */
    private validateConfig(config: ReportConfig): void {
        if (!config.tables || config.tables.length === 0) {
            throw new Error("Report config must have at least one table");
        }
    }

    /**
     * Validate account ID
     */
    private validateAccountId(accountId: number): void {
        if (!Number.isInteger(accountId) || accountId <= 0) {
            throw new Error(`Invalid accountId: ${accountId}`);
        }
    }

    /**
     * Build where clause with filters and search
     */
    private buildWhereClause(
        config: ReportConfig,
        primaryTable: string,
        accountId: number,
        additionalFilters?: Filter[],
        search?: string,
        businessUnitFilter?: any,
        customerAccessFilter?: Record<string, unknown>,
        primaryWhereExtras?: Record<string, unknown>
    ): any {
        const where: any = this.buildAccountIdFilter(primaryTable, accountId);

        // Apply business unit filter (after account_id filter to ensure proper data isolation)
        if (businessUnitFilter && Object.keys(businessUnitFilter).length > 0) {
            const buFilter = this.applyBusinessUnitFilter(
                primaryTable,
                businessUnitFilter
            );
            if (buFilter && Object.keys(buFilter).length > 0) {
                // Merge business unit filter with existing where clause
                // For tables with nested structures (Contact, Dispute), merge into the nested structure
                // For tables with direct filters, use AND to combine
                if (primaryTable === "Contact" && where.Company?.Customer?.some) {
                    // Merge BU filter into the existing Customer.some filter
                    where.Company.Customer.some = {
                        ...where.Company.Customer.some,
                        ...buFilter.Company.Customer.some,
                    };
                } else if (
                    (primaryTable === "Dispute" ||
                        primaryTable === "CustomerCollectionPeriod") &&
                    where.Customer
                ) {
                    // Merge BU filter into the existing Customer filter
                    where.Customer = {
                        ...where.Customer,
                        ...buFilter.Customer,
                    };
                } else if (
                    ["Invoice", "Payment", "InvoicePayment", "Activity"].includes(
                        primaryTable
                    )
                ) {
                    // These tables have direct account_id, so BU filter goes through Customer
                    // If Customer filter already exists (from other filters), merge it
                    if (where.Customer) {
                        where.Customer = {
                            ...where.Customer,
                            ...buFilter.Customer,
                        };
                    } else {
                        // Add Customer filter with BU restriction
                        Object.assign(where, buFilter);
                    }
                } else {
                    // For direct filters (Customer, User, DashboardCache), merge directly
                    Object.assign(where, buFilter);
                }
            }
        }

        // Apply report filters
        if (config.filters && config.filters.length > 0) {
            this.applyConfigFilters(where, config.filters, primaryTable);
        }

        // Apply additional filters
        if (additionalFilters) {
            this.applyAdditionalFilters(where, additionalFilters, primaryTable);
        }

        // Owner / customer access scope (dashboard chart-details parity)
        this.applyCustomerAccessFilter(
            where,
            primaryTable,
            customerAccessFilter
        );

        if (primaryWhereExtras && Object.keys(primaryWhereExtras).length > 0) {
            const existingKeys = Object.keys(where).filter(
                (k) => k !== "account_id"
            );
            if (existingKeys.length > 0) {
                const existing = { ...where };
                delete existing.account_id;
                const accountId = where.account_id;
                Object.keys(where).forEach((k) => {
                    if (k !== "account_id") delete where[k];
                });
                if (accountId !== undefined) {
                    where.account_id = accountId;
                }
                where.AND = [existing, primaryWhereExtras];
            } else {
                Object.assign(where, primaryWhereExtras);
            }
        }

        // Apply search
        if (search && search.trim()) {
            this.applySearch(where, config, primaryTable, search.trim());
        }

        // Ensure joined tables exist (INNER JOIN behavior)
        this.ensureJoinedTablesExist(where, config, primaryTable);

        return where;
    }

    /**
     * Merge Customer-scoped access filters (e.g. owner_id OR null) without
     * overwriting collection_status / BU conditions already on Customer.
     */
    private applyCustomerAccessFilter(
        where: any,
        primaryTable: string,
        customerAccessFilter?: Record<string, unknown>
    ): void {
        if (
            !customerAccessFilter ||
            Object.keys(customerAccessFilter).length === 0
        ) {
            return;
        }

        if (primaryTable === "Customer") {
            if (Object.keys(where).some((k) => k !== "account_id")) {
                const existing = { ...where };
                delete existing.account_id;
                const accountId = where.account_id;
                Object.keys(where).forEach((k) => {
                    if (k !== "account_id") delete where[k];
                });
                if (accountId !== undefined) {
                    where.account_id = accountId;
                }
                where.AND = [existing, customerAccessFilter];
            } else {
                Object.assign(where, customerAccessFilter);
            }
            return;
        }

        if (
            [
                "Invoice",
                "Payment",
                "InvoicePayment",
                "Activity",
                "Dispute",
                "CustomerCollectionPeriod",
            ].includes(primaryTable)
        ) {
            if (where.Customer && Object.keys(where.Customer).length > 0) {
                where.Customer = {
                    AND: [where.Customer, customerAccessFilter],
                };
            } else {
                where.Customer = customerAccessFilter;
            }
        }
    }

    /**
     * Build account_id filter based on table structure
     * Always applies account_id filter to ensure data isolation, even for system reports
     */
    private buildAccountIdFilter(primaryTable: string, accountId: number): any {
        const where: any = {};

        if (primaryTable === "Contact") {
            // Contact doesn't have account_id, filter through Company -> Customer relationship
            where.Company = {
                Customer: {
                    some: {
                        account_id: accountId,
                    },
                },
            };
        } else if (
            primaryTable === "Dispute" ||
            primaryTable === "CustomerCollectionPeriod"
        ) {
            // No account_id on the primary model — filter through Customer
            where.Customer = {
                account_id: accountId,
            };
        } else {
            // Always filter by account_id to ensure data isolation
            // This applies to both regular reports and system reports
            where.account_id = accountId;
        }

        return where;
    }

    /**
     * Apply business unit filter based on table structure
     * Handles tables with direct business_unit_id and tables that filter through Customer relationship
     * @param primaryTable Table name
     * @param businessUnitFilter Base business unit filter (from getBusinessUnitFilter)
     * @returns Prisma filter object for BU access, or empty object if no filter needed
     */
    private applyBusinessUnitFilter(
        primaryTable: string,
        businessUnitFilter: any
    ): any {
        // If no filter or empty filter, return empty object
        if (!businessUnitFilter || Object.keys(businessUnitFilter).length === 0) {
            return {};
        }

        // Tables with direct business_unit_id column
        const tablesWithDirectBU = ["Customer", "User", "DashboardCache"];

        if (tablesWithDirectBU.includes(primaryTable)) {
            // Direct filter on business_unit_id
            return businessUnitFilter;
        }

        // Tables that filter through Customer relationship
        if (primaryTable === "Contact") {
            // Contact -> Company -> Customer relationship
            return {
                Company: {
                    Customer: {
                        some: businessUnitFilter,
                    },
                },
            };
        }

        if (
            primaryTable === "Dispute" ||
            primaryTable === "CustomerCollectionPeriod"
        ) {
            // Customer-scoped primary tables (no account_id / business_unit_id)
            return {
                Customer: businessUnitFilter,
            };
        }

        // For Invoice, Payment, InvoicePayment, Activity - filter through Customer relationship
        if (
            ["Invoice", "Payment", "InvoicePayment", "Activity"].includes(
                primaryTable
            )
        ) {
            return {
                Customer: businessUnitFilter,
            };
        }

        // For other tables, return empty filter (no BU restriction)
        // This allows flexibility for future tables that might not need BU filtering
        return {};
    }

    /**
     * Apply filters from report config
     */
    private applyConfigFilters(
        where: any,
        filters: Filter[],
        primaryTable: string
    ): void {
        for (const filter of filters) {
            const shouldSkip = this.shouldSkipFilter(filter);

            if (shouldSkip) {
                continue;
            }

            if (this.tryApplyPolicyBackedFilter(where, filter, primaryTable)) {
                continue;
            }

            if (this.tryApplyTrendCostBackedFilter(where, filter, primaryTable)) {
                continue;
            }

            if (filter.table !== primaryTable) {
                if (filter.field.includes(".")) {
                    this.applyCrossTableDottedFilter(where, filter, primaryTable);
                } else {
                    this.applyCrossTableFilter(where, filter, primaryTable);
                }
            } else if (filter.field.includes(".")) {
                this.applyRelatedTableFilter(where, filter, primaryTable);
            } else {
                this.applyPrimaryTableFilter(where, filter, primaryTable);
            }
        }
    }

    /**
     * Apply additional filters from execution params
     */
    private applyAdditionalFilters(
        where: any,
        filters: Filter[],
        primaryTable: string
    ): void {
        for (const filter of filters) {
            const shouldSkip = this.shouldSkipFilter(filter);

            if (shouldSkip) {
                continue;
            }

            if (this.tryApplyPolicyBackedFilter(where, filter, primaryTable)) {
                continue;
            }

            if (this.tryApplyTrendCostBackedFilter(where, filter, primaryTable)) {
                continue;
            }

            if (filter.table !== primaryTable) {
                if (filter.field.includes(".")) {
                    this.applyCrossTableDottedFilter(where, filter, primaryTable);
                } else {
                    this.applyCrossTableFilter(where, filter, primaryTable);
                }
            } else if (filter.field.includes(".")) {
                this.applyRelatedTableFilter(where, filter, primaryTable);
            } else {
                this.applyPrimaryTableFilter(where, filter, primaryTable);
            }
        }
    }

    /**
     * Customer credit-insurance fields live on CustomerPolicy, not Customer columns.
     */
    private tryApplyPolicyBackedFilter(
        where: any,
        filter: Filter,
        primaryTable: string
    ): boolean {
        if (
            filter.table === "Customer" &&
            isCustomerPolicyBackedReportField(filter.field)
        ) {
            this.applyCustomerPolicyBackedFilter(where, filter, primaryTable);
            return true;
        }

        return false;
    }

    /**
     * Cross-table filter with nested relation path (e.g. Invoice + InsurancePolicy.policy_number
     * on a Customer report → Invoice.some.InsurancePolicy.policy_number).
     */
    private applyCrossTableDottedFilter(
        where: any,
        filter: Filter,
        primaryTable: string
    ): void {
        const relationName = this.getRelationName(primaryTable, filter.table);

        if (!relationName) {
            this.logService.logMessage(
                LogLevel.WARNING,
                `No relation found for ${primaryTable} -> ${filter.table}, skipping cross-table dotted filter`,
                "ReportQueryBuilder",
                undefined,
                undefined
            );
            return;
        }

        const isDate = this.isDateField(filter.table, filter.field);
        const isDateOnly = this.isDateOnlyField(filter.table, filter.field);
        const condition = this.buildLeafFilterCondition(
            filter,
            isDate,
            isDateOnly
        );

        if (!condition) {
            return;
        }

        const nestedPath: Record<string, unknown> = {};
        this.setNestedField(nestedPath, filter.field, condition);

        const isOneToMany = this.isOneToManyRelation(
            primaryTable,
            filter.table
        );

        if (!where[relationName]) {
            where[relationName] = {};
        }

        if (isOneToMany) {
            if (!where[relationName].some) {
                where[relationName].some = {};
            }
            this.mergeNestedWhere(where[relationName].some, nestedPath);
        } else {
            this.mergeNestedWhere(where[relationName], nestedPath);
        }
    }

    /**
     * Deep-merge nested Prisma where fragments (relation paths + leaf conditions).
     */
    private mergeNestedWhere(
        target: Record<string, unknown>,
        source: Record<string, unknown>
    ): void {
        for (const [key, value] of Object.entries(source)) {
            if (this.isPrismaFieldCondition(value)) {
                target[key] = value;
                continue;
            }

            if (
                value !== null &&
                typeof value === "object" &&
                !Array.isArray(value)
            ) {
                const existing = target[key];
                if (
                    existing &&
                    typeof existing === "object" &&
                    !Array.isArray(existing) &&
                    !this.isPrismaFieldCondition(existing)
                ) {
                    this.mergeNestedWhere(
                        existing as Record<string, unknown>,
                        value as Record<string, unknown>
                    );
                } else {
                    target[key] = value;
                }
                continue;
            }

            target[key] = value;
        }
    }

    private isPrismaFieldCondition(value: unknown): boolean {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return false;
        }

        const conditionKeys = new Set([
            "equals",
            "not",
            "in",
            "contains",
            "startsWith",
            "endsWith",
            "gt",
            "gte",
            "lt",
            "lte",
            "mode",
        ]);

        return Object.keys(value as Record<string, unknown>).some((key) =>
            conditionKeys.has(key)
        );
    }

    private applyCustomerPolicyBackedFilter(
        where: any,
        filter: Filter,
        primaryTable: string
    ): void {
        const relationField =
            filter.field === "policy_id" ||
            filter.field === "InsurancePolicy.policy_number"
                ? "policy_number"
                : filter.field.startsWith("InsurancePolicy.")
                  ? filter.field.split(".", 2)[1]!
                  : null;

        const tableForDate = relationField ? "InsurancePolicy" : "CustomerPolicy";
        const fieldForDate = relationField ?? filter.field;
        const isDate = this.isDateField(tableForDate, fieldForDate);
        const isDateOnly = this.isDateOnlyField(tableForDate, fieldForDate);
        const condition = this.buildLeafFilterCondition(
            filter,
            isDate,
            isDateOnly
        );

        if (!condition) {
            return;
        }

        const applyOnCustomerPolicySome = (container: Record<string, any>) => {
            if (!container.CustomerPolicy) {
                container.CustomerPolicy = {};
            }
            if (!container.CustomerPolicy.some) {
                container.CustomerPolicy.some = {};
            }

            const customerPolicySome = container.CustomerPolicy.some;
            if (relationField) {
                if (!customerPolicySome.InsurancePolicy) {
                    customerPolicySome.InsurancePolicy = {};
                }
                customerPolicySome.InsurancePolicy[relationField] = condition;
            } else {
                customerPolicySome[filter.field] = condition;
            }
        };

        if (primaryTable === "Customer") {
            applyOnCustomerPolicySome(where);
            return;
        }

        const relationName = this.getRelationName(primaryTable, "Customer");
        if (!relationName) {
            return;
        }

        if (!where[relationName]) {
            where[relationName] = {};
        }

        applyOnCustomerPolicySome(where[relationName]);
    }

    /**
     * Daily policy cost fields live on latest CustomerPolicyTrend row, not Customer columns.
     */
    private tryApplyTrendCostBackedFilter(
        where: any,
        filter: Filter,
        primaryTable: string
    ): boolean {
        if (
            filter.table === "Customer" &&
            isTrendCostBackedReportField(filter.field)
        ) {
            this.applyTrendCostBackedFilter(where, filter, primaryTable);
            return true;
        }

        return false;
    }

    private applyTrendCostBackedFilter(
        where: any,
        filter: Filter,
        primaryTable: string
    ): void {
        const trendColumn = getTrendCostTrendColumn(filter.field);
        if (!trendColumn) {
            return;
        }

        const isDate = this.isDateField(filter.table, filter.field);
        const isDateOnly = this.isDateOnlyField(filter.table, filter.field);
        const condition = this.buildLeafFilterCondition(
            filter,
            isDate,
            isDateOnly
        );

        if (!condition) {
            return;
        }

        const applyOnTrendSome = (container: Record<string, any>) => {
            if (!container.CustomerPolicyTrend) {
                container.CustomerPolicyTrend = {};
            }
            if (!container.CustomerPolicyTrend.some) {
                container.CustomerPolicyTrend.some = {};
            }
            container.CustomerPolicyTrend.some[trendColumn] = condition;
        };

        if (primaryTable === "Customer") {
            applyOnTrendSome(where);
            return;
        }

        const relationName = this.getRelationName(primaryTable, "Customer");
        if (!relationName) {
            return;
        }

        if (!where[relationName]) {
            where[relationName] = {};
        }

        applyOnTrendSome(where[relationName]);
    }

    /**
     * Check if filter should be skipped
     */
    private shouldSkipFilter(filter: Filter): boolean {
        const fieldName = filter.field.includes(".")
            ? filter.field.split(".")[1]
            : filter.field;

        // Allow user reference fields even though they end with _id or _by
        // These are valid filterable fields: owner_id, created_by, modified_by, assigned_to
        const normalizedFieldName = fieldName.toLowerCase();
        const isUserReferenceField =
            normalizedFieldName === "owner_id" ||
            normalizedFieldName === "created_by" ||
            normalizedFieldName === "modified_by" ||
            normalizedFieldName === "assigned_to";

        // Allow foreign key fields to be filterable (e.g., customer_id, invoice_id, etc.)
        // These are valid filters even though they end with _id
        const isForeignKeyField =
            normalizedFieldName === "customer_id" ||
            normalizedFieldName === "invoice_id" ||
            normalizedFieldName === "payment_id" ||
            normalizedFieldName === "activity_id" ||
            normalizedFieldName === "dispute_id" ||
            normalizedFieldName === "contact_id" ||
            normalizedFieldName === "company_id" ||
            normalizedFieldName === "parent_customer_id" ||
            normalizedFieldName === "account_id" ||
            normalizedFieldName === "status" ||
            normalizedFieldName === "business_unit_id";

        const isIdFieldResult = this.isIdField(fieldName);
        const shouldSkipResult = isIdFieldResult && !isUserReferenceField && !isForeignKeyField;

        // Only skip if it's an ID field AND not a user reference field AND not a foreign key field
        if (shouldSkipResult) {
            return true;
        }

        // Allow null/empty values for is_empty/is_not_empty operators
        const isEmptyOperator =
            filter.operator === "is_empty" ||
            filter.operator === "is_not_empty";
        if (
            !isEmptyOperator &&
            (filter.value === "" ||
                filter.value === null ||
                filter.value === undefined)
        ) {
            return true;
        }

        if (
            this.normalizeOperator(filter.operator) === "in" &&
            Array.isArray(filter.value) &&
            filter.value.length === 0
        ) {
            return true;
        }

        return false;
    }

    /**
     * Apply filter for related table with dot notation (e.g., Company.name)
     */
    private applyRelatedTableFilter(
        where: any,
        filter: Filter,
        primaryTable: string
    ): void {
        const [relatedTable, fieldName] = filter.field.split(".");
        const relationName = this.getRelationName(primaryTable, relatedTable);

        if (!relationName) {
            this.logService.logMessage(
                LogLevel.WARNING,
                `No relation found for ${primaryTable} -> ${relatedTable}, skipping filter`,
                "ReportQueryBuilder",
                undefined,
                undefined
            );
            return;
        }

        // Special handling for is_not_empty on related string fields
        // For related fields like State.name, we need to check:
        // 1. The relation exists (not null)
        // 2. The field is not null
        // 3. The field is not empty string (for string fields)
        const normalizedOp = this.normalizeOperator(filter.operator);
        const isStringField =
            ReportQueryBuilder.RELATION_STRING_FIELDS.includes(
                fieldName as any
            ) || fieldName === "name"; // name is a common string field

        // For is_not_empty/is_empty on related string fields, we need special handling
        // because Prisma doesn't support AND at the field level
        // We need to apply the condition at the relation level instead
        if (
            (normalizedOp === "is_not_empty" || normalizedOp === "is_empty") &&
            isStringField
        ) {
            const isOneToMany = this.isOneToManyRelation(
                primaryTable,
                relatedTable
            );

            if (normalizedOp === "is_not_empty") {
                // For string fields, is_not_empty means: relation exists AND field is not empty
                // Prisma requires AND at the relation level, not field level
                if (!where[relationName]) {
                    where[relationName] = {};
                }

                if (isOneToMany) {
                    // For one-to-many, use some with the field filter
                    // The `some` already ensures at least one relation exists
                    where[relationName].some = {
                        [fieldName]: {
                            not: { equals: "" },
                        },
                    };
                } else {
                    // For one-to-one optional relation, just filter on the field
                    // This implicitly requires the relation to exist
                    where[relationName] = {
                        [fieldName]: {
                            not: { equals: "" },
                        },
                    };
                }
                return; // Early return since we've already applied the filter
            } else {
                // is_empty: relation is null OR field is null OR field is empty string
                if (isOneToMany) {
                    // For one-to-many, use some with OR for field conditions
                    if (!where[relationName]) {
                        where[relationName] = {};
                    }
                    where[relationName].some = {
                        OR: [
                            { [fieldName]: { equals: null } }, // Field is null
                            { [fieldName]: { equals: "" } }, // Field is empty
                        ],
                    };
                } else {
                    // For one-to-one optional relation, we need OR at the top level
                    // Store existing where conditions (except the relation we're modifying)
                    const existingWhere = { ...where };
                    delete existingWhere[relationName];

                    // Build OR conditions at the top level
                    // For optional relations, we can only check:
                    // 1. Relation is null (relation doesn't exist)
                    // 2. Relation exists and field is empty string
                    // Note: Prisma doesn't support checking if a field inside an optional relation is null
                    const orConditions = [
                        { ...existingWhere, [relationName]: null }, // Relation doesn't exist
                        {
                            ...existingWhere,
                            [relationName]: { [fieldName]: { equals: "" } },
                        }, // Field is empty string
                    ];

                    // Clear where and set up OR at top level
                    Object.keys(where).forEach((key) => delete where[key]);
                    where.OR = orConditions;
                }
                return; // Early return since we've already applied the filter
            }
        }

        // For other operators, use the standard condition building
        // Check if this is a date field in the related table
        const isDate = this.isDateField(relatedTable, fieldName);
        const isDateOnly = this.isDateOnlyField(relatedTable, fieldName);
        const condition = this.buildFilterCondition(
            filter.operator,
            filter.value,
            isDate,
            isDateOnly
        );

        if (condition) {
            this.applyRelationFilter(
                where,
                relationName,
                fieldName,
                condition,
                primaryTable,
                relatedTable
            );
        }
    }

    /**
     * Apply filter for cross-table (different table than primary)
     */
    private applyCrossTableFilter(
        where: any,
        filter: Filter,
        primaryTable: string
    ): void {
        const relationName = this.getRelationName(primaryTable, filter.table);

        // Check if this is a date field before building condition
        const isDate = this.isDateField(filter.table, filter.field);
        const isDateOnly = this.isDateOnlyField(filter.table, filter.field);

        if (!relationName) {
            return;
        }

        const condition = this.buildLeafFilterCondition(
            filter,
            isDate,
            isDateOnly
        );

        if (condition) {
            this.applyRelationFilter(
                where,
                relationName,
                filter.field,
                condition,
                primaryTable,
                filter.table
            );
        }
    }

    /**
     * Apply filter for primary table field
     */
    private applyPrimaryTableFilter(where: any, filter: Filter, primaryTable: string): void {
        const fieldPath = filter.field;
        const isDate = this.isDateField(filter.table, filter.field);
        const normalizedOp = this.normalizeOperator(filter.operator);

        // Generic solution: When filtering by foreign key fields (ending with _id) on tables with relations,
        // always merge it into the relation filter (create one if it doesn't exist)
        // This ensures proper filtering and consistency, especially when business unit filters are also applied
        // EXCEPT when:
        // 1. The primary table matches the relation (can't have self-referential relation filter)
        // 2. The filter table doesn't match the primary table (cross-table filters are handled separately)
        if (filter.field.endsWith("_id") && filter.table === primaryTable) {
            // Nullability of FKs lives on the scalar column (linkedInvoicePaymentWhere /
            // is_not_empty → invoice_id: { gt: 0 }). Do not rewrite into relation.id.
            const isNullabilityOp =
                normalizedOp === "is_empty" || normalizedOp === "is_not_empty";

            if (!isNullabilityOp) {
            // Extract relation name from field (e.g., "customer_id" -> "Customer", "company_id" -> "Company")
            const relationName = this.getRelationNameFromField(filter.field);

            if (relationName && relationName !== primaryTable) {
                // Check if the table has this relation
                const hasRelation = this.getRelationName(filter.table, relationName) !== null;

                if (hasRelation) {
                    // Create relation filter if it doesn't exist
                    if (!where[relationName]) {
                        where[relationName] = {};
                    }

                    const isDateOnly = this.isDateOnlyField(filter.table, filter.field);
                    const condition = FilterConditionBuilder.buildCondition(
                        filter.operator,
                        filter.value,
                        isDate,
                        isDateOnly
                    );

                    if (condition) {
                        // Extract the actual value from the condition
                        // For "equals" operator, condition is { equals: value }
                        // For "in" operator, condition is { in: [values] }
                        let idCondition: any;
                        if (condition.equals !== undefined) {
                            idCondition = condition.equals;
                        } else if (condition.in !== undefined) {
                            idCondition = condition.in;
                        } else {
                            // For other operators, use the condition as-is but wrap in id field
                            idCondition = condition;
                        }

                        // Handle relation filter with OR conditions (business unit filters)
                        if (where[relationName].OR && Array.isArray(where[relationName].OR)) {
                            // Merge foreign key into each OR branch
                            where[relationName].OR = where[relationName].OR.map((orCondition: any) => {
                                // If the condition is a simple value, add id directly
                                if (typeof idCondition === "number" || typeof idCondition === "string") {
                                    return {
                                        ...orCondition,
                                        id: idCondition,
                                    };
                                } else if (Array.isArray(idCondition)) {
                                    // For "in" operator with array
                                    return {
                                        ...orCondition,
                                        id: { in: idCondition },
                                    };
                                } else {
                                    // For other operators, wrap in id
                                    return {
                                        ...orCondition,
                                        id: idCondition,
                                    };
                                }
                            });
                        } else {
                            // No OR conditions, merge directly into relation filter
                            if (typeof idCondition === "number" || typeof idCondition === "string") {
                                where[relationName] = {
                                    ...where[relationName],
                                    id: idCondition,
                                };
                            } else if (Array.isArray(idCondition)) {
                                where[relationName] = {
                                    ...where[relationName],
                                    id: { in: idCondition },
                                };
                            } else {
                                where[relationName] = {
                                    ...where[relationName],
                                    id: idCondition,
                                };
                            }
                        }

                        // Remove the top-level foreign key filter since it's now in relation.id
                        delete where[filter.field];

                        return; // Early return, filter has been applied
                    }
                }
            }
            }
        }

        // Special handling for not_equals
        if (normalizedOp === "not_equals") {
            this.applyNotEqualsFilter(where, fieldPath, filter.value, isDate);
            return;
        }

        const isDateOnly = this.isDateOnlyField(filter.table, filter.field);
        const condition = this.buildLeafFilterCondition(
            filter,
            isDate,
            isDateOnly
        );

        if (condition) {
            this.setNestedField(where, fieldPath, condition);
        }
    }

    /**
     * Apply not_equals filter with OR conditions
     */
    private applyNotEqualsFilter(
        where: any,
        fieldPath: string,
        value: any,
        isDate: boolean
    ): void {
        const existingWhere = JSON.parse(JSON.stringify(where));
        Object.keys(where).forEach((key) => delete where[key]);

        const condition1: any = { ...existingWhere };
        if (isDate && typeof value === "string" && value.includes("T")) {
            this.setNestedField(condition1, fieldPath, {
                not: new Date(value),
            });
        } else {
            this.setNestedField(condition1, fieldPath, { not: value });
        }

        const condition2: any = { ...existingWhere };
        this.setNestedField(condition2, fieldPath, { equals: null });

        where.OR = [condition1, condition2];
    }

    /**
     * Apply filter to relation (one-to-many or one-to-one)
     */
    private applyRelationFilter(
        where: any,
        relationName: string,
        fieldName: string,
        condition: any,
        primaryTable: string,
        relatedTable: string
    ): void {
        const isOneToMany = this.isOneToManyRelation(
            primaryTable,
            relatedTable
        );

        if (!where[relationName]) {
            where[relationName] = {};
        }

        if (isOneToMany) {
            if (!where[relationName].some) {
                where[relationName].some = {};
            }
            where[relationName].some[fieldName] = condition;
        } else {
            where[relationName][fieldName] = condition;
        }
    }

    /**
     * Build a Prisma leaf condition with correct empty/not-empty semantics for strings.
     */
    private buildLeafFilterCondition(
        filter: Filter,
        isDate: boolean,
        isDateOnly = false
    ): any | null {
        const normalizedOp = this.normalizeOperator(filter.operator);
        const isString = this.isStringFilterField(filter.table, filter.field);

        if (normalizedOp === "is_not_empty") {
            if (isString) {
                return { not: { equals: "" } };
            }
            // Prefer gt:0 for numeric FKs — `{ not: null }` fails when the generated
            // client types the column as non-nullable Int (stale prisma generate).
            if (filter.field.endsWith("_id")) {
                return { gt: 0 };
            }
            // Prisma nullable scalars reject `{ not: { equals: null } }`
            return { not: null };
        }

        if (normalizedOp === "is_empty") {
            if (isString) {
                return { in: [null, ""] };
            }
            return { equals: null };
        }

        if (normalizedOp === "not_equals") {
            if (
                filter.value === null ||
                filter.value === undefined ||
                filter.value === ""
            ) {
                return null;
            }
            if (
                isDate &&
                typeof filter.value === "string" &&
                filter.value.includes("T")
            ) {
                return { not: new Date(filter.value) };
            }
            return { not: filter.value };
        }

        return FilterConditionBuilder.buildCondition(
            filter.operator,
            filter.value,
            isDate,
            isDateOnly
        );
    }

    private getLeafFieldName(field: string): string {
        return field.includes(".") ? field.split(".").pop()! : field;
    }

    private isStringFilterField(table: string, field: string): boolean {
        const leafField = this.getLeafFieldName(field);

        if (
            ReportQueryBuilder.RELATION_STRING_FIELDS.includes(leafField as any)
        ) {
            return true;
        }

        if (this.isKnownStringField(leafField)) {
            return true;
        }

        if (this.isNumericField(leafField) || this.isIdField(leafField)) {
            return false;
        }

        return this.checkMetadataForStringType(table, leafField);
    }

    /**
     * Build filter condition from operator and value
     */
    private buildFilterCondition(
        operator: string,
        value: any,
        isDate: boolean,
        isDateOnly = false
    ): any {
        return FilterConditionBuilder.buildCondition(operator, value, isDate, isDateOnly);
    }

    /**
     * Check if a field is a date-only column (@db.Date) - use equals with YYYY-MM-DD to avoid timezone mismatch
     */
    private isDateOnlyField(table: string, field: string): boolean {
        const fieldName = field.includes(".") ? field.split(".")[1]! : field;
        return DATE_ONLY_FIELDS_BY_TABLE[table]?.includes(fieldName) ?? false;
    }

    /**
     * Check if a field supports the contains operator (only String fields support it)
     */
    private fieldSupportsContains(table: string, fieldName: string): boolean {
        if (this.isIdField(fieldName)) {
            return false;
        }

        if (fieldName.includes(".")) {
            return this.relationFieldSupportsContains(fieldName);
        }

        if (this.isKnownStringField(fieldName)) {
            return true;
        }

        if (this.isNumericField(fieldName)) {
            return false;
        }

        return this.checkMetadataForStringType(table, fieldName);
    }

    /**
     * Check if a relation field supports contains
     */
    private relationFieldSupportsContains(fieldName: string): boolean {
        const [, relationField] = fieldName.split(".");
        if (
            ReportQueryBuilder.RELATION_STRING_FIELDS.includes(
                relationField as any
            )
        ) {
            return true;
        }
        return !this.isNumericField(relationField);
    }

    /**
     * Check if field is a known string field
     */
    private isKnownStringField(fieldName: string): boolean {
        return ReportQueryBuilder.KNOWN_STRING_FIELDS.includes(
            fieldName as any
        );
    }

    /**
     * Check if field matches numeric patterns
     */
    private isNumericField(fieldName: string): boolean {
        const fieldLower = fieldName.toLowerCase();
        return ReportQueryBuilder.NUMERIC_PATTERNS.some((pattern) =>
            fieldLower.includes(pattern)
        );
    }

    /**
     * Check metadata for string type
     */
    private checkMetadataForStringType(
        table: string,
        fieldName: string
    ): boolean {
        const tableMetadata = REPORT_METADATA.tables.find(
            (t) => t.name === table
        );
        if (!tableMetadata) {
            return false;
        }

        const fieldMetadata = tableMetadata.fields.find(
            (f) => f.name === fieldName
        );
        return fieldMetadata?.type === "string" || false;
    }

    /**
     * Get search conditions for a virtual field
     * Returns an array of Prisma where conditions that should be searched
     */
    private getVirtualFieldSearchConditions(
        table: string,
        field: string,
        searchTerm: string
    ): any[] {
        const virtualConfig = getVirtualFieldConfig(table, field);
        if (!virtualConfig) {
            return [];
        }

        const searchCondition = {
            contains: searchTerm,
            mode: ReportQueryBuilder.SEARCH_MODE,
        };

        // Use a map for known virtual field patterns
        const virtualFieldHandlers = new Map<string, () => any[]>([
            [
                "Customer.name",
                () => [
                    { Person: { first_name: searchCondition } },
                    { Person: { last_name: searchCondition } },
                    { Person: { full_name: searchCondition } },
                    { Company: { name: searchCondition } },
                ],
            ],
            [
                "Customer.parent_customer_name",
                () => [
                    {
                        ParentCustomer: {
                            Person: { first_name: searchCondition },
                        },
                    },
                    {
                        ParentCustomer: {
                            Person: { last_name: searchCondition },
                        },
                    },
                    {
                        ParentCustomer: {
                            Person: { full_name: searchCondition },
                        },
                    },
                    { ParentCustomer: { Company: { name: searchCondition } } },
                ],
            ],
            [
                "Customer.company_number",
                () => [{ Company: { company_number: searchCondition } }],
            ],
        ]);

        const key = `${table}.${field}`;
        const handler = virtualFieldHandlers.get(key);

        if (handler) {
            return handler();
        }

        // Fallback to generic relation handling
        return this.buildGenericVirtualFieldConditions(
            virtualConfig,
            searchCondition,
            table,
            field
        );
    }

    /**
     * Build generic virtual field search conditions
     */
    private buildGenericVirtualFieldConditions(
        virtualConfig: VirtualFieldConfig,
        searchCondition: any,
        table: string,
        field: string
    ): any[] {
        if (virtualConfig.relationType === "many-to-one") {
            const fieldName = virtualConfig.relationField || "name";
            return [
                {
                    [virtualConfig.relationName]: {
                        [fieldName]: searchCondition,
                    },
                },
            ];
        }

        // Log warning for unsupported types
        if (
            virtualConfig.relationType === "computed" ||
            virtualConfig.relationType === "one-to-many"
        ) {
            this.logService.logMessage(
                LogLevel.WARNING,
                `Virtual field ${table}.${field} is ${virtualConfig.relationType} and cannot be searched directly. Consider adding explicit search conditions.`,
                "ReportQueryBuilder"
            );
        }

        return [];
    }

    /**
     * Apply search across text fields
     */
    private applySearch(
        where: any,
        config: ReportConfig,
        primaryTable: string,
        searchTerm: string
    ): void {
        const textFields = this.getSearchableTextFields(config, primaryTable);
        if (textFields.length === 0) {
            return;
        }

        const searchConditions = this.buildSearchConditions(
            textFields,
            primaryTable,
            searchTerm
        );

        this.mergeSearchConditions(where, searchConditions);
    }

    /**
     * Get searchable text fields from config
     */
    private getSearchableTextFields(
        config: ReportConfig,
        primaryTable: string
    ): FieldConfig[] {
        return (
            config.fields?.filter(
                (field: FieldConfig) =>
                    field.table === primaryTable &&
                    !field.aggregation &&
                    this.fieldSupportsContains(field.table, field.field)
            ) || []
        );
    }

    /**
     * Build search conditions for text fields
     */
    private buildSearchConditions(
        textFields: FieldConfig[],
        primaryTable: string,
        searchTerm: string
    ): any[] {
        const searchCondition = {
            contains: searchTerm,
            mode: ReportQueryBuilder.SEARCH_MODE,
        };

        return textFields.flatMap((field) => {
            if (field.field.includes(".")) {
                return this.buildRelationSearchCondition(
                    field,
                    searchCondition
                );
            }

            const virtualConfig = getVirtualFieldConfig(
                field.table,
                field.field
            );
            if (virtualConfig) {
                return this.getVirtualFieldSearchConditions(
                    field.table,
                    field.field,
                    searchTerm
                );
            }

            return [{ [field.field]: searchCondition }];
        });
    }

    /**
     * Build search condition for relation field
     */
    private buildRelationSearchCondition(
        field: FieldConfig,
        searchCondition: any
    ): any[] {
        const [relationName, relationField] = field.field.split(".", 2);
        return [
            {
                [relationName]: {
                    [relationField]: searchCondition,
                },
            },
        ];
    }

    /**
     * Merge search conditions with existing where clause
     */
    private mergeSearchConditions(where: any, searchConditions: any[]): void {
        const existingConditions = this.extractExistingConditions(where);

        if (this.hasExistingConditions(existingConditions, where)) {
            where.AND = this.buildAndConditions(
                existingConditions,
                where,
                searchConditions
            );
        } else {
            where.OR = searchConditions;
        }
    }

    /**
     * Extract existing conditions from where clause
     */
    private extractExistingConditions(where: any): any {
        const existing: any = {};
        Object.keys(where).forEach((key) => {
            if (!["account_id", "OR", "AND"].includes(key)) {
                existing[key] = where[key];
                delete where[key];
            }
        });
        return existing;
    }

    /**
     * Check if where clause has existing conditions
     */
    private hasExistingConditions(
        existingConditions: any,
        where: any
    ): boolean {
        return (
            Object.keys(existingConditions).length > 0 || where.OR || where.AND
        );
    }

    /**
     * Build AND conditions array
     */
    private buildAndConditions(
        existingConditions: any,
        where: any,
        searchConditions: any[]
    ): any[] {
        const allConditions: any[] = [];

        if (Object.keys(existingConditions).length > 0) {
            allConditions.push(existingConditions);
        }

        if (where.OR) {
            allConditions.push({ OR: where.OR });
            delete where.OR;
        }

        if (where.AND) {
            allConditions.push(
                ...(Array.isArray(where.AND) ? where.AND : [where.AND])
            );
            delete where.AND;
        }

        allConditions.push({ OR: searchConditions });
        return allConditions;
    }

    /**
     * Ensure joined tables exist (INNER JOIN behavior)
     * Only adds filters for tables that are directly related to the primary table
     * (not nested relations through other tables)
     */
    private ensureJoinedTablesExist(
        where: any,
        config: ReportConfig,
        primaryTable: string
    ): void {
        if (config.tables.length <= 1) {
            return;
        }

        // Find tables that are directly related to the primary table
        // (i.e., joined directly from primaryTable, not through another table)
        // Store join info along with table name to derive relation name and type
        const directJoins: Array<{ table: string; relationName: string; isOneToMany: boolean }> = [];

        // Check joins configuration to find direct relations and derive relation info
        if (config.joins && Array.isArray(config.joins)) {
            config.joins.forEach((join: any) => {
                if (join.from === primaryTable) {
                    // This is a direct join from primary table
                    // Derive relation name from join configuration
                    // Prisma relation name is typically the table name in PascalCase
                    const relationName = join.to;

                    // Determine if it's one-to-many by checking the join's "on" clause
                    // If join.on contains "toTable.field = fromTable.id", it's one-to-many
                    // If join.on contains "fromTable.field = toTable.id", it's many-to-one
                    let isOneToMany = false;
                    if (join.on) {
                        // Parse the join condition: "CustomerBanks.customer_bank_account_id = AccountBankAccounts.id"
                        // If the pattern is "toTable.field = fromTable.id", it's one-to-many
                        const onPattern = new RegExp(`${join.to}\\.\\w+\\s*=\\s*${primaryTable}\\.id`, 'i');
                        isOneToMany = onPattern.test(join.on);
                    }

                    directJoins.push({
                        table: join.to,
                        relationName,
                        isOneToMany
                    });
                }
            });
        }

        // If where has OR at top level, we need to add filters to each OR condition
        if (where.OR && Array.isArray(where.OR)) {
            directJoins.forEach(({ relationName, isOneToMany }) => {

                // Add the filter to each OR condition
                where.OR.forEach((orCondition: any) => {
                    const hasExistingConditions =
                        orCondition[relationName] &&
                        Object.keys(orCondition[relationName]).length > 0;

                    if (!hasExistingConditions) {
                        if (!orCondition[relationName]) {
                            orCondition[relationName] = {};
                        }

                        if (isOneToMany) {
                            orCondition[relationName].some = {};
                        } else {
                            // For one-to-one or many-to-one relations, Prisma will automatically
                            // include them in the query if they're in the `include` clause.
                            // For required relations (non-nullable foreign keys), they always exist.
                            // For optional relations, we can't easily check without knowing the exact
                            // foreign key field name, so we skip the check here.
                            // The relation will still be included in the query via the `include` clause.
                            // No filter needed - Prisma handles this through the include mechanism.
                        }
                    }
                });
            });
            return;
        }

        // Normal case: no OR at top level
        directJoins.forEach(({ relationName, isOneToMany }) => {
            const hasExistingConditions =
                where[relationName] &&
                Object.keys(where[relationName]).length > 0;

            if (!hasExistingConditions) {
                if (!where[relationName]) {
                    where[relationName] = {};
                }

                if (isOneToMany) {
                    where[relationName].some = {};
                } else {
                    // For one-to-one or many-to-one relations, Prisma will automatically
                    // include them in the query if they're in the `include` clause.
                    // For required relations (non-nullable foreign keys), they always exist.
                    // For optional relations, we can't easily check without knowing the exact
                    // foreign key field name, so we skip the check here.
                    // The relation will still be included in the query via the `include` clause.
                    // No filter needed - Prisma handles this through the include mechanism.
                }
            }
        });
    }

    /**
     * Build select clause for fields
     */
    private buildSelectClause(
        config: ReportConfig,
        primaryTable: string,
        filtersForSelect: Filter[] = []
    ): any | undefined {
        if (!config.fields || config.fields.length === 0) {
            return undefined;
        }

        const select: any = {};
        let hasRelations = false;
        const joinedTables = new Set<string>();

        for (const field of config.fields) {
            // Include ID fields if they're explicitly in the config (needed for delete/edit operations)
            // The frontend will hide them from display, but they're needed in the data for operations
            // Only skip ID fields that are NOT explicitly in the config
            const isIdFieldInConfig =
                this.isIdField(field.field) &&
                field.field !== "policy_id" &&
                field.field !== "owner_id";

            if (isIdFieldInConfig) {
                // ID field is explicitly in config - include it for operations
                if (field.table === primaryTable) {
                    select[field.field] = true;
                } else {
                    // ID field from joined table - include via relation
                    hasRelations = true;
                    joinedTables.add(field.table);
                    this.addJoinedTableField(select, field, primaryTable, config);
                }
                continue;
            }

            if (field.table === primaryTable) {
                this.addPrimaryTableField(select, field, primaryTable);
                if (
                    field.field.includes(".") ||
                    this.hasUserRelation(field) ||
                    field.field === "parent_customer_name" ||
                    SpecialFieldHandler.shouldMapToCompany(
                        primaryTable,
                        field.field
                    )
                ) {
                    hasRelations = true;
                }
            } else {
                hasRelations = true;
                joinedTables.add(field.table);
                this.addJoinedTableField(select, field, primaryTable, config);
            }
        }

        // Ensure id is selected when we have relations (for operations)
        if (hasRelations && !select.id) {
            select.id = true;
        }

        const hasParentCustomerName = config.fields.some(
            (f) =>
                f.table === primaryTable && f.field === "parent_customer_name"
        );

        // Include columns referenced by filters so in-memory one-to-many re-filtering
        // (formatData) can evaluate them; WHERE already applied at query level.
        if (filtersForSelect.length > 0) {
            this.includeFilterFieldsInSelect(
                select,
                filtersForSelect,
                primaryTable,
                config
            );
        }

        if (primaryTable === "Invoice" && config.fields?.length) {
            const invoicePolicyFields = config.fields
                .filter(
                    (f) =>
                        (f.table === "Invoice" &&
                            isInvoicePolicyReportField(f.field)) ||
                        (f.table === "Customer" &&
                            (f.field === "policy_id" ||
                                f.field === "InsurancePolicy.policy_number"))
                )
                .map((f) =>
                    f.table === "Invoice"
                        ? f.field
                        : "InsurancePolicy.policy_number"
                );
            if (invoicePolicyFields.length > 0) {
                mergeInvoicePolicySelect(
                    select as Record<string, unknown>,
                    invoicePolicyFields
                );
            }
        }

        return Object.keys(select).length > 0 || hasRelations
            ? select
            : undefined;
    }

    /**
     * Ensure filter columns are present on relation selects (not only display fields).
     */
    private includeFilterFieldsInSelect(
        select: any,
        filters: Filter[],
        primaryTable: string,
        config: ReportConfig
    ): void {
        const seen = new Set<string>();

        for (const filter of filters) {
            if (this.shouldSkipFilter(filter)) {
                continue;
            }

            const dedupeKey = `${filter.table}:${filter.field}`;
            if (seen.has(dedupeKey)) {
                continue;
            }
            seen.add(dedupeKey);

            const fieldConfig: FieldConfig = {
                table: filter.table,
                field: filter.field,
            };

            if (filter.table === primaryTable) {
                this.addPrimaryTableField(select, fieldConfig, primaryTable);
            } else {
                this.addJoinedTableField(
                    select,
                    fieldConfig,
                    primaryTable,
                    config
                );
            }
        }
    }

    /**
     * Add field from primary table to select
     */
    private addPrimaryTableField(
        select: any,
        field: FieldConfig,
        primaryTable: string
    ): void {
        if (this.isLegacyLocationField(primaryTable, field.field)) {
            this.addLegacyLocationSelect(select, field.field);
            return;
        }

        if (primaryTable === "Invoice") {
            select.policy_id = true;
        }

        if (
            primaryTable === "Customer" &&
            isCustomerPolicyBackedReportField(field.field)
        ) {
            mergeActiveCustomerPolicySelect(select, [field.field]);
            return;
        }

        if (
            primaryTable === "Customer" &&
            isTrendCostBackedReportField(field.field)
        ) {
            mergeLatestCustomerPolicyTrendSelect(select, [field.field]);
            return;
        }

        if (
            primaryTable === "Invoice" &&
            isInvoicePolicyReportField(field.field)
        ) {
            mergeInvoicePolicySelect(select as Record<string, unknown>, [
                field.field,
            ]);
            return;
        }

        // Handle special computed fields
        if (this.isSpecialComputedField(primaryTable, field.field)) {
            this.addSpecialComputedField(select, field, primaryTable);
            return;
        }

        // Handle relation fields (dot notation)
        if (field.field.includes(".")) {
            this.addRelationField(select, field, primaryTable);
            return;
        }

        // Handle special mappings (e.g., Customer.name -> Company.name)
        if (SpecialFieldHandler.shouldMapToCompany(primaryTable, field.field)) {
            this.addCompanyMappedField(select, field);
            return;
        }

        // Handle user relations
        if (this.hasUserRelation(field)) {
            this.addUserRelationField(select, field, primaryTable);
            return;
        }

        // Default: direct field
        select[field.field] = true;
    }

    /**
     * Check if field is a special computed field
     */
    private isSpecialComputedField(table: string, field: string): boolean {
        return (
            (table === "Customer" && field === "parent_customer_name") ||
            (table === "Customer" && field === "category") ||
            (table === "Customer" && field === "days_overdue") ||
            (table === "Customer" && field === "limit_expires_in_days") ||
            (table === "Customer" &&
                isCreditDashboardEnrichedCustomerField(field)) ||
            (table === "Invoice" && field === "days_overdue") ||
            (table === "Invoice" && field === "days_until_due") ||
            (table === "Invoice" && field === "days_left_for_reporting") ||
            (table === "Invoice" && field === "terms_breach_reason") ||
            (table === "Dispute" && field === "dispute_number") ||
            (table === "Dispute" && field === "dispute_reason") ||
            (table === "Dispute" && field === "assigned_to") ||
            (table === "Dispute" && field === "amount_in_dispute") ||
            (table === "Dispute" && field === "days_past_due") ||
            (table === "Activity" && field === "title") ||
            (table === "Activity" && field === "call_time") ||
            (table === "Activity" && field === "call_direction")
        );
    }

    /**
     * Add special computed field to select
     */
    private addSpecialComputedField(
        select: any,
        field: FieldConfig,
        primaryTable: string
    ): void {
        if (
            primaryTable === "Customer" &&
            field.field === "parent_customer_name"
        ) {
            this.addParentCustomerRelation(select);
        } else if (primaryTable === "Customer" && field.field === "category") {
            this.addCategoryRelation(select);
        } else if (
            primaryTable === "Dispute" &&
            field.field === "dispute_number"
        ) {
            // dispute_number is an alias for id
            select.id = true;
            // Also include Customer relation for linking purposes
            if (!select.Customer) {
                select.Customer = {
                    select: {
                        id: true,
                    },
                };
            }
        } else if (
            primaryTable === "Dispute" &&
            field.field === "dispute_reason"
        ) {
            // dispute_reason comes from DisputeReason relation
            if (!select.DisputeReason) {
                select.DisputeReason = {
                    select: {
                        name: true,
                    },
                };
            }
        } else if (
            primaryTable === "Dispute" &&
            field.field === "assigned_to"
        ) {
            // assigned_to comes from the User relation via owner_id
            if (!select.User_CustomerDispute_owner_idToUser) {
                select.User_CustomerDispute_owner_idToUser = {
                    select: {
                        name: true,
                        email: true,
                    },
                };
            }
        } else if (
            primaryTable === "Dispute" &&
            field.field === "amount_in_dispute"
        ) {
            // amount_in_dispute is calculated from DisputeInvoice relation
            if (!select.DisputeInvoice) {
                select.DisputeInvoice = {
                    select: {
                        Invoice: {
                            select: {
                                outstanding_debt: true,
                                customer_currency: true,
                            },
                        },
                    },
                };
            }
        } else if (
            primaryTable === "Activity" &&
            field.field === "title"
        ) {
            // Activity.title needs the title field plus title_params and relations for parameter replacement
            select.title = true;
            select.title_params = true;
            // Include ActivityContact relation for contacts parameter
            if (!select.ActivityContact) {
                select.ActivityContact = {
                    select: {
                        Contact: {
                            select: {
                                email: true,
                                mobile: true,
                                first_name: true,
                                last_name: true,
                            },
                        },
                        status: true,
                    },
                };
            }
            // Include ActivitiesSequence relation for step parameter
            if (!select.ActivitiesSequence) {
                select.ActivitiesSequence = {
                    select: {
                        step: true,
                        category: true,
                    },
                };
            }
            // Include Account relation for date formatting (timezone/locale)
            if (!select.Account) {
                select.Account = {
                    select: {
                        Country: {
                            select: {
                                iso2: true,
                            },
                        },
                        State: {
                            select: {
                                iso2: true,
                            },
                        },
                    },
                };
            }
            // Include type and schedule_time which are needed for title formatting
            select.type = true;
            select.schedule_time = true;
            select.status = true;
            select.content = true;
        } else if (
            primaryTable === "Dispute" &&
            field.field === "days_past_due"
        ) {
            // days_past_due is calculated from the oldest Invoice due_date in DisputeInvoice
            if (!select.DisputeInvoice) {
                select.DisputeInvoice = {
                    select: {
                        Invoice: {
                            select: {
                                due_date: true,
                            },
                        },
                    },
                };
            } else {
                // DisputeInvoice already exists, ensure due_date is included
                if (!select.DisputeInvoice.select.Invoice) {
                    select.DisputeInvoice.select.Invoice = {
                        select: {
                            due_date: true,
                        },
                    };
                } else if (
                    !select.DisputeInvoice.select.Invoice.select.due_date
                ) {
                    select.DisputeInvoice.select.Invoice.select.due_date = true;
                }
            }
        } else if (
            (primaryTable === "Invoice" && field.field === "days_overdue") ||
            (primaryTable === "Invoice" && field.field === "days_until_due")
        ) {
            select.due_date = true;
        } else if (
            primaryTable === "Invoice" &&
            field.field === "days_left_for_reporting"
        ) {
            select.target_reporting_date = true;
        } else if (
            primaryTable === "Invoice" &&
            field.field === "terms_breach_reason"
        ) {
            select.reporting_breach = true;
            select.ctv_payment_term = true;
            select.ctv_customer_overdue_mep = true;
            select.ctv_outdated_dcl = true;
            select.ctv_invoice_after_policy_end = true;
        } else if (
            primaryTable === "Customer" &&
            field.field === "days_overdue"
        ) {
            select.oldest_invoice_overdue_date = true;
        } else if (
            primaryTable === "Customer" &&
            field.field === "limit_expires_in_days"
        ) {
            mergeActiveCustomerPolicySelect(select, [
                "approved_limit_expiration_date",
            ]);
        } else if (
            primaryTable === "Customer" &&
            isCreditDashboardEnrichedCustomerField(field.field)
        ) {
            select.id = true;
            if (field.field === "policy_risk_allocated") {
                mergeActiveCustomerPolicySelect(select, ["capacity_gap_amount"]);
            }
        } else if (
            primaryTable === "Activity" &&
            (field.field === "call_time" || field.field === "call_direction")
        ) {
            select.actual_delivery_time = true;
            select.created_at = true;
            select.title_params = true;
        }
    }

    /**
     * Add ParentCustomer relation for parent_customer_name field
     */
    private addParentCustomerRelation(select: any): void {
        if (!select.ParentCustomer) {
            select.ParentCustomer = {
                select: {
                    id: true,
                    type: true,
                    customer_number: true,
                    Person: {
                        select: {
                            first_name: true,
                            last_name: true,
                            full_name: true,
                        },
                    },
                    Company: {
                        select: {
                            name: true,
                        },
                    },
                },
            };
        }
        if (!select.parent_customer_id) {
            select.parent_customer_id = true;
        }
    }

    /**
     * Add CustomerCollectionPeriod relation for category field
     */
    private addCategoryRelation(select: any): void {
        select.automation_stuck_no_contacts = true;
        if (!select.CustomerCollectionPeriod) {
            select.CustomerCollectionPeriod = {
                where: {
                    period_end_date: null,
                },
                select: {
                    current_category: true,
                    last_automated_step: true,
                },
                take: 1,
            };
        } else {
            const selectConfig = select.CustomerCollectionPeriod.select || {};
            selectConfig.last_automated_step = true;
        }
    }

    /**
     * Add relation field (dot notation) to select
     */
    private addRelationField(
        select: any,
        field: FieldConfig,
        primaryTable: string
    ): void {
        if (
            primaryTable === "Customer" &&
            isCustomerPolicyBackedReportField(field.field)
        ) {
            mergeActiveCustomerPolicySelect(select, [field.field]);
            return;
        }

        if (
            primaryTable === "Customer" &&
            isTrendCostBackedReportField(field.field)
        ) {
            mergeLatestCustomerPolicyTrendSelect(select, [field.field]);
            return;
        }

        const [relationName, ...relationFieldParts] = field.field.split(".");
        const relationFieldPath = relationFieldParts.join(".");
        if (!select[relationName]) {
            select[relationName] = { select: {} };
        }
        this.addNestedSelectField(
            select[relationName].select,
            relationFieldPath
        );

        // Customer location is often stored under Company in existing datasets.
        // When a report asks for Customer.Country/State, include Company fallback.
        if (
            primaryTable === "Customer" &&
            (relationName === "Country" || relationName === "State") &&
            relationFieldPath === "name"
        ) {
            if (!select.Company) {
                select.Company = { select: {} };
            }
            if (!select.Company.select[relationName]) {
                select.Company.select[relationName] = { select: {} };
            }
            select.Company.select[relationName].select.name = true;
        }
    }

    private addNestedSelectField(targetSelect: any, fieldPath: string): void {
        const parts = fieldPath.split(".").filter(Boolean);
        if (parts.length === 0) {
            return;
        }
        if (parts.length === 1) {
            targetSelect[parts[0]] = true;
            return;
        }
        const [relationName, ...remaining] = parts;
        if (!targetSelect[relationName]) {
            targetSelect[relationName] = { select: {} };
        } else if (!targetSelect[relationName].select) {
            targetSelect[relationName].select = {};
        }
        this.addNestedSelectField(
            targetSelect[relationName].select,
            remaining.join(".")
        );
    }

    /**
     * Add company mapped field to select
     */
    private addCompanyMappedField(select: any, field: FieldConfig): void {
        if (!select.Company) {
            select.Company = { select: {} };
        }
        select.Company.select[field.field] = true;
        // Also ensure Person is included as fallback for name field (in case Company is null)
        if (field.field === "name" && !select.Person) {
            select.Person = {
                select: {
                    first_name: true,
                    last_name: true,
                    full_name: true,
                },
            };
        }
    }

    /**
     * Add user relation field to select
     */
    private addUserRelationField(
        select: any,
        field: FieldConfig,
        primaryTable: string
    ): void {
        const userRelationName = this.getUserRelationName(
            primaryTable,
            field.field as "created_by" | "modified_by"
        );
        if (!select[userRelationName]) {
            select[userRelationName] = {
                select: {
                    name: true,
                    email: true,
                },
            };
        }
        select[field.field] = true;
    }

    /**
     * Add field from joined table to select
     * Supports nested relations (e.g. Customer -> Invoice -> InvoiceStatus) when config is provided
     */
    private addJoinedTableField(
        select: any,
        field: FieldConfig,
        primaryTable: string,
        config?: ReportConfig
    ): void {
        let relationName = this.getRelationName(primaryTable, field.table);

        // If no direct relation, try nested: find a joined table that has a relation to field.table
        let parentRelationName: string | null = null;
        let nestedRelationName: string | null = null;
        if (!relationName && config?.tables?.length) {
            for (const t of config.tables) {
                if (t === primaryTable || t === field.table) continue;
                const parentRel = this.getRelationName(primaryTable, t);
                const childRel = this.getRelationName(t, field.table);
                if (parentRel && childRel) {
                    parentRelationName = parentRel;
                    nestedRelationName = childRel;
                    break;
                }
            }
        }

        if (nestedRelationName && parentRelationName) {
            // Add field under parent's select (e.g. select.Invoice.select.InvoiceStatus)
            if (!select[parentRelationName]) {
                select[parentRelationName] = { select: {} };
            }
            if (!select[parentRelationName].select[nestedRelationName]) {
                select[parentRelationName].select[nestedRelationName] = { select: {} };
            }
            select[parentRelationName].select[nestedRelationName].select[field.field] = true;
            return;
        }

        if (!relationName) {
            this.logService.logMessage(
                LogLevel.WARNING,
                `Could not find relation from ${primaryTable} to ${field.table} for field ${field.field}`,
                "ReportQueryBuilder"
            );
            return;
        }

        if (!select[relationName]) {
            select[relationName] = { select: {} };
        }

        // Always keep joined record id so link metadata (e.g. Customer.name) can resolve.
        if (!select[relationName].select.id) {
            select[relationName].select.id = true;
        }

        // When joining Customer from a child table, also select the FK for links/filters.
        if (
            field.table === "Customer" &&
            primaryTable !== "Customer" &&
            !select.customer_id
        ) {
            select.customer_id = true;
        }

        // Special handling for Activity.title - needs relations for parameter replacement
        if (field.table === "Activity" && field.field === "title") {
            // Include title_params field
            select[relationName].select.title_params = true;
            // Include ActivityContact relation for contacts parameter
            if (!select[relationName].select.ActivityContact) {
                select[relationName].select.ActivityContact = {
                    select: {
                        Contact: {
                            select: {
                                email: true,
                                mobile: true,
                                first_name: true,
                                last_name: true,
                            },
                        },
                        status: true,
                    },
                };
            }
            // Include ActivitiesSequence relation for step parameter
            if (!select[relationName].select.ActivitiesSequence) {
                select[relationName].select.ActivitiesSequence = {
                    select: {
                        step: true,
                        category: true,
                    },
                };
            }
            // Include Account relation for date formatting (timezone/locale)
            if (!select[relationName].select.Account) {
                select[relationName].select.Account = {
                    select: {
                        Country: {
                            select: {
                                iso2: true,
                            },
                        },
                        State: {
                            select: {
                                iso2: true,
                            },
                        },
                    },
                };
            }
            // Include type and schedule_time which are needed for title formatting
            select[relationName].select.type = true;
            select[relationName].select.schedule_time = true;
            select[relationName].select.status = true;
            select[relationName].select.content = true;
            select[relationName].select.title = true;
            return;
        }

        if (SpecialFieldHandler.shouldMapToCompany(field.table, field.field)) {
            if (!select[relationName].select.Company) {
                select[relationName].select.Company = { select: {} };
            }
            select[relationName].select.Company.select[field.field] = true;
            // Person fallback for Customer.name when Company is null (Activity/Dispute drills)
            if (field.field === "name" && !select[relationName].select.Person) {
                select[relationName].select.Person = {
                    select: {
                        first_name: true,
                        last_name: true,
                        full_name: true,
                    },
                };
            }
        } else if (
            field.table === "Customer" &&
            isCustomerPolicyBackedReportField(field.field)
        ) {
            mergeActiveCustomerPolicySelect(
                select[relationName].select as Record<string, unknown>,
                [field.field]
            );
        } else if (
            field.table === "Customer" &&
            isTrendCostBackedReportField(field.field)
        ) {
            mergeLatestCustomerPolicyTrendSelect(
                select[relationName].select as Record<string, unknown>,
                [field.field]
            );
        } else if (
            field.table === "Invoice" &&
            isInvoicePolicyReportField(field.field)
        ) {
            mergeInvoicePolicySelect(
                select[relationName].select as Record<string, unknown>,
                [field.field]
            );
        } else if (this.hasUserRelation(field)) {
            const userRelationName = this.getUserRelationName(
                field.table,
                field.field as "created_by" | "modified_by"
            );
            if (!select[relationName].select[userRelationName]) {
                select[relationName].select[userRelationName] = {
                    select: {
                        name: true,
                        email: true,
                    },
                };
            }
            select[relationName].select[field.field] = true;
        } else {
            if (this.isLegacyLocationField(field.table, field.field)) {
                this.addLegacyLocationSelect(
                    select[relationName].select,
                    field.field
                );
            } else if (field.field.includes(".")) {
                this.addNestedSelectField(
                    select[relationName].select,
                    field.field
                );
            } else {
                select[relationName].select[field.field] = true;
            }
        }

        // Always select policy_id for joined Invoice records to support historic matching
        if (field.table === "Invoice") {
            select[relationName].select.policy_id = true;
        }

        // Add currency field for amount fields
        if (
            field.field.toLowerCase().includes("amount") &&
            field.table === "Invoice"
        ) {
            if (!select[relationName].select.customer_currency) {
                select[relationName].select.customer_currency = true;
            }
        }
    }

    /**
     * Check if field has user relation (created_by, modified_by)
     */
    private hasUserRelation(field: FieldConfig): boolean {
        return field.field === "created_by" || field.field === "modified_by";
    }

    /**
     * Get user relation name
     */
    private getUserRelationName(
        tableName: string,
        fieldName: "created_by" | "modified_by"
    ): string {
        return getUserRelationNameForReportTable(tableName, fieldName);
    }

    /**
     * Get relation name with caching
     */
    private getRelationName(fromTable: string, toTable: string): string | null {
        const key = `${fromTable}:${toTable}`;

        if (this.relationCache.has(key)) {
            return this.relationCache.get(key)!;
        }

        // Prevent cache from growing too large
        if (this.relationCache.size >= this.MAX_CACHE_SIZE) {
            // Clear oldest entries (simple FIFO)
            const firstKey = this.relationCache.keys().next().value;
            if (firstKey !== undefined) {
                this.relationCache.delete(firstKey);
            }
        }

        const relation = RELATION_MAP[fromTable]?.[toTable] || null;
        this.relationCache.set(key, relation);
        return relation;
    }

    /**
     * Extract relation name from foreign key field name
     * Converts snake_case field names to PascalCase table names
     * Examples:
     *   "customer_id" -> "Customer"
     *   "company_id" -> "Company"
     *   "parent_customer_id" -> "ParentCustomer"
     *   "contact_id" -> "Contact"
     */
    private getRelationNameFromField(fieldName: string): string | null {
        if (!fieldName.endsWith("_id")) {
            return null;
        }

        // Remove "_id" suffix
        const baseName = fieldName.slice(0, -3);

        // Convert snake_case to PascalCase
        // Split by underscore, capitalize first letter of each word, join
        const parts = baseName.split("_");
        const pascalCase = parts
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join("");

        return pascalCase || null;
    }

    /**
     * Check if relation is one-to-many
     */
    private isOneToManyRelation(fromTable: string, toTable: string): boolean {
        return ONE_TO_MANY_MAP[fromTable]?.includes(toTable) || false;
    }

    /**
     * Check if field is ID field
     */
    private isIdField(fieldName: string): boolean {
        const normalizedName = fieldName.toLowerCase();
        return normalizedName === "id" || normalizedName.endsWith("_id");
    }

    /**
     * Check if field is date field
     */
    private isDateField(table: string, field: string): boolean {
        const fieldLower = field.toLowerCase();
        if (
            DATE_INDICATORS.some((indicator) => fieldLower.includes(indicator))
        ) {
            return true;
        }
        return DATE_FIELDS_BY_TABLE[table]?.includes(field) || false;
    }

    /**
     * Normalize operator using FilterOperatorNormalizer
     */
    private normalizeOperator(operator: string): string {
        return FilterOperatorNormalizer.normalize(operator);
    }

    /**
     * Set nested field in object
     */
    private setNestedField(obj: any, path: string, value: any): void {
        const parts = path.split(".");
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
                current[parts[i]] = {};
            }
            current = current[parts[i]];
        }

        current[parts[parts.length - 1]] = value;
    }
}
