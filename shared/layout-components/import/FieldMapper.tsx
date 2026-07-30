"use client";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import {
    InfoOutlined as InfoOutlinedIcon,
} from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    List,
    ListItem,
    ListItemSecondaryAction,
    ListItemText,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ImportType } from "@/types/db";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { importMappingService } from "@/shared/services/importMappingService";

interface UserImportMapping {
    id: string;
    user_id: string;
    import_type: ImportType;
    mapping: Record<string, string>;
    name?: string;
    is_default: boolean;
    created_at: Date;
    modified_at: Date;
}

interface FieldMapperProps {
    rawHeaders: string[];
    databaseFields: string[];
    mapping: Record<string, string>; // dbField -> fileField
    setMapping: (
        newMapping:
            | Record<string, string>
            | ((prev: Record<string, string>) => Record<string, string>)
    ) => void;
    fieldDescriptions?: Record<string, { type: string; description: string }>;
    exampleValues?: Record<string, any>;
    fieldLabels?: Record<string, string>;
    requiredFields?: readonly string[];
    isAutoMapping?: boolean;
    importType: ImportType;
    shouldAutoMap?: boolean;
}

const FieldMapper: React.FC<FieldMapperProps> = ({
    rawHeaders,
    databaseFields,
    mapping,
    setMapping,
    fieldDescriptions = {},
    exampleValues = {},
    fieldLabels = {},
    requiredFields = [],
    isAutoMapping = false,
    importType,
    shouldAutoMap = true,
}) => {
    const { t, i18n } = useTranslation(["import", "common"]);
    const requiredFieldSet = useMemo(
        () => new Set(requiredFields),
        [requiredFields]
    );
    const { showToast } = useToast();
    const theme = useTheme();

    // RTL/LTR style helpers
    const isRTL = i18n.language === "he";
    const rtlStyles = useMemo(
        () => ({
            direction: (isRTL ? "rtl" : "ltr") as "rtl" | "ltr",
            textAlign: (isRTL ? "right" : "left") as "right" | "left",
            justifyContent: (isRTL ? "flex-end" : "flex-start") as
                | "flex-end"
                | "flex-start",
        }),
        [isRTL]
    );

    const tableCellStyles = useMemo(
        () => ({
            paddingTop: { xs: "8px", sm: "10px", md: "12px" },
            paddingBottom: { xs: "8px", sm: "10px", md: "12px" },
            paddingLeft: { xs: "8px", sm: "12px", md: "16px" },
            paddingRight: { xs: "8px", sm: "12px", md: "16px" },
            fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.875rem" },
            verticalAlign: "middle" as const,
            minHeight: "48px",
            display: "table-cell",
            "& .MuiTableCell-root": {
                textAlign: rtlStyles.textAlign,
                direction: rtlStyles.direction,
            },
        }),
        [rtlStyles]
    );

    // Shared styles for Autocomplete (matching FilterBuilder pattern)
    const autocompleteStyles = useMemo(
        () => ({
            width: "100%",
            padding: 0,
            margin: 0,
            "& .MuiFormControl-root": {
                padding: 0,
                margin: 0,
            },
            "& .MuiTextField-root": {
                padding: 0,
                margin: 0,
            },
        }),
        []
    );

    const [savedMappings, setSavedMappings] = useState<UserImportMapping[]>([]);
    const [isLoadingMappings, setIsLoadingMappings] = useState(false);
    const [loadDialogOpen, setLoadDialogOpen] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [hasFinishedLoadingMappings, setHasFinishedLoadingMappings] =
        useState(false);

    const autoMappingTriggeredRef = useRef(false);
    const mappingRef = useRef(mapping);
    const hasLoadedSavedMappingRef = useRef(false);

    useEffect(() => {
        mappingRef.current = mapping;
    }, [mapping]);

    const loadSavedMappings = useCallback(async () => {
        try {
            setIsLoadingMappings(true);
            setHasFinishedLoadingMappings(false);

            const mappings = await importMappingService.getMappings(importType);

            setSavedMappings(mappings as unknown as UserImportMapping[]);

            if (mappings.length > 0 && Object.keys(mapping).length === 0) {
                const defaultMapping =
                    mappings.find((m) => m.is_default) || mappings[0];

                setMapping(defaultMapping.mapping as Record<string, string>);
                setHasUnsavedChanges(false);
                hasLoadedSavedMappingRef.current = true;
            }

            setHasFinishedLoadingMappings(true);
        } catch (error) {
            setHasFinishedLoadingMappings(true);
        } finally {
            setIsLoadingMappings(false);
        }
    }, [importType, setMapping]);

    const handleAutoMap = useCallback(async () => {
        if (!rawHeaders || !databaseFields) {
            return;
        }

        const newMapping: Record<string, string> = {};

        databaseFields.forEach((targetField) => {
            const targetFieldLower = targetField.toLowerCase();
            const targetFieldWords = targetFieldLower
                .split(/[\s_-]+/)
                .filter((word) => word.length > 0);

            // Find the best match
            let bestMatch = "";
            let bestScore = 0;

            rawHeaders.forEach((header) => {
                const headerLower = header.toLowerCase().trim();
                const headerWords = headerLower
                    .split(/[\s_-]+/)
                    .filter((word) => word.length > 0);

                // Calculate similarity score
                let score = 0;

                // Exact match gets highest score
                if (headerLower === targetFieldLower) {
                    score = 100;
                }
                // Contains all words from target field
                else if (
                    targetFieldWords.every((word) => headerLower.includes(word))
                ) {
                    score = 80 + targetFieldWords.length * 5;
                }
                // Contains some words from target field
                else {
                    const commonWords = targetFieldWords.filter((word) =>
                        headerLower.includes(word)
                    );
                    score = commonWords.length * 20;
                }

                // Bonus for partial matches
                if (
                    headerLower.includes(targetFieldLower) ||
                    targetFieldLower.includes(headerLower)
                ) {
                    score += 10;
                }

                // Special handling for amount field - look for customer_amount variations
                if (targetField === "amount") {
                    const amountVariations = [
                        "customer_amount",
                        "amount",
                        "total_amount",
                        "invoice_amount",
                    ];
                    if (
                        amountVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        const variationScore = 50; // High score for amount-related fields
                        score = Math.max(score, variationScore);
                    }
                }

                // Special handling for base_amount field - look for base currency amount variations
                if (targetField === "base_amount") {
                    const baseAmountVariations = [
                        "base_amount",
                        "baseamount",
                        "base amount",
                        "account_amount",
                        "accountamount",
                        "account amount",
                        "system_amount",
                        "systemamount",
                        "system amount",
                        "base_currency_amount",
                        "basecurrencyamount",
                        "base currency amount",
                    ];
                    if (
                        baseAmountVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        const variationScore = 60; // High score for base amount fields
                        score = Math.max(score, variationScore);
                    }
                }

                // Special handling for invoice_amount field - look for customer currency amount variations
                if (targetField === "invoice_amount") {
                    const invoiceAmountVariations = [
                        "invoice_amount",
                        "invoiceamount",
                        "invoice amount",
                        "customer_amount",
                        "customeramount",
                        "customer amount",
                        "debtor_amount",
                        "debtoramount",
                        "debtor amount",
                    ];
                    if (
                        invoiceAmountVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        const variationScore = 60; // High score for invoice amount fields
                        score = Math.max(score, variationScore);
                    }
                }

                // Special handling for contact fields
                if (targetField === "first_name") {
                    const firstNameVariations = [
                        "first_name",
                        "firstname",
                        "first name",
                        "given_name",
                        "givenname",
                        "given name",
                        "forename",
                        "fname",
                    ];
                    if (
                        firstNameVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 60);
                    }
                }

                if (targetField === "last_name") {
                    const lastNameVariations = [
                        "last_name",
                        "lastname",
                        "last name",
                        "surname",
                        "family_name",
                        "familyname",
                        "family name",
                        "lname",
                    ];
                    if (
                        lastNameVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 60);
                    }
                }

                if (targetField === "customer_number") {
                    const customerNumberVariations = [
                        "customer_number",
                        "customernumber",
                        "customer number",
                        "account_id",
                        "customerid",
                        "customer id",
                        "client_number",
                        "clientnumber",
                        "client number",
                        "account_number",
                        "accountnumber",
                        "account number",
                        "customer",
                        "client",
                        "account",
                    ];
                    if (
                        customerNumberVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 60);
                    }
                }

                if (targetField === "policy_number") {
                    const policyNumberVariations = [
                        "policy_number",
                        "policynumber",
                        "policy number",
                        "insurance_policy",
                        "insurance policy",
                        "policy_no",
                        "policy no",
                        "policy_id",
                        "policy id",
                    ];
                    if (
                        policyNumberVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 60);
                    }
                }

                if (targetField === "limit_type") {
                    const limitTypeVariations = [
                        "limit_type",
                        "limittype",
                        "limit type",
                        "coverage_type",
                        "coverage type",
                        "limit",
                    ];
                    if (
                        limitTypeVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 60);
                    }
                }

                if (targetField === "customer_number_policy") {
                    const policyCustomerVariations = [
                        "customer_number_policy",
                        "customernumberpolicy",
                        "customer number policy",
                        "policy_customer_number",
                        "policy customer number",
                        "named_customer",
                        "named customer",
                    ];
                    if (
                        policyCustomerVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 60);
                    }
                }

                if (targetField === "crn") {
                    const crnVariations = [
                        "crn",
                        "company_registration",
                        "company registration",
                        "registration_number",
                        "registration number",
                        "commercial_registration",
                        "commercial registration",
                        "×—.×¤",
                        "×—×¤",
                        "×ž×¡×¤×¨ ×—",
                    ];
                    if (
                        crnVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 60);
                    }
                }

                if (targetField === "company_wide_address") {
                    const companyWideVariations = [
                        "company_wide_address",
                        "companywideaddress",
                        "company wide address",
                        "company_wide",
                        "companywide",
                        "company wide",
                        "global_address",
                        "globaladdress",
                        "global address",
                        "all_locations",
                        "alllocations",
                        "all locations",
                    ];
                    if (
                        companyWideVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 60);
                    }
                }

                // Special handling for credit_for_invoice_number field
                if (targetField === "credit_for_invoice_number") {
                    // Look for common variations of credit invoice number
                    const creditVariations = [
                        "credit",
                        "credit invoice",
                        "credit number",
                        "original invoice",
                        "original number",
                        "reference invoice",
                        "reference number",
                    ];
                    if (
                        creditVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 30); // Give it a decent score if it matches credit-related terms
                    }
                }

                // Special handling for reminder fields
                if (targetField === "receives_standard_reminder") {
                    const standardReminderVariations = [
                        "standard",
                        "standard reminder",
                        "standard reminders",
                        "standard remainders",
                        "standard_reminder",
                        "standard_reminders",
                        "receives_standard_reminder",
                        "standard_remainders",
                        "primary",
                        "primary contact",
                        "main contact",
                        "standard contact",
                        "standard_contact",
                        "primary_contact",
                        "main_contact",
                    ];
                    if (
                        standardReminderVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 50); // High score for standard reminder fields
                    }
                }

                if (targetField === "receives_escalated_reminder") {
                    const escalatedReminderVariations = [
                        "escalated",
                        "escalated reminder",
                        "escalated reminders",
                        "escalated remainders",
                        "escalated_reminder",
                        "escalated_reminders",
                        "receives_escalated_reminder",
                        "escalated_remainders",
                        "escalation",
                        "escalation reminder",
                        "escalation reminders",
                        "escalated remainders",
                        "escalated_reminders",
                        "escalation remainders",
                        "escalation_reminder",
                        "escalation_reminders",
                        "secondary",
                        "secondary contact",
                        "escalation contact",
                        "secondary_contact",
                        "escalation_contact",
                    ];
                    if (
                        escalatedReminderVariations.some((variation) =>
                            headerLower.includes(variation)
                        )
                    ) {
                        score = Math.max(score, 50); // High score for escalated reminder fields
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = header;
                }
            });

            if (bestScore >= 10) {
                newMapping[targetField] = bestMatch;
            } else {
                if (
                    targetField === "receives_escalated_reminder" &&
                    bestScore === 0
                ) {
                    const escalatedColumn = rawHeaders.find((header) =>
                        header.toLowerCase().includes("escalated")
                    );
                    if (escalatedColumn) {
                        newMapping[targetField] = escalatedColumn;
                    } else {
                        newMapping[targetField] = "";
                    }
                } else if (
                    targetField === "receives_standard_reminder" &&
                    bestScore === 0
                ) {
                    const standardColumn = rawHeaders.find((header) => {
                        const headerLower = header.toLowerCase();
                        return (
                            headerLower.includes("standard") ||
                            headerLower.includes("remainder") ||
                            headerLower.includes("reminder") ||
                            headerLower.includes("primary") ||
                            headerLower.includes("main")
                        );
                    });
                    if (standardColumn) {
                        newMapping[targetField] = standardColumn;
                    } else {
                        newMapping[targetField] = "";
                    }
                } else {
                    newMapping[targetField] = "";
                }
            }
        });

        // Ensure reminder fields are mapped if they exist in the file
        const finalMapping = { ...newMapping };

        // Check for standard reminder field - be more flexible with matching
        if (
            !finalMapping.receives_standard_reminder ||
            finalMapping.receives_standard_reminder === ""
        ) {
            const standardField = rawHeaders.find((header) => {
                const headerLower = header.toLowerCase();
                return (
                    headerLower.includes("standard") ||
                    headerLower.includes("reminder") ||
                    headerLower.includes("remainder")
                );
            });
            if (standardField) {
                finalMapping.receives_standard_reminder = standardField;
            }
        }

        // Check for escalated reminder field - be more flexible with matching
        if (
            !finalMapping.receives_escalated_reminder ||
            finalMapping.receives_escalated_reminder === ""
        ) {
            const escalatedField = rawHeaders.find((header) => {
                const headerLower = header.toLowerCase();
                return (
                    headerLower.includes("escalated") ||
                    headerLower.includes("escalation") ||
                    headerLower.includes("secondary")
                );
            });
            if (escalatedField) {
                finalMapping.receives_escalated_reminder = escalatedField;
            }
        }

        setMapping(finalMapping);

        try {
            const existingMappings =
                await importMappingService.getMappings(importType);

            if (existingMappings.length > 0) {
                const existingMapping = existingMappings[0];

                const updatedMapping = await importMappingService.updateMapping(
                    existingMapping.id,
                    {
                        mapping: newMapping,
                        is_default: true,
                    }
                );

                // Update the saved mappings list
                setSavedMappings((prev) =>
                    prev.map((m) =>
                        m.id === existingMapping.id
                            ? (updatedMapping as unknown as UserImportMapping)
                            : m
                    )
                );
            } else {
                // Create new mapping if none exists - ensure name is never null
                const mappingName = `Auto-generated ${importType} Mapping`;
                const newMappingRecord =
                    await importMappingService.createMapping({
                        import_type: importType,
                        mapping: newMapping,
                        name: mappingName,
                        is_default: true,
                    });

                // Update the saved mappings list
                setSavedMappings((prev) => [
                    ...prev,
                    newMappingRecord as unknown as UserImportMapping,
                ]);
            }
        } catch {
            // Silent fail - errors are handled silently
        }
    }, [rawHeaders, databaseFields, importType, setMapping]);

    // Load saved mappings on component mount
    useEffect(() => {
        loadSavedMappings();
    }, [loadSavedMappings]);

    // Reset auto-mapping trigger when rawHeaders change (new file loaded)
    useEffect(() => {
        autoMappingTriggeredRef.current = false;
        hasLoadedSavedMappingRef.current = false; // Reset the saved mapping flag for new file
    }, [rawHeaders]);

    // Auto-map only when we've finished loading mappings and there are no saved mappings
    useEffect(() => {
        // Auto-map if:
        // 1. We've finished loading mappings (we know the true state)
        // 2. We have file headers and target fields
        // 3. Auto-mapping is enabled (shouldAutoMap prop)
        // 4. We haven't already triggered auto-mapping
        // 5. AND either:
        //    a) There are no saved mappings for this import type, OR
        //    b) The current mapping is empty (no fields mapped)
        if (
            hasFinishedLoadingMappings &&
            rawHeaders &&
            databaseFields &&
            shouldAutoMap &&
            !autoMappingTriggeredRef.current
        ) {
            // Only auto-map if there are no saved mappings OR if the current mapping is completely empty
            const currentMapping = mappingRef.current;
            const hasEmptyMapping = Object.keys(currentMapping).length === 0;
            const hasLoadedSavedMapping = hasLoadedSavedMappingRef.current;

            // Auto-map if the mapping is completely empty (regardless of saved mappings)
            // AND we haven't already loaded a saved mapping
            if (hasEmptyMapping && !hasLoadedSavedMapping) {
                autoMappingTriggeredRef.current = true;
                handleAutoMap();
            } else {
                // Check if we need to auto-map specific fields that might be missing
                const currentMapping = mappingRef.current;
                const needsReminderMapping =
                    !currentMapping.receives_standard_reminder ||
                    !currentMapping.receives_escalated_reminder;

                if (needsReminderMapping) {
                    autoMappingTriggeredRef.current = true;
                    handleAutoMap();
                }
            }
        }
    }, [
        hasFinishedLoadingMappings,
        savedMappings.length,
        rawHeaders,
        databaseFields,
        shouldAutoMap,
    ]);

    const handleLoadMapping = async (savedMapping: UserImportMapping) => {
        try {
            setMapping(savedMapping.mapping as Record<string, string>);
            setLoadDialogOpen(false);
        } catch {
            // Silent fail - errors are handled silently
        }
    };

    const handleDeleteMapping = async (mappingId: string) => {
        try {
            await importMappingService.deleteMapping(mappingId);
            await loadSavedMappings();
        } catch {
            // Silent fail - errors are handled silently
        }
    };

    const handleSetDefault = async (mappingId: string) => {
        try {
            const mapping = savedMappings.find((m) => m.id === mappingId);
            if (mapping) {
                await importMappingService.updateMapping(mappingId, {
                    is_default: true,
                });
                await loadSavedMappings();
            }
        } catch {
            // Silent fail - errors are handled silently
        }
    };

    // Handle saving the current mapping
    const handleSaveMapping = async () => {
        try {
            if (savedMappings.length > 0) {
                // Update existing mapping
                const existingMapping =
                    savedMappings.find((m) => m.is_default) || savedMappings[0];

                const updatedMapping = await importMappingService.updateMapping(
                    existingMapping.id,
                    {
                        mapping: mapping,
                        is_default: true,
                    }
                );

                // Update the saved mappings list
                setSavedMappings((prev) =>
                    prev.map((m) =>
                        m.id === existingMapping.id
                            ? (updatedMapping as unknown as UserImportMapping)
                            : m
                    )
                );

                // Show success toast for updated mapping
                showToast(
                    t("fields.field_mapping_mapping_updated", { ns: "import" }),
                    "success"
                );
            } else {
                // Create new mapping if none exists - ensure name is never null
                const mappingName = `Manual ${importType} Mapping`;

                const newMappingRecord =
                    await importMappingService.createMapping({
                        import_type: importType,
                        mapping: mapping,
                        name: mappingName,
                        is_default: true,
                    });

                // Update the saved mappings list
                setSavedMappings((prev) => [
                    ...prev,
                    newMappingRecord as unknown as UserImportMapping,
                ]);

                // Show success toast for new mapping
                showToast(
                    t("fields.field_mapping_mapping_created", { ns: "import" }),
                    "success"
                );
            }

            setHasUnsavedChanges(false);
        } catch (error: any) {
            // Check for authentication errors
            if (
                error.message &&
                (error.message.includes("401") ||
                    error.message.includes("Unauthorized"))
            ) {
                showToast(
                    "Session expired. Please refresh the page and log in again.",
                    "error"
                );
            } else {
                // Show generic error toast
                showToast(
                    t("fields.field_mapping_mapping_save_error", {
                        ns: "import",
                    }),
                    "error"
                );
            }
        }
    };

    // Handle Autocomplete change
    const handleAutocompleteChange = (
        dbField: string,
        newValue: string | null
    ) => {
        const newMapping = { ...mapping, [dbField]: newValue || "" };
        setMapping(newMapping);
        setHasUnsavedChanges(true);
    };

    return (
        <Box
            sx={{
                width: "100%",
                overflow: "hidden",
                boxSizing: "border-box",
                ...rtlStyles,
            }}
        >
            {/* Header */}
            <Box
                display="flex"
                flexDirection={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                gap={{ xs: 1, sm: 0 }}
                bgcolor="background.paper"
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <InfoOutlinedIcon
                        sx={{
                            color: "primary.main",
                            fontSize: { xs: 18, sm: 20 },
                        }}
                    />
                    <Typography
                        sx={{
                            fontWeight: "500 !important",
                            fontSize: { xs: "1rem", sm: "1.25rem" },
                            color: "text.primary",
                            lineHeight: 1.2,
                            fontFamily: "inherit",
                            display: "block",
                            ...rtlStyles,
                            "&.MuiTypography-root": {
                                fontWeight: "500 !important",
                            },
                        }}
                    >
                        {t("fields.field_mapping_field_mapping", {
                            ns: "import",
                        })}
                    </Typography>
                    {isAutoMapping && (
                        <Chip
                            label={
                                i18n.language === "he"
                                    ? "×ž×™×¤×•×™ ××•×˜×•×ž×˜×™..."
                                    : "Auto-mapping..."
                            }
                            size="small"
                            variant="outlined"
                            sx={{
                                borderColor: theme.palette.chartPalette.main,
                                color: theme.palette.chartPalette.main,
                            }}
                        />
                    )}
                </Box>

                {/* Mapping management buttons */}
                <Box
                    display="flex"
                    gap={1}
                    flexWrap="wrap"
                    justifyContent={{ xs: "center", sm: "flex-end" }}
                >
                    {/* Manual auto-map button */}
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleAutoMap}
                    >
                        {i18n.language === "he" ? "×ž×™×¤×•×™ ××•×˜×•×ž×˜×™" : "Auto-Map"}
                    </Button>

                    {/* Clear mapping button */}
                    <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={() => {
                            setMapping({});
                            setHasUnsavedChanges(true);
                        }}
                    >
                        {i18n.language === "he" ? "× ×§×”" : "Clear"}
                    </Button>

                    {/* Show save button only when there are unsaved changes */}
                    {hasUnsavedChanges && (
                        <Button
                            variant="contained"
                            size="small"
                            color="success"
                            onClick={handleSaveMapping}
                        >
                            {i18n.language === "he"
                                ? "×©×ž×•×¨ ×ž×™×¤×•×™"
                                : "Save Mapping"}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Table */}
            <TableContainer
                sx={{
                    maxWidth: "100%",
                    overflowX: "auto",
                    width: "100%",
                    mt: 2,
                    borderRadius: theme.shape.borderRadius,
                    overflow: "hidden",
                    minHeight: "200px",
                }}
            >
                <Table
                    size="small"
                    sx={{
                        tableLayout: "fixed",
                    }}
                >
                    <TableHead>
                        <TableRow
                            sx={{
                                bgcolor: `${theme.palette.grey[50]} !important`,
                                ...rtlStyles,
                                "& .MuiTableCell-head": {
                                    backgroundColor: `${theme.palette.grey[50]} !important`,
                                    color: `${theme.palette.text.primary} !important`,
                                    ...rtlStyles,
                                },
                            }}
                        >
                            <TableCell
                                sx={{
                                    fontWeight: 600,
                                    width: "40%",
                                    borderRight: `1px solid ${theme.palette.divider}`,
                                    ...tableCellStyles,
                                }}
                                style={rtlStyles}
                            >
                                {t("fields.field_mapping_db_field", {
                                    ns: "import",
                                })}
                            </TableCell>
                            <TableCell
                                sx={{
                                    fontWeight: 600,
                                    width: "60%",
                                    ...tableCellStyles,
                                }}
                                style={rtlStyles}
                            >
                                {t("fields.field_mapping_file_column", {
                                    ns: "import",
                                })}
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {useMemo(
                            () =>
                                databaseFields.map((dbField) => {
                                    const fileField = mapping[dbField] || "";
                                    const desc = fieldDescriptions[dbField];
                                    const example = exampleValues[dbField];

                                    return (
                                        <TableRow
                                            key={dbField}
                                            hover
                                            sx={{
                                                minHeight: "48px",
                                                ...rtlStyles,
                                                "& .MuiTableCell-root":
                                                    rtlStyles,
                                            }}
                                        >
                                            <TableCell
                                                sx={{
                                                    width: "40%",
                                                    borderRight: `1px solid ${theme.palette.divider} !important`,
                                                    ...tableCellStyles,
                                                }}
                                                style={rtlStyles}
                                            >
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems:
                                                            "flex-start",
                                                        gap: {
                                                            xs: 0.25,
                                                            sm: 0.5,
                                                        },
                                                        width: "100%",
                                                        ...rtlStyles,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            lineHeight: 1.3,
                                                            flex: 1,
                                                        }}
                                                    >
                                                        {fieldLabels?.[
                                                            dbField
                                                        ] || dbField}
                                                    </Typography>
                                                    {requiredFieldSet.has(
                                                        dbField
                                                    ) && (
                                                        <Chip
                                                            size="small"
                                                            label="Required"
                                                            color="default"
                                                            sx={{
                                                                flexShrink: 0,
                                                            }}
                                                        />
                                                    )}
                                                    {desc && (
                                                        <Tooltip
                                                            title={
                                                                <Box
                                                                    sx={{
                                                                        direction:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                        textAlign:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "right"
                                                                                : "left",
                                                                    }}
                                                                >
                                                                    {/* Description section */}
                                                                    <Box sx={{ mb: desc.type || example ? 1 : 0 }}>
                                                                        <Typography
                                                                            component="span"
                                                                            sx={{
                                                                                fontWeight: 600,
                                                                                fontSize: "0.75rem",
                                                                                display: "block",
                                                                                mb: 0.5,
                                                                            }}
                                                                        >
                                                                            {t("fields.field_mapping_description", {
                                                                                ns: "import",
                                                                            })}
                                                                            :
                                                                        </Typography>
                                                                        <Typography
                                                                            component="span"
                                                                            sx={{
                                                                                fontSize: "0.75rem",
                                                                                display: "block",
                                                                            }}
                                                                        >
                                                                            {desc.description ||
                                                                                t(
                                                                                    "fields.field_mapping_no_description_available",
                                                                                    {
                                                                                        ns: "import",
                                                                                    }
                                                                                )}
                                                                        </Typography>
                                                                    </Box>

                                                                    {/* Type section */}
                                                                    {desc.type && (
                                                                        <Box sx={{ mb: example ? 1 : 0 }}>
                                                                            <Typography
                                                                                component="span"
                                                                                sx={{
                                                                                    fontWeight: 600,
                                                                                    fontSize: "0.75rem",
                                                                                    display: "inline",
                                                                                }}
                                                                            >
                                                                                {t("fields.field_mapping_type", {
                                                                                    ns: "import",
                                                                                })}
                                                                                :{" "}
                                                                            </Typography>
                                                                            <Typography
                                                                                component="span"
                                                                                sx={{
                                                                                    fontSize: "0.75rem",
                                                                                    display: "inline",
                                                                                }}
                                                                            >
                                                                                {desc.type}
                                                                            </Typography>
                                                                        </Box>
                                                                    )}

                                                                    {/* Example section */}
                                                                    {example && (
                                                                        <Box>
                                                                            <Typography
                                                                                component="span"
                                                                                sx={{
                                                                                    fontWeight: 600,
                                                                                    fontSize: "0.75rem",
                                                                                    display: "inline",
                                                                                }}
                                                                            >
                                                                                {t("fields.field_mapping_example", {
                                                                                    ns: "import",
                                                                                })}
                                                                                :{" "}
                                                                            </Typography>
                                                                            <Typography
                                                                                component="span"
                                                                                sx={{
                                                                                    fontSize: "0.75rem",
                                                                                    display: "inline",
                                                                                    fontFamily: "monospace",
                                                                                }}
                                                                            >
                                                                                {example}
                                                                            </Typography>
                                                                        </Box>
                                                                    )}
                                                                </Box>
                                                            }
                                                            arrow
                                                            enterDelay={300}
                                                            leaveDelay={100}
                                                            placement="bottom"
                                                            PopperProps={{
                                                                sx: {
                                                                    "& .MuiTooltip-tooltip":
                                                                    {
                                                                        direction:
                                                                            i18n.language ===
                                                                                "he"
                                                                                ? "rtl"
                                                                                : "ltr",
                                                                    },
                                                                    "& .MuiTooltip-arrow":
                                                                    {
                                                                        ...(i18n.language ===
                                                                            "he" && {
                                                                            transform:
                                                                                "scaleX(-1)",
                                                                        }),
                                                                    },
                                                                },
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    display:
                                                                        "inline-flex",
                                                                    alignItems:
                                                                        "center",
                                                                    flexShrink: 0,
                                                                }}
                                                            >
                                                                <IconButton
                                                                    size="small"
                                                                    sx={{
                                                                        p: {
                                                                            xs: 0.125,
                                                                            sm: 0.25,
                                                                        },
                                                                        color: "primary.main",
                                                                        "&:hover":
                                                                        {
                                                                            bgcolor:
                                                                                "primary.50",
                                                                            color: "primary.dark",
                                                                        },
                                                                    }}
                                                                >
                                                                    <InfoOutlinedIcon
                                                                        sx={{
                                                                            fontSize:
                                                                            {
                                                                                xs: "0.75rem",
                                                                                sm: "0.875rem",
                                                                            },
                                                                        }}
                                                                    />
                                                                </IconButton>
                                                            </Box>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    width: "60%",
                                                    ...tableCellStyles,
                                                }}
                                                style={rtlStyles}
                                            >
                                                <Box
                                                    sx={{
                                                        maxWidth: "400px",
                                                        width: "100%",
                                                    }}
                                                >
                                                    <Autocomplete
                                                        size="small"
                                                        value={fileField || null}
                                                        onChange={(event, newValue) =>
                                                            handleAutocompleteChange(
                                                                dbField,
                                                                newValue
                                                            )
                                                        }
                                                        options={rawHeaders}
                                                        getOptionLabel={(option) =>
                                                            option || ""
                                                        }
                                                        isOptionEqualToValue={(
                                                            option,
                                                            value
                                                        ) => option === value}
                                                        dir={rtlStyles.direction}
                                                        {...(isRTL && {
                                                            "data-rtl": true,
                                                        })}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                placeholder={t(
                                                                    "fields.field_mapping_select_field",
                                                                    {
                                                                        ns: "import",
                                                                    }
                                                                )}
                                                                dir={rtlStyles.direction}
                                                                {...(isRTL && {
                                                                    "data-rtl": true,
                                                                })}
                                                                sx={{
                                                                    fontSize:
                                                                        theme
                                                                            .typography
                                                                            .body2
                                                                            .fontSize,
                                                                    "& .MuiOutlinedInput-root":
                                                                    {
                                                                        direction:
                                                                            rtlStyles.direction,
                                                                    },
                                                                    "& .MuiAutocomplete-endAdornment":
                                                                    {
                                                                        left: isRTL
                                                                            ? "8px"
                                                                            : "auto",
                                                                        right: isRTL
                                                                            ? "auto"
                                                                            : "8px",
                                                                    },
                                                                }}
                                                            />
                                                        )}
                                                        renderOption={(
                                                            props,
                                                            option
                                                        ) => {
                                                            const {
                                                                key,
                                                                ...restProps
                                                            } = props;
                                                            return (
                                                                <Box
                                                                    component="li"
                                                                    key={key}
                                                                    {...restProps}
                                                                    sx={{
                                                                        ...rtlStyles,
                                                                        display: "flex",
                                                                        alignItems:
                                                                            "center",
                                                                        minHeight: "48px",
                                                                        padding: "2px 6px",
                                                                    }}
                                                                >
                                                                    <Typography
                                                                        variant="body2"
                                                                        sx={{
                                                                            textOverflow:
                                                                                "ellipsis",
                                                                            overflow:
                                                                                "hidden",
                                                                            whiteSpace:
                                                                                "nowrap",
                                                                            ...rtlStyles,
                                                                        }}
                                                                    >
                                                                        {option}
                                                                    </Typography>
                                                                </Box>
                                                            );
                                                        }}
                                                        sx={autocompleteStyles}
                                                    />
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }),
                            [
                                databaseFields,
                                mapping,
                                fieldDescriptions,
                                exampleValues,
                                fieldLabels,
                                i18n.language,
                                theme,
                                t,
                            ]
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Load Mapping Dialog */}
            <AppDialog
                open={loadDialogOpen}
                onClose={() => setLoadDialogOpen(false)}
                drag={false}
                align={false}
                slide={false}
                isRTL={isRTL}
                title={t("fields.field_mapping_load_mapping", { ns: "import" })}
                titleIcon={null}
                ariaLabelledBy="field-mapper-load-dialog-title"
                ariaDescribedBy="field-mapper-load-dialog-description"
                maxWidth="md"
                fullWidth
                actions={
                    <Button onClick={() => setLoadDialogOpen(false)}>
                        {t("common.close")}
                    </Button>
                }
            >
                <Box id="field-mapper-load-dialog-description" component="div">
                    {isLoadingMappings ? (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                height: 200,
                            }}
                        >
                            <CircularProgress
                                color="primary"
                                size={32}
                                thickness={4}
                            />
                        </Box>
                    ) : savedMappings.length === 0 ? (
                        <Typography color="text.secondary">
                            {t("fields.field_mapping_no_saved_mappings", {
                                ns: "import",
                            })}
                        </Typography>
                    ) : (
                        <List>
                            {savedMappings.map((savedMapping) => (
                                <ListItem key={savedMapping.id} divider>
                                    <ListItemText
                                        primary={
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 1,
                                                }}
                                            >
                                                {savedMapping.name ||
                                                    t(
                                                        "import.field_mapping.unnamedMapping"
                                                    )}
                                                {savedMapping.is_default && (
                                                    <Chip
                                                        label={t(
                                                            "import.field_mapping.default"
                                                        )}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            fontSize: "0.7rem",
                                                            borderColor:
                                                                theme.palette.chartPalette.main,
                                                            color: theme.palette.chartPalette.main,
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {new Date(
                                                    savedMapping.modified_at
                                                ).toLocaleDateString()}{" "}
                                                -{" "}
                                                {
                                                    Object.keys(
                                                        (savedMapping.mapping as Record<
                                                            string,
                                                            any
                                                        >) || {}
                                                    ).length
                                                }{" "}
                                                fields
                                            </Typography>
                                        }
                                    />
                                    <ListItemSecondaryAction>
                                        <Box sx={{ display: "flex", gap: 1 }}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() =>
                                                    handleSetDefault(
                                                        String(savedMapping.id)
                                                    )
                                                }
                                                disabled={
                                                    savedMapping.is_default
                                                }
                                                sx={{ minWidth: "auto", px: 1 }}
                                            >
                                                {savedMapping.is_default
                                                    ? t(
                                                        "fields.field_mapping_default",
                                                        { ns: "import" }
                                                    )
                                                    : t(
                                                        "fields.field_mapping_set_default",
                                                        { ns: "import" }
                                                    )}
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() =>
                                                    handleLoadMapping(
                                                        savedMapping
                                                    )
                                                }
                                                sx={{ minWidth: "auto", px: 1 }}
                                            >
                                                {t("common.load_data")}
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() =>
                                                    handleDeleteMapping(
                                                        String(savedMapping.id)
                                                    )
                                                }
                                                color="error"
                                                sx={{ minWidth: "auto", px: 1 }}
                                            >
                                                {i18n.language === "he"
                                                    ? "× ×§×”"
                                                    : "Clear"}
                                            </Button>
                                        </Box>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </AppDialog>
        </Box>
    );
};

export default FieldMapper;
