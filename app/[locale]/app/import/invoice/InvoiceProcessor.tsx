"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ImportType } from "@/types/db";
import { useRouter } from "next/navigation";
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useFileParser } from "@/shared/hooks/useFileParser";
import FieldMapper from "@/shared/layout-components/import/FieldMapper";
import FileUploader from "@/shared/layout-components/import/FileUploader";
import MappedDataGrid from "@/shared/layout-components/import/MappedDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

// Constants
const BASE_DATABASE_FIELDS = [
    "customer_number",
    "invoice_date",
    "due_date",
    "base_amount",
    "invoice_amount",
    "customer_total_paid",
    "currency",
    "invoice_number",
    "credit_for_invoice_number",
];

const REQUIRED_FIELDS = [
    "customer_number",
    "invoice_date",
    "invoice_number",
    "base_amount",
    "invoice_amount",
];

const FIELD_MAPPING = {
    customer_number: "customer_number",
    base_amount: "amount",
    invoice_amount: "customer_amount",
    customer_total_paid: "customer_total_paid",
    currency: "customer_currency",
    invoice_date: "invoice_date",
    due_date: "due_date",
    invoice_number: "invoice_number",
    credit_for_invoice_number: "credit_for_invoice_number",
};

/** Client-side mirror of ImportService.validateInvoiceData (no server import). */
function validateInvoiceData(invoice: {
    invoice_number?: unknown;
    invoice_date?: unknown;
    due_date?: unknown;
    amount?: unknown;
}): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!invoice.invoice_number) {
        errors.push("Invoice number is required");
    }
    if (!invoice.invoice_date) {
        errors.push("Invoice date is required");
    }
    if (!invoice.due_date) {
        errors.push("Due date is required");
    }
    if (
        invoice.amount === null ||
        invoice.amount === undefined ||
        invoice.amount === ""
    ) {
        errors.push("Amount is required and cannot be empty");
    } else {
        const numAmount = Number(invoice.amount);
        if (isNaN(numAmount)) {
            errors.push("Amount must be a valid number");
        }
    }
    if (
        invoice.invoice_date &&
        isNaN(new Date(invoice.invoice_date as string | number | Date).getTime())
    ) {
        errors.push("Invalid invoice date format");
    }
    if (
        invoice.due_date &&
        isNaN(new Date(invoice.due_date as string | number | Date).getTime())
    ) {
        errors.push("Invalid due date format");
    }

    return { isValid: errors.length === 0, errors };
}

