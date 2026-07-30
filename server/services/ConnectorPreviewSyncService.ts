import type { ImportType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
    discoverPriorityFields,
    fetchPriorityEntitySamples,
    type PriorityConnectionConfig,
} from "@/server/integrations/priority/PriorityClient";
import { isPriorityEntityImportType } from "@/server/integrations/priority/priorityApiContract";
import type { PriorityEntityImportType } from "@/server/integrations/priority/fixtures/samplePayloads";
import {
    buildPaymentsByInvoiceLinkFilters,
} from "@/server/integrations/priority/priorityDatedBackfillFilters";
import {
    DEFAULT_ACCOUNT_TIMEZONE,
    buildBackfillEntityPullPhases,
    buildCutoverOptionsSnapshot,
    extractInvoiceCustomerLinks,
    formatCutoverOptionsSummary,
    type CutoverOptionsSnapshot,
} from "@/server/services/billingConnectorBackfillBounds";
import { ConnectorFieldMappingService } from "@/server/services/ConnectorFieldMappingService";
import { sortInvoicesForImport } from "@/server/services/import/sortInvoicesForImport";
import { decryptCredentials } from "@/server/utils/billingConnectorCrypto";
import {
    mapErpRecord,
    parseMappingRules,
    validateMappedRow,
} from "@/server/utils/connectorFieldUtils";
import { getImportEntityFieldCatalog } from "@/shared/constants/importEntityFields";

const PREVIEW_SAMPLE_TOP = 10;

export interface PreviewEntityResult {
    import_type: ImportType;
    pulled: number;
    sample_rows: Record<string, unknown>[];
    validation_errors: string[];
    sorted_preview: boolean;
    /** Pull phase ids applied (mirrors backfill cutover plan). */
    pull_phases: string[];
}

export interface PreviewSyncResult {
    mode: "preview";
    started_at: string;
    completed_at: string;
    cutover: CutoverOptionsSnapshot;
    cutover_summary: string | null;
    entities: PreviewEntityResult[];
    go_no_go: {
        required_field_errors: number;
        passed: boolean;
        checks: Array<{ id: string; label: string; passed: boolean; detail: string }>;
    };
}

function recordIdentityKey(
    importType: ImportType,
    record: Record<string, unknown>
): string {
    if (importType === "Invoice") {
        return `inv:${String(record.IVNUM ?? "")}\0${String(record.CUSTNAME ?? "")}`;
    }
    if (importType === "Payment") {
        return `pay:${String(record.PAYNUM ?? "")}\0${String(record.CUSTNAME ?? "")}`;
    }
    if (importType === "Customer") {
        return `cust:${String(record.CUSTNAME ?? "")}`;
    }
    if (importType === "Contact") {
        return `contact:${String(record.CUSTNAME ?? "")}\0${String(record.NAME ?? "")}`;
    }
    return JSON.stringify(record);
}

function mergeUniqueRecords(
    importType: ImportType,
    batches: Record<string, unknown>[][]
): Record<string, unknown>[] {
    const seen = new Set<string>();
    const merged: Record<string, unknown>[] = [];
    for (const batch of batches) {
        for (const record of batch) {
            const key = recordIdentityKey(importType, record);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            merged.push(record);
        }
    }
    return merged;
}

export class ConnectorPreviewSyncService {
    private static instance: ConnectorPreviewSyncService;

    public static getInstance(): ConnectorPreviewSyncService {
        if (!ConnectorPreviewSyncService.instance) {
            ConnectorPreviewSyncService.instance =
                new ConnectorPreviewSyncService();
        }
        return ConnectorPreviewSyncService.instance;
    }

