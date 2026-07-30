import { ImportRecordStatus, ImportType, ImportStatus } from "@prisma/client";
import Joi from "joi";
import { NextApiRequest, NextApiResponse } from "next";
import { prismaJobs } from "@/lib/prisma";
import { getSessionOrTestAuth } from "@/utils/testAuthHelper";
import { AccessControlService } from "@/server/services/AccessControlService";
import { BusinessUnitService } from "@/server/services/BusinessUnitService";
import { ImportJobService } from "@/server/services/ImportJobService";
import {
    ImportService,
    InvoicePaymentInput,
} from "@/server/services/ImportService";
import { ImportPaymentService } from "@/server/services/import/ImportPaymentService";
import { PermissionService } from "@/server/services/PermissionService";

const prisma = prismaJobs();

const schema = Joi.array().items(
    Joi.object({
        account_id: Joi.number().required().messages({
            "any.required": "import.validation.accountIdRequired",
            "number.base": "import.validation.accountIdMustBeNumber",
        }),
        customer_number: Joi.string().required().messages({
            "any.required": "import.validation.customerNumberRequired",
            "string.base": "import.validation.customerNumberMustBeString",
        }),
        invoice_number: Joi.string().required().messages({
            "any.required": "import.validation.invoiceNumberRequired",
            "string.base": "import.validation.invoiceNumberMustBeString",
        }),
        payment_date: Joi.date().iso().required().messages({
            "any.required": "import.validation.paymentDateRequired",
            "date.base": "import.validation.paymentDateMustBeValid",
            "date.format": "import.validation.paymentDateMustBeISO",
        }),
        amount: Joi.number().optional().messages({
            "number.base": "import.validation.amountMustBeNumber",
        }),
        customer_amount: Joi.number()
            .required()
            .invalid(0)
            .messages({
                "any.required": "import.validation.customerAmountRequired",
                "number.base": "import.validation.customerAmountMustBeNumber",
                "any.invalid": "import.validation.paymentCustomerAmountZero",
            }),
        payment_method: Joi.string().optional().allow(null, "").messages({
            "string.base": "import.validation.paymentMethodMustBeString",
        }),
        customer_currency: Joi.string().required().messages({
            "any.required": "import.validation.customerCurrencyRequired",
            "string.base": "import.validation.customerCurrencyMustBeString",
        }),
        reference: Joi.string().allow(null, "").messages({
            "string.base": "import.validation.referenceMustBeString",
        }),
        company_code: Joi.string().optional(),
    })
);

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { payments, jobId, batchIndex, globalStartIndex } = req.body;
        const { user } = await getSessionOrTestAuth(req, res);
        const account_id = user?.account_id;
        const user_id = user?.id;

        if (!account_id) {
            return res
                .status(400)
                .json({ message: "Customer not found", results: [] });
        }

        if (!Array.isArray(payments)) {
            return res
                .status(400)
                .json({ message: "Invalid input format", results: [] });
        }

        let importJob: any;
        let isNewJob = false;

        // Check if we're using an existing job (batch processing) or need to create a new one
        if (jobId) {
            // Use existing job for batch processing
            importJob = await ImportJobService.getImportJobWithRecords(jobId);
            if (!importJob) {
                return res
                    .status(404)
                    .json({ message: "Import job not found", results: [] });
            }
        } else {
            // Create new job (legacy approach)
            isNewJob = true;
            importJob = await ImportJobService.createImportJob(
                {
                    account_id,
                    user_id,
                    import_type: ImportType.Payment,
                    total_records: payments.length,
                    metadata: {
                        field_mapping: req.body.fieldMapping || {},
                        field_labels: req.body.fieldLabels || {},
                    },
                },
                user_id
            );

            // Create import records
            const importRecords = payments.map((payment, index) => ({
                import_job_id: importJob.id,
                row_index: index,
                original_data: payment,
            }));

            await ImportJobService.createImportRecords(importRecords, user_id);

            // Update job status to processing
            await ImportJobService.updateImportJobStatus(
                importJob.id,
                ImportStatus.Processing,
                {
                    started_at: new Date(),
                },
                user_id
            );
        }

        // For batch processing, create import records for this batch
        if (
            jobId &&
            typeof batchIndex === "number" &&
            typeof globalStartIndex === "number"
        ) {
            const importRecords = payments.map((payment, index) => ({
                import_job_id: importJob.id,
                row_index: globalStartIndex + index, // Use global index for proper ordering
                original_data: payment,
            }));

            await ImportJobService.createImportRecords(importRecords, user_id);
        }

        let paymentRecords: InvoicePaymentInput[] = payments;

        // Add account_id to each payment
        paymentRecords = paymentRecords.map((payment) => ({
            ...payment,
            account_id,
        }));

        // Get user's business unit and admin status for access control
        const dbUser = await prisma.user.findUnique({
            where: { id: user_id },
            select: {
                business_unit_id: true,
                role: true,
            },
        });

        // Check if user has import_payment permission
        const accessControl = AccessControlService.getInstance();
        const userInfo = await accessControl.getUserInfo(req);
        const effectiveAccountId =
            userInfo.viewAsUserAccountId || userInfo.accountId;
        const effectiveRole = userInfo.viewAsUserRole || userInfo.role;

        const permissionService = PermissionService.getInstance();
        const hasImportPaymentPermission =
            await permissionService.hasPermission(
                effectiveAccountId,
                effectiveRole,
                "import_payment"
            );

        const isAdmin = account_id === 10013;

        if (!isAdmin && !hasImportPaymentPermission) {
            return res.status(403).json({
                error: "You do not have permission to import payments",
            });
        }
        const userBuId = dbUser?.business_unit_id || null;

        // Validate input
        paymentRecords = paymentRecords.map(
            ImportService.normalizePaymentInput
        );

        // Validate business unit access for payments
        // IMPORTANT: We only check the customer's business unit access, NOT the parent customer's business unit.
        // This allows importing payments for customers even if they have a parent customer the user doesn't have access to,
        // as long as the user has access to the customer itself.
        const businessUnitAccessErrors: {
            index: number;
            customerNumber: string;
            businessUnitId: number | null;
        }[] = [];
        const customerNumbers = Array.from(
            new Set(paymentRecords.map((p) => p.customer_number))
        );

        // Fetch customers with their business units (only customer's business_unit_id, not parent's)
        const customers = await prisma.customer.findMany({
            where: {
                customer_number: { in: customerNumbers },
                account_id: account_id,
            },
            select: {
                customer_number: true,
                business_unit_id: true, // Only customer's business unit, not parent's
            },
        });

        const customerBusinessUnitMap = new Map<string, number | null>();
        customers.forEach((customer) => {
            customerBusinessUnitMap.set(
                customer.customer_number as string,
                customer.business_unit_id
            ); // Only customer's business unit
        });

        // Get accessible business unit IDs once
        const accessibleBuIds =
            await BusinessUnitService.getAccessibleBusinessUnitIds(
                userBuId,
                isAdmin
            );

        // Check business unit access for each payment (only customer's business unit, not parent's)
        for (let i = 0; i < paymentRecords.length; i++) {
            const payment = paymentRecords[i];
            const customerBuId = customerBusinessUnitMap.get(
                payment.customer_number
            );

            if (customerBuId !== null && customerBuId !== undefined) {
                // null means admin (can access all)
                if (
                    accessibleBuIds !== null &&
                    !accessibleBuIds.includes(customerBuId)
                ) {
                    businessUnitAccessErrors.push({
                        index: i,
                        customerNumber: payment.customer_number,
                        businessUnitId: customerBuId,
                    });
                }
            }
        }

        // Fetch business unit external IDs for error messages
        const businessUnitIds = Array.from(
            new Set(
                businessUnitAccessErrors
                    .map((e) => e.businessUnitId)
                    .filter((id): id is number => id !== null)
            )
        );
        const businessUnits =
            businessUnitIds.length > 0
                ? await prisma.businessUnit.findMany({
                      where: { id: { in: businessUnitIds } },
                      select: { id: true, external_id: true },
                  })
                : [];
        const businessUnitExternalIdMap = new Map<number, string>();
        businessUnits.forEach((bu) => {
            businessUnitExternalIdMap.set(
                bu.id,
                bu.external_id || `BU-${bu.id}`
            );
        });

        const { error } = schema.validate(paymentRecords, {
            abortEarly: false,
        });

        let validationResults: any[] = [];

        if (error || businessUnitAccessErrors.length > 0) {
            // Update import records with validation errors
            validationResults = paymentRecords.map((payment, index) => {
                const recordErrors =
                    error?.details.filter(
                        (detail) => detail.path[0] === index
                    ) || [];

                // Check for business unit access errors
                const buAccessError = businessUnitAccessErrors.find(
                    (e) => e.index === index
                );

                if (recordErrors.length > 0 || buAccessError) {
                    const messages: string[] = recordErrors.map(
                        (e) => e.message
                    );

                    if (
                        buAccessError &&
                        buAccessError.businessUnitId !== null
                    ) {
                        const externalId =
                            businessUnitExternalIdMap.get(
                                buAccessError.businessUnitId
                            ) || `BU-${buAccessError.businessUnitId}`;
                        messages.push(
                            `import.validation.businessUnitAccessDenied:${externalId}`
                        );
                    }

                    const result = {
                        index: index,
                        success: false,
                        message: messages.join(", "),
                        originalInvoiceNumber: payment.invoice_number,
                    };
                    return result;
                } else {
                    const result = {
                        index: index,
                        success: true,
                        message: "import.results.importedSuccessfully",
                        originalInvoiceNumber: payment.invoice_number,
                    };
                    return result;
                }
            });

            // Update import records with validation results
            if (validationResults.length > 0) {
                const records = await ImportJobService.getImportRecordsByJobId(
                    importJob.id
                );

                // For batch processing, only update records that belong to the current batch
                const currentBatchRecords = records.filter(
                    (record) =>
                        record.row_index >= globalStartIndex &&
                        record.row_index < globalStartIndex + payments.length
                );

                for (let i = 0; i < currentBatchRecords.length; i++) {
                    const result = validationResults[i];
                    if (result) {
                        await ImportJobService.updateImportRecord(
                            currentBatchRecords[i].id,
                            {
                                status: result.success
                                    ? ImportRecordStatus.Validated
                                    : ImportRecordStatus.Failed,
                                validation_errors: result.success
                                    ? null
                                    : { errors: result.message },
                                result_message: result.message,
                            },
                            user_id
                        );
                    }
                }
            }
        }

        const importPaymentService = new ImportPaymentService();
        const results = await importPaymentService.importPayments(
            paymentRecords,
            account_id,
            {
                businessUnitAccessErrors,
                businessUnitExternalIdMap,
            }
        );

        // Update import records with processing results
        const records = await ImportJobService.getImportRecordsByJobId(
            importJob.id
        );

        // For batch processing, only update records that belong to the current batch
        const recordsToUpdate =
            jobId && typeof globalStartIndex === "number"
                ? records.filter(
                      (record) =>
                          record.row_index >= globalStartIndex &&
                          record.row_index < globalStartIndex + payments.length
                  )
                : records;

        for (let i = 0; i < recordsToUpdate.length; i++) {
            const result = results[i];
            if (result) {
                await ImportJobService.updateImportRecord(
                    recordsToUpdate[i].id,
                    {
                        status: result.success
                            ? ImportRecordStatus.Success
                            : ImportRecordStatus.Failed,
                        processed_data: paymentRecords[i],
                        result_message: result.message,
                        entity_id: result.invoicePaymentId,
                    },
                    user_id
                );
            }
        }

        // Only update job status if this is a new job (legacy approach)
        if (isNewJob) {
            const successfulCount = results.filter((r) => r.success).length;
            const failedCount = results.filter((r) => !r.success).length;

            await ImportJobService.updateImportJobStatus(
                importJob.id,
                ImportStatus.Completed,
                {
                    processed_records: payments.length,
                    successful_records: successfulCount,
                    failed_records: failedCount,
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
                    importJob.account_id,
                    {
                        import_type: importJob.import_type,
                        total_records: payments.length,
                        successful_records: successfulCount,
                        failed_records: failedCount,
                        job_id: importJob.id,
                    } as any,
                    {
                        source: "import",
                        importType: importJob.import_type,
                        statistics: {
                            total: payments.length,
                            successful: successfulCount,
                            failed: failedCount,
                        },
                    }
                );
            } catch (auditError) {
                // Log error but don't fail the request
                console.error(
                    "Failed to log payment import completion audit:",
                    auditError
                );
            }

        }

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;
        const affectedCustomerIds = Array.from(
            new Set(
                results
                    .map((result) => result.customerId)
                    .filter(
                        (id): id is number =>
                            typeof id === "number" && Number.isFinite(id)
                    )
            )
        );
        return res.status(200).json({
            jobId: importJob.id,
            results: results,
            affectedCustomerIds,
        });
    } catch (err: any) {
        console.error("[PaymentImport] Error in handler:", err);
        console.error("[PaymentImport] Error stack:", err?.stack);
        return res.status(500).json({
            error: "Server error",
            details: err.message,
        });
    }
}
