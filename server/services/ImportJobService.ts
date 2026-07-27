import { ImportType, ImportStatus, ImportRecordStatus } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "@/lib/prisma";

export interface CreateImportJobData {
    account_id: number;
    user_id?: string;
    import_type: ImportType;
    total_records: number;
    metadata?: any;
}

export interface CreateImportRecordData {
    import_job_id: string;
    row_index: number;
    original_data: any;
    processed_data?: any;
    validation_errors?: any;
    processing_errors?: any;
    result_message?: string;
    entity_id?: number;
}

export class ImportJobService {
    /**
     * Create a new import job
     */
    static async createImportJob(data: CreateImportJobData, userId?: string) {
        const jobId = uuidv4();

        // Use userId from parameter or fallback to data.user_id
        const auditUserId = userId || data.user_id || null;

        const importJob = await prisma.importJob.create({
            data: {
                id: jobId,
                account_id: data.account_id,
                user_id: data.user_id,
                import_type: data.import_type,
                status: ImportStatus.Pending,
                total_records: data.total_records,
                metadata: data.metadata || {},
            },
        });

        return importJob;
    }

    /**
     * Create import records for a job
     */
    static async createImportRecords(records: CreateImportRecordData[], userId?: string) {
        const auditUserId = userId || null;

        const importRecords = await prisma.importRecord.createMany({
            data: records.map((record) => ({
                id: uuidv4(),
                import_job_id: record.import_job_id,
                row_index: record.row_index,
                status: ImportRecordStatus.Pending,
                original_data: record.original_data,
                processed_data: record.processed_data,
                validation_errors: record.validation_errors,
                processing_errors: record.processing_errors,
                result_message: record.result_message,
                entity_id: record.entity_id,
                created_by: auditUserId,
                modified_by: auditUserId,
            })),
        });


        return importRecords;
    }

    /**
     * Get import job with records
     */
    static async getImportJobWithRecords(jobId: string) {
        const importJob = await prisma.importJob.findUnique({
            where: { id: jobId },
            include: {
                ImportRecord: {
                    orderBy: { row_index: "asc" },
                },
            },
        });

        return importJob;
    }

    /**
     * Update import job status
     */
    static async updateImportJobStatus(
        jobId: string,
        status: ImportStatus,
        updates: {
            processed_records?: number;
            successful_records?: number;
            failed_records?: number;
            started_at?: Date;
            completed_at?: Date;
            error_message?: string;
        } = {},
        userId?: string
    ) {
        const importJob = await prisma.importJob.update({
            where: { id: jobId },
            data: {
                status,
                ...updates,
                modified_at: new Date(),
            },
        });

        return importJob;
    }

    /**
     * Update import record status
     */
    static async updateImportRecord(
        recordId: string,
        updates: {
            status?: ImportRecordStatus;
            processed_data?: any;
            validation_errors?: any;
            processing_errors?: any;
            result_message?: string;
            entity_id?: number;
        },
        userId?: string
    ) {
        const importRecord = await prisma.importRecord.update({
            where: { id: recordId },
            data: {
                ...updates,
                modified_at: new Date(),
            },
        });

        return importRecord;
    }

    /**
     * Get import records by job ID
     */
    static async getImportRecordsByJobId(jobId: string) {
        const records = await prisma.importRecord.findMany({
            where: { import_job_id: jobId },
            orderBy: { row_index: "asc" },
        });

        return records;
    }

    /**
     * Get import job statistics
     */
    static async getImportJobStats(jobId: string) {
        const job = await prisma.importJob.findUnique({
            where: { id: jobId },
            include: {
                ImportRecord: true,
            },
        });

        if (!job) {
            throw new Error("Import job not found");
        }

        // Calculate statistics from actual records for accuracy
        const successfulRecords = job.ImportRecord.filter(
            (record) =>
                record.status === ImportRecordStatus.Success ||
                record.status === ImportRecordStatus.Validated
        );
        const failedRecords = job.ImportRecord.filter(
            (record) => record.status === ImportRecordStatus.Failed
        );
        const pendingRecords = job.ImportRecord.filter(
            (record) => record.status === ImportRecordStatus.Pending
        );

        return {
            total: job.total_records,
            processed: job.ImportRecord.length,
            successful: successfulRecords.length,
            failed: failedRecords.length,
            pending: pendingRecords.length,
            status: job.status,
        };
    }

    /**
     * Shallow-merge keys into import job metadata (e.g. replay stats on completion).
     */
    static async mergeImportJobMetadata(
        jobId: string,
        metadataPatch: Record<string, unknown>
    ) {
        const existing = await prisma.importJob.findUnique({
            where: { id: jobId },
            select: { metadata: true },
        });

        const current =
            existing?.metadata &&
            typeof existing.metadata === "object" &&
            !Array.isArray(existing.metadata)
                ? (existing.metadata as Record<string, unknown>)
                : {};

        return prisma.importJob.update({
            where: { id: jobId },
            data: {
                metadata: { ...current, ...metadataPatch },
                modified_at: new Date(),
            },
        });
    }

    /**
     * Delete import job and all its records
     */
    static async deleteImportJob(jobId: string) {
        await prisma.importRecord.deleteMany({
            where: { import_job_id: jobId },
        });

        await prisma.importJob.delete({
            where: { id: jobId },
        });
    }
}