    async runPreview(accountId: number): Promise<PreviewSyncResult> {
        const startedAt = new Date();
        const mappingService = ConnectorFieldMappingService.getInstance();
        await mappingService.assertMappingsCompleteForEnabledEntities(accountId);

        const connector = await prisma.billingConnector.findUnique({
            where: { account_id: accountId },
            include: { ConnectorFieldMapping: true },
        });
        if (!connector?.base_url || !connector.credentials_encrypted) {
            throw Object.assign(new Error("Billing connector is not configured"), {
                statusCode: 400,
                code: "CONNECTOR_NOT_CONFIGURED",
            });
        }

        const timeZone = DEFAULT_ACCOUNT_TIMEZONE;

        const cutover = buildCutoverOptionsSnapshot({
            backfillStartDate: connector.backfill_start_date,
            includeOlderOpenInvoices: connector.include_older_open_invoices,
            skipReportingBreachOnBackfill:
                connector.skip_reporting_breach_on_backfill,
        });

        const enabledEntities = (
            Array.isArray(connector.enabled_entities)
                ? connector.enabled_entities
                : []
        ).filter(
            (entity): entity is ImportType & PriorityEntityImportType =>
                typeof entity === "string" && isPriorityEntityImportType(entity as ImportType)
        );

        const config: PriorityConnectionConfig = {
            baseUrl: connector.base_url,
            authType: connector.auth_type,
            credentials: decryptCredentials(connector.credentials_encrypted),
        };

        const mappingByType = new Map(
            connector.ConnectorFieldMapping.map((row) => [
                row.import_type,
                parseMappingRules(row.mapping),
            ])
        );

        const entities: PreviewEntityResult[] = [];
        let totalValidationErrors = 0;

        for (const importType of enabledEntities) {
            const rules = mappingByType.get(importType) ?? [];
            const phases = buildBackfillEntityPullPhases({
                entityType: importType,
                syncMode: "BACKFILL",
                backfillStartDate: connector.backfill_start_date,
                includeOlderOpenInvoices:
                    connector.include_older_open_invoices ?? true,
                timeZone,
            });

            const { records, phaseIds } = await this.pullPreviewRecords({
                config,
                importType,
                phases,
                backfillStartDate: connector.backfill_start_date,
                timeZone,
            });

            let mappedRows = records.map((record) => mapErpRecord(record, rules));

            let sortedPreview = false;
            if (importType === "Invoice") {
                mappedRows = sortInvoicesForImport(
                    mappedRows.map((row) => ({
                        customer_number: String(row.customer_number ?? ""),
                        invoice_number: String(row.invoice_number ?? ""),
                        invoice_date: String(row.invoice_date ?? ""),
                        ...row,
                    }))
                );
                sortedPreview = true;
            }

            const validationErrors: string[] = [];
            mappedRows.forEach((row, index) => {
                const rowErrors = validateMappedRow(importType, row, index);
                validationErrors.push(...rowErrors);
            });
            totalValidationErrors += validationErrors.length;

            entities.push({
                import_type: importType,
                pulled: records.length,
                sample_rows: mappedRows.slice(0, 5),
                validation_errors: validationErrors,
                sorted_preview: sortedPreview,
                pull_phases: phaseIds,
            });
        }

        const completedAt = new Date();
        const checks = this.buildGoNoGoChecks(
            entities,
            totalValidationErrors,
            cutover
        );

        return {
            mode: "preview",
            started_at: startedAt.toISOString(),
            completed_at: completedAt.toISOString(),
            cutover,
            cutover_summary: formatCutoverOptionsSummary(cutover),
            entities,
            go_no_go: {
                required_field_errors: totalValidationErrors,
                passed: checks.every((check) => check.passed),
                checks,
            },
        };
    }

    async discoverFields(accountId: number, importType: ImportType) {
        if (!isPriorityEntityImportType(importType)) {
            throw Object.assign(new Error("Unsupported import type"), {
                statusCode: 400,
                code: "INVALID_IMPORT_TYPE",
            });
        }

        const mappingService = ConnectorFieldMappingService.getInstance();
        const connector = await mappingService.getConnectorOrThrow(accountId);

        const config: PriorityConnectionConfig = {
            baseUrl: connector.base_url!,
            authType: connector.auth_type,
            credentials: decryptCredentials(connector.credentials_encrypted!),
        };

        const discovered = await discoverPriorityFields(config, importType, 5);
        if (!discovered.ok) {
            throw Object.assign(
                new Error(discovered.error ?? "Failed to discover fields"),
                {
                    statusCode: discovered.statusCode === 401 ? 400 : 502,
                    code:
                        discovered.statusCode === 401
                            ? "PRIORITY_AUTH_FAILED"
                            : "PRIORITY_FETCH_FAILED",
                }
            );
        }

        const catalog = getImportEntityFieldCatalog(importType);
        return {
            import_type: importType,
            raw_headers: discovered.rawHeaders,
            example_values: discovered.exampleValues,
            sample_count: discovered.sampleCount,
            archaser_fields: catalog?.fields ?? [],
            required_fields: catalog?.requiredFields ?? [],
            highlighted_fields: catalog?.highlightedFields ?? [],
        };
    }

