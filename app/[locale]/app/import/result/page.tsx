"use client";
import { apiFetch } from "@/utils/apiFetch";

import {
    ArrowBack as ArrowBackIcon,
    Cancel as CancelIcon,
    CheckCircle as CheckCircleIcon,
    Contacts as ContactsIcon,
    FilePresent as FilePresentIcon,
    Home as HomeIcon,
    InfoOutlined as InfoOutlinedIcon,
    Payment as PaymentIcon,
    People as PeopleIcon,
    Receipt as ReceiptIcon,
    Shield as ShieldIcon
} from "@mui/icons-material";
import {
    Alert,
    Box,
    Card,
    CardContent,
    CircularProgress,
    Container,
    IconButton,
    Tooltip,
    Typography,
    useTheme
} from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import FilterChip from "@/shared/layout-components/import/FilterChip";
import { CurrencyColumnsConfig, ExportFormat } from "@/shared/utility/exportToExcel";
import { translateImportMessage } from "@/shared/utils/translateImportMessage";

interface ImportResult {
    index: number;
    success: boolean;
    message?: string;
    invoiceId?: number;
    customerId?: number;
    originalInvoiceNumber?: string;
    validationErrors?: Record<string, unknown>;
    processingErrors?: Record<string, unknown>;
    originalData?: Record<string, unknown>;
}

interface SuccessPageProps {
    searchParams?: Promise<{
        successCount?: string;
        totalCount?: string;
        failedCount?: string;
        results?: string;
        originalData?: string;
        fieldLabels?: string;
        jobId?: string;
        importType?: string;
    }>;
}

