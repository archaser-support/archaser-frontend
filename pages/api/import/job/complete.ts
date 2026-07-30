import {
    ImportStatus,
    ImportRecordStatus,
    ImportType,
} from "@prisma/client";
import { NextApiRequest, NextApiResponse } from "next";
import { getSessionOrTestAuth } from "@/utils/testAuthHelper";
import { ImportJobService } from "@/server/services/ImportJobService";
import { triggerPostImportOverdueMetrics } from "@/server/services/creditInsurance/postImportOverdueMetrics";
import { enqueueRewriteForImport } from "@/server/services/creditInsurance/asOfRewriteQueue";
import { runArPostIngestForCustomers } from "@/server/services/import/arPostIngestForCustomers";
import type { ReplayBatchSummary } from "@/server/services/import/importArReplayService";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { jobId, affectedCustomerIds } = req.body;

        if (!jobId) {
            return res.status(400).json({ message: "Job ID is required" });
        }

        // Get account_id from session for authorization
        const { user } = await getSessionOrTestAuth(req, res);
        const account_id = user?.account_id;
        const user_id = user?.id;

        if (!account_id) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // Get the import job
        const importJob = await ImportJobService.getImportJobWithRecords(jobId);

        if (!importJob) {
            return res.status(404).json({ message: "Import job not found" });
        }

        // Check if user has access to this job
        if (importJob.account_id !== account_id) {
            return res.status(403).json({ error: "Access denied" });
        }

        // Get all import records for this job
        const importRecords =
            await ImportJobService.getImportRecordsByJobId(jobId);

        // Calculate final statistics
        const successfulRecords = importRecords.filter(
            (record) =>
                record.status === ImportRecordStatus.Success ||
                record.status === ImportRecordStatus.Validated
        );
        const failedRecords = importRecords.filter(
            (record) => record.status === ImportRecordStatus.Failed
        );
        const pendingRecords = importRecords.filter(
            (record) => record.status === ImportRecordStatus.Pending
        );
        const validatedRecords = importRecords.filter(
            (record) => record.status === ImportRecordStatus.Validated
        );

        // Update job status to completed
        await ImportJobService.updateImportJobStatus(
            jobId,
            ImportStatus.Completed,
            {
                processed_records: importRecords.length,
                successful_records: successfulRecords.length,
                failed_records: failedRecords.length,
                completed_at: new Date(),
            },
            user_id
        );

        // Log audit trail for import completion
        try {
            const { SettingsAuditLogService } = await import(
                "@/server/services/SettingsAuditLogService"
            );
            const auditLogService = SettingsAuditLogService.getInstance();

            await auditLogService.logCreate(
                "imports",
                importJob.id,
                user_id || "system",
                account_id,
                {
                    import_type: importJob.import_type,
                    total_records: importRecords.length,
                    successful_records: successfulRecords.length,
                    failed_records: failedRecords.length,
                    job_id: importJob.id,
                } as any,
                {
                    source: "import",
                    importType: importJob.import_type,
                    statistics: {
                        total: importRecords.length,
                        successful: successfulRecords.length,
                        failed: failedRecords.length,
                        pending: pendingRecords.length,
                    },
                }
            );
        } catch (auditError) {
            // Log error but don't fail the request
            console.error("Failed to log import completion audit:", auditError);
        }

        const validCustomerIds = Array.isArray(affectedCustomerIds)
            ? (affectedCustomerIds as number[]).filter(
                  (id) => typeof id === "number" && Number.isFinite(id)
              )
            : [];

        let replayStats: ReplayBatchSummary | null = null;

        const isInvoiceOrPayment =
            importJob.import_type === ImportType.Invoice ||
            importJob.import_type === ImportType.Payment;

        // Invoice and payment file import: chronological replay + live refresh
        // for affected customers (no maturity on file import).
        if (isInvoiceOrPayment && validCustomerIds.length > 0) {
            const postIngest = await runArPostIngestForCustomers({
                accountId: account_id,
                customerIds: validCustomerIds,
                runMaturity: false,
                runLiveRefresh: true,
            });
            replayStats = postIngest.replayStats;

            if (replayStats) {
                await ImportJobService.mergeImportJobMetadata(jobId, {
                    replayStats,
                });
            }
        } else if (
            importJob.import_type === ImportType.Customer ||
            importJob.import_type === ImportType.Invoice ||
            importJob.import_type === ImportType.Policy
        ) {
            // Invoice with no affected customers still gets a full-account sweep;
            // Customer/Policy imports keep their existing post-import refresh.
            void triggerPostImportOverdueMetrics(
                validCustomerIds.length > 0 ? validCustomerIds : undefined
            );
        }

        // Enqueue an as-of rewrite window so past CPT/dashboard days that a
        // late-dated invoice or payment belongs to are corrected on the next
        // daily drain (PRD slice 3). fromDate = earliest successful date in job.
        if (isInvoiceOrPayment) {
            const entityIds = successfulRecords
                .map((record) => record.entity_id)
                .filter((id): id is number => typeof id === "number");
            if (entityIds.length > 0) {
                try {
                    await enqueueRewriteForImport({
                        accountId: account_id,
                        importType:
                            importJob.import_type === ImportType.Invoice
                                ? "Invoice"
                                : "Payment",
                        entityIds,
                        customerIds: validCustomerIds,
                    });
                } catch (enqueueError) {
                    console.error(
                        "Failed to enqueue as-of rewrite for import:",
                        enqueueError
                    );
                }
            }
        }

        return res.status(200).json({
            message: "Import job completed successfully",
            jobId,
            statistics: {
                total: importRecords.length,
                successful: successfulRecords.length,
                failed: failedRecords.length,
                pending: pendingRecords.length,
            },
            ...(replayStats && { replayStats }),
        });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
}