    private async pullPreviewRecords(params: {
        config: PriorityConnectionConfig;
        importType: PriorityEntityImportType;
        phases: ReturnType<typeof buildBackfillEntityPullPhases>;
        backfillStartDate: Date | null;
        timeZone: string;
    }): Promise<{ records: Record<string, unknown>[]; phaseIds: string[] }> {
        const batches: Record<string, unknown>[][] = [];
        const phaseIds: string[] = [];

        for (const phase of params.phases) {
            phaseIds.push(phase.id);

            if (phase.filter === "dynamic_related") {
                const olderOpenFilter = buildBackfillEntityPullPhases({
                    entityType: "Invoice",
                    syncMode: "BACKFILL",
                    backfillStartDate: params.backfillStartDate,
                    includeOlderOpenInvoices: true,
                    timeZone: params.timeZone,
                }).find((p) => p.id === "older_open")?.filter;

                if (typeof olderOpenFilter !== "string") {
                    continue;
                }

                const olderOpenResult = await fetchPriorityEntitySamples(
                    params.config,
                    "Invoice",
                    PREVIEW_SAMPLE_TOP,
                    { filter: olderOpenFilter }
                );
                this.assertFetchOk(olderOpenResult);

                const linkFilters = buildPaymentsByInvoiceLinkFilters(
                    extractInvoiceCustomerLinks(olderOpenResult.records)
                );
                for (const filter of linkFilters.slice(0, 3)) {
                    const related = await fetchPriorityEntitySamples(
                        params.config,
                        params.importType,
                        PREVIEW_SAMPLE_TOP,
                        { filter }
                    );
                    this.assertFetchOk(related);
                    batches.push(related.records);
                }
                continue;
            }

            const filter =
                typeof phase.filter === "string" ? phase.filter : null;
            const fetchResult = await fetchPriorityEntitySamples(
                params.config,
                params.importType,
                PREVIEW_SAMPLE_TOP,
                { filter }
            );
            this.assertFetchOk(fetchResult);
            batches.push(fetchResult.records);
        }

        return {
            records: mergeUniqueRecords(params.importType, batches),
            phaseIds,
        };
    }

    private assertFetchOk(fetchResult: {
        ok: boolean;
        error?: string;
        statusCode?: number;
        records: Record<string, unknown>[];
    }): asserts fetchResult is {
        ok: true;
        records: Record<string, unknown>[];
        statusCode?: number;
    } {
        if (!fetchResult.ok) {
            throw Object.assign(
                new Error(fetchResult.error ?? "Failed to pull preview data"),
                {
                    statusCode: fetchResult.statusCode === 401 ? 400 : 502,
                    code:
                        fetchResult.statusCode === 401
                            ? "PRIORITY_AUTH_FAILED"
                            : "PRIORITY_FETCH_FAILED",
                }
            );
        }
    }

    private buildGoNoGoChecks(
        entities: PreviewEntityResult[],
        totalValidationErrors: number,
        cutover: CutoverOptionsSnapshot
    ) {
        const cutoverSummary =
            formatCutoverOptionsSummary(cutover) ?? "full history";

        const checks = [
            {
                id: "required_fields",
                label: "0 validation errors for required fields",
                passed: totalValidationErrors === 0,
                detail:
                    totalValidationErrors === 0
                        ? "All required fields mapped and populated in preview samples."
                        : `${totalValidationErrors} required-field validation error(s) found.`,
            },
            {
                id: "sample_rows",
                label: "Preview returned sample rows for each enabled entity",
                passed: entities.every((entity) => entity.sample_rows.length > 0),
                detail: entities
                    .map(
                        (entity) =>
                            `${entity.import_type}: ${entity.sample_rows.length} sample row(s) [${entity.pull_phases.join(", ")}]`
                    )
                    .join("; "),
            },
            {
                id: "invoice_sort",
                label: "Invoices sorted by invoice_date asc, invoice_number asc per customer",
                passed: entities
                    .filter((entity) => entity.import_type === "Invoice")
                    .every((entity) => entity.sorted_preview),
                detail:
                    "Invoice preview applies sortInvoicesForImport before validation.",
            },
            {
                id: "cutover_window",
                label: "Preview samples use the same cutover window as backfill",
                passed: true,
                detail: cutover.backfill_start_date
                    ? `Applied cutover filters (${cutoverSummary}). Customers/contacts remain full history.`
                    : `No start date — full-history preview (${cutoverSummary}).`,
            },
        ];

        return checks;
    }
}

export const connectorPreviewSyncService =
    ConnectorPreviewSyncService.getInstance();
