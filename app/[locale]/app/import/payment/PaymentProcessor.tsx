"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { ImportType } from "@/types/db";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useFileParser } from "@/shared/hooks/useFileParser";
import FieldMapper from "@/shared/layout-components/import/FieldMapper";
import FileUploader from "@/shared/layout-components/import/FileUploader";
import MappedDataGrid from "@/shared/layout-components/import/MappedDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { importMappingService } from "@/shared/services/importMappingService";
import { getImportEntityFieldCatalog } from "@/shared/constants/importEntityFields";

interface PaymentRow {
    [key: string]: string | number | null;
}

interface _ServerResult {
    index: number;
    success: boolean;
    message?: string;
    paymentId?: number;
}

const PaymentProcessor: React.FC = () => {
    const { success, error: showError, showToast } = useToast();
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [mappedData, setMappedData] = useState<PaymentRow[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [importStatus, setImportStatus] = useState<
        "idle" | "loading" | "success" | "partial" | "error"
    >("idle");
    const [importProgress, setImportProgress] = useState(0);
    const [currentRecordCount, setCurrentRecordCount] = useState(0);
    const [jobId, setJobId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const paymentCatalog = useMemo(
        () => getImportEntityFieldCatalog(ImportType.Payment)!,
        []
    );
    const databaseFields = useMemo(
        () => [...paymentCatalog.fields],
        [paymentCatalog]
    );
    const requiredFields = useMemo(
        () => [...paymentCatalog.requiredFields],
        [paymentCatalog]
    );
    const exampleValues = useMemo(
        () => ({ ...paymentCatalog.exampleValues }),
        [paymentCatalog]
    );
    const { parsedData, headers, parseFile, clear, isParsing } =
        useFileParser();
    const { t, i18n } = useTranslation(["import", "common"]);
    const router = useRouter();

    const fieldLabels = {
        customer_number: t("fields.payment_fields_customer_number", {
            ns: "import",
        }),
        invoice_number: t("fields.payment_fields_invoice_number", {
            ns: "import",
        }),
        payment_date: t("fields.payment_fields_payment_date", { ns: "import" }),
        amount: t("fields.payment_fields_amount", { ns: "import" }),
        payment_method: t("fields.payment_fields_payment_method", {
            ns: "import",
        }),
        reference: t("fields.payment_fields_reference", { ns: "import" }),
        customer_currency: t("fields.payment_fields_customer_currency", {
            ns: "import",
        }),
        customer_amount: t("fields.payment_fields_customer_amount", {
            ns: "import",
        }),
    };

    const fieldDescriptions = {
        customer_number: {
            type: "number",
            description: t(
                "fields.payment_fields_customer_number_description",
                { ns: "import" }
            ),
        },
        invoice_number: {
            type: "string",
            description: t("fields.payment_fields_invoice_number_description", {
                ns: "import",
            }),
        },
        payment_date: {
            type: "date",
            description: t("fields.payment_fields_payment_date_description", {
                ns: "import",
            }),
        },
        amount: {
            type: "number",
            description: t("fields.payment_fields_amount_description", {
                ns: "import",
            }),
        },
        payment_method: {
            type: "string",
            description: t("fields.payment_fields_payment_method_description", {
                ns: "import",
            }),
        },
        reference: {
            type: "string",
            description: t("fields.payment_fields_reference_description", {
                ns: "import",
            }),
        },
        customer_currency: {
            type: "string",
            description: t(
                "fields.payment_fields_customer_currency_description",
                { ns: "import" }
            ),
        },
        customer_amount: {
            type: "number",
            description: t(
                "fields.payment_fields_customer_amount_description",
                { ns: "import" }
            ),
        },
    };

    const handleFileSelected = useCallback(
        async (file: File) => {
            setSelectedFile(file);

            // Parse the file first
            const parsedData = await parseFile(file);

            // Check for existing field mappings for this user and import type
            try {
                const existingMapping =
                    await importMappingService.getDefaultMappingForUser(
                        ImportType.Payment
                    );

                if (existingMapping && existingMapping.mapping) {
                    // Apply the existing mapping
                    setMapping(
                        existingMapping.mapping as Record<string, string>
                    );

                    // Map the data with the existing mapping
                    if (parsedData.length > 0) {
                        const mapped = parsedData.map((row) => {
                            const newRow: PaymentRow = {};
                            Object.entries(
                                existingMapping.mapping as Record<
                                    string,
                                    string
                                >
                            ).forEach(([dbField, fileField]) => {
                                if (fileField) newRow[dbField] = row[fileField];
                            });
                            return newRow;
                        });
                        setMappedData(mapped);
                    }
                }
                // If no existing mapping found, FieldMapper will handle auto-mapping
            } catch (error) {
                // FieldMapper will handle auto-mapping if needed
            }
        },
        [parseFile]
    );

    const handleClear = useCallback(() => {
        setSelectedFile(null);
        setMapping({});
        setMappedData([]);
        setIsSubmitted(false);
        setImportProgress(0);
        setCurrentRecordCount(0);
        setJobId(null);
        clear();
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [clear]);

    const mapData = () => {
        if (!parsedData.length) return;

        const mapped = parsedData.map((row) => {
            const newRow: PaymentRow = {};
            Object.entries(mapping).forEach(([dbField, fileField]) => {
                if (fileField) newRow[dbField] = row[fileField];
            });
            // Set default success message for rows that will be validated
            return {
                ...newRow,
                message: "All fields validated successfully - Ready for import",
            };
        });

        setMappedData(mapped);

        // Validate business unit access for customers
        validateCustomerBusinessUnitAccess(mapped);
    };

    const validateCustomerBusinessUnitAccess = async (
        mappedData: PaymentRow[]
    ) => {
        // Extract unique customer numbers
        const customerNumbers = Array.from(
            new Set(
                mappedData
                    .map((row) => row.customer_number)
                    .filter((val): val is string | number => Boolean(val))
            )
        );

        if (customerNumbers.length === 0) {
            return;
        }

        try {
            const response = await apiFetch("/api/customers/validate-business-unit-access",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        customerNumbers: customerNumbers.map(String),
                    }),
                }
            );

            if (!response.ok) {
                console.error(
                    "[PaymentProcessor] Failed to validate customer business unit access"
                );
                return;
            }

            const result = await response.json();
            const validationResults = result.data || [];

            // Create a map of customer number to access result
            const accessMap = new Map<
                string,
                { hasAccess: boolean; externalId: string | null }
            >();
            validationResults.forEach((result: any) => {
                accessMap.set(result.customerNumber, {
                    hasAccess: result.hasAccess,
                    externalId: result.businessUnitExternalId,
                });
            });

            // Update mapped data with business unit errors
            const updatedMapped = mappedData.map((row) => {
                const customerNumber = row.customer_number;
                if (!customerNumber) {
                    // Ensure row has a default success message if no customer number
                    return {
                        ...row,
                        message:
                            row.message ||
                            "All fields validated successfully - Ready for import",
                    };
                }

                const accessResult = accessMap.get(String(customerNumber));
                // Only add error if customer exists and user doesn't have access
                if (
                    accessResult &&
                    accessResult.hasAccess === false &&
                    accessResult.externalId
                ) {
                    const errorMessage = t(
                        "validation.business_unit_access_denied",
                        {
                            businessUnit: accessResult.externalId,
                            ns: "import",
                        }
                    );
                    const existingMessage =
                        row.message ||
                        "All fields validated successfully - Ready for import";
                    const isCurrentlyValid =
                        existingMessage ===
                        "All fields validated successfully - Ready for import";

                    return {
                        ...row,
                        message: isCurrentlyValid
                            ? errorMessage
                            : `${existingMessage}, ${errorMessage}`,
                    };
                }
                // Ensure row has a default success message if access is granted or customer not found
                return {
                    ...row,
                    message:
                        row.message ||
                        "All fields validated successfully - Ready for import",
                };
            });

            setMappedData(updatedMapped);
        } catch (error) {
            console.error(
                "[PaymentProcessor] Error validating customer business unit access:",
                error
            );
        }
    };

    const handleSubmit = useCallback(async () => {
        if (mappedData.length === 0) {
            showError(t("validation.no_data_to_submit", { ns: "import" }));
            return;
        }

        setIsSubmitting(true);
        setImportProgress(0);
        setCurrentRecordCount(0);
        setImportStatus("loading");

        try {
            // Create a single import job for all records first
            const jobResponse = await apiFetch("/api/import/job/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    import_type: ImportType.Payment,
                    total_records: mappedData.length,
                    metadata: {
                        field_mapping: mapping,
                        field_labels: fieldLabels,
                    },
                }),
            });

            if (!jobResponse.ok) {
                throw new Error(
                    `Failed to create import job: ${jobResponse.status}`
                );
            }

            const jobData = await jobResponse.json();
            const jobId = jobData.jobId;

            if (!jobId) {
                throw new Error("Failed to create import job");
            }

            setJobId(jobId);

            // Split data into batches to avoid 431 error (Request Header Fields Too Large)
            const BATCH_SIZE = 20; // Process 20 records at a time
            const batches = [];

            for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
                batches.push(mappedData.slice(i, i + BATCH_SIZE));
            }

            const allResults: any[] = [];
            let processedCount = 0;

            for (
                let batchIndex = 0;
                batchIndex < batches.length;
                batchIndex++
            ) {
                const batch = batches[batchIndex];

                const requestBody = {
                    jobId: jobId,
                    payments: batch.map(({ status, message, ...rest }) => rest),
                    fieldMapping: mapping,
                    fieldLabels: fieldLabels,
                    batchIndex: batchIndex,
                    globalStartIndex: processedCount,
                };

                const response = await apiFetch("/api/import/payment", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                });

                if (!response.ok) {
                    throw new Error(
                        `Batch ${batchIndex + 1} failed: ${response.status}`
                    );
                }

                const result = await response.json();

                if (result?.results) {
                    // Adjust the index for each batch to maintain correct global indexing
                    const adjustedResults = result.results.map((r: any) => ({
                        ...r,
                        index: r.index + processedCount,
                    }));

                    allResults.push(...adjustedResults);
                    processedCount += batch.length;
                } else {
                    // Create failed results for this batch
                    const failedResults = batch.map((_, index) => ({
                        index: processedCount + index,
                        success: false,
                        message: t("fields.errors.batchProcessingFailed"),
                    }));
                    allResults.push(...failedResults);
                    processedCount += batch.length;
                }

                // Update progress
                setImportProgress(((batchIndex + 1) / batches.length) * 100);
                setCurrentRecordCount(processedCount);
            }

            // Mark the import job as completed
            try {
                await apiFetch("/api/import/job/complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jobId: jobId,
                    }),
                });
            } catch (_err) {
                // Handle silently
            }

            if (allResults.length > 0) {
                setIsSubmitted(true);
                const updated = mappedData.map((row, index) => {
                    const rowResult = allResults[index];
                    let status = rowResult?.success ? "Success" : "Failed";
                    if (rowResult?.deferred) {
                        status = "Deferred";
                    } else if (rowResult?.skipped) {
                        status = "Skipped";
                    }
                    return {
                        ...row,
                        status,
                        message: rowResult?.message || "",
                    };
                });
                setMappedData(updated);

                // Analyze results to determine if it's success, partial, or failure
                const successCount = allResults.filter(
                    (result: any) => result.success
                ).length;
                const failedCount = allResults.length - successCount;

                if (failedCount === 0) {
                    // All succeeded
                    setImportStatus("success");
                    const successMessage = t("messages.import_success", {
                        ns: "import",
                        count: successCount,
                    });
                    // Fallback if translation fails
                    const finalMessage =
                        successMessage === "import.messages.import_success"
                            ? `Successfully imported ${successCount} record(s)`
                            : successMessage;
                    success(finalMessage);
                } else if (successCount === 0) {
                    // All failed
                    setImportStatus("error");
                    const errorMessage = t("messages.import_failed", {
                        ns: "import",
                        count: failedCount,
                    });
                    // Fallback if translation fails
                    const finalMessage =
                        errorMessage === "import.messages.import_failed"
                            ? `Failed to import ${failedCount} record(s)`
                            : errorMessage;
                    showError(finalMessage);
                } else {
                    // Partial success
                    setImportStatus("partial");
                    const partialMessage = t("messages.import_partial", {
                        ns: "import",
                        success: successCount,
                        failed: failedCount,
                    });
                    // Fallback if translation fails
                    const finalMessage =
                        partialMessage === "import.messages.import_partial"
                            ? `Partially imported: ${successCount} succeeded, ${failedCount} failed`
                            : partialMessage;
                    showToast(finalMessage, "warning");
                }

                // Use batch cache invalidator for efficient cache management
                const { BatchCacheInvalidator } = await import(
                    "@/utils/cacheUtils"
                );
                const batchInvalidator = new BatchCacheInvalidator();

                // Mark control center stats for invalidation
                batchInvalidator.markControlCenterForInvalidation();

                // Get unique customer IDs from the payment data
                const uniqueCustomerIds = Array.from(
                    new Set(
                        mappedData
                            .map((payment: any) => payment.customer_number)
                            .filter(
                                (id: any) => id !== null && id !== undefined
                            )
                    )
                );

                if (uniqueCustomerIds.length > 0) {
                    batchInvalidator.addAffectedCustomers(uniqueCustomerIds);
                }

                // Execute all cache invalidations at once
                if (batchInvalidator.hasPendingInvalidations()) {
                    await batchInvalidator.executeInvalidations();
                }

                // Invalidate customer cache to refresh the header
                try {
                    const { invalidateLastSyncDate } = await import(
                        "@/utils/cacheUtils"
                    );
                    await invalidateLastSyncDate();
                } catch (error) {
                    console.error("Error invalidating customer cache:", error);
                }

                // Redirect to result page with job ID only
                router.push(`/app/import/result?jobId=${jobId}`);
            }
        } catch (error) {
            showError(t("fields.errors.submissionFailed"));
            setImportStatus("error");
        } finally {
            setIsSubmitting(false);
            setImportProgress(100);
        }
    }, [mappedData, mapping, fieldLabels, showError, success, t, router]);

    useEffect(() => {
        if (parsedData.length > 0 && Object.keys(mapping).length > 0) {
            mapData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsedData, mapping]);

    // Clear URL parameters on component mount to prevent conflicts with old job IDs
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (
            urlParams.has("jobId") ||
            urlParams.has("successCount") ||
            urlParams.has("results")
        ) {
            // Clear URL parameters without triggering a page reload
            const newUrl = window.location.pathname;
            window.history.replaceState({}, "", newUrl);
        }
    }, []);

    return (
        <Box sx={{ width: "100%" }}>
            <FileUploader
                onFileSelected={handleFileSelected}
                onClear={handleClear}
                selectedFile={selectedFile}
                isParsing={isParsing}
                fileInputRef={fileInputRef}
                uploadTitle={t("fields.file_handling_upload_payment_file", {
                    ns: "import",
                })}
            />

            {parsedData.length > 0 && (
                <Box sx={{ mt: 4 }}>
                    <FieldMapper
                        rawHeaders={headers}
                        databaseFields={databaseFields}
                        mapping={mapping}
                        setMapping={setMapping}
                        fieldDescriptions={fieldDescriptions}
                        exampleValues={exampleValues}
                        fieldLabels={fieldLabels}
                        requiredFields={requiredFields}
                        importType={ImportType.Payment}
                        shouldAutoMap={Object.keys(mapping).length === 0}
                    />
                </Box>
            )}

            {mappedData.length > 0 && (
                <Box sx={{ mt: 4 }}>
                    <MappedDataGrid
                        rows={mappedData}
                        columns={databaseFields}
                        isLoading={isSubmitting}
                        isSubmitted={isSubmitted}
                        onSubmit={handleSubmit}
                        importStatus={importStatus}
                        fieldLabels={fieldLabels}
                        currentRecordCount={currentRecordCount}
                        totalRecords={mappedData.length}
                        importProgress={importProgress}
                    />
                </Box>
            )}
        </Box>
    );
};

export default PaymentProcessor;
