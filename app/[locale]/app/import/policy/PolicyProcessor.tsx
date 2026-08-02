"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Box } from "@mui/material";
import { ImportType } from "@/types/db";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useFileParser } from "@/shared/hooks/useFileParser";
import FieldMapper from "@/shared/layout-components/import/FieldMapper";
import FileUploader from "@/shared/layout-components/import/FileUploader";
import MappedDataGrid from "@/shared/layout-components/import/MappedDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface PolicyRow {
    [key: string]: string | number | null | boolean;
}

interface ServerResult {
    index: number;
    success: boolean;
    message?: string;
    customerId?: number;
    action?: string;
}

const POLICY_FIELDS = [
    "policy_number",
    "customer_number",
    "limit_type",
    "customer_number_policy",
    "approved_limit",
    "approved_limit_expiration_date",
    "approved_limit_currency",
    "max_payment_term",
    "payment_term_cutoff_day_of_month",
    "payment_term_substitute_day_of_month",
    "max_allowed_mep",
    "mep_cutoff_day_of_month",
    "mep_substitute_day_of_month",
    "reporting_days",
    "reporting_cutoff_day_of_month",
    "reporting_substitute_day_of_month",
    "credit_score",
    "credit_score_input_date",
    "active_customer_since",
    "policy_exclusion_reason",
] as const;

const REQUIRED_FIELDS = ["policy_number", "customer_number", "limit_type"] as const;