const InvoiceProcessor: React.FC = () => {
    const { t } = useTranslation(["import", "common"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const router = useRouter();

    // State management
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const EMPTY_MAPPING = {};
    const [mapping, setMapping] =
        useState<Record<string, string>>(EMPTY_MAPPING);
    const [mappedData, setMappedData] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [importStatus, setImportStatus] = useState<
        "idle" | "loading" | "success" | "partial" | "error"
    >("idle");
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Progress tracking state
    const [importProgress, setImportProgress] = useState(0);
    const [currentRecordCount, setCurrentRecordCount] = useState(0);
    const [jobId, setJobId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // File parsing hook
    const { parsedData, headers, parseFile, clear, isParsing } =
        useFileParser();

    const databaseFields = useMemo(() => [...BASE_DATABASE_FIELDS], []);

    // Field configurations
    const fieldLabels = databaseFields.reduce(
        (acc, field) => {
            // Special handling: invoice_amount maps to invoice_fields_amount (not invoice_fields_invoice_amount)
            // base_amount has its own translation key: invoice_fields_base_amount
            let translationKey: string;
            if (field === "invoice_amount") {
                translationKey = "fields.invoice_fields_amount";
            } else if (field === "base_amount") {
                translationKey = "fields.invoice_fields_base_amount";
            } else {
                translationKey = `fields.invoice_fields_${field}`;
            }
            acc[field] = t(translationKey, { ns: "import" });
            return acc;
        },
        {} as Record<string, string>
    );

    const fieldDescriptions = databaseFields.reduce(
        (acc, field) => {
            // Special handling: invoice_amount maps to invoice_fields_amount (not invoice_fields_invoice_amount)
            // base_amount has its own translation key: invoice_fields_base_amount_description
            let descriptionKey: string;
            if (field === "invoice_amount") {
                descriptionKey = "fields.invoice_fields_amount_description";
            } else if (field === "base_amount") {
                descriptionKey =
                    "fields.invoice_fields_base_amount_description";
            } else {
                descriptionKey = `fields.invoice_fields_${field}_description`;
            }
            acc[field] = {
                type: field.includes("date")
                    ? "date"
                    : field.includes("amount") || field.includes("paid")
                      ? "number"
                      : "string",
                description: t(descriptionKey, { ns: "import" }),
            };
            return acc;
        },
        {} as Record<string, { type: string; description: string }>
    );

    const exampleValues = {
        customer_number: "12345",
        invoice_date: "2024-01-15",
        due_date: "2024-02-15",
        base_amount: 1500.0,
        invoice_amount: 1500.0,
        customer_total_paid: 0.0,
        currency: "USD",
        invoice_number: "INV-2024-001",
        credit_for_invoice_number: "",
    };

    const validateCustomerBusinessUnitAccess = useCallback(
        async (mappedData: any[]) => {
            // Extract unique customer numbers
            const customerNumbers = Array.from(
                new Set(
                    mappedData.map((row) => row.customer_number).filter(Boolean)
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
                            customerNumbers,
                        }),
                    }
                );

                if (!response.ok) {
                    console.error(
                        "[InvoiceProcessor] Failed to validate customer business unit access"
                    );
                    return;
                }

                const result = await response.json();
                const validationResults = result.items || result.data || [];

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
                    if (!customerNumber) return row;

                    const accessResult = accessMap.get(customerNumber);
                    if (
                        accessResult &&
                        !accessResult.hasAccess &&
                        accessResult.externalId
                    ) {
                        const errorMessage = t(
                            "validation.business_unit_access_denied",
                            {
                                businessUnit: accessResult.externalId,
                                ns: "import",
                            }
                        );
                        const existingMessage = row.message || "";
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
                    return row;
                });

                setMappedData(updatedMapped);
            } catch (error) {
                console.error(
                    "[InvoiceProcessor] Error validating customer business unit access:",
                    error
                );
            }
        },
        [t]
    );

    // File handling
    const handleFileSelected = useCallback(
        async (file: File) => {
            setSelectedFile(file);
            try {
                await parseFile(file);
                setMapping(EMPTY_MAPPING);
                setMappedData([]);
                setValidationErrors([]);
            } catch (_error) {
                showToast(
                    t("messages.file_parse_error", { ns: "import" }),
                    "error"
                );
            }
        },
        [parseFile, showToast, t]
    );

    const handleFileRemoved = useCallback(() => {
        setSelectedFile(null);
        clear();
        setMapping(EMPTY_MAPPING);
        setMappedData([]);
        setIsSubmitted(false);
        setImportStatus("idle");
        setValidationErrors([]);
        setImportProgress(0);
        setCurrentRecordCount(0);
        setJobId(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [clear]);

    // Field mapping function to convert frontend field names to backend field names
    const mapFrontendToBackendFields = useCallback((frontendData: any[]) => {
        return frontendData.map((row) => {
            const mappedRow: any = {};
            Object.keys(row).forEach((frontendField) => {
                const backendField =
                    FIELD_MAPPING[
                        frontendField as keyof typeof FIELD_MAPPING
                    ] || frontendField;
                mappedRow[backendField] = row[frontendField];
            });
            return mappedRow;
        });
    }, []);

    // Update mappedData when parsedData and mapping change
    useEffect(() => {
        if (parsedData.length > 0 && Object.keys(mapping).length > 0) {
            // Map parsed data to the expected format - only include invoice fields
            const newMappedData = parsedData.map((row) => {
                const mappedRow: Record<string, any> = {};
                for (const dbField in mapping) {
                    // Only process fields that are in our invoice database fields list
                    if (databaseFields.includes(dbField)) {
                        const fileHeader = mapping[dbField];
                        if (fileHeader && row[fileHeader] !== undefined) {
                            mappedRow[dbField] = row[fileHeader];
                        }
                    }
                }
                return mappedRow;
            });

            // Check for missing required field mappings
            const errors: string[] = [];
            REQUIRED_FIELDS.forEach((field) => {
                if (!mapping[field]) {
                    const fieldLabel = fieldLabels[field];
                    errors.push(`${fieldLabel || field} is required`);
                }
            });

            // Validate each row using client-side invoice validation
            const rowsWithMessages = newMappedData.map((row) => {
                const backendRow = mapFrontendToBackendFields([row])[0];

                const invoiceData = {
                    invoice_number:
                        backendRow.invoice_number || row.invoice_number,
                    invoice_date: backendRow.invoice_date || row.invoice_date,
                    due_date: backendRow.due_date || row.due_date,
                    // base_amount (mapped to amount) is required for currency ratio calculation
                    // invoice_amount (mapped to customer_amount) is also required
                    amount: backendRow.amount || row.base_amount,
                };

                const validation = validateInvoiceData(invoiceData);
                return {
                    ...row,
                    message: validation.isValid
                        ? "All fields validated successfully - Ready for import"
                        : validation.errors.join(", "),
                };
            });

            setMappedData(rowsWithMessages);
            setValidationErrors(errors);

            // Validate business unit access for customers
            validateCustomerBusinessUnitAccess(rowsWithMessages);
        } else {
            setMappedData([]);
            setValidationErrors([]);
        }
    }, [
        parsedData,
        mapping,
        databaseFields,
        mapFrontendToBackendFields,
        validateCustomerBusinessUnitAccess,
        t,
    ]);

    // Submit handler with batching
    const handleSubmit = useCallback(async () => {
        setIsSubmitting(true);
        setImportProgress(0);
        setCurrentRecordCount(0);
        setImportStatus("loading");

        try {
            // Send ALL rows to the API, including failed ones, so import records are created for all
            // The backend will handle validation and mark failed records appropriately
            const backendData = mapFrontendToBackendFields(mappedData);

            const allowedInvoiceFields = new Set([
                "account_id",
                "customer_number",
                "status_id",
                "invoice_date",
                "due_date",
                "amount",
                "customer_amount",
                "customer_total_paid",
                "customer_currency",
                "invoice_number",
                "credit_for_invoice_number",
            ]);

            const cleanedBackendData = backendData.map(
                ({ message: _message, ...cleanRow }) => {
                    const filteredRow: Record<string, any> = {};
                    Object.keys(cleanRow).forEach((key) => {
                        if (allowedInvoiceFields.has(key)) {
                            filteredRow[key] = cleanRow[key];
                        }
                    });
                    return filteredRow;
                }
            );

            // Create a single import job for all records first
            const jobResponse = await apiFetch("/api/import/job/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    import_type: ImportType.Invoice,
                    total_records: cleanedBackendData.length,
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

            // Split data into batches to avoid connection pool exhaustion
            const BATCH_SIZE = 20; // Process 20 records at a time
            const batches = [];

            for (let i = 0; i < cleanedBackendData.length; i += BATCH_SIZE) {
                batches.push(cleanedBackendData.slice(i, i + BATCH_SIZE));
            }

            let allResults: any[] = [];
            let processedCount = 0;
            const affectedCustomerIds = new Set<number>();

            for (
                let batchIndex = 0;
                batchIndex < batches.length;
                batchIndex++
            ) {
                const batch = batches[batchIndex];

                const response = await apiFetch("/api/import/invoice", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        invoices: batch,
                        jobId: jobId,
                        batchIndex: batchIndex,
                        globalStartIndex: batchIndex * BATCH_SIZE,
                        mapping,
                    }),
                });

                if (response.ok) {
                    const responseData = await response.json();
                    allResults = allResults.concat(responseData.results || []);
                    (responseData.affectedCustomerIds as number[] | undefined)?.forEach(
                        (id) => affectedCustomerIds.add(id)
                    );
                    processedCount += batch.length;

                    // Update progress
                    const progress = Math.round(
                        (processedCount / cleanedBackendData.length) * 100
                    );
                    setImportProgress(progress);
                    setCurrentRecordCount(processedCount);
                } else {
                    const errorData = await response.json();
                    const errorMessage =
                        errorData.message ||
                        errorData.error ||
                        errorData.details?.join(", ") ||
                        `Batch ${batchIndex + 1} failed`;
                    throw new Error(errorMessage);
                }
            }

            // Mark the import job as completed
            try {
                await apiFetch("/api/import/job/complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jobId: jobId,
                        affectedCustomerIds: Array.from(affectedCustomerIds),
                    }),
                });
            } catch (_err) {
                // Handle silently
            }

            // Analyze results to determine if it's success, partial, or failure
            if (allResults.length > 0) {
                setIsSubmitted(true);
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
                    const finalMessage =
                        successMessage === "import.messages.import_success"
                            ? `Successfully imported ${successCount} record(s)`
                            : successMessage;
                    showToast(finalMessage, "success");
                } else if (successCount === 0) {
                    // All failed
                    setImportStatus("error");
                    const errorMessage = t("messages.import_failed", {
                        ns: "import",
                        count: failedCount,
                    });
                    const finalMessage =
                        errorMessage === "import.messages.import_failed"
                            ? `Failed to import ${failedCount} record(s)`
                            : errorMessage;
                    showToast(finalMessage, "error");
                } else {
                    // Partial success
                    setImportStatus("partial");
                    const partialMessage = t("messages.import_partial", {
                        ns: "import",
                        success: successCount,
                        failed: failedCount,
                    });
                    const finalMessage =
                        partialMessage === "import.messages.import_partial"
                            ? `Partially imported: ${successCount} succeeded, ${failedCount} failed`
                            : partialMessage;
                    showToast(finalMessage, "warning");
                }

                if (jobId) {
                    router.push(`/app/import/result?jobId=${jobId}`);
                }
            } else {
                // No results - should not happen, but handle gracefully
                setImportStatus("error");
                showToast(
                    t("messages.import_failed", { ns: "import" }),
                    "error"
                );
            }
        } catch (_error) {
            setImportStatus("error");
            showToast(t("messages.import_failed", { ns: "import" }), "error");
        } finally {
            setIsSubmitting(false);
        }
    }, [
        mappedData,
        mapping,
        mapFrontendToBackendFields,
        showToast,
        t,
        router,
        fieldLabels,
    ]);

    return (
        <Box sx={{ width: "100%" }}>
            {/* File Upload Section */}
            <FileUploader
                onFileSelected={handleFileSelected}
                onClear={handleFileRemoved}
                selectedFile={selectedFile}
                isParsing={isParsing}
                fileInputRef={fileInputRef}
                uploadTitle={t("fields.file_handling_upload_invoice_file", {
                    ns: "import",
                })}
            />

            {/* Field Mapping Section */}
            {parsedData.length > 0 && (
                <Box sx={{ mt: theme.spacing(4) }}>
                    <FieldMapper
                        rawHeaders={headers}
                        databaseFields={databaseFields}
                        mapping={mapping}
                        setMapping={setMapping}
                        fieldDescriptions={fieldDescriptions}
                        exampleValues={exampleValues}
                        fieldLabels={fieldLabels}
                        importType={ImportType.Invoice}
                        shouldAutoMap={Object.keys(mapping).length === 0}
                    />
                </Box>
            )}

            {/* Record Preview Section */}
            {mappedData.length > 0 && (
                <Box sx={{ mt: theme.spacing(4) }}>
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
                        validationErrors={validationErrors}
                    />
                </Box>
            )}
        </Box>
    );
};

export default InvoiceProcessor;