const SuccessPage: React.FC<SuccessPageProps> = ({ searchParams }) => {
    const { t, i18n } = useTranslation(["import", "common", "customers"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const urlSearchParams = useSearchParams();
    const theme = useTheme();
    const windowWidth = useWindowWidth();
    const headerRef = React.useRef<HTMLDivElement>(null);
    const isHebrewUser = i18n.language === "he";

    // Ensure proper language loading
    React.useEffect(() => {
        if (
            i18n.language !== "he" &&
            window.location.pathname.includes("/he/")
        ) {
            i18n.changeLanguage("he");
        }
    }, [i18n]);

    const [results, setResults] = useState<ImportResult[]>([]);
    const [originalData, setOriginalData] = useState<Record<string, unknown>[]>(
        []
    );
    const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
    const [successCount, setSuccessCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [statusFilter, setStatusFilter] = useState<
        "all" | "success" | "failed"
    >("all");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [importType, setImportType] = useState<string>("Invoice");
    const [customerInfo, setCustomerInfo] = useState<
        Record<string, { name: string; customerId: number }>
    >({});
    const [customerAccess, setCustomerAccess] = useState<
        Record<string, boolean>
    >({});
    const [replayStats, setReplayStats] = useState<{
        customersAffected: number;
        eventsApplied: number;
        paymentsLinked: number;
        deferredRemaining: number;
    } | null>(null);

    useEffect(() => {
        const loadData = async () => {
            const resolvedSearchParams = await searchParams;
            const jobId =
                urlSearchParams?.get("jobId") || resolvedSearchParams?.jobId;

            if (jobId) {
                setIsLoading(true);
                setError(null);

                try {
                    const response = await apiFetch(`/api/import/job/${jobId}`);

                    if (!response.ok) {
                        throw new Error(
                            `Failed to fetch import job: ${response.statusText}`
                        );
                    }

                    const jobData = await response.json();

                    if (jobData.import_type) {
                        setImportType(jobData.import_type);
                    }

                    if (jobData.records && jobData.records.length > 0) {
                        // Helper function to extract error message from error objects
                        const extractErrorMessage = (errorObj: any): string => {
                            if (!errorObj?.errors) return "";

                            const errors = errorObj.errors;
                            if (typeof errors === "string") {
                                return errors
                                    .split(",")
                                    .map((msg: string) => msg.trim())
                                    .join(", ");
                            }
                            if (Array.isArray(errors)) {
                                return errors.join(", ");
                            }
                            if (typeof errors === "object") {
                                const errorMessages: string[] = [];
                                if (errors.message)
                                    errorMessages.push(String(errors.message));
                                if (errors.error)
                                    errorMessages.push(String(errors.error));
                                return errorMessages.length > 0
                                    ? errorMessages.join(", ")
                                    : JSON.stringify(errors);
                            }
                            return String(errors);
                        };

                        // Use results array from API if available (has customerId), otherwise build from records
                        let resultsFromDatabase: ImportResult[];
                        if (jobData.results && jobData.results.length > 0) {
                            resultsFromDatabase = jobData.results.map(
                                (result: any) => ({
                                    index: result.index,
                                    success: result.success,
                                    message:
                                        result.message ||
                                        "No message available",
                                    originalData: result.originalData || {},
                                    ...(result.deferred && {
                                        deferred: result.deferred,
                                    }),
                                    ...(result.skipped && {
                                        skipped: result.skipped,
                                    }),
                                    ...(result.invoiceId && {
                                        invoiceId: result.invoiceId,
                                    }),
                                    ...(result.customerId && {
                                        customerId: result.customerId,
                                    }),
                                    ...(result.originalInvoiceNumber && {
                                        originalInvoiceNumber:
                                            result.originalInvoiceNumber,
                                    }),
                                })
                            );
                        } else {
                            // Fallback: build from records
                            resultsFromDatabase = jobData.records.map(
                                (record: any) => {
                                    let message =
                                        record.result_message ||
                                        "No message available";

                                    if (record.validation_errors?.errors) {
                                        message = extractErrorMessage(
                                            record.validation_errors
                                        );
                                    } else if (
                                        record.processing_errors?.errors
                                    ) {
                                        message = extractErrorMessage(
                                            record.processing_errors
                                        );
                                    }

                                    const isSuccess =
                                        record.status === "Success" ||
                                        record.status === "Validated";
                                    const originalData =
                                        record.original_data || {};

                                    return {
                                        index: record.row_index,
                                        success: isSuccess,
                                        message,
                                        originalData,
                                        ...(record.entity_id &&
                                            jobData.import_type ===
                                            "Invoice" && {
                                            invoiceId: record.entity_id,
                                        }),
                                        ...(record.entity_id &&
                                            (jobData.import_type ===
                                                "Customer" ||
                                                jobData.import_type ===
                                                    "Policy") && {
                                                customerId: record.entity_id,
                                            }),
                                        ...(originalData?.invoice_number && {
                                            originalInvoiceNumber:
                                                originalData.invoice_number,
                                        }),
                                    };
                                }
                            );
                        }

                        setResults(resultsFromDatabase);

                        // Set original data from records
                        const originalDataFromRecords = jobData.records.map(
                            (record: any) => record.original_data || {}
                        );
                        setOriginalData(originalDataFromRecords);

                        const total = jobData.records.length;
                        const successful = jobData.records.filter(
                            (r: any) =>
                                r.status === "Success" ||
                                r.status === "Validated"
                        ).length;
                        const failed = jobData.records.filter(
                            (r: any) => r.status === "Failed"
                        ).length;
                        setTotalCount(total);
                        setSuccessCount(successful);
                        setFailedCount(failed);
                    } else {
                        setSuccessCount(jobData.statistics?.successful || 0);
                        setFailedCount(jobData.statistics?.failed || 0);
                        setTotalCount(jobData.statistics?.total || 0);
                    }

                    if (jobData.metadata?.field_labels) {
                        setFieldLabels(jobData.metadata.field_labels);
                    }

                    if (jobData.metadata?.replayStats) {
                        setReplayStats(jobData.metadata.replayStats);
                    }

                    // Set customer info from API response
                    if (jobData.customer_info) {
                        setCustomerInfo(jobData.customer_info);
                    }

                    // Fetch customer access information
                    const allCustomerNumbers = new Set<string>();
                    if (jobData.records) {
                        jobData.records.forEach((record: any) => {
                            const customerNumber =
                                record.original_data?.customer_number ||
                                record.original_data?.temp__customer_number;
                            if (customerNumber) {
                                allCustomerNumbers.add(customerNumber);
                            }
                        });
                    }
                    if (jobData.results) {
                        jobData.results.forEach((result: any) => {
                            const customerNumber =
                                result.originalData?.customer_number ||
                                result.originalData?.temp__customer_number;
                            if (customerNumber) {
                                allCustomerNumbers.add(customerNumber);
                            }
                        });
                    }

                    // Check access for all customer numbers
                    if (allCustomerNumbers.size > 0) {
                        try {
                            const accessResponse = await apiFetch("/api/customers/validate-business-unit-access",
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                        customerNumbers:
                                            Array.from(allCustomerNumbers),
                                    }),
                                }
                            );
                            if (accessResponse.ok) {
                                const accessData = await accessResponse.json();
                                const accessMap: Record<string, boolean> = {};
                                if (accessData.data) {
                                    accessData.data.forEach((item: any) => {
                                        accessMap[item.customerNumber] =
                                            item.hasAccess;
                                    });
                                }
                                setCustomerAccess(accessMap);
                            }
                        } catch (err) {
                            console.error(
                                "[Import Result] Error fetching customer access:",
                                err
                            );
                            // If access check fails, default to showing all (fail open)
                        }
                    }

                    if (jobData.results) {
                        const originalDataFromRecords = jobData.results.map(
                            (result: any) => {
                                return result.originalData || {};
                            }
                        );
                        setOriginalData(originalDataFromRecords);
                    }
                } catch (err) {
                    console.error("[Import Result] Error in loadData:", err);
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Failed to load import results"
                    );
                } finally {
                    setIsLoading(false);
                }
            } else {
                const resultsParam =
                    urlSearchParams?.get("results") ||
                    resolvedSearchParams?.results;
                const successCountParam =
                    urlSearchParams?.get("successCount") ||
                    resolvedSearchParams?.successCount;
                const totalCountParam =
                    urlSearchParams?.get("totalCount") ||
                    resolvedSearchParams?.totalCount;
                const failedCountParam =
                    urlSearchParams?.get("failedCount") ||
                    resolvedSearchParams?.failedCount;
                const originalDataParam =
                    urlSearchParams?.get("originalData") ||
                    resolvedSearchParams?.originalData;
                const fieldLabelsParam =
                    urlSearchParams?.get("fieldLabels") ||
                    resolvedSearchParams?.fieldLabels;
                const importTypeParam =
                    urlSearchParams?.get("importType") ||
                    resolvedSearchParams?.importType;

                if (importTypeParam) {
                    setImportType(importTypeParam);
                }

                if (resultsParam) {
                    try {
                        const parsedResults = JSON.parse(
                            decodeURIComponent(resultsParam)
                        );
                        setResults(parsedResults);
                    } catch (error) {
                        // Silent error handling for parsing
                    }
                }

                if (successCountParam && totalCountParam && failedCountParam) {
                    setSuccessCount(parseInt(successCountParam, 10));
                    setTotalCount(parseInt(totalCountParam, 10));
                    setFailedCount(parseInt(failedCountParam, 10));
                } else if (resultsParam) {
                    try {
                        const parsedResults = JSON.parse(
                            decodeURIComponent(resultsParam)
                        );
                        const total = parsedResults.length;
                        const successful = parsedResults.filter(
                            (result: ImportResult) => result.success
                        ).length;
                        const failed = parsedResults.filter(
                            (result: ImportResult) => !result.success
                        ).length;

                        setTotalCount(total);
                        setSuccessCount(successful);
                        setFailedCount(failed);
                    } catch (error) {
                        // Silent error handling for parsing
                    }
                }

                if (originalDataParam) {
                    try {
                        const parsedOriginalData = JSON.parse(
                            decodeURIComponent(originalDataParam)
                        );
                        setOriginalData(parsedOriginalData);
                    } catch (error) {
                        // Silent error handling for parsing
                    }
                }

                if (fieldLabelsParam) {
                    try {
                        const parsedFieldLabels = JSON.parse(
                            decodeURIComponent(fieldLabelsParam)
                        );
                        setFieldLabels(parsedFieldLabels);
                    } catch (error) {
                        // Silent error handling for parsing
                    }
                }
            }
        };

        loadData();
    }, [urlSearchParams, searchParams]);

    useEffect(() => {
        setStatusFilter("all");
    }, []);

    const mergedData = useMemo(() => {
        const merged = results.map((result, index) => {
            const originalRow = originalData[index] || {};
            const mergedRow = {
                ...originalRow,
                ...result,
                index: result.index,
            };

            return mergedRow;
        });

        return merged;
    }, [results, originalData]);

    const filteredMergedData = useMemo(() => {
        const filtered = mergedData.filter((result) => {
            if (statusFilter === "all") return true;
            if (statusFilter === "success") return result.success;
            if (statusFilter === "failed") return !result.success;
            return true;
        });

        return filtered;
    }, [mergedData, statusFilter]);

    const filteredTotalCount = filteredMergedData.length;
    const filteredSuccessCount = filteredMergedData.filter(
        (result) => result.success
    ).length;
    const filteredFailedCount = filteredMergedData.filter(
        (result) => !result.success
    ).length;

    const handleChipClick = (filterType: "all" | "success" | "failed") => {
        setStatusFilter(filterType);
    };

    // Helper function to get all unique fields from originalData
    const getAllFields = useMemo(() => {
        const allFields = new Set<string>();
        originalData.forEach((row) => {
            Object.keys(row).forEach((key) => allFields.add(key));
        });
        return Array.from(allFields).sort();
    }, [originalData]);

    const generateColumns = useMemo((): GridColDef[] => {
        const columns: GridColDef[] = [];

        columns.push({
            field: "message",
            headerName: t("fields.results_message", { ns: "import" }),
            width: 200,
            flex: 1,
            minWidth: 120,
            renderCell: (params) => {
                let displayMessage = params.value || "-";
                const isSuccess = params.row.success;

                // Function to translate a message key
                const translateMessage = (msg: string): string => {
                    if (!msg || typeof msg !== "string") return msg;

                    // Check if message contains a colon separator for parameters (e.g., "import.validation.businessUnitAccessDenied:BU-001")
                    // or error messages (e.g., "import.results.processingFailed: <error message>")
                    if (msg.includes(":")) {
                        const colonIndex = msg.indexOf(":");
                        const keyPart = msg.substring(0, colonIndex);
                        const valuePart = msg.substring(colonIndex + 1);
                        const trimmedKey = keyPart.trim();
                        const trimmedValue = valuePart.trim();

                        // Strip namespace prefix if present
                        let keyWithoutNamespace = trimmedKey;
                        if (trimmedKey.startsWith("import.")) {
                            keyWithoutNamespace = trimmedKey.substring(7); // Remove "import." prefix
                        }

                        // Special handling for processingFailed - show the error message directly
                        if (
                            trimmedKey.includes("processingFailed") ||
                            trimmedKey.includes("processing_failed")
                        ) {
                            // Try to translate the key part first
                            const snakeCaseKey = keyWithoutNamespace
                                .replace(/([A-Z])/g, "_$1")
                                .toLowerCase()
                                .replace(/^_/, "");

                            let translatedKey = t(`fields.${snakeCaseKey}`, {
                                ns: "import",
                            });

                            if (translatedKey === `fields.${snakeCaseKey}`) {
                                translatedKey = t(`messages.${snakeCaseKey}`, {
                                    ns: "import",
                                });
                            }
                            if (translatedKey === `messages.${snakeCaseKey}`) {
                                translatedKey = t(`actions.${snakeCaseKey}`, {
                                    ns: "import",
                                });
                            }

                            // If we got a translation, combine it with the error message
                            if (
                                translatedKey &&
                                translatedKey !== `actions.${snakeCaseKey}` &&
                                translatedKey !== `messages.${snakeCaseKey}` &&
                                translatedKey !== `fields.${snakeCaseKey}`
                            ) {
                                return `${translatedKey}: ${trimmedValue}`;
                            }
                            // Otherwise, just show the error message
                            // Clean up the error message if it contains Prisma data dump markers
                            let finalMessage = trimmedValue || translatedKey;

                            // If the error message contains Prisma error markers, extract a cleaner message
                            if (
                                finalMessage &&
                                typeof finalMessage === "string"
                            ) {
                                // Remove Prisma data dump markers
                                if (
                                    finalMessage.includes("{ data:") ||
                                    finalMessage.includes("data: [")
                                ) {
                                    // Try to extract a meaningful error before the data dump
                                    const beforeDataMatch = finalMessage.match(
                                        /^(.+?)(?:\s*\{?\s*data:)/
                                    );
                                    if (beforeDataMatch) {
                                        finalMessage =
                                            beforeDataMatch[1].trim();
                                    } else {
                                        // If we can't extract, use a generic message
                                        finalMessage =
                                            "Database error occurred during import";
                                    }
                                }

                                // Remove any remaining object/array markers
                                finalMessage = finalMessage
                                    .replace(/\s*\{.*$/, "")
                                    .replace(/\s*\[.*$/, "")
                                    .trim();
                            }

                            return finalMessage;
                        }

                        // Convert camelCase to snake_case for translation keys
                        // e.g., "validation.businessUnitAccessDenied" -> "validation.business_unit_access_denied"
                        const snakeCaseKey = keyWithoutNamespace
                            .replace(/([A-Z])/g, "_$1")
                            .toLowerCase()
                            .replace(/^_/, "");

                        // Try translating with snake_case key and parameter
                        let translated = t(snakeCaseKey, {
                            ns: "import",
                            businessUnit: trimmedValue,
                        });
                        if (
                            translated !== snakeCaseKey &&
                            !translated.includes(snakeCaseKey)
                        ) {
                            return translated;
                        }

                        // Try with original camelCase key
                        translated = t(keyWithoutNamespace, {
                            ns: "import",
                            businessUnit: trimmedValue,
                        });
                        if (
                            translated !== keyWithoutNamespace &&
                            !translated.includes(keyWithoutNamespace)
                        ) {
                            return translated;
                        }

                        // Try with full key (including namespace)
                        translated = t(trimmedKey, {
                            ns: "import",
                            businessUnit: trimmedValue,
                        });
                        if (
                            translated !== trimmedKey &&
                            !translated.includes(trimmedKey)
                        ) {
                            return translated;
                        }

                        // Return formatted fallback
                        return `${trimmedKey}: ${trimmedValue}`;
                    }

                    // If message contains "." and no spaces, it might be a full translation key path
                    if (msg.includes(".") && !msg.includes(" ")) {
                        // Strip namespace prefix if present (e.g., "import.results.importedSuccessfully" -> "results.importedSuccessfully")
                        let keyWithoutNamespace = msg;
                        if (msg.startsWith("import.")) {
                            keyWithoutNamespace = msg.substring(7); // Remove "import." prefix
                        }

                        // Try the direct path first (e.g., "validation.emailMustBeValid")
                        let translated = t(keyWithoutNamespace, {
                            ns: "import",
                        });
                        if (translated !== keyWithoutNamespace) return translated;

                        // If key contains ".", split it and try different combinations
                        if (keyWithoutNamespace.includes(".")) {
                            const parts = keyWithoutNamespace.split(".");
                            const category = parts[0]; // "results", "messages", "actions", etc.
                            const suffix = parts[parts.length - 1];
                            const snakeSuffix = suffix
                                .replace(/([A-Z])/g, "_$1")
                                .toLowerCase()
                                .replace(/^_/, "");

                            // Try category.snake_case first (e.g., "validation.email_must_be_valid")
                            translated = t(`${category}.${snakeSuffix}`, {
                                ns: "import",
                            });
                            if (translated !== `${category}.${snakeSuffix}`)
                                return translated;

                            // Try actions.category_snake_case (results keys are under actions section)
                            // e.g., "results.importedSuccessfully" -> "actions.results_imported_successfully"
                            translated = t(
                                `actions.${category}_${snakeSuffix}`,
                                { ns: "import" }
                            );
                            if (
                                translated !==
                                `actions.${category}_${snakeSuffix}`
                            )
                                return translated;

                            // Try fields.category_snake_case (some keys might be under fields)
                            translated = t(
                                `fields.${category}_${snakeSuffix}`,
                                { ns: "import" }
                            );
                            if (
                                translated !==
                                `fields.${category}_${snakeSuffix}`
                            )
                                return translated;

                            // Try messages.category_snake_case
                            translated = t(
                                `messages.${category}_${snakeSuffix}`,
                                { ns: "import" }
                            );
                            if (
                                translated !==
                                `messages.${category}_${snakeSuffix}`
                            )
                                return translated;
                        } else {
                            // No category, try the key without namespace first
                            translated = t(keyWithoutNamespace, {
                                ns: "import",
                            });
                            if (translated !== keyWithoutNamespace)
                                return translated;

                            // Convert camelCase to snake_case and try again
                            const snakeCaseKey = keyWithoutNamespace
                                .replace(/([A-Z])/g, "_$1")
                                .toLowerCase()
                                .replace(/^_/, "");
                            translated = t(snakeCaseKey, { ns: "import" });
                            if (translated !== snakeCaseKey) return translated;
                        }

                        // Try the original key with import namespace
                        translated = t(msg, { ns: "import" });
                        if (translated !== msg) return translated;
                    }

                    // Try to translate as a validation key
                    const validationKey = `validation.${msg}`;
                    let translated = t(validationKey, { ns: "import" });
                    if (translated !== validationKey) return translated;

                    // Try as a message key
                    const messageKey = `messages.${msg}`;
                    translated = t(messageKey, { ns: "import" });
                    if (translated !== messageKey) return translated;

                    // Try as a direct field key
                    const fieldKey = `fields.${msg}`;
                    translated = t(fieldKey, { ns: "import" });
                    if (translated !== fieldKey) return translated;

                    // Convert camelCase to snake_case and try all formats again
                    const snakeCase = msg
                        .replace(/([A-Z])/g, "_$1")
                        .toLowerCase()
                        .replace(/^_/, "");
                    translated = t(`results.${snakeCase}`, { ns: "import" });
                    if (translated !== `results.${snakeCase}`)
                        return translated;

                    translated = t(`messages.${snakeCase}`, { ns: "import" });
                    if (translated !== `messages.${snakeCase}`)
                        return translated;

                    // Try actions.results_snake_case format (results keys are in actions section)
                    translated = t(`actions.results_${snakeCase}`, {
                        ns: "import",
                    });
                    if (translated !== `actions.results_${snakeCase}`)
                        return translated;

                    translated = t(`fields.results_${snakeCase}`, {
                        ns: "import",
                    });
                    if (translated !== `fields.results_${snakeCase}`)
                        return translated;

                    return translateImportMessage(msg, t);
                };

                if (params.value && typeof params.value === "string") {
                    // If message contains commas, split and translate each part
                    if (params.value.includes(",")) {
                        const messages = params.value
                            .split(",")
                            .map((msg) => msg.trim());
                        const translatedMessages =
                            messages.map(translateMessage);
                        displayMessage = translatedMessages.join(", ");
                    } else {
                        // Single message - translate it
                        displayMessage = translateMessage(params.value);
                    }
                }

                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            width: "100%",
                            direction: isHebrewUser ? "rtl" : "ltr",
                        }}
                    >
                        {isSuccess ? (
                            <CheckCircleIcon
                                sx={{
                                    fontSize: "1rem",
                                    color: "success.main",
                                    flexShrink: 0,
                                }}
                            />
                        ) : (
                            <CancelIcon
                                sx={{
                                    fontSize: "1rem",
                                    color: "error.main",
                                    flexShrink: 0,
                                }}
                            />
                        )}
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                                direction: isHebrewUser ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he"
                                        ? "right"
                                        : "left",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                            }}
                        >
                            {displayMessage}
                        </Typography>
                    </Box>
                );
            },
        });

        // Add customer name column for all import types
        columns.push({
            field: "customerName",
            headerName: t("fields.results_account_name", { ns: "import" }),
            width: 200,
            flex: 1,
            minWidth: 150,
            renderCell: (params) => {
                // Handle both invoice imports (customer_number) and customer imports (customer_number/temp__customer_number)
                const customerNumber =
                    params.row.originalData?.customer_number ||
                    params.row.originalData?.temp__customer_number ||
                    params.row.customer_number ||
                    params.row.temp__customer_number;

                // Check if user has access to this customer
                const hasAccess = customerNumber
                    ? customerAccess[customerNumber] !== false
                    : true;

                // If user doesn't have access, don't show customer name
                if (!hasAccess) {
                    return (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                                fontStyle: "italic",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                            }}
                        >
                            —
                        </Typography>
                    );
                }

                // For customer imports, the name is already in the original data
                let customerName: string;
                const customerData = customerNumber
                    ? customerInfo[customerNumber]
                    : null;

                if (importType === "Customer") {
                    // For customer imports, use the name from original data
                    customerName =
                        params.row.originalData?.name ||
                        params.row.name ||
                        customerData?.name ||
                        t("fields.unknown", { ns: "common" });
                } else {
                    // For invoice imports, look up customer info
                    customerName =
                        customerData?.name ||
                        t("fields.unknown", { ns: "common" });
                }

                const customerId =
                    customerData?.customerId || params.row.customerId;
                const tooltipText = customerNumber
                    ? `${t("fields.customer_number", { ns: "customers" })}: ${customerNumber}`
                    : "";

                // Only allow navigation if the record was successfully imported
                const isSuccess = params.row.success === true;
                const hasCustomerId = !!customerId;

                const handleCustomerClick = () => {
                    if (!isSuccess || !hasCustomerId) {
                        return; // Don't navigate if record failed or no customer ID
                    }

                    if (customerId) {
                        const locale = i18n.language === "he" ? "he" : "en";
                        router.push(`/${locale}/app/customers/${customerId}`);
                    }
                };

                return (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            width: "100%",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant="body2"
                            color={
                                isSuccess && hasCustomerId
                                    ? "primary.main"
                                    : "text.primary"
                            }
                            onClick={
                                isSuccess && hasCustomerId
                                    ? handleCustomerClick
                                    : undefined
                            }
                            sx={{
                                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                cursor:
                                    isSuccess && hasCustomerId
                                        ? "pointer"
                                        : "default",
                                textDecoration:
                                    isSuccess && hasCustomerId
                                        ? "underline"
                                        : "none",
                                textUnderlineOffset:
                                    isSuccess && hasCustomerId
                                        ? "0.125em"
                                        : undefined,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                textAlign:
                                    i18n.language === "he" ? "right" : "left",
                                "&:hover":
                                    isSuccess && hasCustomerId
                                        ? {
                                            textDecoration: "underline",
                                            color: "primary.dark",
                                        }
                                        : {},
                                transition: "color 0.2s ease",
                            }}
                        >
                            {customerName}
                        </Typography>
                        {customerNumber && (
                            <Tooltip
                                title={tooltipText}
                                arrow
                                enterDelay={300}
                                leaveDelay={100}
                                placement="bottom"
                                PopperProps={{
                                    sx: {
                                        "& .MuiTooltip-tooltip": {
                                            direction: isHebrewUser ? "rtl" : "ltr",
                                        },
                                        "& .MuiTooltip-arrow": {
                                            ...(isHebrewUser && { transform: "scaleX(-1)" }),
                                        },
                                    },
                                }}
                            >
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        // Navigate to customer record
                                        if (customerId) {
                                            const locale =
                                                i18n.language === "he"
                                                    ? "he"
                                                    : "en";
                                            router.push(
                                                `/${locale}/app/customers/${customerId}`
                                            );
                                        }
                                    }}
                                    sx={{
                                        p: 0.5,
                                        color: "primary.main",
                                        "&:hover": {
                                            bgcolor: "primary.50",
                                        },
                                    }}
                                >
                                    <InfoOutlinedIcon
                                        sx={{ fontSize: "0.875rem" }}
                                    />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                );
            },
        });

        // Only show invoice number column for Invoice and Payment imports
        if (importType === "Invoice" || importType === "Payment") {
            columns.push({
                field: "originalInvoiceNumber",
                headerName: t("fields.invoice_fields_invoice_number", {
                    ns: "import",
                }),
                width: 180,
                flex: 0,
                minWidth: 100,
                renderCell: (params) => {
                    // Always show invoice number - it's part of the import data
                    // Check multiple sources: originalInvoiceNumber, invoice_number from originalData, or invoice_number from row
                    const invoiceNumber =
                        params.value ||
                        params.row.originalData?.invoice_number ||
                        params.row.invoice_number ||
                        "-";

                    return (
                        <Typography
                            variant="body2"
                            color="text.primary"
                            sx={{
                                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                            }}
                        >
                            {invoiceNumber}
                        </Typography>
                    );
                },
            });
        }

        if (originalData.length > 0) {
            getAllFields.forEach((field) => {
                if (field === "invoice_number") return;

                // Try to get translation for the field, fallback to fieldLabels, then formatted field name
                let headerName = fieldLabels[field];

                // If no fieldLabels translation, try to get translation from translation keys based on import type
                if (!headerName) {
                    let translationKey = `fields.invoice_fields_${field}`;

                    // Try different import type field translations
                    if (importType === "Customer") {
                        translationKey = `fields.customer_fields_${field}`;
                    } else if (importType === "Payment") {
                        translationKey = `fields.payment_fields_${field}`;
                    } else if (importType === "Contact") {
                        translationKey = `fields.contact_fields_${field}`;
                    } else if (importType === "Policy") {
                        translationKey = `fields.policy_fields_${field}`;
                    }

                    const translatedField = t(translationKey, { ns: "import" });
                    headerName =
                        translatedField !== translationKey
                            ? translatedField
                            : field.replace(/_/g, " ");
                }

                // Special handling for common field name variations
                if (!headerName || headerName === field.replace(/_/g, " ")) {
                    const fieldVariations: Record<string, string> = {
                        // Amount variations
                        amount: t("fields.invoice_fields_amount", {
                            ns: "import",
                        }),
                        base_amount: t("fields.invoice_fields_amount", {
                            ns: "import",
                        }),
                        invoice_amount: t("fields.invoice_fields_amount", {
                            ns: "import",
                        }),
                        customer_amount: t("fields.invoice_fields_amount", {
                            ns: "import",
                        }),

                        // Customer variations
                        customer_number: t(
                            "fields.invoice_fields_customer_number",
                            { ns: "import" }
                        ),
                        client_number: t(
                            "fields.invoice_fields_customer_number",
                            { ns: "import" }
                        ),

                        // Date variations
                        invoice_date: t("fields.invoice_fields_invoice_date", {
                            ns: "import",
                        }),
                        due_date: t("fields.invoice_fields_due_date", {
                            ns: "import",
                        }),
                        date: t("fields.invoice_fields_invoice_date", {
                            ns: "import",
                        }),

                        // Currency variations
                        currency: t("fields.invoice_fields_currency", {
                            ns: "import",
                        }),
                        customer_currency: t("fields.invoice_fields_currency", {
                            ns: "import",
                        }),

                        // Payment variations
                        total_paid: t(
                            "fields.invoice_fields_customer_total_paid",
                            { ns: "import" }
                        ),
                        customer_total_paid: t(
                            "fields.invoice_fields_customer_total_paid",
                            { ns: "import" }
                        ),

                        // Invoice number variations
                        invoice_number: t(
                            "fields.invoice_fields_invoice_number",
                            { ns: "import" }
                        ),
                        invoice_no: t("fields.invoice_fields_invoice_number", {
                            ns: "import",
                        }),
                        inv_number: t("fields.invoice_fields_invoice_number", {
                            ns: "import",
                        }),

                        // Credit variations
                        credit_for_invoice_number: t(
                            "fields.invoice_fields_credit_for_invoice_number",
                            { ns: "import" }
                        ),
                        credit_invoice: t(
                            "fields.invoice_fields_credit_for_invoice_number",
                            { ns: "import" }
                        ),
                        original_invoice: t(
                            "fields.invoice_fields_credit_for_invoice_number",
                            { ns: "import" }
                        ),
                    };

                    if (fieldVariations[field]) {
                        headerName = fieldVariations[field];
                    }
                }

                columns.push({
                    field,
                    headerName,
                    width: 150,
                    flex: 1,
                    minWidth: 80,
                    renderCell: (params) => (
                        <Typography
                            variant="body2"
                            color="text.primary"
                            sx={{
                                fontSize: { xs: "0.75rem", sm: "0.875rem" },
                            }}
                        >
                            {params.value !== null && params.value !== undefined
                                ? String(params.value)
                                : "-"}
                        </Typography>
                    ),
                });
            });
        }

        return columns;
    }, [
        t,
        i18n.language,
        importType,
        fieldLabels,
        getAllFields,
        originalData,
        customerInfo,
        customerAccess,
    ]);

    const columns = generateColumns;

    const customFilterButtons = useMemo(
        () => (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: { xs: 1, sm: 1.5 },
                    alignItems: { xs: "flex-start", sm: "center" },
                    flexWrap: "wrap",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <FilterChip
                    type="all"
                    count={totalCount}
                    filteredCount={filteredTotalCount}
                    isActive={statusFilter === "all"}
                    onClick={() => handleChipClick("all")}
                    icon={<FilePresentIcon />}
                    title={t("actions.results_all_records", { ns: "import" })}
                    description={t(
                        "actions.results_show_all_records_description",
                        { ns: "import" }
                    )}
                    color="primary"
                />

                <FilterChip
                    type="success"
                    count={successCount}
                    filteredCount={filteredSuccessCount}
                    isActive={statusFilter === "success"}
                    onClick={() => handleChipClick("success")}
                    icon={<CheckCircleIcon />}
                    title={t("actions.results_successful_records", {
                        ns: "import",
                    })}
                    description={t(
                        "actions.results_show_successful_records_description",
                        { ns: "import" }
                    )}
                    color="success"
                />

                <FilterChip
                    type="failed"
                    count={failedCount}
                    filteredCount={filteredFailedCount}
                    isActive={statusFilter === "failed"}
                    onClick={() => handleChipClick("failed")}
                    icon={<CancelIcon />}
                    title={t("actions.results_failed_records", {
                        ns: "import",
                    })}
                    description={t(
                        "actions.results_show_failed_records_description",
                        { ns: "import" }
                    )}
                    color="error"
                    showCondition={failedCount > 0}
                />
            </Box>
        ),
        [
            t,
            i18n.language,
            statusFilter,
            filteredTotalCount,
            totalCount,
            filteredSuccessCount,
            successCount,
            filteredFailedCount,
            failedCount,
            handleChipClick,
            windowWidth,
        ]
    );

    const columnVisibilityModel = useMemo(() => {
        const baseModel = {
            message: windowWidth >= BREAKPOINTS.MOBILE,
            customerName: windowWidth >= BREAKPOINTS.MOBILE,
            originalInvoiceNumber: windowWidth >= BREAKPOINTS.TABLET,
        };

        // Add visibility for dynamic columns from originalData
        const dynamicModel: Record<string, boolean> = {};
        getAllFields.forEach((field) => {
            if (field !== "invoice_number") {
                dynamicModel[field] = windowWidth >= BREAKPOINTS.TABLET;
            }
        });

        return { ...baseModel, ...dynamicModel };
    }, [windowWidth, getAllFields]);

    // Export handler for import results
    const handleExport = useCallback(
        async (
            selectedColumns: string[],
            fileName: string,
            format: ExportFormat
        ) => {
            // Use the existing results data instead of making a new API call
            const rawResults = results || [];

            const transformedResults = rawResults.map(
                (result: ImportResult) => {
                    // Create a base object with all the standard fields
                    const exportRow: any = {
                        index: result.index,
                        success: result.success,
                        message: result.message || "",
                        invoiceId: result.invoiceId || null,
                        originalInvoiceNumber:
                            result.originalInvoiceNumber || "",
                        raw: result,
                    };

                    // Add all dynamic fields from originalData
                    if (result.originalData) {
                        Object.keys(result.originalData).forEach((key) => {
                            exportRow[key] = result.originalData![key] || "";
                        });
                    }

                    return exportRow;
                }
            );

            return transformedResults;
        },
        [results]
    );

    const handleBackToImport = () => {
        switch (importType) {
            case "Invoice":
                router.push(`/${locale}/app/import?tab=invoice`, { scroll: false });
                break;
            case "Customer":
                router.push(`/${locale}/app/import?tab=customer`, { scroll: false });
                break;
            case "Payment":
                router.push(`/${locale}/app/import?tab=payment`, { scroll: false });
                break;
            case "Contact":
                router.push(`/${locale}/app/import?tab=contact`, { scroll: false });
                break;
            case "Policy":
                router.push(`/${locale}/app/import?tab=policy`, { scroll: false });
                break;
            default:
                router.push(`/${locale}/app/import?tab=invoice`, { scroll: false });
                break;
        }
    };

    const handleGoToDashboard = () => {
        router.push("/app/dashboard");
    };

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: "400px",
                    flexDirection: "column",
                    gap: 2,
                    p: { xs: 2, sm: 3, md: 4 },
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                <CircularProgress
                    size={40}
                    sx={{
                        color: "primary.main",
                    }}
                />
            </Box>
        );
    }

    if (error) {
        return (
            <Box
                sx={{
                    p: { xs: 2, sm: 3, md: 4 },
                    maxWidth: "100%",
                }}
            >
                <Alert
                    severity="error"
                    sx={{
                        mb: 2,
                        fontSize: { xs: "0.875rem", sm: "1rem" },
                    }}
                >
                    {error}
                </Alert>
                <Box
                    sx={{
                        display: "flex",
                        gap: { xs: 1, sm: 2 },
                        flexDirection: { xs: "column", sm: "row" },
                        alignItems: { xs: "stretch", sm: "center" },
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <IconButton
                        onClick={handleBackToImport}
                        color="primary"
                        sx={{
                            width: { xs: "100%", sm: "auto" },
                            height: { xs: "48px", sm: "40px" },
                        }}
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <IconButton
                        onClick={handleGoToDashboard}
                        color="primary"
                        sx={{
                            width: { xs: "100%", sm: "auto" },
                            height: { xs: "48px", sm: "40px" },
                        }}
                    >
                        <HomeIcon />
                    </IconButton>
                </Box>
            </Box>
        );
    }

    // Get icon based on import type
    const getImportIcon = () => {
        switch (importType) {
            case "Invoice":
                return <ReceiptIcon />;
            case "Payment":
                return <PaymentIcon />;
            case "Customer":
                return <PeopleIcon />;
            case "Contact":
                return <ContactsIcon />;
            case "Policy":
                return <ShieldIcon />;
            default:
                return <FilePresentIcon />;
        }
    };

    // Get title based on import type
    const getImportTitle = () => {
        if (importType === "Invoice") {
            return t("actions.import_types_invoice_import", { ns: "import" });
        }
        if (importType === "Payment") {
            return t("actions.import_types_payment_import", { ns: "import" });
        }
        if (importType === "Customer") {
            return t("actions.import_types_customer_import", { ns: "import" });
        }
        if (importType === "Contact") {
            return t("actions.import_types_contact_import", { ns: "import" });
        }
        if (importType === "Policy") {
            return t("actions.import_types_policy_import", { ns: "import" });
        }
        return t("actions.results_title", { ns: "import" });
    };

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                minHeight: "100vh",
                m: 0,
                p: 0,
                mt: { xs: -1, sm: -1.5 },
                mx: { xs: -1, sm: -1.5 },
                width: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                maxWidth: { xs: "calc(100% + 16px)", sm: "calc(100% + 24px)" },
                direction: i18n.language === "he" ? "rtl" : "ltr",
                ...(i18n.language === "he" && {
                    "& *": {
                        boxSizing: "border-box",
                    },
                    "& .MuiTableContainer-root": {
                        overflowX: "auto",
                        maxWidth: "100%",
                    },
                    "& .MuiTable-root": {
                        tableLayout: "fixed",
                        width: "100%",
                    },
                    "& .MuiTableCell-root": {
                        wordBreak: "break-word",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    },
                    "& > *": {
                        maxWidth: "100%",
                        overflow: "hidden",
                    },
                }),
            }}
        >
            {/* Sticky Header */}
            <Box
                ref={headerRef}
                sx={{
                    position: "sticky",
                    top: { xs: "-8px", sm: "-12px" },
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    bgcolor: "background.paper",
                    flexShrink: 0,
                    m: 0,
                    mt: 0,
                    backgroundColor: "background.paper",
                    width: "100%",
                    maxWidth: "100%",
                    px: { xs: 2, sm: 3, md: 4 },
                    pt: { xs: 2, sm: 3 },
                    pb: 0,
                }}
            >
                <Box
                    sx={{
                        maxWidth: "xl",
                        mx: "auto",
                    }}
                >
                    <Box sx={{ "& .MuiPaper-root": { mb: 0 } }}>
                        <PageHeader
                            title={getImportTitle()}
                            description={t("actions.results_results_description", {
                                ns: "import",
                            })}
                            sticky={false}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: { xs: 1, sm: 1.5 },
                                    flexDirection: { xs: "row", sm: "row" },
                                    alignItems: "center",
                                    justifyContent: {
                                        xs: "center",
                                        sm:
                                            i18n.language === "he"
                                                ? "flex-start"
                                                : "flex-end",
                                    },
                                    flexShrink: 0,
                                }}
                            >
                                <Tooltip
                                    title={
                                        <Card
                                            sx={{
                                                maxWidth: { xs: 250, sm: 300 },
                                                bgcolor: "background.paper",
                                                color: "text.primary",
                                                boxShadow: theme.shadows[4],
                                                border: "none",
                                                borderRadius:
                                                    theme.shape.borderRadius,
                                                position: "relative",
                                                direction: isHebrewUser ? "rtl" : "ltr",
                                                "& .MuiCard-root": {
                                                    border: "none",
                                                },
                                                "&::before": {
                                                    content: '""',
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    borderRadius:
                                                        theme.shape.borderRadius,
                                                    background: `linear-gradient(135deg, ${theme.palette.primary.main}08 0%, ${theme.palette.primary.main}03 100%)`,
                                                    pointerEvents: "none",
                                                    zIndex: 0,
                                                },
                                            }}
                                        >
                                            <CardContent
                                                sx={{
                                                    p: { xs: 1.5, sm: 2 },
                                                    "&:last-child": {
                                                        pb: { xs: 1.5, sm: 2 },
                                                    },
                                                    position: "relative",
                                                    zIndex: 1,
                                                    direction: isHebrewUser ? "rtl" : "ltr",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        mb: 1,
                                                        direction: isHebrewUser ? "rtl" : "ltr",
                                                    }}
                                                >
                                                    <ArrowBackIcon
                                                        sx={{
                                                            fontSize: "1rem",
                                                            color: "primary.main",
                                                        }}
                                                    />
                                                    <Typography
                                                        variant="subtitle2"
                                                        sx={{
                                                            fontWeight: 600,
                                                            color: "primary.main",
                                                            fontSize: {
                                                                xs: "0.75rem",
                                                                sm: "0.875rem",
                                                            },
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing: "0.5px",
                                                            direction: isHebrewUser ? "rtl" : "ltr",
                                                            textAlign: isHebrewUser ? "right" : "left",
                                                        }}
                                                    >
                                                        {t(
                                                            "tooltips.back_to_import_title",
                                                            { ns: "import" }
                                                        )}
                                                    </Typography>
                                                </Box>

                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: "text.primary",
                                                        lineHeight: 1.4,
                                                        fontSize: {
                                                            xs: "0.7rem",
                                                            sm: "0.8rem",
                                                        },
                                                        wordBreak: "break-word",
                                                        direction: isHebrewUser ? "rtl" : "ltr",
                                                        textAlign: isHebrewUser ? "right" : "left",
                                                    }}
                                                >
                                                    {(() => {
                                                        // Translate the import type to Hebrew/English
                                                        const typeKey = `actions.import_types_${importType.toLowerCase()}`;
                                                        const translatedType = t(
                                                            typeKey,
                                                            { ns: "import" }
                                                        );

                                                        // If translation found, use it; otherwise use the original type
                                                        const typeValue =
                                                            translatedType !==
                                                                typeKey
                                                                ? translatedType
                                                                : importType.toLowerCase();

                                                        return t(
                                                            "tooltips.back_to_import_description",
                                                            {
                                                                ns: "import",
                                                                type: typeValue,
                                                            }
                                                        );
                                                    })()}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    }
                                    arrow
                                    enterDelay={300}
                                    leaveDelay={100}
                                    placement="bottom"
                                    PopperProps={{
                                        sx: {
                                            "& .MuiTooltip-tooltip": {
                                                direction: isHebrewUser ? "rtl" : "ltr",
                                                bgcolor: "transparent",
                                                p: 0,
                                            },
                                            "& .MuiTooltip-arrow": {
                                                color: "background.paper",
                                                ...(isHebrewUser && { transform: "scaleX(-1)" }),
                                            },
                                        },
                                    }}
                                >
                                    <IconButton
                                        onClick={handleBackToImport}
                                        color="primary"
                                        sx={{
                                            bgcolor: "primary.main",
                                            color: "primary.contrastText",
                                            width: { xs: "44px", sm: "48px" },
                                            height: { xs: "44px", sm: "48px" },
                                            borderRadius: theme.shape.borderRadius,
                                            boxShadow: `0 2px 8px ${theme.palette.primary.main}4D`,
                                            transition: "all 0.2s ease-in-out",
                                            "&:hover": {
                                                bgcolor: "primary.dark",
                                                transform: "translateY(-2px)",
                                                boxShadow: `0 4px 12px ${theme.palette.primary.main}66`,
                                            },
                                            "&:active": {
                                                transform: "translateY(0)",
                                            },
                                        }}
                                    >
                                        <ArrowBackIcon
                                            sx={{
                                                fontSize: {
                                                    xs: "1.25rem",
                                                    sm: "1.5rem",
                                                },
                                            }}
                                        />
                                    </IconButton>
                                </Tooltip>

                                <Tooltip
                                    title={
                                        <Card
                                            sx={{
                                                maxWidth: { xs: 250, sm: 300 },
                                                bgcolor: "background.paper",
                                                color: "text.primary",
                                                boxShadow: theme.shadows[4],
                                                border: "none",
                                                borderRadius:
                                                    theme.shape.borderRadius,
                                                position: "relative",
                                                direction: isHebrewUser ? "rtl" : "ltr",
                                                "& .MuiCard-root": {
                                                    border: "none",
                                                },
                                                "&::before": {
                                                    content: '""',
                                                    position: "absolute",
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    borderRadius:
                                                        theme.shape.borderRadius,
                                                    background: `linear-gradient(135deg, ${theme.palette.primary.main}08 0%, ${theme.palette.primary.main}03 100%)`,
                                                    pointerEvents: "none",
                                                    zIndex: 0,
                                                },
                                            }}
                                        >
                                            <CardContent
                                                sx={{
                                                    p: { xs: 1.5, sm: 2 },
                                                    "&:last-child": {
                                                        pb: { xs: 1.5, sm: 2 },
                                                    },
                                                    position: "relative",
                                                    zIndex: 1,
                                                    direction: isHebrewUser ? "rtl" : "ltr",
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        mb: 1,
                                                        direction: isHebrewUser ? "rtl" : "ltr",
                                                    }}
                                                >
                                                    <HomeIcon
                                                        sx={{
                                                            fontSize: "1rem",
                                                            color: "primary.main",
                                                        }}
                                                    />
                                                    <Typography
                                                        variant="subtitle2"
                                                        sx={{
                                                            fontWeight: 600,
                                                            color: "primary.main",
                                                            fontSize: {
                                                                xs: "0.75rem",
                                                                sm: "0.875rem",
                                                            },
                                                            textTransform:
                                                                "uppercase",
                                                            letterSpacing: "0.5px",
                                                            direction: isHebrewUser ? "rtl" : "ltr",
                                                            textAlign: isHebrewUser ? "right" : "left",
                                                        }}
                                                    >
                                                        {t(
                                                            "tooltips.go_to_dashboard_title",
                                                            { ns: "import" }
                                                        )}
                                                    </Typography>
                                                </Box>

                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        color: "text.primary",
                                                        lineHeight: 1.4,
                                                        fontSize: {
                                                            xs: "0.7rem",
                                                            sm: "0.8rem",
                                                        },
                                                        wordBreak: "break-word",
                                                        direction: isHebrewUser ? "rtl" : "ltr",
                                                        textAlign: isHebrewUser ? "right" : "left",
                                                    }}
                                                >
                                                    {t(
                                                        "tooltips.go_to_dashboard_description",
                                                        { ns: "import" }
                                                    )}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    }
                                    arrow
                                    enterDelay={300}
                                    leaveDelay={100}
                                    placement="bottom"
                                    PopperProps={{
                                        sx: {
                                            "& .MuiTooltip-tooltip": {
                                                direction: isHebrewUser ? "rtl" : "ltr",
                                                bgcolor: "transparent",
                                                p: 0,
                                            },
                                            "& .MuiTooltip-arrow": {
                                                color: "background.paper",
                                                ...(isHebrewUser && { transform: "scaleX(-1)" }),
                                            },
                                        },
                                    }}
                                >
                                    <IconButton
                                        onClick={handleGoToDashboard}
                                        color="primary"
                                        sx={{
                                            bgcolor: "background.paper",
                                            color: "primary.main",
                                            border: "2px solid",
                                            borderColor: "primary.main",
                                            width: { xs: "44px", sm: "48px" },
                                            height: { xs: "44px", sm: "48px" },
                                            borderRadius: theme.shape.borderRadius,
                                            transition: "all 0.2s ease-in-out",
                                            "&:hover": {
                                                bgcolor: "primary.main",
                                                color: "primary.contrastText",
                                                transform: "translateY(-2px)",
                                                boxShadow: `0 4px 12px ${theme.palette.primary.main}4D`,
                                            },
                                            "&:active": {
                                                transform: "translateY(0)",
                                            },
                                        }}
                                    >
                                        <HomeIcon
                                            sx={{
                                                fontSize: {
                                                    xs: "1.25rem",
                                                    sm: "1.5rem",
                                                },
                                            }}
                                        />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </PageHeader>
                    </Box>
                </Box>
            </Box>

            {/* Content Area */}
            <Container
                maxWidth="xl"
                sx={{
                    py: { xs: 2, sm: 3 },
                    px: { xs: 2, sm: 3, md: 4 },
                }}
            >
                {importType === "Invoice" && replayStats && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        {t("messages.ar_replay_stats", {
                            ns: "import",
                            events_applied: replayStats.eventsApplied,
                            payments_linked: replayStats.paymentsLinked,
                            deferred_remaining: replayStats.deferredRemaining,
                            customers_affected: replayStats.customersAffected,
                        })}
                    </Alert>
                )}
                <Box
                    sx={{
                        width: "100%",
                        bgcolor: "background.paper",
                        borderRadius: theme.shape.borderRadius,
                    }}
                >
                    <EndlessScrollDataGrid
                        rows={(() => {
                            const rowsWithIds = filteredMergedData.map(
                                (row, index) => ({
                                    id: row.index !== undefined ? row.index : index,
                                    ...row,
                                })
                            );
                            return rowsWithIds;
                        })()}
                        columns={columns}
                        totalRecords={filteredMergedData.length}
                        isLoading={isLoading}
                        onLoadMore={() => { }} // No pagination needed for import results
                        hasMore={false} // No pagination needed for import results
                        sortModel={[]}
                        onSortModelChange={() => { }} // No sorting needed for import results
                        customButtons={customFilterButtons}
                        searchDisabled={true}
                        searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                        fillViewport={true}
                        resizableColumns={true}
                        columnVisibilityModel={columnVisibilityModel}
                        noRowsMessage={t("messages.no_results", { ns: "common" })}
                        noRowsDescription={t("messages.no_results_description", {
                            ns: "common",
                        })}
                        language={i18n.language}
                        onExport={handleExport}
                        exportContextInfo={{
                            pageName: "import_results",
                            customPrefix: `${importType?.toLowerCase()}_import_results`,
                        }}
                        // Currency columns configuration for export splitting
                        currencyColumns={
                            {
                                amount: {
                                    amountField: "amount_value",
                                    currencyField: "amount_currency",
                                },
                                base_amount: {
                                    amountField: "base_amount_value",
                                    currencyField: "base_amount_currency",
                                },
                                invoice_amount: {
                                    amountField: "invoice_amount_value",
                                    currencyField: "invoice_amount_currency",
                                },
                                customer_amount: {
                                    amountField: "customer_amount_value",
                                    currencyField: "customer_amount_currency",
                                },
                                total_paid: {
                                    amountField: "total_paid_value",
                                    currencyField: "total_paid_currency",
                                },
                                customer_total_paid: {
                                    amountField: "customer_total_paid_value",
                                    currencyField: "customer_total_paid_currency",
                                },
                            } as CurrencyColumnsConfig
                        }
                    />
                </Box>
            </Container>
        </Box>
    );
};

export default SuccessPage;
