"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box, Paper } from "@mui/material";
import { ImportType } from "@/types/db";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useFileParser } from "@/shared/hooks/useFileParser";
import FieldMapper from "@/shared/layout-components/import/FieldMapper";
import FileUploader from "@/shared/layout-components/import/FileUploader";
import MappedDataGrid from "@/shared/layout-components/import/MappedDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { importMappingService } from "@/shared/services/importMappingService";

interface CustomerRow {
    [key: string]: string | number | null;
}

interface ServerResult {
    index: number;
    success: boolean;
    message?: string;
    accountId?: number;
}

const exampleValues = {
    name: "John Doe",
    customer_number: 12345,
    crn: "514123456",
    country_iso2: "US",
    state_iso2: "CA",
    city: "San Francisco",
    address_line1: "123 Main St",
    address_line2: "Suite 400",
    postal_code: "94103",
    owner_email: "john.doe@example.com",
    business_unit: "BU-001",
    parent_customer_number: "PARENT-001",
};

const CustomerProcessor: React.FC = () => {
    const { t, i18n } = useTranslation(["import", "common"]);
    const { success, error: showError, showToast } = useToast();
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [mappedData, setMappedData] = useState<CustomerRow[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [importStatus, setImportStatus] = useState<
        "idle" | "loading" | "success" | "partial" | "error"
    >("idle");
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [businessUnitWarnings, setBusinessUnitWarnings] = useState<string[]>(
        []
    );
    const [importProgress, setImportProgress] = useState(0);
    const [currentRecordCount, setCurrentRecordCount] = useState(0);
    const [jobId, setJobId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const databaseFields = useMemo(() => Object.keys(exampleValues), []);
    const { parsedData, headers, parseFile, clear, isParsing } =
        useFileParser();

    const fieldLabels = {
        name: t("fields.customer_fields_name", { ns: "import" }),
        customer_number: t("fields.customer_fields_customer_number", {
            ns: "import",
        }),
        crn: t("fields.customer_fields_crn", { ns: "import" }),
        country_iso2: t("fields.customer_fields_country_iso2", {
            ns: "import",
        }),
        state_iso2: t("fields.customer_fields_state_iso2", { ns: "import" }),
        city: t("fields.customer_fields_city", { ns: "import" }),
        address_line1: t("fields.customer_fields_address_line1", {
            ns: "import",
        }),
        address_line2: t("fields.customer_fields_address_line2", {
            ns: "import",
        }),
        postal_code: t("fields.customer_fields_postal_code", { ns: "import" }),
        owner_email: t("fields.customer_fields_owner_email", { ns: "import" }),
        business_unit: t("fields.customer_fields_business_unit", {
            ns: "import",
        }),
        parent_customer_number: t(
            "fields.customer_fields_parent_customer_number",
            { ns: "import" }
        ),
    };

    const fieldDescriptions = {
        name: {
            type: "string",
            description: t("fields.customer_fields_name_description", {
                ns: "import",
            }),
        },
        customer_number: {
            type: "number",
            description: t(
                "fields.customer_fields_customer_number_description",
                { ns: "import" }
            ),
        },
        crn: {
            type: "string",
            description: t("fields.customer_fields_crn_description", {
                ns: "import",
            }),
        },
        country_iso2: {
            type: "string",
            description: t("fields.customer_fields_country_iso2_description", {
                ns: "import",
            }),
        },
        state_iso2: {
            type: "string",
            description: t("fields.customer_fields_state_iso2_description", {
                ns: "import",
            }),
        },
        city: {
            type: "string",
            description: t("fields.customer_fields_city_description", {
                ns: "import",
            }),
        },
        address_line1: {
            type: "string",
            description: t("fields.customer_fields_address_line1_description", {
                ns: "import",
            }),
        },
        address_line2: {
            type: "string",
            description: t("fields.customer_fields_address_line2_description", {
                ns: "import",
            }),
        },
        postal_code: {
            type: "string",
            description: t("fields.customer_fields_postal_code_description", {
                ns: "import",
            }),
        },
        owner_email: {
            type: "string",
            description: t("fields.customer_fields_owner_email_description", {
                ns: "import",
            }),
        },
        business_unit: {
            type: "string",
            description: t("fields.customer_fields_business_unit_description", {
                ns: "import",
            }),
        },
        parent_customer_number: {
            type: "string",
            description: t(
                "fields.customer_fields_parent_customer_number_description",
                { ns: "import" }
            ),
        },
    };

    const validateMapping = useCallback(() => {
        const errors: string[] = [];
        const requiredFields = [
            "name",
            "customer_number",
            "country_iso2",
        ] as const;

        requiredFields.forEach((field) => {
            if (!mapping[field]) {
                const label = fieldLabels[field];
                errors.push(
                    t("validation.required_field_missing", {
                        field: label,
                        ns: "import",
                    })
                );
            }
        });

        setValidationErrors(errors);
        return errors.length === 0;
    }, [mapping, t, fieldLabels]);

    const validateBusinessUnitAccess = async (
        mappedData: CustomerRow[]
    ): Promise<Map<number, string>> => {
        const businessUnitErrors = new Map<number, string>();

        // Extract unique business unit external IDs from mapped data
        const businessUnitExternalIds = new Set<string>();
        mappedData.forEach((row, index) => {
            if (row.business_unit && typeof row.business_unit === "string") {
                const trimmed = row.business_unit.trim();
                if (trimmed !== "") {
                    businessUnitExternalIds.add(trimmed);
                }
            }
        });

        // If no business units found, no need to validate
        if (businessUnitExternalIds.size === 0) {
            setBusinessUnitWarnings([]);
            return businessUnitErrors;
        }

        try {
            // Call API to validate business unit access
            const response = await apiFetch("/api/business-units/validate-access",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        externalIds: Array.from(businessUnitExternalIds),
                    }),
                }
            );

            if (!response.ok) {
                return businessUnitErrors;
            }

            const result = await response.json();
            const validationResults = result.items || result.data || [];

            // Create a map of external ID to access result
            const accessMap = new Map<
                string,
                { hasAccess: boolean; exists: boolean }
            >();
            validationResults.forEach((result: any) => {
                accessMap.set(result.externalId, {
                    hasAccess: result.hasAccess,
                    exists: result.exists,
                });
            });

            // Find business units the user doesn't have access to and map to row indices
            mappedData.forEach((row, index) => {
                if (
                    row.business_unit &&
                    typeof row.business_unit === "string"
                ) {
                    const trimmed = row.business_unit.trim();
                    if (trimmed !== "") {
                        const accessResult = accessMap.get(trimmed);
                        if (accessResult) {
                            // Mark as error if business unit exists AND user doesn't have access
                            if (
                                accessResult.exists &&
                                !accessResult.hasAccess
                            ) {
                                const errorMessage = t(
                                    "validation.business_unit_access_denied",
                                    {
                                        businessUnit: trimmed,
                                        ns: "import",
                                    }
                                );
                                businessUnitErrors.set(index, errorMessage);
                            }
                            // Also mark as error if business unit doesn't exist (should be created first)
                            else if (!accessResult.exists) {
                                const errorMessage = t(
                                    "validation.business_unit_not_found",
                                    {
                                        businessUnit: trimmed,
                                        ns: "import",
                                    }
                                );
                                businessUnitErrors.set(index, errorMessage);
                            }
                        }
                    }
                }
            });

            // Show general warning if any errors found
            const inaccessibleBusinessUnits = validationResults
                .filter((result: any) => result.exists && !result.hasAccess)
                .map((result: any) => result.externalId);

            if (inaccessibleBusinessUnits.length > 0) {
                const warningMessage = t(
                    "validation.business_unit_access_denied_warning",
                    {
                        businessUnits: inaccessibleBusinessUnits.join(", "),
                        count: inaccessibleBusinessUnits.length,
                        ns: "import",
                    }
                );
                setBusinessUnitWarnings([warningMessage]);
                // Toast message removed - warnings are shown in the preview table instead
            } else {
                setBusinessUnitWarnings([]);
            }
        } catch (_error) {
            // Error handled silently
        }

        return businessUnitErrors;
    };

    const handleFileSelected = async (file: File) => {
        setSelectedFile(file);
        setValidationErrors([]);
        setBusinessUnitWarnings([]);

        // Parse the file first
        const parsedData = await parseFile(file);

        // Check for existing field mappings for this user and import type
        try {
            const existingMapping =
                await importMappingService.getDefaultMappingForUser(
                    ImportType.Customer
                );

            if (existingMapping && existingMapping.mapping) {
                // Apply the existing mapping
                setMapping(existingMapping.mapping as Record<string, string>);

                // Map the data with the existing mapping
                if (parsedData.length > 0) {
                    const mapped = parsedData.map((row) => {
                        const newRow: CustomerRow = {};
                        Object.entries(
                            existingMapping.mapping as Record<string, string>
                        ).forEach(([dbField, fileField]) => {
                            if (fileField) newRow[dbField] = row[fileField];
                        });
                        return newRow;
                    });
                    // Validate business unit access for mapped data and update with errors
                    validateBusinessUnitAccess(mapped)
                        .then((businessUnitErrors) => {
                            const updatedMapped = mapped.map((row, index) => {
                                const buError = businessUnitErrors.get(index);
                                if (buError) {
                                    // Business unit access error - mark as failed
                                    return {
                                        ...row,
                                        status: "Validation Failed",
                                        message: buError,
                                    };
                                }
                                // No business unit error - ensure row has success status and message
                                return {
                                    ...row,
                                    status: "Validated",
                                    message:
                                        "All fields validated successfully - Ready for import",
                                };
                            });

                            setMappedData(updatedMapped);
                        })
                        .catch((_error) => {
                            // Error handled silently
                        });
                }
            }
            // If no existing mapping found, FieldMapper will handle auto-mapping
        } catch (_error) {
            // FieldMapper will handle auto-mapping if needed
        }
    };

    const handleClear = () => {
        setSelectedFile(null);
        setMapping({});
        setMappedData([]);
        setIsSubmitted(false);
        setValidationErrors([]);
        setBusinessUnitWarnings([]);
        setJobId(null);
        setImportProgress(0);
        setCurrentRecordCount(0);
        clear();
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const mapData = () => {
        if (!parsedData.length) return;

        const mapped = parsedData.map((row, index) => {
            const newRow: CustomerRow = { id: index } as any; // Add unique ID for grid

            // Initialize all database fields to ensure they exist in the row
            databaseFields.forEach((dbField) => {
                newRow[dbField] = null;
            });

            // Then populate the fields that have been mapped
            Object.entries(mapping).forEach(([dbField, fileField]) => {
                if (fileField && row[fileField] !== undefined) {
                    // Convert empty strings to null for consistent display
                    const value = row[fileField];
                    newRow[dbField] =
                        typeof value === "string" && value.trim() === ""
                            ? null
                            : value;
                }
            });

            return newRow;
        });

        // Individual row validation
        const validatedMapped = mapped.map((row, index) => {
            const errors: string[] = [];

            // Check required fields
            if (!row.name) {
                errors.push(`${fieldLabels.name} is required`);
            }
            if (!row.customer_number) {
                errors.push(`${fieldLabels.customer_number} is required`);
            }
            if (!row.country_iso2) {
                errors.push(
                    `${fieldLabels.country_iso2} is required (e.g., US, GB, IL)`
                );
            }

            // Check country_iso2 length
            if (
                row.country_iso2 &&
                typeof row.country_iso2 === "string" &&
                row.country_iso2.length !== 2
            ) {
                errors.push(
                    `${fieldLabels.country_iso2} must be exactly 2 characters (e.g., US, GB, IL)`
                );
            }

            // Check state_iso2 length if provided
            if (
                row.state_iso2 &&
                typeof row.state_iso2 === "string" &&
                row.state_iso2.length !== 2
            ) {
                errors.push(
                    `${fieldLabels.state_iso2} must be exactly 2 characters (e.g., CA, NY, TX)`
                );
            }

            // Check email format if provided
            if (
                row.owner_email &&
                typeof row.owner_email === "string" &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.owner_email)
            ) {
                errors.push(
                    `${fieldLabels.owner_email} must be a valid email format`
                );
            }

            // Additional validation checks
            if (
                row.name &&
                typeof row.name === "string" &&
                row.name.trim().length < 2
            ) {
                errors.push(
                    `${fieldLabels.name} must be at least 2 characters long`
                );
            }

            if (
                row.postal_code &&
                typeof row.postal_code === "string" &&
                row.postal_code.trim().length < 3
            ) {
                errors.push(
                    `${fieldLabels.postal_code} must be at least 3 characters long`
                );
            }

            if (errors.length > 0) {
                return {
                    ...row,
                    status: "Validation Failed",
                    message: errors.join(", "),
                };
            } else {
                return {
                    ...row,
                    status: "Validated",
                    message:
                        "All fields validated successfully - Ready for import",
                };
            }
        });

        // Check if any rows have validation errors
        const hasValidationErrors = validatedMapped.some(
            (row) => row.status === "Validation Failed"
        );

        if (hasValidationErrors) {
            setValidationErrors([
                t("validation.some_records_have_errors", { ns: "import" }),
            ]);
        } else {
            setValidationErrors([]);
        }

        setMappedData(validatedMapped);

        // Validate business unit access and merge errors into validated data
        validateBusinessUnitAccess(validatedMapped).then(
            (businessUnitErrors) => {
                // Always update mapped data to ensure all rows have proper status and messages
                const updatedMapped = validatedMapped.map((row, index) => {
                    const buError = businessUnitErrors.get(index);
                    if (buError) {
                        // Business unit access error - mark as failed
                        const existingErrors =
                            row.status === "Validation Failed"
                                ? (row.message || "").split(", ")
                                : [];
                        return {
                            ...row,
                            status: "Validation Failed",
                            message: [...existingErrors, buError]
                                .filter(Boolean)
                                .join(", "),
                        };
                    }
                    // No business unit error - preserve existing status and message
                    return {
                        ...row,
                        status: row.status || "Validated",
                        message:
                            row.message ||
                            "All fields validated successfully - Ready for import",
                    };
                });
                setMappedData(updatedMapped);

                // Update validation errors state if any errors exist
                const hasErrors = updatedMapped.some(
                    (row) => row.status === "Validation Failed"
                );
                if (hasErrors) {
                    setValidationErrors([
                        t("validation.some_records_have_errors", {
                            ns: "import",
                        }),
                    ]);
                } else {
                    setValidationErrors([]);
                }
            }
        );
    };

    const handleSubmit = async () => {
        if (mappedData.length === 0) {
            showError(t("validation.no_data_to_submit", { ns: "import" }));
            return;
        }

        if (!validateMapping()) {
            showError(t("validation.validation_errors", { ns: "import" }));
            return;
        }

        // Check if ALL records have validation errors
        const recordsWithErrors = mappedData.filter(
            (row) => row.status === "Validation Failed"
        );
        if (recordsWithErrors.length === mappedData.length) {
            showError(
                t("validation.some_records_have_errors", { ns: "import" })
            );
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
                    import_type: ImportType.Customer,
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

            let allResults: ServerResult[] = [];
            let processedCount = 0;

            for (
                let batchIndex = 0;
                batchIndex < batches.length;
                batchIndex++
            ) {
                const batch = batches[batchIndex];

                const requestBody = {
                    jobId: jobId,
                    customers: batch.map(({ status, message, ...rest }) => {
                        // Map customer_number to temp__customer_number for backend compatibility
                        const { customer_number, ...otherFields } = rest;
                        return {
                            ...otherFields,
                            temp__customer_number: customer_number,
                        };
                    }),
                    fieldMapping: mapping,
                    fieldLabels: fieldLabels,
                    batchIndex: batchIndex,
                    globalStartIndex: processedCount,
                };

                const response = await apiFetch("/api/import/customer", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                });

                const result = await response.json();

                if (!response.ok) {
                    // Create failed results for this batch
                    const failedResults = batch.map((_, index) => ({
                        index: processedCount + index,
                        success: false,
                        message:
                            result?.error ||
                            result?.message ||
                            `Batch processing failed (${response.status})`,
                        originalCustomerNumber: batch[index]?.customer_number,
                    }));
                    allResults.push(...failedResults);
                    processedCount += batch.length;
                    continue; // Skip to next batch
                }

                if (result?.results && Array.isArray(result.results)) {
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
                        message:
                            result?.error ||
                            result?.message ||
                            "Batch processing failed",
                        originalCustomerNumber: batch[index]?.customer_number,
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
            } catch (err) {
                // Handle silently
            }

            // Invalidate last sync date cache to refresh the header
            try {
                const { invalidateLastSyncDate } = await import(
                    "@/utils/cacheUtils"
                );
                await invalidateLastSyncDate();
            } catch (_error) {
                // Error handled silently
            }

            // Ensure we have results for all records, even if API didn't return them
            if (allResults.length === 0 && mappedData.length > 0) {
                allResults = mappedData.map((row, index) => ({
                    index,
                    success: false,
                    message: "Import failed - no response from server",
                    originalCustomerNumber: row.customer_number,
                }));
            }

            if (allResults.length > 0) {
                setIsSubmitted(true);
                const updated = mappedData.map((row, index) => ({
                    ...row,
                    status: allResults[index]?.success
                        ? t("actions.results_imported", { ns: "import" })
                        : t("actions.results_import_failed", { ns: "import" }),
                    message: allResults[index]?.message || "",
                }));
                setMappedData(updated);

                // Show success message before redirecting
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

                // Redirect to result page with job ID only
                try {
                    await router.push(`/app/import/result?jobId=${jobId}`);
                } catch (redirectError) {
                    // Try alternative redirect method
                    window.location.href = `/app/import/result?jobId=${jobId}`;
                }
            } else {
                showError(t("fields.errors.submissionFailed"));
            }
        } catch (err) {
            showError(t("fields.errors.submissionFailed"));
            setImportStatus("error");
        } finally {
            setIsSubmitting(false);
            setImportProgress(100);
        }
    };

    useEffect(() => {
        if (parsedData.length > 0 && Object.keys(mapping).length > 0) {
            mapData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsedData, mapping]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case "s":
                        e.preventDefault();
                        if (!isSubmitting) handleSubmit();
                        break;
                    case "r":
                        e.preventDefault();
                        handleClear();
                        break;
                }
            }
        };

        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [isSubmitting]);

    return (
        <Box sx={{ width: "100%" }}>
            {/* File Upload Section */}
            <FileUploader
                onFileSelected={handleFileSelected}
                onClear={handleClear}
                selectedFile={selectedFile}
                isParsing={isParsing}
                fileInputRef={fileInputRef}
                uploadTitle={t("fields.file_handling_upload_customer_file", {
                    ns: "import",
                })}
            />

            {/* Field Mapping Section */}
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
                        importType={ImportType.Customer}
                        shouldAutoMap={Object.keys(mapping).length === 0}
                    />
                </Box>
            )}

            {/* Record Preview Section */}
            {mappedData.length > 0 && (
                <Box sx={{ mt: 4 }}>
                    <Paper elevation={1} sx={{ overflow: "hidden" }}>
                        <MappedDataGrid
                            key={t("fields.customer_fields.customer_number")}
                            rows={mappedData}
                            columns={databaseFields}
                            isLoading={isSubmitting}
                            isSubmitted={isSubmitted}
                            onSubmit={handleSubmit}
                            importStatus={importStatus}
                            fieldLabels={fieldLabels}
                            isParsing={isParsing}
                            currentRecordCount={currentRecordCount}
                            totalRecords={mappedData.length}
                            importProgress={importProgress}
                            validationErrors={validationErrors}
                        />
                    </Paper>
                </Box>
            )}
        </Box>
    );
};

export default CustomerProcessor;
