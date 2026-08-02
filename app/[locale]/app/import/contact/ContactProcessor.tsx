"use client";

import { Box } from "@mui/material";
import { ImportType } from "@/types/db";
import { useRouter } from "next/navigation";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";

import { useFileParser } from "@/shared/hooks/useFileParser";
import FieldMapper from "@/shared/layout-components/import/FieldMapper";
import FileUploader from "@/shared/layout-components/import/FileUploader";
import MappedDataGrid from "@/shared/layout-components/import/MappedDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    getEnabledFields,
    mergeWithDefaults,
    GENERIC_FIELD_DB_COLUMNS,
    getFieldType,
} from "@/utils/genericFieldUtils";

interface ContactRow {
    [key: string]: string | number | null | boolean;
}

interface ServerResult {
    index: number;
    success: boolean;
    message?: string;
    contactId?: number;
}

const BASE_CONTACT_FIELDS = [
    "first_name",
    "last_name",
    "customer_number",
    "email",
    "phone",
    "mobile",
    "role",
    "company_wide_address",
    "receives_standard_reminder",
    "receives_escalated_reminder",
] as const;

const ContactProcessor: React.FC = () => {
    const { success, error: showError } = useToast();
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [mappedData, setMappedData] = useState<ContactRow[]>([]);
    const [serverResults, setServerResults] = useState<ServerResult[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [importStatus, setImportStatus] = useState<
        "idle" | "loading" | "success" | "partial" | "error"
    >("idle");
    const [importProgress, setImportProgress] = useState(0);
    const [currentRecordCount, setCurrentRecordCount] = useState(0);
    const [jobId, setJobId] = useState<string | null>(null);
    const [isAutoMapping, setIsAutoMapping] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data: session } = useSession();
    const accountId = session?.user?.account_id as number | undefined;

    const { data: accountData } = useQuery({
        queryKey: ["account", accountId],
        queryFn: async () => {
            const res = await api.get(`/api/entities/accounts/${accountId}`);
            return res.data;
        },
        enabled: !!accountId,
    });

    const genericConfig = useMemo(
        () => mergeWithDefaults(accountData?.generic_field_config),
        [accountData?.generic_field_config]
    );

    const enabledContactGenericFields = useMemo(
        () => getEnabledFields(genericConfig, "contact"),
        [genericConfig]
    );

    const contactGenericDbColumns = useMemo(
        () =>
            enabledContactGenericFields.map(
                (key) => GENERIC_FIELD_DB_COLUMNS[key]
            ),
        [enabledContactGenericFields]
    );

    const databaseFields = useMemo(
        () => [...BASE_CONTACT_FIELDS, ...contactGenericDbColumns],
        [contactGenericDbColumns]
    );
    const { parsedData, headers, parseFile, clear, isParsing, error } =
        useFileParser();
    const { t, i18n } = useTranslation(["import", "common"]);
    const router = useRouter();

    // Helper functions for type conversion
    const convertToBoolean = (value: any): boolean => {
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string") {
            const lowerValue = value.toLowerCase().trim();
            return (
                lowerValue === "true" ||
                lowerValue === "1" ||
                lowerValue === "yes" ||
                lowerValue === "y" ||
                lowerValue === "on" ||
                lowerValue === "enabled" ||
                lowerValue === "active"
            );
        }
        if (typeof value === "number") {
            return value === 1;
        }
        return false;
    };

    const convertToNumber = (value: any): number | null => {
        if (typeof value === "number") {
            return value;
        }
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (
                trimmed === "" ||
                trimmed === "null" ||
                trimmed === "undefined"
            ) {
                return null;
            }
            const parsed = parseFloat(trimmed);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    };

    const convertToDateString = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === "string") {
            const trimmed = value.trim();
            if (
                trimmed === "" ||
                trimmed === "null" ||
                trimmed === "undefined"
            ) {
                return null;
            }
            const date = new Date(trimmed);
            return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
        }
        if (typeof value === "number") {
            const date = new Date(value);
            return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
        }
        return null;
    };

    const fieldLabels = useMemo(() => {
        const base: Record<string, string> = {
            first_name: t("fields.contact_fields_first_name", { ns: "import" }),
            last_name: t("fields.contact_fields_last_name", { ns: "import" }),
            customer_number: t("fields.contact_fields_customer_number", {
                ns: "import",
            }),
            email: t("fields.contact_fields_email", { ns: "import" }),
            phone: t("fields.contact_fields_phone", { ns: "import" }),
            mobile: t("fields.contact_fields_mobile", { ns: "import" }),
            role: t("fields.contact_fields_role", { ns: "import" }),
            company_wide_address: t("fields.contact_fields_company_wide_address", {
                ns: "import",
            }),
            receives_standard_reminder: t(
                "fields.contact_fields_receives_standard_reminder",
                { ns: "import" }
            ),
            receives_escalated_reminder: t(
                "fields.contact_fields_receives_escalated_reminder",
                { ns: "import" }
            ),
        };
        enabledContactGenericFields.forEach((fieldKey) => {
            const dbCol = GENERIC_FIELD_DB_COLUMNS[fieldKey];
            base[dbCol] = genericConfig.contact[fieldKey].label;
        });
        return base;
    }, [t, enabledContactGenericFields, genericConfig]);

    const fieldDescriptions = useMemo(() => {
        const base: Record<
            string,
            { type: string; description: string }
        > = {
            first_name: {
                type: "string",
                description: t("fields.contact_fields_first_name_description", {
                    ns: "import",
                }),
            },
            last_name: {
                type: "string",
                description: t("fields.contact_fields_last_name_description", {
                    ns: "import",
                }),
            },
            customer_number: {
                type: "string",
                description: t(
                    "fields.contact_fields_customer_number_description",
                    { ns: "import" }
                ),
            },
            email: {
                type: "string",
                description: t("fields.contact_fields_email_description", {
                    ns: "import",
                }),
            },
            phone: {
                type: "string",
                description: t("fields.contact_fields_phone_description", {
                    ns: "import",
                }),
            },
            mobile: {
                type: "string",
                description: t("fields.contact_fields_mobile_description", {
                    ns: "import",
                }),
            },
            role: {
                type: "string",
                description: t("fields.contact_fields_role_description", {
                    ns: "import",
                }),
            },
            company_wide_address: {
                type: "boolean",
                description: t(
                    "fields.contact_fields_company_wide_address_description",
                    { ns: "import" }
                ),
            },
            receives_standard_reminder: {
                type: "boolean",
                description: t(
                    "fields.contact_fields_receives_standard_reminder_description",
                    { ns: "import" }
                ),
            },
            receives_escalated_reminder: {
                type: "boolean",
                description: t(
                    "fields.contact_fields_receives_escalated_reminder_description",
                    { ns: "import" }
                ),
            },
        };
        enabledContactGenericFields.forEach((fieldKey) => {
            const dbCol = GENERIC_FIELD_DB_COLUMNS[fieldKey];
            const fieldType = getFieldType(fieldKey);
            base[dbCol] = {
                type: fieldType,
                description: genericConfig.contact[fieldKey].label,
            };
        });
        return base;
    }, [t, enabledContactGenericFields, genericConfig]);

    const exampleValues = useMemo(() => {
        const base: Record<string, string | number | boolean> = {
            first_name: "John",
            last_name: "Doe",
            customer_number: "12345",
            email: "john.doe@example.com",
            phone: "+1234567890",
            mobile: "+19876543210",
            role: "Manager",
            company_wide_address: false,
            receives_standard_reminder: true,
            receives_escalated_reminder: false,
        };
        enabledContactGenericFields.forEach((fieldKey) => {
            const dbCol = GENERIC_FIELD_DB_COLUMNS[fieldKey];
            const fieldType = getFieldType(fieldKey);
            if (fieldType === "number") base[dbCol] = 100;
            else if (fieldType === "date") base[dbCol] = "2026-02-15";
            else base[dbCol] = "Example";
        });
        return base;
    }, [enabledContactGenericFields]);

    const handleFileSelected = useCallback(
        async (file: File) => {
            setSelectedFile(file);

            // Clear existing mapping and data when new file is selected
            setMapping({});
            setMappedData([]);

            // Parse the file first
            await parseFile(file);

            // Let FieldMapper handle all mapping logic including auto-mapping
        },
        [parseFile]
    );

    const handleClear = useCallback(() => {
        setSelectedFile(null);
        setMapping({});
        setMappedData([]);
        setServerResults([]);
        setIsSubmitted(false);
        setImportProgress(0);
        setCurrentRecordCount(0);
        setJobId(null);
        clear();
        // Use ref instead of document.getElementById to avoid null reference errors
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [clear]);

    const mapData = () => {
        if (!parsedData.length) return;

        const mapped = parsedData.map((row) => {
            const newRow: ContactRow = {};
            Object.entries(mapping).forEach(([dbField, fileField]) => {
                if (fileField && row[fileField] !== undefined) {
                    let value = row[fileField];

                    // Convert boolean fields properly
                    if (
                        fieldDescriptions[
                            dbField as keyof typeof fieldDescriptions
                        ]?.type === "boolean"
                    ) {
                        value = convertToBoolean(value);
                    }
                    // Convert number fields properly
                    else if (
                        fieldDescriptions[
                            dbField as keyof typeof fieldDescriptions
                        ]?.type === "number"
                    ) {
                        value = convertToNumber(value);
                    }
                    // Convert date fields to YYYY-MM-DD
                    else if (
                        fieldDescriptions[
                            dbField as keyof typeof fieldDescriptions
                        ]?.type === "date"
                    ) {
                        value = convertToDateString(value);
                    }
                    // Convert string fields and trim whitespace
                    else if (
                        fieldDescriptions[
                            dbField as keyof typeof fieldDescriptions
                        ]?.type === "string"
                    ) {
                        value =
                            typeof value === "string"
                                ? value.trim()
                                : String(value).trim();
                    }

                    newRow[dbField] = value;
                }
            });
            return newRow;
        });

        // Individual row validation
        const validatedMapped = mapped.map((row, _index) => {
            const errors: string[] = [];

            // Check required fields
            if (!row.first_name) {
                errors.push(`First name is required`);
            }
            if (!row.last_name) {
                errors.push(`Last name is required`);
            }
            if (!row.customer_number) {
                errors.push(`Customer number is required`);
            }

            // Check email format if provided
            if (
                row.email &&
                typeof row.email === "string" &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
            ) {
                errors.push(`Invalid email format`);
            }

            // Check name length
            if (
                row.first_name &&
                typeof row.first_name === "string" &&
                row.first_name.trim().length < 2
            ) {
                errors.push(`First name must be at least 2 characters long`);
            }

            if (
                row.last_name &&
                typeof row.last_name === "string" &&
                row.last_name.trim().length < 2
            ) {
                errors.push(`Last name must be at least 2 characters long`);
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
            // Note: ContactProcessor doesn't have validationErrors state, so we'll handle this in handleSubmit
        }

        setMappedData(validatedMapped);

        // Validate business unit access for customers
        validateCustomerBusinessUnitAccess(validatedMapped);
    };

    const validateCustomerBusinessUnitAccess = async (
        mappedData: ContactRow[]
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
                        customerNumbers,
                    }),
                }
            );

            if (!response.ok) {
                console.error(
                    "[ContactProcessor] Failed to validate customer business unit access"
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

                const accessResult = accessMap.get(String(customerNumber));
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
                        status: "Validation Failed",
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
                "[ContactProcessor] Error validating customer business unit access:",
                error
            );
        }
    };

    const handleSubmit = useCallback(async () => {
        if (mappedData.length === 0) {
            showError(t("validation.no_data_to_submit", { ns: "import" }));
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
        setServerResults([]);
        setImportProgress(0);
        setCurrentRecordCount(0);
        setImportStatus("loading");

        try {
            // Create a single import job for all records first
            const jobResponse = await apiFetch("/api/import/job/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    import_type: ImportType.Contact,
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
                    contacts: batch.map(
                        ({ status: _status, message: _message, ...rest }) =>
                            rest
                    ),
                    fieldMapping: mapping,
                    fieldLabels: fieldLabels,
                    batchIndex: batchIndex,
                    globalStartIndex: processedCount,
                };

                // Debug log removed

                const response = await apiFetch("/api/import/contact", {
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
                        message: "Batch processing failed",
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

            // Invalidate customer cache to refresh the header
            try {
                const { invalidateLastSyncDate } = await import(
                    "@/utils/cacheUtils"
                );
                await invalidateLastSyncDate();
            } catch (error) {
                console.error("Error invalidating customer cache:", error);
            }

            if (allResults.length > 0) {
                setIsSubmitted(true);
                const updated = mappedData.map((row, index) => ({
                    ...row,
                    status: allResults[index]?.success ? "Success" : "Failed",
                    message: allResults[index]?.message || "",
                }));
                setMappedData(updated);
                setServerResults(allResults);

                // Show success message before redirecting
                const successCount = allResults.filter(
                    (result: any) => result.success
                ).length;
                const failedCount = allResults.length - successCount;

                if (failedCount === 0) {
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
                    showError(finalMessage);
                }

                // Redirect to result page with job ID only
                router.push(`/app/import/result?jobId=${jobId}`);
            }
        } catch (_err) {
            showError(t("fields.errors.submissionFailed"));
            setImportStatus("error");
        } finally {
            setIsSubmitting(false);
            setImportProgress(100);
        }
    }, [mappedData, mapping, fieldLabels, showError, success, t, router]);

    useEffect(() => {
        if (parsedData.length > 0) {
            if (Object.keys(mapping).length > 0) {
                mapData();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [parsedData, mapping, fieldDescriptions]);

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
                uploadTitle={t("fields.file_handling_upload_contact_file", {
                    ns: "import",
                })}
            />

            {parsedData.length > 0 && (
                <Box sx={{ mt: 4 }}>
                    <FieldMapper
                        rawHeaders={headers}
                        databaseFields={databaseFields}
                        fieldLabels={fieldLabels}
                        mapping={mapping}
                        setMapping={setMapping}
                        fieldDescriptions={fieldDescriptions}
                        exampleValues={exampleValues}
                        importType={ImportType.Contact}
                        shouldAutoMap={true}
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

export default ContactProcessor;