const PolicyProcessor: React.FC = () => {
    const { success, error: showError } = useToast();
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [mappedData, setMappedData] = useState<PolicyRow[]>([]);
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { parsedData, headers, parseFile, clear, isParsing } = useFileParser();
    const { t } = useTranslation(["import", "common"]);
    const router = useRouter();

    const databaseFields = useMemo(() => [...POLICY_FIELDS], []);

    const convertToNumber = (value: unknown): number | null => {
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
            return Number.isNaN(parsed) ? null : parsed;
        }
        return null;
    };

    const convertToDateString = (value: unknown): string | null => {
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
            return Number.isNaN(date.getTime())
                ? null
                : date.toISOString().slice(0, 10);
        }
        if (typeof value === "number") {
            const date = new Date(value);
            return Number.isNaN(date.getTime())
                ? null
                : date.toISOString().slice(0, 10);
        }
        return null;
    };

    const fieldLabels = useMemo(() => {
        const labels: Record<string, string> = {};
        POLICY_FIELDS.forEach((field) => {
            labels[field] = t(`fields.policy_fields_${field}`, { ns: "import" });
        });
        return labels;
    }, [t]);

    const fieldDescriptions = useMemo(() => {
        const descriptions: Record<string, { type: string; description: string }> =
            {};
        POLICY_FIELDS.forEach((field) => {
            const typeKey = `fields.policy_fields_${field}_type`;
            const typeTranslation = t(typeKey, { ns: "import" });
            const type =
                typeTranslation !== typeKey
                    ? typeTranslation
                    : field.includes("date")
                      ? "date"
                      : [
                                "approved_limit",
                                "max_payment_term",
                                "payment_term_cutoff_day_of_month",
                                "payment_term_substitute_day_of_month",
                                "max_allowed_mep",
                                "mep_cutoff_day_of_month",
                                "mep_substitute_day_of_month",
                                "reporting_days",
                                "reporting_cutoff_day_of_month",
                                "reporting_substitute_day_of_month",
                            ].includes(field)
                          ? "number"
                          : "string";

            descriptions[field] = {
                type,
                description: t(`fields.policy_fields_${field}_description`, {
                    ns: "import",
                }),
            };
        });
        return descriptions;
    }, [t]);

    const exampleValues = useMemo(
        (): Record<string, string | number | boolean> => ({
            policy_number: "POL-2026-001",
            customer_number: "12345",
            limit_type: "DCL",
            customer_number_policy: "POL-CUST-99",
            approved_limit: 50000,
            approved_limit_expiration_date: "2026-12-31",
            approved_limit_currency: "USD",
            max_payment_term: 60,
            payment_term_cutoff_day_of_month: 24,
            payment_term_substitute_day_of_month: 2,
            max_allowed_mep: 10000,
            mep_cutoff_day_of_month: 24,
            mep_substitute_day_of_month: 2,
            reporting_days: 30,
            reporting_cutoff_day_of_month: "",
            reporting_substitute_day_of_month: "",
            credit_score: "A",
            credit_score_input_date: "2026-01-15",
            active_customer_since: "2020-06-01",
            policy_exclusion_reason: "",
        }),
        []
    );

    const isValidLimitType = (value: unknown): boolean => {
        if (value === null || value === undefined || value === "") {
            return false;
        }
        const normalized = String(value).trim().toUpperCase();
        return normalized === "DCL" || normalized === "NAMED";
    };

    const handleFileSelected = useCallback(
        async (file: File) => {
            setSelectedFile(file);
            setMapping({});
            setMappedData([]);
            await parseFile(file);
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
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }, [clear]);

    const validateCustomerBusinessUnitAccess = async (rows: PolicyRow[]) => {
        const customerNumbers = Array.from(
            new Set(
                rows
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
                    body: JSON.stringify({ customerNumbers }),
                }
            );

            if (!response.ok) {
                return;
            }

            const result = await response.json();
            const validationResults = result.items || result.data || [];
            const accessMap = new Map<
                string,
                { hasAccess: boolean; externalId: string | null }
            >();
            validationResults.forEach(
                (item: {
                    customerNumber: string;
                    hasAccess: boolean;
                    businessUnitExternalId: string | null;
                }) => {
                    accessMap.set(item.customerNumber, {
                        hasAccess: item.hasAccess,
                        externalId: item.businessUnitExternalId,
                    });
                }
            );

            const updatedMapped = rows.map((row) => {
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
        } catch (err) {
            console.error(
                "[PolicyProcessor] Error validating customer business unit access:",
                err
            );
        }
    };

    const mapData = () => {
        if (!parsedData.length) return;

        const mapped = parsedData.map((row) => {
            const newRow: PolicyRow = {};
            Object.entries(mapping).forEach(([dbField, fileField]) => {
                if (fileField && row[fileField] !== undefined) {
                    let value: string | number | boolean | null = row[fileField];

                    const fieldType =
                        fieldDescriptions[dbField]?.type ?? "string";

                    if (fieldType === "number") {
                        value = convertToNumber(value);
                    } else if (fieldType === "date") {
                        value = convertToDateString(value);
                    } else if (fieldType === "string") {
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

        const validatedMapped = mapped.map((row) => {
            const errors: string[] = [];

            REQUIRED_FIELDS.forEach((field) => {
                if (!row[field]) {
                    errors.push(
                        t("validation.required_field_missing", {
                            ns: "import",
                            field: fieldLabels[field] || field,
                        })
                    );
                }
            });

            if (row.limit_type && !isValidLimitType(row.limit_type)) {
                errors.push(
                    t("validation.invalid_limit_type", { ns: "import" })
                );
            }

            if (errors.length > 0) {
                return {
                    ...row,
                    status: "Validation Failed",
                    message: errors.join(", "),
                };
            }

            return {
                ...row,
                status: "Validated",
                message:
                    "All fields validated successfully - Ready for import",
            };
        });

        setMappedData(validatedMapped);
        void validateCustomerBusinessUnitAccess(validatedMapped);
    };

    const handleSubmit = useCallback(async () => {
        if (mappedData.length === 0) {
            showError(t("validation.no_data_to_submit", { ns: "import" }));
            return;
        }

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
            const jobResponse = await apiFetch("/api/import/job/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    import_type: ImportType.Policy,
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
            const createdJobId = jobData.jobId;

            if (!createdJobId) {
                throw new Error("Failed to create import job");
            }

            setJobId(createdJobId);

            const BATCH_SIZE = 20;
            const batches: PolicyRow[][] = [];

            for (let i = 0; i < mappedData.length; i += BATCH_SIZE) {
                batches.push(mappedData.slice(i, i + BATCH_SIZE));
            }

            const allResults: ServerResult[] = [];
            let processedCount = 0;

            for (
                let batchIndex = 0;
                batchIndex < batches.length;
                batchIndex++
            ) {
                const batch = batches[batchIndex];

                const requestBody = {
                    jobId: createdJobId,
                    policies: batch.map(
                        ({ status: _status, message: _message, ...rest }) =>
                            rest
                    ),
                    fieldMapping: mapping,
                    fieldLabels,
                    batchIndex,
                    globalStartIndex: processedCount,
                };

                const response = await apiFetch("/api/import/policy", {
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
                    const adjustedResults = result.results.map(
                        (r: ServerResult) => ({
                            ...r,
                            index: r.index + processedCount,
                        })
                    );
                    allResults.push(...adjustedResults);
                    processedCount += batch.length;
                } else {
                    const failedResults = batch.map((_, index) => ({
                        index: processedCount + index,
                        success: false,
                        message: "Batch processing failed",
                    }));
                    allResults.push(...failedResults);
                    processedCount += batch.length;
                }

                setImportProgress(((batchIndex + 1) / batches.length) * 100);
                setCurrentRecordCount(processedCount);
            }

            try {
                await apiFetch("/api/import/job/complete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ jobId: createdJobId }),
                });
            } catch {
                // Job completion is best-effort; batch handler may have already finalized.
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

                const successCount = allResults.filter((r) => r.success).length;
                const failedCount = allResults.length - successCount;

                if (failedCount === 0) {
                    const successMessage = t("messages.import_success", {
                        ns: "import",
                        count: successCount,
                    });
                    success(successMessage);
                } else if (successCount === 0) {
                    showError(
                        t("messages.import_failed", {
                            ns: "import",
                            count: failedCount,
                        })
                    );
                } else {
                    showError(
                        t("messages.import_partial", {
                            ns: "import",
                            success: successCount,
                            failed: failedCount,
                        })
                    );
                }

                router.push(`/app/import/result?jobId=${createdJobId}`);
            }
        } catch {
            showError(t("messages.errors_submission_failed", { ns: "import" }));
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
    }, [parsedData, mapping, fieldDescriptions]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (
            urlParams.has("jobId") ||
            urlParams.has("successCount") ||
            urlParams.has("results")
        ) {
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
                uploadTitle={t("fields.file_handling_upload_policy_file", {
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
                        importType={ImportType.Policy}
                        shouldAutoMap
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

export default PolicyProcessor;
