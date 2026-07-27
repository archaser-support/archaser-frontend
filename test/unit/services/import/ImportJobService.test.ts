import { ImportType, ImportStatus, ImportRecordStatus } from "@prisma/client";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ImportJobService } from "@/server/services/ImportJobService";
import { createPrismaMock } from "@/test/mocks/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

// Mock uuid
vi.mock("uuid", () => ({
    v4: vi.fn(() => "test-uuid-123"),
}));

describe("ImportJobService", () => {
    let mockPrisma: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { prisma } = await import("@/lib/prisma");
        mockPrisma = prisma;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("createImportJob", () => {
        it("should create a new import job successfully", async () => {
            const jobData = {
                account_id: 1,
                user_id: "user-123",
                import_type: ImportType.Invoice,
                total_records: 100,
                metadata: { field_mapping: { name: "Name" } },
            };

            const mockCreatedJob = {
                id: "test-uuid-123",
                account_id: 1,
                user_id: "user-123",
                import_type: ImportType.Invoice,
                status: ImportStatus.Pending,
                total_records: 100,
                metadata: { field_mapping: { name: "Name" } },
                created_at: new Date(),
                modified_at: new Date(),
            };

            mockPrisma.importJob.create.mockResolvedValue(mockCreatedJob);

            const result = await ImportJobService.createImportJob(jobData);

            expect(mockPrisma.importJob.create).toHaveBeenCalledWith({
                data: {
                    id: "test-uuid-123",
                    account_id: 1,
                    user_id: "user-123",
                    import_type: ImportType.Invoice,
                    status: ImportStatus.Pending,
                    total_records: 100,
                    metadata: { field_mapping: { name: "Name" } },
                },
            });

            expect(result).toEqual(mockCreatedJob);
        });

        it("should create job with default metadata when not provided", async () => {
            const jobData = {
                account_id: 1,
                import_type: ImportType.Invoice,
                total_records: 50,
            };

            const mockCreatedJob = {
                id: "test-uuid-123",
                account_id: 1,
                import_type: ImportType.Invoice,
                status: ImportStatus.Pending,
                total_records: 50,
                metadata: {},
            };

            mockPrisma.importJob.create.mockResolvedValue(mockCreatedJob);

            const result = await ImportJobService.createImportJob(jobData);

            expect(mockPrisma.importJob.create).toHaveBeenCalledWith({
                data: {
                    id: "test-uuid-123",
                    account_id: 1,
                    user_id: undefined,
                    import_type: ImportType.Invoice,
                    status: ImportStatus.Pending,
                    total_records: 50,
                    metadata: {},
                },
            });

            expect(result).toEqual(mockCreatedJob);
        });
    });

    describe("createImportRecords", () => {
        it("should create multiple import records successfully", async () => {
            const records = [
                {
                    import_job_id: "job-123",
                    row_index: 0,
                    original_data: { invoice_number: "INV001", amount: 1000 },
                },
                {
                    import_job_id: "job-123",
                    row_index: 1,
                    original_data: { invoice_number: "INV002", amount: 2000 },
                },
            ];

            const mockCreatedRecords = { count: 2 };
            mockPrisma.importRecord.createMany.mockResolvedValue(
                mockCreatedRecords
            );

            const result = await ImportJobService.createImportRecords(records);

            expect(mockPrisma.importRecord.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        id: "test-uuid-123",
                        import_job_id: "job-123",
                        row_index: 0,
                        status: ImportRecordStatus.Pending,
                        original_data: {
                            invoice_number: "INV001",
                            amount: 1000,
                        },
                        processed_data: undefined,
                        validation_errors: undefined,
                        processing_errors: undefined,
                        result_message: undefined,
                        entity_id: undefined,
                        created_by: null,
                        modified_by: null,
                    },
                    {
                        id: "test-uuid-123",
                        import_job_id: "job-123",
                        row_index: 1,
                        status: ImportRecordStatus.Pending,
                        original_data: {
                            invoice_number: "INV002",
                            amount: 2000,
                        },
                        processed_data: undefined,
                        validation_errors: undefined,
                        processing_errors: undefined,
                        result_message: undefined,
                        entity_id: undefined,
                        created_by: null,
                        modified_by: null,
                    },
                ],
            });

            expect(result).toEqual(mockCreatedRecords);
        });

        it("should handle records with all optional fields", async () => {
            const records = [
                {
                    import_job_id: "job-123",
                    row_index: 0,
                    original_data: { invoice_number: "INV001" },
                    processed_data: { normalized: true },
                    validation_errors: { errors: ["Invalid amount"] },
                    processing_errors: { errors: ["Database error"] },
                    result_message: "Failed validation",
                    entity_id: 123,
                },
            ];

            mockPrisma.importRecord.createMany.mockResolvedValue({ count: 1 });

            await ImportJobService.createImportRecords(records);

            expect(mockPrisma.importRecord.createMany).toHaveBeenCalledWith({
                data: [
                    {
                        id: "test-uuid-123",
                        import_job_id: "job-123",
                        row_index: 0,
                        status: ImportRecordStatus.Pending,
                        original_data: { invoice_number: "INV001" },
                        processed_data: { normalized: true },
                        validation_errors: { errors: ["Invalid amount"] },
                        processing_errors: { errors: ["Database error"] },
                        result_message: "Failed validation",
                        entity_id: 123,
                        created_by: null,
                        modified_by: null,
                    },
                ],
            });
        });
    });

    describe("getImportJobWithRecords", () => {
        it("should retrieve import job with records", async () => {
            const jobId = "job-123";
            const mockJobWithRecords = {
                id: "job-123",
                account_id: 1,
                import_type: ImportType.Invoice,
                status: ImportStatus.Processing,
                total_records: 100,
                ImportRecord: [
                    {
                        id: "record-1",
                        row_index: 0,
                        status: ImportRecordStatus.Success,
                    },
                    {
                        id: "record-2",
                        row_index: 1,
                        status: ImportRecordStatus.Failed,
                    },
                ],
            };

            mockPrisma.importJob.findUnique.mockResolvedValue(
                mockJobWithRecords
            );

            const result =
                await ImportJobService.getImportJobWithRecords(jobId);

            expect(mockPrisma.importJob.findUnique).toHaveBeenCalledWith({
                where: { id: jobId },
                include: {
                    ImportRecord: {
                        orderBy: { row_index: "asc" },
                    },
                },
            });

            expect(result).toEqual(mockJobWithRecords);
        });

        it("should return null when job not found", async () => {
            const jobId = "non-existent-job";
            mockPrisma.importJob.findUnique.mockResolvedValue(null);

            const result =
                await ImportJobService.getImportJobWithRecords(jobId);

            expect(result).toBeNull();
        });
    });

    describe("updateImportJobStatus", () => {
        it("should update import job status successfully", async () => {
            const jobId = "job-123";
            const status = ImportStatus.Completed;
            const updates = {
                processed_records: 100,
                successful_records: 95,
                failed_records: 5,
                completed_at: new Date("2024-01-01"),
            };

            const mockUpdatedJob = {
                id: "job-123",
                status: ImportStatus.Completed,
                processed_records: 100,
                successful_records: 95,
                failed_records: 5,
                completed_at: new Date("2024-01-01"),
                modified_at: new Date(),
            };

            mockPrisma.importJob.update.mockResolvedValue(mockUpdatedJob);

            const result = await ImportJobService.updateImportJobStatus(
                jobId,
                status,
                updates
            );

            expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
                where: { id: jobId },
                data: {
                    status: ImportStatus.Completed,
                    processed_records: 100,
                    successful_records: 95,
                    failed_records: 5,
                    completed_at: new Date("2024-01-01"),
                    modified_at: expect.any(Date),
                    modified_by: undefined,
                },
            });

            expect(result).toEqual(mockUpdatedJob);
        });

        it("should update status with minimal updates", async () => {
            const jobId = "job-123";
            const status = ImportStatus.Processing;

            const mockUpdatedJob = {
                id: "job-123",
                status: ImportStatus.Processing,
                modified_at: new Date(),
            };

            mockPrisma.importJob.update.mockResolvedValue(mockUpdatedJob);

            const result = await ImportJobService.updateImportJobStatus(
                jobId,
                status
            );

            expect(mockPrisma.importJob.update).toHaveBeenCalledWith({
                where: { id: jobId },
                data: {
                    status: ImportStatus.Processing,
                    modified_at: expect.any(Date),
                    modified_by: undefined,
                },
            });

            expect(result).toEqual(mockUpdatedJob);
        });
    });

    describe("updateImportRecord", () => {
        it("should update import record successfully", async () => {
            const recordId = "record-123";
            const updates = {
                status: ImportRecordStatus.Success,
                processed_data: { normalized: true },
                result_message: "Successfully imported",
                entity_id: 456,
            };

            const mockUpdatedRecord = {
                id: "record-123",
                status: ImportRecordStatus.Success,
                processed_data: { normalized: true },
                result_message: "Successfully imported",
                entity_id: 456,
                modified_at: new Date(),
            };

            mockPrisma.importRecord.update.mockResolvedValue(mockUpdatedRecord);

            const result = await ImportJobService.updateImportRecord(
                recordId,
                updates
            );

            expect(mockPrisma.importRecord.update).toHaveBeenCalledWith({
                where: { id: recordId },
                data: {
                    status: ImportRecordStatus.Success,
                    processed_data: { normalized: true },
                    result_message: "Successfully imported",
                    entity_id: 456,
                    modified_at: expect.any(Date),
                    modified_by: undefined,
                },
            });

            expect(result).toEqual(mockUpdatedRecord);
        });

        it("should handle partial updates", async () => {
            const recordId = "record-123";
            const updates = {
                status: ImportRecordStatus.Failed,
                validation_errors: { errors: ["Invalid data"] },
            };

            const mockUpdatedRecord = {
                id: "record-123",
                status: ImportRecordStatus.Failed,
                validation_errors: { errors: ["Invalid data"] },
                modified_at: new Date(),
            };

            mockPrisma.importRecord.update.mockResolvedValue(mockUpdatedRecord);

            const result = await ImportJobService.updateImportRecord(
                recordId,
                updates
            );

            expect(mockPrisma.importRecord.update).toHaveBeenCalledWith({
                where: { id: recordId },
                data: {
                    status: ImportRecordStatus.Failed,
                    validation_errors: { errors: ["Invalid data"] },
                    modified_at: expect.any(Date),
                    modified_by: undefined,
                },
            });

            expect(result).toEqual(mockUpdatedRecord);
        });
    });

    describe("getImportRecordsByJobId", () => {
        it("should retrieve import records for a job", async () => {
            const jobId = "job-123";
            const mockRecords = [
                {
                    id: "record-1",
                    row_index: 0,
                    status: ImportRecordStatus.Success,
                },
                {
                    id: "record-2",
                    row_index: 1,
                    status: ImportRecordStatus.Failed,
                },
                {
                    id: "record-3",
                    row_index: 2,
                    status: ImportRecordStatus.Pending,
                },
            ];

            mockPrisma.importRecord.findMany.mockResolvedValue(mockRecords);

            const result =
                await ImportJobService.getImportRecordsByJobId(jobId);

            expect(mockPrisma.importRecord.findMany).toHaveBeenCalledWith({
                where: { import_job_id: jobId },
                orderBy: { row_index: "asc" },
            });

            expect(result).toEqual(mockRecords);
        });

        it("should return empty array when no records found", async () => {
            const jobId = "job-123";
            mockPrisma.importRecord.findMany.mockResolvedValue([]);

            const result =
                await ImportJobService.getImportRecordsByJobId(jobId);

            expect(result).toEqual([]);
        });
    });

    describe("getImportJobStats", () => {
        it("should calculate job statistics correctly", async () => {
            const jobId = "job-123";
            const mockJob = {
                id: "job-123",
                total_records: 100,
                status: ImportStatus.Completed,
                ImportRecord: [
                    { status: ImportRecordStatus.Success },
                    { status: ImportRecordStatus.Success },
                    { status: ImportRecordStatus.Validated },
                    { status: ImportRecordStatus.Failed },
                    { status: ImportRecordStatus.Pending },
                ],
            };

            mockPrisma.importJob.findUnique.mockResolvedValue(mockJob);

            const result = await ImportJobService.getImportJobStats(jobId);

            expect(mockPrisma.importJob.findUnique).toHaveBeenCalledWith({
                where: { id: jobId },
                include: {
                    ImportRecord: true,
                },
            });

            expect(result).toEqual({
                total: 100,
                processed: 5,
                successful: 3, // 2 Success + 1 Validated
                failed: 1,
                pending: 1,
                status: ImportStatus.Completed,
            });
        });

        it("should throw error when job not found", async () => {
            const jobId = "non-existent-job";
            mockPrisma.importJob.findUnique.mockResolvedValue(null);

            await expect(
                ImportJobService.getImportJobStats(jobId)
            ).rejects.toThrow("Import job not found");
        });

        it("should handle job with no records", async () => {
            const jobId = "job-123";
            const mockJob = {
                id: "job-123",
                total_records: 100,
                status: ImportStatus.Pending,
                ImportRecord: [],
            };

            mockPrisma.importJob.findUnique.mockResolvedValue(mockJob);

            const result = await ImportJobService.getImportJobStats(jobId);

            expect(result).toEqual({
                total: 100,
                processed: 0,
                successful: 0,
                failed: 0,
                pending: 0,
                status: ImportStatus.Pending,
            });
        });
    });

    describe("deleteImportJob", () => {
        it("should delete import job and all its records", async () => {
            const jobId = "job-123";

            mockPrisma.importRecord.deleteMany.mockResolvedValue({ count: 5 });
            mockPrisma.importJob.delete.mockResolvedValue({ id: "job-123" });

            await ImportJobService.deleteImportJob(jobId);

            expect(mockPrisma.importRecord.deleteMany).toHaveBeenCalledWith({
                where: { import_job_id: jobId },
            });

            expect(mockPrisma.importJob.delete).toHaveBeenCalledWith({
                where: { id: jobId },
            });
        });

        it("should handle deletion when no records exist", async () => {
            const jobId = "job-123";

            mockPrisma.importRecord.deleteMany.mockResolvedValue({ count: 0 });
            mockPrisma.importJob.delete.mockResolvedValue({ id: "job-123" });

            await ImportJobService.deleteImportJob(jobId);

            expect(mockPrisma.importRecord.deleteMany).toHaveBeenCalled();
            expect(mockPrisma.importJob.delete).toHaveBeenCalled();
        });
    });
});
