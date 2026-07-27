import type { ImportType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
    discoverPriorityFields,
    fetchPriorityEntitySamples,
    type PriorityConnectionConfig,
} from "@/server/integrations/priority/PriorityClient";
import { isPriorityEntityImportType } from "@/server/integrations/priority/priorityApiContract";
import type { PriorityEntityImportType } from "@/server/integrations/priority/fixtures/samplePayloads";
import { ConnectorFieldMappingService } from "@/server/services/ConnectorFieldMappingService";
import { sortInvoicesForImport } from "@/server/services/import/sortInvoicesForImport";
import { decryptCredentials } from "@/server/utils/billingConnectorCrypto";
import {
    mapErpRecord,
    parseMappingRules,
    validateMappedRow,
} from "@/server/utils/connectorFieldUtils";
import { getImportEntityFieldCatalog } from "@/shared/constants/importEntityFields";

export interface PreviewEntityResult {
    import_type: ImportType;
    pulled: number;
    sample_rows: Record<string, unknown>[];
    validation_errors: string[];
    sorted_preview: boolean;
}

export interface PreviewSyncResult {
    mode: "preview";
    started_at: string;
    completed_at: string;
    entities: PreviewEntityResult[];
    go_no_go: {
        required_field_errors: number;
        passed: boolean;
        checks: Array<{ id: string; label: string; passed: boolean; detail: string }>;
    };
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
            const fetchResult = await fetchPriorityEntitySamples(
                config,
                importType,
                10
            );
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

            let mappedRows = fetchResult.records.map((record) =>
                mapErpRecord(record, rules)
            );

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
                pulled: fetchResult.records.length,
                sample_rows: mappedRows.slice(0, 5),
                validation_errors: validationErrors,
                sorted_preview: sortedPreview,
            });
        }

        const completedAt = new Date();
        const checks = this.buildGoNoGoChecks(entities, totalValidationErrors);

        return {
            mode: "preview",
            started_at: startedAt.toISOString(),
            completed_at: completedAt.toISOString(),
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

    private buildGoNoGoChecks(
        entities: PreviewEntityResult[],
        totalValidationErrors: number
    ) {
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
                            `${entity.import_type}: ${entity.sample_rows.length} sample row(s)`
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
        ];

        return checks;
    }
}

export const connectorPreviewSyncService =
    ConnectorPreviewSyncService.getInstance();
