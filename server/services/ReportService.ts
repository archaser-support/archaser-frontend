import { Prisma, Report } from "@prisma/client";

import { DbClient, prisma, type ExtendedPrismaClient } from "@/lib/prisma";
import { MAIN_REPORTS_MENU_CONTEXT } from "@/shared/utils/viewConfigs";
import { reportConfigReferencesCreditInsuranceFields } from "@/server/utils/reportCreditInsuranceFieldUsage";
import {
    getFieldOutputKey,
    isReportFilterValueIncomplete,
} from "@/utils/reportTableUtils";
import {
    MAX_FORMULAS_PER_REPORT,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import { validateReportFormulas } from "@/server/services/reportFormulaExecution";
import { LogLevel } from "@/types/enums";
import { LogService } from "./LogService";
import { REPORT_METADATA } from "./reportMetadata";

// Constants
const SYSTEM_ADMIN_ACCOUNT_ID = 10013;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SORT_FIELD = "modified_at";
const DEFAULT_SORT_DIRECTION = "desc" as const;

export interface ReportConfig {
    tables: string[];
    joins?: Array<{
        type: "INNER" | "LEFT" | "RIGHT";
        from: string;
        to: string;
        on: string;
    }>;
    fields?: Array<{
        table: string;
        field: string;
        alias?: string;
        aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
    }>;
    filters?: Array<{
        table: string;
        field: string;
        operator: string;
        value: any;
    }>;
    grouping?: string[];
    sorting?: Array<{
        field: string;
        direction: "ASC" | "DESC";
    }>;
    chart?: {
        type: "bar" | "line" | "pie" | "area" | "table";
        xAxis?: string;
        yAxis?: string;
        title?: string;
    };
    formulas?: ReportFormula[];
    /** Interleaved column order: field output keys and `formula:{id}` entries. */
    columnOrder?: string[];
}

export interface CreateReportData {
    account_id: number;
    name: string;
    description?: string;
    report_config: ReportConfig;
    is_public?: boolean;
    is_system?: boolean;
    context?: string;
    is_default?: boolean;
    created_by?: string;
}

export interface UpdateReportData {
    name?: string;
    description?: string;
    report_config?: ReportConfig;
    is_public?: boolean;
    is_system?: boolean;
    context?: string;
    is_default?: boolean;
    modified_by?: string;
}

export class ReportService {
    private static instance: ReportService;
    private static metadataCache: typeof REPORT_METADATA | null = null;
    private logService = LogService.getInstance();

    public static getInstance(): ReportService {
        if (!ReportService.instance) {
            ReportService.instance = new ReportService();
        }
        return ReportService.instance;
    }

    private normalizeReportContext(context?: string | null): string {
        const trimmed = context?.trim();
        return trimmed || MAIN_REPORTS_MENU_CONTEXT;
    }

    private shouldBypassCreditInsuranceReportFilter(
        accountId: number,
        userRole?: string
    ): boolean {
        return (
            accountId === SYSTEM_ADMIN_ACCOUNT_ID ||
            userRole === "archaser_admin" ||
            userRole === "ARchaser Admin"
        );
    }

    private async accountHasCreditInsurance(
        accountId: number,
        dbClient: DbClient = prisma
    ): Promise<boolean> {
        if (accountId === SYSTEM_ADMIN_ACCOUNT_ID) {
            return true;
        }

        const account = await (dbClient as any).account.findUnique({
            where: { id: accountId },
            select: { has_credit_insurance: true } as any,
        });

        return (account as any)?.has_credit_insurance === true;
    }

    private shouldSyncSystemReportToAccount(
        report: Pick<Report, "report_config">,
        targetAccountId: number,
        targetHasCreditInsurance: boolean
    ): boolean {
        if (targetAccountId === SYSTEM_ADMIN_ACCOUNT_ID) {
            return true;
        }

        if (
            !reportConfigReferencesCreditInsuranceFields(report.report_config)
        ) {
            return true;
        }

        return targetHasCreditInsurance;
    }

    /**
     * Generate description from report config
     */
    private async generateDescription(config: ReportConfig): Promise<string> {
        const parts: string[] = [];

        // Get primary table name
        const primaryTable = config.tables[0] || "records";
        const tableLabel = this.getTableLabel(primaryTable);

        // Add filters description
        if (config.filters && config.filters.length > 0) {
            const filterDescriptions = await Promise.all(
                config.filters.map(async (filter) => {
                    const fieldLabel = this.getFieldLabel(
                        filter.table,
                        filter.field
                    );
                    const valueLabel = await this.formatFilterValue(
                        filter.value,
                        filter.operator
                    );
                    return `${fieldLabel} ${this.getOperatorLabel(filter.operator)} ${valueLabel}`;
                })
            );
            parts.push(filterDescriptions.join(" and "));
        }

        // Build description
        let description = "";
        if (parts.length > 0) {
            description = `All ${tableLabel.toLowerCase()} where ${parts.join(" and ")}.`;
        } else {
            description = `All ${tableLabel.toLowerCase()}.`;
        }

        // Replace any user IDs in the description with user names
        description = await this.replaceUserIdsWithNames(description);

        return description;
    }

    /**
     * Get human-readable table label
     */
    private getTableLabel(table: string): string {
        const labels: Record<string, string> = {
            Customer: "customers",
            Invoice: "invoices",
            Payment: "payments",
            Contact: "contacts",
            Activity: "activities",
        };
        return labels[table] || table;
    }

    /**
     * Get human-readable field label
     */
    private getFieldLabel(table: string, field: string): string {
        let label: string = "";

        // Handle prefixed fields like "Company.Name", "Country.name", "State.name", etc.
        if (field.includes(".")) {
            const metadata = this.getMetadata();

            // First, check if this is a field in the current table's metadata
            // (e.g., Customer table has "Country.name" as a field with label "Country")
            const currentTableData = metadata.tables.find(
                (t: any) => t.name === table
            );
            if (currentTableData) {
                const currentTableField = currentTableData.fields.find(
                    (f: any) => f.name === field
                );
                if (currentTableField?.label) {
                    label = currentTableField.label;
                }
            }

            // If not found in current table, try to resolve as a relation
            if (!label) {
                const [prefixTable, actualField] = field.split(".", 2);
                const tableData = metadata.tables.find(
                    (t: any) => t.name === prefixTable
                );
                if (tableData) {
                    const fieldData = tableData.fields.find(
                        (f: any) => f.name === actualField
                    );
                    if (fieldData) {
                        label = fieldData.label;
                    } else {
                        // Fallback: format the field name
                        label = actualField
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase());
                    }
                } else {
                    // Fallback: format the field name
                    label = actualField
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase());
                }
            }
        } else {
            // Simple mapping - can be enhanced with metadata
            const fieldLabels: Record<string, Record<string, string>> = {
                Customer: {
                    created_at: "created",
                    collection_status: "status",
                    parent_customer_name: "Parent Customer",
                },
                Invoice: {
                    due_date: "due date",
                    amount: "amount",
                },
            };

            // Try to get from metadata first
            const metadata = this.getMetadata();
            const tableData = metadata.tables.find(
                (t: any) => t.name === table
            );
            if (tableData) {
                const fieldData = tableData.fields.find(
                    (f: any) => f.name === field
                );
                if (fieldData) {
                    label = fieldData.label;
                } else {
                    label =
                        fieldLabels[table]?.[field] ||
                        field
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase());
                }
            } else {
                label =
                    fieldLabels[table]?.[field] ||
                    field
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase());
            }
        }

        // Return lowercase label for description
        return label.toLowerCase();
    }

    /**
     * Get metadata structure (matches the metadata API)
     * Uses cached metadata for performance
     */
    private getMetadata(): typeof REPORT_METADATA {
        if (!ReportService.metadataCache) {
            ReportService.metadataCache = REPORT_METADATA;
        }
        return ReportService.metadataCache;
    }

    /**
     * Get human-readable operator label
     */
    private getOperatorLabel(operator: string): string {
        const labels: Record<string, string> = {
            "=": "is",
            "!=": "is not",
            ">": "greater than",
            ">=": "greater than or equal to",
            "<": "less than",
            "<=": "less than or equal to",
            contains: "contains",
            in: "is one of",
            between: "is between",
        };
        return labels[operator] || operator;
    }

    /**
     * Format filter value for description
     */
    private async formatFilterValue(
        value: any,
        operator: string
    ): Promise<string> {
        if (value === null || value === undefined) {
            return "null";
        }

        if (
            operator === "between" &&
            Array.isArray(value) &&
            value.length === 2
        ) {
            const [start, end] = await Promise.all([
                this.replaceUserIdsWithNames(String(value[0])),
                this.replaceUserIdsWithNames(String(value[1])),
            ]);
            return `${start} and ${end}`;
        }

        if (operator === "in" && Array.isArray(value)) {
            const formattedValues = await Promise.all(
                value.map((v) => this.replaceUserIdsWithNames(String(v)))
            );
            return formattedValues.join(", ");
        }

        if (value instanceof Date) {
            return value.toLocaleDateString();
        }

        const stringValue = String(value);
        return await this.replaceUserIdsWithNames(stringValue);
    }

    /**
     * Replace user IDs in a string with user names
     * Optimized to use batch queries instead of individual lookups
     */
    private async replaceUserIdsWithNames(text: string): Promise<string> {
        if (!text || typeof text !== "string") {
            return text;
        }

        // Pattern to match potential user IDs:
        // - UUID format: 8-4-4-4-12 hex characters (most common user ID format)
        // - Alphanumeric strings that look like IDs (longer strings, typically 8+ chars)
        const uuidPattern =
            /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

        // For non-UUID patterns, be more conservative: only match longer alphanumeric strings
        // that are likely to be IDs (8+ characters, no spaces, not pure numbers)
        const idLikePattern = /\b[a-zA-Z0-9_-]{8,100}\b/g;

        // Collect all potential user IDs
        const potentialIds = new Set<string>();

        // Match UUIDs (most common format)
        let match;
        while ((match = uuidPattern.exec(text)) !== null) {
            potentialIds.add(match[0]);
        }

        // Match ID-like strings (longer alphanumeric strings)
        idLikePattern.lastIndex = 0; // Reset regex
        while ((match = idLikePattern.exec(text)) !== null) {
            const candidate = match[0];
            // Skip if it's a pure number, email-like, or contains common separators
            if (
                !/^\d+$/.test(candidate) && // Not pure numbers
                !candidate.includes("@") && // Not email-like
                !candidate.includes("/") && // Not paths
                !candidate.includes(".") && // Not IPs or domains
                candidate.length >= 8 // At least 8 chars (more likely to be an ID)
            ) {
                potentialIds.add(candidate);
            }
        }

        if (potentialIds.size === 0) {
            return text;
        }

        // Batch query all users at once instead of individual lookups
        const userIds = Array.from(potentialIds);
        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                name: true,
                email: true,
            },
        });

        // Create a map for O(1) lookups
        const userMap = new Map(
            users.map((user) => [
                user.id,
                // Get user name: prefer first_name + last_name, then name, then email
                (user.first_name && user.last_name
                    ? `${user.first_name} ${user.last_name}`.trim()
                    : null) ||
                user.name ||
                user.email ||
                user.id, // Fallback to ID if no name found
            ])
        );

        // Replace all found user IDs with their names
        let result = text;
        userMap.forEach((userName, userId) => {
            // Use word boundary to ensure we replace the exact ID, not partial matches
            const regex = new RegExp(`\\b${this.escapeRegex(userId)}\\b`, "g");
            result = result.replace(regex, userName);
        });

        return result;
    }

    /**
     * Escape special regex characters in a string
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Validate report config
     */
    private validateReportConfig(config: ReportConfig): void {
        if (!config.tables || config.tables.length === 0) {
            throw new Error("Report must have at least one table");
        }

        if (!config.fields || config.fields.length === 0) {
            throw new Error("Report must have at least one selected field");
        }

        // Validate joins
        if (config.joins) {
            for (const join of config.joins) {
                if (!config.tables.includes(join.from)) {
                    throw new Error(
                        `Join references unknown table: ${join.from}`
                    );
                }
                if (!config.tables.includes(join.to)) {
                    throw new Error(
                        `Join references unknown table: ${join.to}`
                    );
                }
            }
        }

        // Validate fields
        for (const field of config.fields) {
            if (!field.table?.trim() || !field.field?.trim()) {
                throw new Error(
                    "Each selected column must have a non-empty table and field"
                );
            }
            if (!config.tables.includes(field.table)) {
                throw new Error(
                    `Field references unknown table: ${field.table}`
                );
            }
        }

        const selectedFields = config.fields;
        const selectedFieldOutputKeys = new Set(
            selectedFields.map((field) => getFieldOutputKey(field))
        );

        if (selectedFieldOutputKeys.size !== selectedFields.length) {
            throw new Error(
                "Duplicate report field output keys (same alias or same table.field with the same aggregation)"
            );
        }

        if (config.grouping) {
            for (const groupKey of config.grouping) {
                if (!selectedFieldOutputKeys.has(groupKey)) {
                    throw new Error(
                        `Grouping references unknown selected field: ${groupKey}`
                    );
                }
                const matchedField = selectedFields.find(
                    (f) => getFieldOutputKey(f) === groupKey
                );
                if (matchedField?.aggregation) {
                    throw new Error(
                        `Grouping cannot use aggregated field output as dimension: ${groupKey}`
                    );
                }
            }
        }

        const hasAggregatedField = selectedFields.some((field) => !!field.aggregation);
        if (hasAggregatedField) {
            const groupingKeys = new Set(config.grouping || []);
            const missingGroupingFields = selectedFields
                .filter((field) => !field.aggregation)
                .map((field) => getFieldOutputKey(field))
                .filter((fieldKey) => !groupingKeys.has(fieldKey));
            if (missingGroupingFields.length > 0) {
                throw new Error(
                    "When aggregation is used, every non-aggregated selected field must be included in grouping"
                );
            }
        }

        // Validate filters
        if (config.filters) {
            for (const filter of config.filters) {
                if (!filter.table?.trim() || !filter.field?.trim()) {
                    throw new Error(
                        "Each filter must have a table and field selected"
                    );
                }
                if (!config.tables.includes(filter.table)) {
                    throw new Error(
                        `Filter references unknown table: ${filter.table}`
                    );
                }

                if (isReportFilterValueIncomplete(filter)) {
                    if (filter.operator === "between") {
                        throw new Error(
                            `Filter with "between" operator requires both start and end values to be filled`
                        );
                    }
                    throw new Error(
                        "Each filter must have a value, or use \"Is empty\" / \"Is not empty\" when no value is needed"
                    );
                }
            }
        }

        if (config.formulas && config.formulas.length > 0) {
            if (config.formulas.length > MAX_FORMULAS_PER_REPORT) {
                throw new Error(
                    `Reports may contain at most ${MAX_FORMULAS_PER_REPORT} formulas`
                );
            }
            for (const formula of config.formulas) {
                if (
                    formula &&
                    typeof formula === "object" &&
                    "name" in formula &&
                    !("id" in formula)
                ) {
                    throw new Error(
                        "Legacy formula configuration is not supported; recreate formulas using the formula editor"
                    );
                }
            }
            const metadataTables = (this.getMetadata()?.tables ||
                REPORT_METADATA.tables) as Array<{
                name: string;
                fields: Array<{ name: string; type: string }>;
            }>;
            validateReportFormulas(config, metadataTables);
        }

        if (config.columnOrder && config.columnOrder.length > 0) {
            const fieldKeys = new Set(
                selectedFields.map((field) => getFieldOutputKey(field))
            );
            const formulaKeys = new Set(
                (config.formulas || []).map((f) => `formula:${f.id}`)
            );
            for (const key of config.columnOrder) {
                if (!fieldKeys.has(key) && !formulaKeys.has(key)) {
                    throw new Error(
                        `Column order references unknown column: ${key}`
                    );
                }
            }
        }
    }

    /**
     * Generate a unique name from report name
     * Converts to lowercase, replaces spaces/special chars with underscores
     * Ensures uniqueness per account by appending numbers if needed
     */
    private async generateUniqueName(
        baseName: string,
        accountId: number,
        excludeId?: number
    ): Promise<string> {
        // Convert to lowercase and replace non-alphanumeric with underscores
        let cleanName = baseName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, ""); // Remove leading/trailing underscores

        // Ensure it's not empty
        if (!cleanName) {
            cleanName = "report";
        }

        let candidateName = cleanName;
        let counter = 0;

        // Check for uniqueness and increment counter if needed
        while (true) {
            const existing = await prisma.report.findFirst({
                where: {
                    account_id: accountId,
                    unique_name: candidateName,
                    ...(excludeId ? { id: { not: excludeId } } : {}),
                } as Prisma.ReportWhereInput,
            });

            if (!existing) {
                break;
            }

            counter++;
            candidateName = `${cleanName}_${counter}`;
        }

        return candidateName;
    }

    /**
     * Create a new report
     */
    async createReport(data: CreateReportData): Promise<Report> {
        try {
            // Ensure first field is set as default sort if no sorting is provided
            if (!data.report_config.sorting || data.report_config.sorting.length === 0) {
                if (data.report_config.fields && data.report_config.fields.length > 0) {
                    const firstField = data.report_config.fields[0];
                    data.report_config.sorting = [{
                        field: getFieldOutputKey(firstField),
                        direction: "ASC",
                    }];
                }
            }

            // Validate config
            this.validateReportConfig(data.report_config);

            // Generate description if not provided
            const description =
                data.description ||
                (await this.generateDescription(data.report_config));

            // Generate unique name
            const uniqueName = await this.generateUniqueName(
                data.name,
                data.account_id
            );

            // If this is a system report being set as default, unset all other system/account defaults for the same context
            // NOTE: This only affects Report.is_default flags, NOT UserDefaultReport records.
            // User-specific defaults are stored separately and take precedence in getDefaultView(),
            // so users who have set their own default will not be affected by this change.
            if (data.is_system && data.is_default && data.context) {
                await prisma.report.updateMany({
                    where: {
                        context: data.context,
                        is_default: true,
                        account_id: data.account_id,
                        id: { not: -1 }, // Exclude non-existent ID to update all
                    },
                    data: {
                        is_default: false,
                    },
                });
            }

            const report = await (prisma as any).report.create({
                data: {
                    account_id: data.account_id,
                    name: data.name,
                    unique_name: uniqueName,
                    description,
                    report_config: data.report_config as any,
                    is_public: data.is_public || false,
                    is_system: data.is_system || false,
                    context: this.normalizeReportContext(data.context),
                    is_default: data.is_default || false,
                    created_by: data.created_by,
                    modified_by: data.created_by,
                },
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Report created: ${report.name} (ID: ${report.id}, Unique: ${report.unique_name})`,
                "ReportService",
                undefined,
                data.account_id,
                data.created_by
            );

            return report;
        } catch (error) {
            // Handle unique constraint violation for unique_name
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                const target = (error.meta?.target as string[]) || [];
                if (
                    target.includes("unique_name") ||
                    target.includes("account_id")
                ) {
                    throw new Error(
                        `A report with the name "${data.name}" already exists. Please choose a different name.`
                    );
                }
            }

            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to create report: ${error instanceof Error ? error.message : String(error)}`,
                "ReportService",
                undefined,
                data.account_id,
                data.created_by
            );
            throw error;
        }
    }

    /**
     * Get report by ID with permission check
     */
    async getReport(
        id: number,
        accountId: number,
        userId?: string
    ): Promise<Report | null> {
        const report = await (prisma as any).report.findUnique({
            where: { id },
            include: {
                Account: true,
            },
        });

        if (!report) {
            return null;
        }

        // Check if user has access
        if (report.account_id !== accountId && !report.is_system) {
            // Check if report is public or shared
            if (!report.is_public) {
                if (userId) {
                    const share = await prisma.reportShare.findFirst({
                        where: {
                            report_id: id,
                            OR: [
                                { shared_with_user_id: userId },
                                {
                                    shared_with_role: {
                                        // This would need to check user's role
                                    },
                                },
                            ],
                        },
                    });

                    if (!share) {
                        return null;
                    }
                } else {
                    return null;
                }
            }
        }

        return report;
    }

    /**
     * Get default view for a context
     * Prioritizes user-specific defaults, then system views, then account-specific views
     *
     * IMPORTANT: User-specific defaults (UserDefaultReport) always take precedence.
     * When system/account defaults are updated, users with personal defaults are NOT affected
     * because this method checks UserDefaultReport first before falling back to system defaults.
     */
    async getDefaultView(
        accountId: number,
        context: string,
        userId?: string,
        options?: { filterCreditInsuranceReports?: boolean; userRole?: string }
    ): Promise<Report | null> {
        const filterCreditInsuranceReports =
            options?.filterCreditInsuranceReports === true &&
            !this.shouldBypassCreditInsuranceReportFilter(
                accountId,
                options?.userRole
            );

        // First try to find a user-specific default (if userId provided)
        // This takes precedence over all system/account defaults, so users with personal
        // defaults are protected from changes to system default reports.
        if (userId) {
            const userDefault = await prisma.userDefaultReport.findUnique({
                where: {
                    user_id_context: {
                        user_id: userId,
                        context: context,
                    },
                },
                include: {
                    Report: true,
                },
            });

            if (userDefault?.Report) {
                if (
                    !filterCreditInsuranceReports ||
                    !reportConfigReferencesCreditInsuranceFields(
                        userDefault.Report.report_config
                    )
                ) {
                    return userDefault.Report;
                }
            }
        }

        if (filterCreditInsuranceReports) {
            const accessConditions = this.buildAccessConditions(
                accountId,
                userId,
                context
            );
            const where: Prisma.ReportWhereInput = {
                OR: accessConditions,
                is_default: true,
                context: context,
            };

            const candidates = await prisma.report.findMany({
                where,
                orderBy: [{ is_system: "desc" }, { created_at: "asc" }],
            });

            const picked =
                candidates.find(
                    (r) =>
                        !reportConfigReferencesCreditInsuranceFields(
                            r.report_config
                        )
                ) || null;
            return picked;
        }

        // If no user default, try to find a system default view using access conditions
        // This ensures we use the same access control logic as listReports
        const accessConditions = this.buildAccessConditions(accountId, userId, context);
        const where: Prisma.ReportWhereInput = {
            OR: accessConditions,
            is_default: true,
            context: context,
        };

        // First try system default (is_system = true)
        const systemDefault = await prisma.report.findFirst({
            where: {
                ...where,
                is_system: true,
            },
            orderBy: {
                created_at: "asc",
            },
        });

        if (systemDefault) {
            return systemDefault;
        }

        // If no system default, try any account-specific default from accessible reports
        const accountDefault = await prisma.report.findFirst({
            where,
            orderBy: {
                created_at: "asc",
            },
        });

        return accountDefault;
    }

    /**
     * Set user's default report for a context
     */
    async setUserDefaultReport(
        userId: string,
        context: string,
        reportId: number,
        accountId: number,
        userRole?: string
    ): Promise<void> {
        // Verify report exists and user has access
        const report = await this.getReport(reportId, accountId, userId);
        if (!report) {
            throw new Error("Report not found or access denied");
        }

        // Verify context matches
        if (report.context !== context) {
            throw new Error("Report context does not match");
        }

        const accountRow = await prisma.account.findUnique({
            where: { id: accountId },
            select: { has_credit_insurance: true } as any,
        });
        const hasCreditInsurance =
            (accountRow as any)?.has_credit_insurance === true;
        if (
            !hasCreditInsurance &&
            !this.shouldBypassCreditInsuranceReportFilter(
                accountId,
                userRole
            ) &&
            reportConfigReferencesCreditInsuranceFields(report.report_config)
        ) {
            throw new Error(
                "Credit insurance is not enabled for this account; this view cannot be set as default"
            );
        }

        // Upsert user default report
        await prisma.userDefaultReport.upsert({
            where: {
                user_id_context: {
                    user_id: userId,
                    context: context,
                },
            },
            update: {
                report_id: reportId,
                modified_at: new Date(),
            },
            create: {
                user_id: userId,
                context: context,
                report_id: reportId,
            },
        });
    }

    /**
     * Clear user's default report for a context
     */
    async clearUserDefaultReport(
        userId: string,
        context: string
    ): Promise<void> {
        await prisma.userDefaultReport.deleteMany({
            where: {
                user_id: userId,
                context: context,
            },
        });
    }

    /**
     * Get user's default report for a context
     */
    async getUserDefaultReport(
        userId: string,
        context: string,
        accountId: number,
        userRole?: string
    ): Promise<Report | null> {
        const userDefault = await prisma.userDefaultReport.findUnique({
            where: {
                user_id_context: {
                    user_id: userId,
                    context: context,
                },
            },
            include: {
                Report: true,
            },
        });

        const report = userDefault?.Report || null;
        if (!report) {
            return null;
        }

        const filterCreditInsuranceReports =
            !this.shouldBypassCreditInsuranceReportFilter(
                accountId,
                userRole
            );

        if (!filterCreditInsuranceReports) {
            return report;
        }

        const accountRow = await prisma.account.findUnique({
            where: { id: accountId },
            select: { has_credit_insurance: true } as any,
        });
        const hasCreditInsurance =
            (accountRow as any)?.has_credit_insurance === true;
        if (
            !hasCreditInsurance &&
            reportConfigReferencesCreditInsuranceFields(report.report_config)
        ) {
            return null;
        }

        return report;
    }

    /**
     * Build access conditions for report queries
     * Users can only see:
     * 1. Reports they created (created_by === userId)
     * 2. System reports (is_system === true)
     * 3. Public reports (is_public === true)
     * 4. Reports shared with them (handled by buildShareConditions)
     */
    private buildAccessConditions(
        accountId: number,
        userId?: string,
        context?: string
    ): Prisma.ReportWhereInput[] {
        const orConditions: Prisma.ReportWhereInput[] = [];

        if (context) {
            // Reports created by the user with matching context
            if (userId) {
                orConditions.push({
                    AND: [
                        { account_id: accountId },
                        { created_by: userId },
                        { context },
                    ],
                });
            }
            // System reports with matching context (only from current account)
            // System reports are copied to each account, so we only show the current account's copy
            orConditions.push({
                AND: [
                    { is_system: true },
                    { context },
                    { account_id: accountId },
                ],
            });
            // Public reports with matching context (only from current account)
            orConditions.push({
                AND: [
                    { is_public: true },
                    { context },
                    { account_id: accountId },
                ],
            });
        } else {
            // If no context filter, show reports created by user, system reports, and public reports
            if (userId) {
                orConditions.push({
                    AND: [{ account_id: accountId }, { created_by: userId }],
                });
            }
            // System reports from current account only
            // System reports are copied to each account, so we only show the current account's copy
            orConditions.push({
                AND: [{ is_system: true }, { account_id: accountId }],
            });
            // Public reports from current account only
            orConditions.push({
                AND: [{ is_public: true }, { account_id: accountId }],
            });
        }

        return orConditions;
    }

    /**
     * Build share conditions for report queries
     * Returns conditions for reports shared with the user (by user ID or role)
     */
    private buildShareConditions(
        userId?: string,
        userRole?: string,
        context?: string
    ): Prisma.ReportWhereInput[] {
        const shareConditions: Prisma.ReportWhereInput[] = [];

        if (userId) {
            const userShareCondition: Prisma.ReportWhereInput = {
                ReportShare: {
                    some: {
                        shared_with_user_id: userId,
                    },
                },
            };

            // Apply context filter if provided
            if (context) {
                shareConditions.push({
                    AND: [userShareCondition, { context }],
                });
            } else {
                shareConditions.push(userShareCondition);
            }
        }

        if (userRole) {
            const roleShareCondition: Prisma.ReportWhereInput = {
                ReportShare: {
                    some: {
                        shared_with_role: userRole as any,
                    },
                },
            };

            // Apply context filter if provided
            if (context) {
                shareConditions.push({
                    AND: [roleShareCondition, { context }],
                });
            } else {
                shareConditions.push(roleShareCondition);
            }
        }

        return shareConditions;
    }

    /**
     * Build search conditions for report queries
     */
    private buildSearchConditions(search: string): Prisma.ReportWhereInput {
        return {
            OR: [
                {
                    name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ],
        };
    }

    /**
     * Build orderBy clause for report queries
     */
    private buildOrderBy(
        sortField?: string,
        sortDirection?: "asc" | "desc"
    ): Prisma.ReportOrderByWithRelationInput {
        const direction = sortDirection || DEFAULT_SORT_DIRECTION;
        const field = sortField || DEFAULT_SORT_FIELD;

        switch (field) {
            case "name":
                return { name: direction };
            case "description":
                return { description: direction };
            case "created_at":
                return { created_at: direction };
            case "modified_at":
                return { modified_at: direction };
            default:
                return { modified_at: DEFAULT_SORT_DIRECTION };
        }
    }

    /**
     * List reports user has access to
     */
    async listReports(
        accountId: number,
        userId?: string,
        userRole?: string,
        options?: {
            page?: number;
            limit?: number;
            search?: string;
            sortField?: string;
            sortDirection?: "asc" | "desc";
            context?: string;
            /** When true, omit saved views that reference credit-insurance-only columns. */
            filterCreditInsuranceReports?: boolean;
        }
    ): Promise<{ reports: Report[]; totalRecords: number }> {
        // Validate and normalize pagination parameters
        const page = Math.max(1, options?.page || 1);
        const limit = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, options?.limit || DEFAULT_PAGE_SIZE)
        );
        const search = options?.search?.trim() || "";
        const sortField = options?.sortField || DEFAULT_SORT_FIELD;
        const sortDirection = options?.sortDirection || DEFAULT_SORT_DIRECTION;

        // Build where clause
        const orConditions = this.buildAccessConditions(
            accountId,
            userId,
            options?.context
        );

        const shareConditions = this.buildShareConditions(
            userId,
            userRole,
            options?.context
        );
        if (shareConditions.length > 0) {
            orConditions.push(...shareConditions);
        }

        // Determine if user is archaser admin
        const isArchaserAdmin =
            accountId === SYSTEM_ADMIN_ACCOUNT_ID ||
            userRole === "archaser_admin" ||
            userRole === "ARchaser Admin";

        const applyCreditInsuranceReportFilter =
            options?.filterCreditInsuranceReports === true && !isArchaserAdmin;

        const where: Prisma.ReportWhereInput = {
            OR: orConditions,
            // If context is provided, only show reports with that context
            // If no context is provided:
            //   - For archaser admin: show all reports (with or without context)
            //   - For regular users: main Reports menu (Location = "reports" in builder)
            ...(options?.context !== undefined
                ? { context: options.context }
                : isArchaserAdmin
                    ? {} // No context filter for archaser admin - show all reports
                    : { context: MAIN_REPORTS_MENU_CONTEXT }),
        };

        // Add search filter if provided
        if (search) {
            where.AND = [
                ...((where.AND as any) || []),
                this.buildSearchConditions(search),
            ];
        }

        // Build orderBy
        const orderBy = this.buildOrderBy(sortField, sortDirection);
        const skip = (page - 1) * limit;

        const includeBlock = {
            User_Report_created_byToUser: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            User_Report_modified_byToUser: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        };

        if (applyCreditInsuranceReportFilter) {
            const idRows = await (prisma as any).report.findMany({
                where,
                orderBy,
                select: {
                    id: true,
                    report_config: true,
                },
            });
            const allowedRows = idRows.filter(
                (r: { report_config: unknown }) =>
                    !reportConfigReferencesCreditInsuranceFields(r.report_config)
            );
            const totalRecords = allowedRows.length;
            const pageRows = allowedRows.slice(skip, skip + limit);
            const pageIds = pageRows.map((r: { id: number }) => r.id);

            if (pageIds.length === 0) {
                return { reports: [], totalRecords };
            }

            const reportsUnordered = await (prisma as any).report.findMany({
                where: { id: { in: pageIds } },
                include: includeBlock,
            });
            const orderIndex = new Map<number, number>(
                pageIds.map((id: number, i: number) => [id, i])
            );
            const reports = [...reportsUnordered].sort(
                (a: { id: number }, b: { id: number }) =>
                    (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0)
            );

            return { reports, totalRecords };
        }

        // Execute queries in parallel
        const [reports, totalRecords] = await Promise.all([
            (prisma as any).report.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: includeBlock,
            }),
            (prisma as any).report.count({ where }),
        ]);

        return { reports, totalRecords };
    }

    /**
     * Update report
     */
    /**
     * Update an existing report
     */
    async updateReport(
        id: number,
        data: UpdateReportData,
        accountId: number
    ): Promise<Report> {
        // Verify report exists and belongs to account
        const existing = await prisma.report.findUnique({
            where: { id },
        });

        if (!existing) {
            throw new Error(`Report with ID ${id} not found`);
        }

        if (existing.account_id !== accountId) {
            throw new Error(
                `Unauthorized to update report ${id}. Report belongs to account ${existing.account_id}, but request is from account ${accountId}`
            );
        }

        // Prevent editing system reports unless user is from system admin account
        if (
            (existing as any).is_system &&
            accountId !== SYSTEM_ADMIN_ACCOUNT_ID
        ) {
            throw new Error(
                `System reports cannot be modified. Only system administrators (account ${SYSTEM_ADMIN_ACCOUNT_ID}) can modify system reports.`
            );
        }

        // Only system admin account can set is_system to true
        if (data.is_system && accountId !== SYSTEM_ADMIN_ACCOUNT_ID) {
            throw new Error(
                `Only system administrators (account ${SYSTEM_ADMIN_ACCOUNT_ID}) can set reports as system reports`
            );
        }

        // Ensure first field is set as default sort if no sorting is provided
        if (data.report_config) {
            if (!data.report_config.sorting || data.report_config.sorting.length === 0) {
                if (data.report_config.fields && data.report_config.fields.length > 0) {
                    const firstField = data.report_config.fields[0];
                    data.report_config.sorting = [{
                        field: getFieldOutputKey(firstField),
                        direction: "ASC",
                    }];
                }
            }

            this.validateReportConfig(data.report_config);
        }

        // Generate description if config changed
        const description =
            data.description ||
            (data.report_config
                ? await this.generateDescription(data.report_config)
                : undefined);

        const modified_ata: any = {
            ...data,
            modified_at: new Date(),
        };

        if (description) {
            modified_ata.description = description;
        }

        // If name is being updated, regenerate unique_name
        if (data.name !== undefined) {
            modified_ata.name = data.name;
            modified_ata.unique_name = await this.generateUniqueName(
                data.name,
                accountId,
                id // Exclude current report from uniqueness check
            );
        }

        if (data.context !== undefined) {
            modified_ata.context = this.normalizeReportContext(data.context);
        }

        // Allow updating is_system (only by account 10013, validated above)
        if (data.is_system !== undefined) {
            modified_ata.is_system = data.is_system;
        }

        // If this is a system report being set as default, unset all other system/account defaults for the same context
        // NOTE: This only affects Report.is_default flags, NOT UserDefaultReport records.
        // User-specific defaults are stored separately and take precedence in getDefaultView(),
        // so users who have their own default will not be affected by this change.
        if (existing.is_system && data.is_default && existing.context) {
            await prisma.report.updateMany({
                where: {
                    account_id: accountId,
                    context: existing.context,
                    is_default: true,
                    id: { not: id }, // Exclude current report
                },
                data: {
                    is_default: false,
                },
            });
        }

        // Allow updating is_default
        if (data.is_default !== undefined) {
            modified_ata.is_default = data.is_default;
        }

        try {
            const report = await (prisma as any).report.update({
                where: { id },
                data: modified_ata,
            });

            await this.logService.logMessage(
                LogLevel.INFO,
                `Report updated: ${report.name} (ID: ${report.id}, Unique: ${report.unique_name})`,
                "ReportService",
                undefined,
                accountId,
                data.modified_by
            );

            return report;
        } catch (error) {
            // Handle unique constraint violation for unique_name
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002"
            ) {
                const target = (error.meta?.target as string[]) || [];
                if (
                    target.includes("unique_name") ||
                    target.includes("account_id")
                ) {
                    throw new Error(
                        `A report with the name "${data.name || "this name"}" already exists. Please choose a different name.`
                    );
                }
            }

            await this.logService.logMessage(
                LogLevel.ERROR,
                `Failed to update report: ${error instanceof Error ? error.message : String(error)}`,
                "ReportService",
                undefined,
                accountId,
                data.modified_by
            );
            throw error;
        }
    }

    /**
     * Delete report and all related records
     */
    async deleteReport(
        id: number,
        accountId: number,
        userId?: string
    ): Promise<void> {
        // Verify report exists and belongs to account
        const existing = await prisma.report.findUnique({
            where: { id },
            include: {
                ReportShare: true,
                ReportSchedule: true,
                ReportExecution: true,
            },
        });

        if (!existing) {
            throw new Error(`Report with ID ${id} not found`);
        }

        if (existing.account_id !== accountId) {
            throw new Error(
                `Unauthorized to delete report ${id}. Report belongs to account ${existing.account_id}, but request is from account ${accountId}`
            );
        }

        // Prevent deletion of system reports unless user is from system admin account
        if (
            (existing as any).is_system &&
            accountId !== SYSTEM_ADMIN_ACCOUNT_ID
        ) {
            throw new Error(
                `System reports cannot be deleted. Only system administrators (account ${SYSTEM_ADMIN_ACCOUNT_ID}) can delete system reports.`
            );
        }

        // Delete all related records in a transaction to ensure data integrity
        await prisma.$transaction(async (tx) => {
            // Delete report executions
            await tx.reportExecution.deleteMany({
                where: { report_id: id },
            });

            // Delete report schedules
            await tx.reportSchedule.deleteMany({
                where: { report_id: id },
            });

            // Delete report shares
            await tx.reportShare.deleteMany({
                where: { report_id: id },
            });

            // Finally, delete the report itself
            await (tx as any).report.delete({
                where: { id },
            });
        });

        await this.logService.logMessage(
            LogLevel.INFO,
            `Report deleted: ${existing.name} (ID: ${id}) along with ${existing.ReportShare.length} shares, ${existing.ReportSchedule.length} schedules, and ${existing.ReportExecution.length} executions`,
            "ReportService",
            undefined,
            accountId,
            userId
        );
    }

    /**
     * Copy all system reports from system admin account to a new account
     * Optimized to use batch create operation
     */
    async copySystemReportsToNewAccount(
        targetAccountId: number,
        userId?: string,
        dbClient: DbClient = prisma,
        skipLogging = false
    ): Promise<void> {
        const targetHasCreditInsurance = await this.accountHasCreditInsurance(
            targetAccountId,
            dbClient
        );

        // Get all system reports from system admin account
        const systemReports = await (dbClient as any).report.findMany({
            where: {
                account_id: SYSTEM_ADMIN_ACCOUNT_ID,
                is_system: true,
            },
        });

        const eligibleSystemReports = systemReports.filter((report: Report) =>
            this.shouldSyncSystemReportToAccount(
                report,
                targetAccountId,
                targetHasCreditInsurance
            )
        );

        if (eligibleSystemReports.length === 0) {
            return; // No system reports to copy
        }

        // Preserve master unique_name so context-specific lookups (e.g. dashboard_invoices_*) stay stable.
        let copiedCount = 0;
        for (const systemReport of eligibleSystemReports) {
            try {
                await (dbClient as any).report.upsert({
                    where: {
                        account_id_unique_name: {
                            account_id: targetAccountId,
                            unique_name: systemReport.unique_name,
                        },
                    },
                    create: {
                        account_id: targetAccountId,
                        name: systemReport.name,
                        unique_name: systemReport.unique_name,
                        description: systemReport.description,
                        report_config: systemReport.report_config,
                        is_public: systemReport.is_public,
                        is_system: true,
                        is_default: systemReport.is_default || false,
                        context: systemReport.context,
                        created_by: userId || systemReport.created_by,
                        modified_by: userId || systemReport.modified_by,
                    },
                    update: {
                        name: systemReport.name,
                        description: systemReport.description,
                        report_config: systemReport.report_config,
                        is_public: systemReport.is_public,
                        is_system: true,
                        is_default: systemReport.is_default || false,
                        context: systemReport.context,
                        modified_by: userId || systemReport.modified_by,
                    },
                });
                copiedCount++;
            } catch (error: any) {
                // Skip if report already exists (unique constraint violation)
                if (error?.code === 'P2002' || error?.code === '23505') {
                    // Report already exists, skip
                    continue;
                }
                // Re-throw other errors
                throw error;
            }
        }

        if (!skipLogging) {
            await this.logService.logMessage(
                LogLevel.INFO,
                `Copied ${copiedCount} system reports to account ${targetAccountId}`,
                "ReportService",
                undefined,
                targetAccountId,
                userId
            );
        }
    }

    /**
     * Sync selected system reports (from master admin account 10013) to all other non-deleted accounts.
     * Matching is by (account_id, unique_name). This updates existing per-account copies and creates missing ones.
     */
    async syncSystemReportsToAllAccounts(
        reportIds: number[],
        userId?: string
    ): Promise<{
        syncedReports: number;
        targetAccounts: number;
        created: number;
        updated: number;
    }> {
        if (!Array.isArray(reportIds) || reportIds.length === 0) {
            throw new Error("reportIds must be a non-empty array");
        }

        const uniqueIds = Array.from(new Set(reportIds)).filter(
            (id) => Number.isFinite(id)
        );
        if (uniqueIds.length === 0) {
            throw new Error("reportIds must contain at least one valid ID");
        }

        // Load selected reports from master account only
        const masterReports = await prisma.report.findMany({
            where: {
                id: { in: uniqueIds },
                account_id: SYSTEM_ADMIN_ACCOUNT_ID,
            },
        });

        if (masterReports.length !== uniqueIds.length) {
            throw new Error(
                "One or more selected reports were not found in the master admin account"
            );
        }

        const nonSystem = masterReports.filter((r) => !r.is_system);
        if (nonSystem.length > 0) {
            throw new Error("Only system reports can be synced");
        }

        // Target: all non-deleted accounts except master
        const targetAccounts = (await prisma.account.findMany({
            where: {
                deleted_at: null,
                id: { not: SYSTEM_ADMIN_ACCOUNT_ID },
            },
            select: {
                id: true,
                has_credit_insurance: true,
            } as any,
        })) as unknown as Array<{
            id: number;
            has_credit_insurance: boolean | null;
        }>;

        if (targetAccounts.length === 0) {
            return {
                syncedReports: masterReports.length,
                targetAccounts: 0,
                created: 0,
                updated: 0,
            };
        }

        const uniqueNames = masterReports.map((r) => r.unique_name);

        // Fetch existing per-account copies to compute created vs updated deterministically
        const existing = (await prisma.report.findMany({
            where: {
                account_id: { in: targetAccounts.map((a) => a.id) },
                unique_name: { in: uniqueNames },
            },
            select: {
                account_id: true,
                unique_name: true,
            },
        })) as Array<{ account_id: number; unique_name: string }>;
        const existingKeySet = new Set(
            existing.map((r) => `${r.account_id}:${r.unique_name}`)
        );

        let created = 0;
        let updated = 0;
        const eligibleAccountIds = new Set<number>();

        // Upsert per target account per report using (account_id, unique_name)
        await prisma.$transaction(async (tx) => {
            for (const account of targetAccounts) {
                const targetHasCreditInsurance =
                    (account as any).has_credit_insurance === true;
                let syncedAnyReportForAccount = false;

                for (const report of masterReports) {
                    if (
                        !this.shouldSyncSystemReportToAccount(
                            report,
                            account.id,
                            targetHasCreditInsurance
                        )
                    ) {
                        continue;
                    }

                    syncedAnyReportForAccount = true;
                    const key = `${account.id}:${report.unique_name}`;
                    if (existingKeySet.has(key)) {
                        updated++;
                    } else {
                        created++;
                        existingKeySet.add(key);
                    }

                    const upserted = await (tx as any).report.upsert({
                        where: {
                            account_id_unique_name: {
                                account_id: account.id,
                                unique_name: report.unique_name,
                            },
                        },
                        create: {
                            account_id: account.id,
                            name: report.name,
                            unique_name: report.unique_name,
                            description: report.description,
                            report_config: report.report_config as any,
                            is_public: report.is_public,
                            is_system: true,
                            is_default: report.is_default,
                            context: report.context,
                            created_by: userId || report.created_by,
                            modified_by: userId || report.modified_by,
                        },
                        update: {
                            name: report.name,
                            description: report.description,
                            report_config: report.report_config as any,
                            is_public: report.is_public,
                            is_system: true,
                            is_default: report.is_default,
                            context: report.context,
                            modified_at: new Date(),
                            modified_by: userId || null,
                        },
                        select: { id: true },
                    });

                    void upserted;
                }

                if (syncedAnyReportForAccount) {
                    eligibleAccountIds.add(account.id);
                }
            }
        });

        await this.logService.logMessage(
            LogLevel.INFO,
            `Synced ${masterReports.length} system reports to ${eligibleAccountIds.size} accounts (created: ${created}, updated: ${updated})`,
            "ReportService",
            undefined,
            SYSTEM_ADMIN_ACCOUNT_ID,
            userId
        );

        return {
            syncedReports: masterReports.length,
            targetAccounts: eligibleAccountIds.size,
            created,
            updated,
        };
    }

    /**
     * Sync system reports from the master admin account (10013) to a single target account.
     * - Matching is by (account_id, unique_name)
     * - Updates existing per-account copies and creates missing ones
     * - Intended for account (re)activation flows
     */
    async syncSystemReportsToAccount(
        targetAccountId: number,
        reportIds?: number[],
        userId?: string,
        dbClient: DbClient = prisma
    ): Promise<{ created: number; updated: number; syncedReports: number }> {
        const targetHasCreditInsurance = await this.accountHasCreditInsurance(
            targetAccountId,
            dbClient
        );

        // Load system reports from master account, optionally filtered by reportIds
        const where: Prisma.ReportWhereInput = {
            account_id: SYSTEM_ADMIN_ACCOUNT_ID,
            is_system: true,
        };
        if (Array.isArray(reportIds) && reportIds.length > 0) {
            const uniqueIds = Array.from(new Set(reportIds)).filter((id) =>
                Number.isFinite(id)
            ) as number[];
            if (uniqueIds.length === 0) {
                throw new Error("reportIds must contain at least one valid ID");
            }
            (where as any).id = { in: uniqueIds };
        }

        const masterReports = (await (dbClient as any).report.findMany({
            where,
        })) as Report[];

        const eligibleReports = masterReports.filter((report: Report) =>
            this.shouldSyncSystemReportToAccount(
                report,
                targetAccountId,
                targetHasCreditInsurance
            )
        );

        if (eligibleReports.length === 0) {
            return { created: 0, updated: 0, syncedReports: 0 };
        }

        const uniqueNames = eligibleReports.map((r: Report) => r.unique_name);

        // Fetch existing per-account copies for this target account
        const existing = (await (dbClient as any).report.findMany({
            where: {
                account_id: targetAccountId,
                unique_name: { in: uniqueNames },
            },
            select: { unique_name: true },
        })) as Array<{ unique_name: string }>;
        const existingSet = new Set(existing.map((r: { unique_name: string }) => r.unique_name));

        let created = 0;
        let updated = 0;

        const runUpserts = async (txLike: DbClient) => {
            for (const report of eligibleReports) {
                const exists = existingSet.has(report.unique_name);
                if (exists) {
                    updated++;
                } else {
                    created++;
                    existingSet.add(report.unique_name);
                }

                await (txLike as any).report.upsert({
                    where: {
                        account_id_unique_name: {
                            account_id: targetAccountId,
                            unique_name: report.unique_name,
                        },
                    },
                    create: {
                        account_id: targetAccountId,
                        name: report.name,
                        unique_name: report.unique_name,
                        description: report.description,
                        report_config: report.report_config as any,
                        is_public: report.is_public,
                        is_system: true,
                        is_default: report.is_default,
                        context: report.context,
                        created_by: userId || report.created_by,
                        modified_by: userId || report.modified_by,
                    },
                    update: {
                        name: report.name,
                        description: report.description,
                        report_config: report.report_config as any,
                        is_public: report.is_public,
                        is_system: true,
                        is_default: report.is_default,
                        context: report.context,
                        modified_at: new Date(),
                        modified_by: userId || null,
                    },
                    select: { id: true },
                });
            }
        };

        if (dbClient === prisma) {
            await prisma.$transaction(async (tx) => {
                await runUpserts(tx as DbClient);
            });
        } else {
            await runUpserts(dbClient);
        }

        await this.logService.logMessage(
            LogLevel.INFO,
            `Synced ${eligibleReports.length} system reports to account ${targetAccountId} (created: ${created}, updated: ${updated})`,
            "ReportService",
            undefined,
            targetAccountId,
            userId
        );

        return { created, updated, syncedReports: eligibleReports.length };
    }
}
