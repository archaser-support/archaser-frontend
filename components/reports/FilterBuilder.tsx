"use client";

import {
    Add,
    Clear as ClearIcon,
    Delete,
    ExpandMore,
    Person,
    Search as SearchIcon,
} from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Collapse,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputAdornment,
    InputLabel,
    ListItemText,
    MenuItem,
    OutlinedInput,
    Paper,
    Select,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { useQuery } from "@tanstack/react-query";
import moment, { Moment } from "moment";
import React from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import { useSessionState } from "@/hooks/useSessionState";
import { currencies, Currency } from "@/shared/data/common/currencies";
import {
    type DatePreset,
    isDatePresetValue,
    resolveDatePreset,
    resolveDatePresetRange,
} from "@/utils/datePresetUtils";
import {
    formatDateForDisplay,
    getDatePickerFormat,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

/** Option row for {@link ReportFilterInMultiSelect}. */
interface ReportFilterInOption {
    value: string;
    label: string;
}

/**
 * Multi-value "in" filter control — same interaction pattern as Related Invoices
 * in `LogActivity.tsx` (Select + chips + search field + checkbox rows).
 */
function ReportFilterInMultiSelect({
    idBase,
    labelText,
    emptyPlaceholder,
    searchPlaceholder,
    noOptionsLabel,
    noResultsLabel,
    loadingLabel,
    options,
    value,
    onChange,
    isRTL,
    isHebrew,
    loading = false,
}: {
    idBase: string;
    labelText: string;
    emptyPlaceholder: string;
    searchPlaceholder: string;
    noOptionsLabel: string;
    noResultsLabel: string;
    loadingLabel: string;
    options: ReportFilterInOption[];
    value: string[];
    onChange: (next: string[]) => void;
    isRTL: boolean;
    isHebrew: boolean;
    loading?: boolean;
}) {
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState("");

    React.useEffect(() => {
        if (!open) {
            setSearch("");
        }
    }, [open]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, search]);

    const labelId = `${idBase}-label`;
    const selectId = `${idBase}-select`;

    const labelForValue = (v: string) =>
        options.find((o) => o.value === v)?.label ?? v;

    const selectSx = {
        minHeight: "32px",
        "& .MuiSelect-icon": {
            top: "50%",
            transform: "translateY(-50%)",
            ...(isRTL
                ? {
                      right: "auto !important",
                      left: "8px !important",
                      fontSize: "1.5rem !important",
                      color: "primary.main !important",
                      position: "absolute !important",
                  }
                : {
                      right: "9px !important",
                  }),
        },
        ...(isRTL && {
            "& .MuiSelect-select": {
                textAlign: "right",
                direction: "rtl",
                paddingRight: "14px !important",
                paddingLeft: "42px !important",
            },
            "& .MuiOutlinedInput-notchedOutline": {
                direction: "rtl !important",
            },
            "& .MuiOutlinedInput-notchedOutline legend": {
                direction: "rtl !important",
                textAlign: "right !important",
            },
        }),
    } as const;

    return (
        <FormControl
            fullWidth
            size="small"
            {...(isHebrew && { "data-hebrew": true, "data-rtl": true })}
            sx={{
                direction: isRTL ? "rtl" : "ltr",
            }}
        >
            <InputLabel
                id={labelId}
                sx={{
                    fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.875rem" },
                    color: "primary.main",
                    textAlign: isRTL ? "right" : "left",
                    direction: isRTL ? "rtl" : "ltr",
                    ...(isRTL && {
                        right: "14px",
                        left: "auto",
                        transform: "translate(0px, 9px) scale(1)",
                        transformOrigin: "right top",
                        position: "absolute",
                        "&.MuiInputLabel-shrink": {
                            transform:
                                "translate(0px, -9px) scale(0.75) !important",
                            transformOrigin: "right top !important",
                            right: "14px",
                            left: "auto",
                            top: "0px",
                        },
                    }),
                }}
            >
                {labelText}
            </InputLabel>
            <Select<string[]>
                labelId={labelId}
                id={selectId}
                multiple
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                value={value}
                onChange={(e) => {
                    const raw = e.target.value;
                    const next = Array.isArray(raw)
                        ? raw
                        : typeof raw === "string" && raw
                          ? [raw]
                          : [];
                    onChange(next);
                    setOpen(true);
                }}
                sx={selectSx}
                input={<OutlinedInput size="small" label={labelText} />}
                renderValue={() => (
                    <>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 0.5,
                                height: "100%",
                                maxHeight: 60,
                                overflow: "auto",
                                pr:
                                    value.length > 0
                                        ? isRTL
                                            ? "0"
                                            : "56px"
                                        : 0,
                                pl:
                                    value.length > 0
                                        ? isRTL
                                            ? "56px"
                                            : "0"
                                        : 0,
                            }}
                        >
                            {value.length === 0 ? (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {emptyPlaceholder}
                                </Typography>
                            ) : (
                                value.map((v) => (
                                    <Chip
                                        key={v}
                                        label={labelForValue(v)}
                                        size="small"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                        onDelete={() =>
                                            onChange(
                                                value.filter((x) => x !== v)
                                            )
                                        }
                                    />
                                ))
                            )}
                        </Box>
                        {value.length > 0 && (
                            <IconButton
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onChange([]);
                                    setOpen(false);
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                size="small"
                                sx={{
                                    position: "absolute",
                                    right: isRTL ? "auto" : "32px",
                                    left: isRTL ? "36px" : "auto",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    height: 28,
                                    width: 28,
                                    zIndex: 1,
                                    "& .MuiSvgIcon-root": {
                                        fontSize: "1.5rem !important",
                                    },
                                }}
                            >
                                <ClearIcon />
                            </IconButton>
                        )}
                    </>
                )}
                MenuProps={{
                    PaperProps: { style: { maxHeight: 300 } },
                    keepMounted: true,
                    onClose: (_event, reason) => {
                        if (
                            reason === "escapeKeyDown" ||
                            reason === "backdropClick" ||
                            reason === "tabKeyDown"
                        ) {
                            setOpen(false);
                        }
                    },
                }}
            >
                <Box
                    sx={{
                        p: 1,
                        borderBottom: 1,
                        borderColor: "divider",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <TextField
                        size="small"
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        fullWidth
                        dir={isRTL ? "rtl" : "ltr"}
                        {...(isHebrew && { "data-hebrew": true })}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: search ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => setSearch("")}
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : undefined,
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                    />
                </Box>
                {loading ? (
                    <MenuItem disabled sx={{ py: 2, textAlign: "center" }}>
                        {loadingLabel}
                    </MenuItem>
                ) : filtered.length > 0 ? (
                    filtered.map((opt) => {
                        const isSelected = value.includes(opt.value);
                        return (
                            <MenuItem
                                key={opt.value}
                                value={opt.value}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    py: 1,
                                }}
                            >
                                <Checkbox checked={isSelected} sx={{ p: 0 }} />
                                <ListItemText
                                    primary={opt.label}
                                    primaryTypographyProps={{
                                        fontSize: "0.875rem",
                                    }}
                                />
                            </MenuItem>
                        );
                    })
                ) : (
                    <MenuItem disabled sx={{ py: 2, textAlign: "center" }}>
                        {search.trim() ? noResultsLabel : noOptionsLabel}
                    </MenuItem>
                )}
            </Select>
        </FormControl>
    );
}

interface Filter {
    table: string;
    field: string;
    operator: string;
    value: any;
}

export type FilterBuilderMode = "builder" | "viewer";

interface FilterBuilderProps {
    mode?: FilterBuilderMode;
    selectedTables: string[];
    tables: Array<{
        name: string;
        label: string;
        fields: Array<{
            name: string;
            type: string;
            label: string;
            options?: string[];
            translationKey?: string;
            translationNamespace?: string;
        }>;
    }>;
    filters: Filter[];
    onFiltersChange: (filters: Filter[]) => void;
    validationErrors?: Record<number, string>;
}

/**
 * Fields whose stored value is a set of codes rather than one value, so only
 * multi-select and presence operators make sense.
 */
export const PICK_LIST_ONLY_FIELD_KEYS = new Set(["terms_breach_reason"]);

/** Lookup-backed string fields that support Prisma `in` (multi-select OR). */
export const REPORT_LOOKUP_FIELD_KEYS_WITH_IN = new Set([
    "Country.name",
    "State.name",
    "BusinessUnit.name",
    "dispute_reason",
    "customer_currency",
    "InsurancePolicy.policy_number",
]);

const FilterBuilder: React.FC<FilterBuilderProps> = ({
    mode = "builder",
    selectedTables,
    tables,
    filters,
    onFiltersChange,
    validationErrors = {},
}) => {
    const isViewer = mode === "viewer";
    const { t, i18n } = useTranslation([
        "reports",
        "common",
        "customers",
        "invoices",
        "disputes",
        "activities",
        "contacts",
        "companies",
        "accounts",
    ]);
    const theme = useTheme();
    const { session } = useSessionState();
    const isHebrew = i18n.language === "he";
    const isRTL = isHebrew;

    const datePickerFormat = React.useMemo(
        () =>
            i18n.language === "he"
                ? "DD/MM/YYYY"
                : getDatePickerFormat(session ?? null, "DD/MM/YYYY"),
        [session, i18n.language]
    );

    const dateTimePickerFormat = React.useMemo(
        () =>
            getUserDateLocale(session ?? null) === "he-IL"
                ? "DD/MM/YYYY HH:mm"
                : "MM/DD/YYYY hh:mm A",
        [session]
    );
    const [users, setUsers] = React.useState<
        Array<{
            id: string;
            name: string;
            email?: string;
            first_name?: string;
            last_name?: string;
        }>
    >([]);
    const [usersLoading, setUsersLoading] = React.useState(false);

    type DatePresetWithCustom = DatePreset | "custom";

    interface DatePresetOption {
        value: DatePresetWithCustom;
        label: string;
        requiresInput?: boolean;
    }

    const [dateMode, setDateMode] = React.useState<Record<number, "custom" | "preset">>({});
    const [datePreset, setDatePreset] = React.useState<Record<number, DatePresetWithCustom>>({});
    const [datePresetInput, setDatePresetInput] = React.useState<Record<number, number>>({});

    // Sync dateMode/datePreset from filter values when filters load (e.g. from saved report)
    React.useEffect(() => {
        filters.forEach((filter, index) => {
            const val = filter.value;
            if (
                val &&
                typeof val === "object" &&
                "__datePreset" in val &&
                typeof (val as any).__datePreset === "string"
            ) {
                const preset = (val as any).__datePreset as DatePreset;
                const input = (val as any).__datePresetInput as number | undefined;
                setDateMode((prev) => ({ ...prev, [index]: "preset" }));
                setDatePreset((prev) => ({ ...prev, [index]: preset }));
                if (input !== undefined) {
                    setDatePresetInput((prev) => ({ ...prev, [index]: input }));
                }
            }
        });
    }, [filters]);

    // State for expanded filters
    const [expandedFilters, setExpandedFilters] = React.useState<Set<number>>(new Set());

    // Country and State types
    interface CountryType {
        id: number;
        name: string;
        emoji: string | null;
    }

    interface StateType {
        id: number;
        name: string;
        country_id: number;
    }

    interface BusinessUnitType {
        id: number;
        name: string;
        status?: string;
    }

    // Fetch countries
    const { data: countries = [], isLoading: countriesLoading } = useQuery<
        CountryType[]
    >({
        queryKey: ["countries"],
        queryFn: async () => {
            const response = await api.get<CountryType[]>("/country");
            return response.data;
        },
    });

    // Fetch states (all states, not filtered by country for simplicity)
    const { data: states = [], isLoading: statesLoading } = useQuery<
        StateType[]
    >({
        queryKey: ["states"],
        queryFn: async () => {
            const response = await api.get<StateType[]>("/state");
            return response.data;
        },
    });

    const accountIdForBusinessUnits =
        session?.user?.view_as_user_account_id || session?.user?.account_id;

    const { data: businessUnits = [], isLoading: businessUnitsLoading } =
        useQuery<BusinessUnitType[]>({
            queryKey: ["report-business-units", accountIdForBusinessUnits],
            queryFn: async () => {
                if (!accountIdForBusinessUnits) {
                    return [];
                }
                const response = await api.get(
                    `/entities/accounts/${accountIdForBusinessUnits}/business-units`,
                    {
                        params: {
                            page: 1,
                            limit: 500,
                            sortField: "name",
                            sortDirection: "asc",
                        },
                    }
                );
                const payload = response.data;
                return Array.isArray(payload) ? payload : payload.data || [];
            },
            enabled: !!accountIdForBusinessUnits,
        });

    // DisputeReason type
    interface DisputeReasonType {
        id: number;
        name: string;
    }

    // Fetch dispute reasons
    const { data: disputeReasonsData, isLoading: disputeReasonsLoading } =
        useQuery<{ disputeReasons: DisputeReasonType[] }>({
            queryKey: ["dispute-reasons"],
            queryFn: async () => {
                const accountId =
                    session?.user?.view_as_user_account_id ||
                    session?.user?.account_id;
                if (!accountId) return { disputeReasons: [] };
                const response = await api.get("/operations/dispute-reasons", {
                    params: {
                        account_id: accountId,
                        page: 1,
                        limit: 100, // API max is 100
                    },
                });
                return response.data;
            },
            enabled: !!session,
        });

    const disputeReasons = disputeReasonsData?.disputeReasons || [];

    interface InsurancePolicyOption {
        id: number;
        policy_number: string;
    }

    const { data: insurancePoliciesData, isLoading: insurancePoliciesLoading } =
        useQuery<{ policies: InsurancePolicyOption[] }>({
            queryKey: [
                "report-insurance-policies",
                session?.user?.view_as_user_account_id ??
                    session?.user?.account_id,
            ],
            queryFn: async () => {
                const accountId =
                    session?.user?.view_as_user_account_id ||
                    session?.user?.account_id;
                if (!accountId) {
                    return { policies: [] as InsurancePolicyOption[] };
                }
                const response = await api.get("/entities/insurance-policies", {
                    params: {
                        account_id: accountId,
                        effectively_active: 1,
                    },
                });
                return response.data as { policies: InsurancePolicyOption[] };
            },
            enabled: !!session,
        });

    const insurancePolicies = insurancePoliciesData?.policies ?? [];

    // Shared styles for filter components (defined at component level for reuse)
    const filterAutocompleteStyles = React.useMemo(
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
            "& .MuiInputLabel-root": {
                whiteSpace: "nowrap",
                overflow: "visible",
                textOverflow: "clip",
            },
        }),
        []
    );

    const filterTextFieldStyles = React.useMemo(
        () => ({
            padding: 0,
            margin: 0,
            "& .MuiFormControl-root": {
                padding: 0,
                margin: 0,
            },
            "& .MuiInputLabel-root": {
                whiteSpace: "nowrap",
                overflow: "visible",
                textOverflow: "clip",
            },
        }),
        []
    );

    const filterFormControlStyles = React.useMemo(
        () => ({
            minWidth: 200,
            padding: 0,
            margin: 0,
            direction: isRTL ? "rtl" : "ltr",
        }),
        [isRTL]
    );

    const rtlTypographyStyles = React.useMemo(
        () => ({
            direction: isRTL ? "rtl" : "ltr",
            textAlign: isRTL ? "right" : "left",
        }),
        [isRTL]
    );

    const rtlMenuItemStyles = React.useMemo(
        () => ({
            direction: isRTL ? "rtl" : "ltr",
            textAlign: isRTL ? "right" : "left",
        }),
        [isRTL]
    );

    /** Side-by-side start/end pickers must shrink inside narrow modals (no fixed minWidth). */
    const betweenRangePickerLayoutSx = React.useMemo(
        () => ({
            row: {
                display: "flex",
                gap: 1,
                alignItems: "flex-start",
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
                flexWrap: "wrap" as const,
            },
            item: {
                flex: "1 1 140px",
                minWidth: 0,
                maxWidth: "100%",
            },
            textField: {
                margin: 0,
                width: "100%",
                maxWidth: "100%",
                "& .MuiFormControl-root": {
                    margin: 0,
                    width: "100%",
                    maxWidth: "100%",
                },
                "& .MuiOutlinedInput-root": {
                    width: "100%",
                    maxWidth: "100%",
                },
                "& .MuiInputBase-root": {
                    width: "100%",
                    maxWidth: "100%",
                },
            },
        }),
        []
    );

    // Normalize field names (remove Company. prefix for Customer table)
    const normalizeFieldName = React.useCallback(
        (tableName: string, fieldName: string): string => {
            if (tableName === "Customer" && fieldName.startsWith("Company.")) {
                return fieldName.replace("Company.", "");
            }
            return fieldName;
        },
        []
    );

    // Normalize field names and validate operators in filters
    React.useEffect(() => {
        let hasChanges = false;
        const normalizedFilters = filters.map((filter) => {
            const normalizedField = normalizeFieldName(
                filter.table,
                filter.field
            );

            // Get available fields for the table (excluding id fields, but allow owner/owner_id)
            const availableFields = getTableFields(filter.table).filter((f) => {
                const fieldNameLower = f.name.toLowerCase();
                // Allow owner/owner_id fields (they're user reference fields like created_by/modified_by)
                if (
                    fieldNameLower === "owner" ||
                    fieldNameLower === "owner_id"
                ) {
                    return true;
                }
                return (
                    fieldNameLower !== "id" && !fieldNameLower.endsWith("_id")
                );
            });

            // Check if the field is valid
            const isValidField = availableFields.some(
                (f) => f.name === normalizedField
            );
            const validField = isValidField
                ? normalizedField
                : availableFields.length > 0
                    ? availableFields[0].name
                    : "";

            const fieldInfo = getFieldInfo(filter.table, validField);
            // Treat owner/owner_id fields as user type (like created_by/modified_by)
            const isOwnerField =
                validField === "owner" || validField === "owner_id";
            const fieldTypeForOperators = isOwnerField
                ? "user"
                : fieldInfo?.type || "string";
            const operators = fieldInfo
                ? getOperatorsForFilterField(
                      fieldTypeForOperators,
                      validField
                  )
                : [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                    {
                        value: "not_equals",
                        label: t("values.operator_not_equals", {
                            ns: "reports",
                            defaultValue: "Not Equals",
                        }),
                    },
                ];

            const isValidOperator = operators.some(
                (op) => op.value === filter.operator
            );
            const updatedFilter: any = { ...filter };

            if (normalizedField !== filter.field) {
                updatedFilter.field = normalizedField;
                hasChanges = true;
            }

            // Fix invalid fields (like "id" that's not in available options)
            if (!isValidField && validField && normalizedField !== validField) {
                updatedFilter.field = validField;
                hasChanges = true;
            }

            if (!isValidOperator && operators.length > 0) {
                updatedFilter.operator = operators[0].value;
                updatedFilter.value = "";
                hasChanges = true;
            }

            return updatedFilter;
        });

        if (hasChanges) {
            onFiltersChange(normalizedFilters);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount to fix old field names and invalid fields

    // Fetch users for autocomplete
    React.useEffect(() => {
        const fetchUsers = async () => {
            try {
                const accountId =
                    session?.user?.view_as_user_account_id ||
                    session?.user?.account_id;
                if (!accountId) return;

                setUsersLoading(true);
                const response = await api.get("/entities/users", {
                    params: {
                        account_id: accountId,
                        page: 1,
                        limit: 1000, // Get all users for autocomplete
                    },
                });
                setUsers(response.data?.users || []);
            } catch (error) {
                console.error("Failed to fetch users:", error);
            } finally {
                setUsersLoading(false);
            }
        };

        if (session) {
            fetchUsers();
        }
    }, [session]);

    // Helper to get translated field label
    const getTranslatedFieldLabel = React.useCallback(
        (
            tableName: string,
            fieldName: string,
            defaultLabel: string,
            field?: { translationKey?: string; translationNamespace?: string }
        ): string => {
            // First, try using metadata's translationKey and translationNamespace if available
            if (field?.translationKey && field?.translationNamespace) {
                const translationKey = `fields.${field.translationKey}`;
                const translation = t(translationKey, {
                    ns: field.translationNamespace,
                    defaultValue: "",
                });
                if (translation && translation !== translationKey) {
                    return translation;
                }
            }

            // Try table-specific translation (e.g., customers.fields.total_due_amount)
            const tableNamespace = tableName.toLowerCase();
            const tableSpecificKey = `fields.${fieldName}`;
            const tableTranslation = t(tableSpecificKey, {
                ns: tableNamespace,
                defaultValue: "",
            });

            if (tableTranslation && tableTranslation !== tableSpecificKey) {
                return tableTranslation;
            }

            // Try reports namespace
            const reportsTranslation = t(`fields.${fieldName}`, {
                ns: "reports",
                defaultValue: "",
            });

            if (
                reportsTranslation &&
                reportsTranslation !== `fields.${fieldName}`
            ) {
                return reportsTranslation;
            }

            // Fallback to default label from metadata
            return defaultLabel;
        },
        [t]
    );

    const getTableFields = React.useCallback(
        (tableName: string) => {
            const table = tables.find((t) => t.name === tableName);
            // Filter out ID fields from base table fields (except owner/owner_id which are user references)
            let fields = (table?.fields || [])
                .filter((f) => {
                    const fieldNameLower = f.name.toLowerCase();
                    // Allow owner/owner_id fields (they're user reference fields like created_by/modified_by)
                    if (
                        fieldNameLower === "owner" ||
                        fieldNameLower === "owner_id"
                    ) {
                        return true;
                    }
                    // Exclude ID fields
                    return (
                        fieldNameLower !== "id" &&
                        !fieldNameLower.endsWith("_id")
                    );
                })
                .map((field) => ({
                    ...field,
                    label: getTranslatedFieldLabel(
                        tableName,
                        field.name,
                        field.label || field.name,
                        field
                    ),
                }));

            // If Customer table, include Company fields directly (without id, created_at, modified_at)
            if (tableName === "Customer") {
                const companyTable = tables.find((t) => t.name === "Company");

                if (companyTable?.fields) {
                    const companyFields = companyTable.fields
                        .filter((f) => {
                            const fieldNameLower = f.name.toLowerCase();
                            return (
                                fieldNameLower !== "id" &&
                                !fieldNameLower.endsWith("_id") &&
                                fieldNameLower !== "created_at" &&
                                fieldNameLower !== "modified_at" &&
                                // Exclude fields that are already handled as Customer virtual fields
                                fieldNameLower !== "name" &&
                                fieldNameLower !== "company_number"
                            );
                        })
                        .map((field) => ({
                            ...field,
                            name: field.name,
                            label: getTranslatedFieldLabel(
                                "Company",
                                field.name,
                                field.label || field.name,
                                field
                            ),
                        }));
                    fields = [...fields, ...companyFields];
                }

                // Add Country and State fields for Customer table (only if not already present)
                if (!fields.some((f) => f.name === "Country.name")) {
                    fields.push({
                        name: "Country.name",
                        type: "string",
                        label: t("fields.country", {
                            ns: "common",
                            defaultValue: "Country",
                        }),
                    });
                }
                if (!fields.some((f) => f.name === "State.name")) {
                    fields.push({
                        name: "State.name",
                        type: "string",
                        label: t("fields.state", {
                            ns: "customers",
                            defaultValue: "State",
                        }),
                    });
                }
                if (!fields.some((f) => f.name === "BusinessUnit.name")) {
                    fields.push({
                        name: "BusinessUnit.name",
                        type: "string",
                        label: t("fields.business_unit", {
                            ns: "customers",
                            defaultValue: "Business Unit",
                        }),
                    });
                }
            }

            // Add created_by and modified_by when not already in table metadata
            if (!fields.some((f) => f.name === "created_by")) {
                fields.push({
                    name: "created_by",
                    type: "user",
                    label: t("fields.created_by", "Created By"),
                });
            }
            if (!fields.some((f) => f.name === "modified_by")) {
                fields.push({
                    name: "modified_by",
                    type: "user",
                    label: t("fields.modified_by", "Modified By"),
                });
            }

            // Sort fields alphabetically by label
            return fields.sort((a, b) => {
                const labelA = (a.label || a.name || "").toLowerCase();
                const labelB = (b.label || b.name || "").toLowerCase();
                return labelA.localeCompare(labelB);
            });
        },
        [tables, t, getTranslatedFieldLabel]
    );

    const getTableLabel = React.useCallback(
        (tableName: string) => {
            const table = tables.find((t) => t.name === tableName);
            if (!table) return tableName;

            // Map table names to translation strategies (try multiple approaches)
            const tableTranslationMap: Record<
                string,
                Array<{ key: string; ns: string }>
            > = {
                Customer: [
                    { key: "sections.title", ns: "customers" },
                    { key: "tables.customers", ns: "reports" },
                    { key: "navigation_customers", ns: "common" },
                ],
                Invoice: [
                    { key: "sections.title", ns: "invoices" },
                    { key: "tables.invoices", ns: "reports" },
                ],
                Dispute: [
                    { key: "sections.title", ns: "disputes" },
                    { key: "tables.disputes", ns: "reports" },
                    { key: "navigation_disputes", ns: "common" },
                ],
                Activity: [
                    { key: "sections.title", ns: "activities" },
                    { key: "tables.activities", ns: "reports" },
                ],
                InvoicePayment: [
                    { key: "tables.invoice_payments", ns: "reports" },
                ],
                Contact: [
                    { key: "sections.title", ns: "contacts" },
                    { key: "tables.contacts", ns: "reports" },
                ],
                Company: [
                    { key: "sections.title", ns: "companies" },
                    { key: "tables.companies", ns: "reports" },
                ],
            };

            const translationConfigs = tableTranslationMap[tableName];
            if (translationConfigs) {
                // Try each translation strategy in order
                for (const config of translationConfigs) {
                    const translation = t(config.key, {
                        ns: config.ns,
                        defaultValue: "",
                    });
                    // Check if translation was found (not the key itself and not empty)
                    if (
                        translation &&
                        translation !== config.key &&
                        translation.trim() !== ""
                    ) {
                        return translation;
                    }
                }
            }

            // Fallback: Try to use table name directly in common namespace
            const tableNameLower = tableName.toLowerCase();
            const directTranslation = t(`navigation_${tableNameLower}`, {
                ns: "common",
                defaultValue: "",
            });
            if (
                directTranslation &&
                directTranslation !== `navigation_${tableNameLower}` &&
                directTranslation.trim() !== ""
            ) {
                return directTranslation;
            }

            // Final fallback to table label from metadata
            return table.label;
        },
        [tables, t]
    );

    const getFieldInfo = React.useCallback(
        (tableName: string, fieldName: string) => {
            const normalizedFieldName = normalizeFieldName(
                tableName,
                fieldName
            );
            const tableFields = getTableFields(tableName);
            return tableFields.find((f) => f.name === normalizedFieldName);
        },
        [normalizeFieldName, getTableFields]
    );

    // Get date value for display (resolves preset object to actual date string)
    const getDateDisplayValue = React.useCallback(
        (filterValue: any, isDateTime = false): string | null => {
            if (!filterValue) return null;
            if (
                typeof filterValue === "object" &&
                "__datePreset" in filterValue
            ) {
                const p = (filterValue as any).__datePreset as DatePreset;
                const inp = (filterValue as any).__datePresetInput as number | undefined;
                return (
                    resolveDatePreset(
                        p,
                        p === "last_x_days" || p === "last_x_months" || p === "next_x_days" || p === "next_x_months"
                            ? inp
                            : undefined,
                        isDateTime
                    ) || null
                );
            }
            return typeof filterValue === "string" ? filterValue : null;
        },
        []
    );

    // Create date preset options
    const datePresetOptions: DatePresetOption[] = React.useMemo(
        () => [
            {
                value: "today",
                label: t("fields.date_preset_today", {
                    ns: "reports",
                    defaultValue: "Today",
                }),
            },
            {
                value: "yesterday",
                label: t("fields.date_preset_yesterday", {
                    ns: "reports",
                    defaultValue: "Yesterday",
                }),
            },
            {
                value: "tomorrow",
                label: t("fields.date_preset_tomorrow", {
                    ns: "reports",
                    defaultValue: "Tomorrow",
                }),
            },
            {
                value: "this_week",
                label: t("fields.date_preset_this_week", {
                    ns: "reports",
                    defaultValue: "This Week",
                }),
            },
            {
                value: "last_week",
                label: t("fields.date_preset_last_week", {
                    ns: "reports",
                    defaultValue: "Last Week",
                }),
            },
            {
                value: "next_week",
                label: t("fields.date_preset_next_week", {
                    ns: "reports",
                    defaultValue: "Next Week",
                }),
            },
            {
                value: "this_month",
                label: t("fields.date_preset_this_month", {
                    ns: "reports",
                    defaultValue: "This Month",
                }),
            },
            {
                value: "last_month",
                label: t("fields.date_preset_last_month", {
                    ns: "reports",
                    defaultValue: "Last Month",
                }),
            },
            {
                value: "next_month",
                label: t("fields.date_preset_next_month", {
                    ns: "reports",
                    defaultValue: "Next Month",
                }),
            },
            {
                value: "last_x_days",
                label: t("fields.date_preset_last_x_days", {
                    ns: "reports",
                    defaultValue: "Last X Days",
                }),
                requiresInput: true,
            },
            {
                value: "last_x_months",
                label: t("fields.date_preset_last_x_months", {
                    ns: "reports",
                    defaultValue: "Last X Months",
                }),
                requiresInput: true,
            },
            {
                value: "next_x_days",
                label: t("fields.date_preset_next_x_days", {
                    ns: "reports",
                    defaultValue: "Next X Days",
                }),
                requiresInput: true,
            },
            {
                value: "next_x_months",
                label: t("fields.date_preset_next_x_months", {
                    ns: "reports",
                    defaultValue: "Next X Months",
                }),
                requiresInput: true,
            },
            {
                value: "custom",
                label: t("fields.date_preset_custom", {
                    ns: "reports",
                    defaultValue: "Custom Date",
                }),
            },
        ],
        [t]
    );

    const formatEnumValueForDisplay = React.useCallback(
        (value: string, fieldName: string, tableName: string): string => {
            if (!value) return value;

            const stringValue = String(value);
            const normalizedFieldName = fieldName.toLowerCase();
            const normalizedTableName = tableName.toLowerCase();

            // Special handling for dispute_status - uses 'disputes' namespace
            if (normalizedFieldName === "dispute_status") {
                const translationKey = `values.dispute_status_${stringValue.toLowerCase()}`;
                const translation = t(translationKey, {
                    ns: "disputes",
                    defaultValue: stringValue,
                });
                // i18next returns the key when translation is not found, so check for that
                if (translation && translation !== translationKey) {
                    return translation;
                }
                // Fallback: format the value by replacing underscores with spaces
                return stringValue.replace(/_/g, " ");
            }

            // Special handling for dispute_resolution - uses 'disputes' namespace
            if (normalizedFieldName === "dispute_resolution") {
                const translationKey = `values.dispute_resolution_${stringValue.toLowerCase()}`;
                const translation = t(translationKey, {
                    ns: "disputes",
                    defaultValue: stringValue,
                });
                if (translation && translation !== translationKey) {
                    return translation;
                }
                return stringValue.replace(/_/g, " ");
            }

            // Special handling for collection_status - uses 'customers' namespace
            if (normalizedFieldName === "collection_status") {
                const translationKey = `values.status_${stringValue.toLowerCase()}`;
                const translation = t(translationKey, {
                    ns: "customers",
                    defaultValue: stringValue,
                });
                // i18next returns the key when translation is not found, so check for that
                if (translation && translation !== translationKey) {
                    return translation;
                }
                // Fallback: format the value by replacing underscores with spaces
                return stringValue.replace(/_/g, " ");
            }

            // Terms breach reason codes reuse the invoice flag labels, so the
            // pick-list names each reason exactly as the report column does.
            if (normalizedFieldName === "terms_breach_reason") {
                const translation = t(stringValue, {
                    ns: "invoices",
                    defaultValue: stringValue,
                });
                if (translation && translation !== stringValue) {
                    return translation;
                }
                return stringValue.replace(/_/g, " ");
            }

            // Special handling for Activity.status - uses 'activities' namespace
            if (
                normalizedTableName === "activity" &&
                normalizedFieldName === "status"
            ) {
                const translationKey = `values.status_${stringValue.toLowerCase()}`;
                const translation = t(translationKey, {
                    ns: "activities",
                    defaultValue: stringValue,
                });
                if (translation && translation !== translationKey) {
                    return translation;
                }
                return stringValue.replace(/_/g, " ");
            }

            // Special handling for Contact.status - uses 'common' namespace
            if (
                normalizedTableName === "contact" &&
                normalizedFieldName === "status"
            ) {
                const translationKey = `values.status_${stringValue.toLowerCase()}`;
                const translation = t(translationKey, {
                    ns: "common",
                    defaultValue: stringValue,
                });
                if (translation && translation !== translationKey) {
                    return translation;
                }
                return stringValue.replace(/_/g, " ");
            }

            // Try generic field-specific translation
            const fieldKey = `values.${normalizedTableName}_${normalizedFieldName}_${stringValue.toLowerCase().replace(/_/g, "_")}`;
            const genericTranslation = t(fieldKey, {
                ns: "reports",
            });
            if (
                genericTranslation &&
                genericTranslation !== fieldKey
            ) {
                return genericTranslation;
            }

            // Try generic value translation
            const valueKey = stringValue.toLowerCase().replace(/_/g, "_");
            
            // Try with status_ prefix first if it's a status field
            if (normalizedFieldName === "status" || normalizedFieldName.endsWith("_status")) {
                const statusKey = `values.status_${valueKey}`;
                const statusTranslation = t(statusKey, { ns: "common" });
                if (statusTranslation && statusTranslation !== statusKey) {
                    return statusTranslation;
                }
            }

            const fullValueKey = `values.${valueKey}`;
            const valueTranslation = t(fullValueKey, { ns: "common" });
            if (valueTranslation && valueTranslation !== fullValueKey) {
                return valueTranslation;
            }

            // Fallback: replace underscores with spaces and capitalize words
            return stringValue.replace(/_/g, " ");
        },
        [t]
    );

    const getOperatorsForType = (fieldType: string) => {
        switch (fieldType) {
            case "string":
            case "text":
                return [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                    {
                        value: "not_equals",
                        label: t("values.operator_not_equals", {
                            ns: "reports",
                            defaultValue: "Not Equals",
                        }),
                    },
                    {
                        value: "contains",
                        label: t("values.operator_contains", {
                            ns: "reports",
                            defaultValue: "Contains",
                        }),
                    },
                    {
                        value: "starts_with",
                        label: t("values.operator_starts_with", {
                            ns: "reports",
                            defaultValue: "Starts With",
                        }),
                    },
                    {
                        value: "ends_with",
                        label: t("values.operator_ends_with", {
                            ns: "reports",
                            defaultValue: "Ends With",
                        }),
                    },
                    {
                        value: "is_empty",
                        label: t("values.operator_is_empty", {
                            ns: "reports",
                            defaultValue: "Is Empty",
                        }),
                    },
                    {
                        value: "is_not_empty",
                        label: t("values.operator_is_not_empty", {
                            ns: "reports",
                            defaultValue: "Is Not Empty",
                        }),
                    },
                ];
            case "number":
            case "decimal":
                return [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                    {
                        value: "not_equals",
                        label: t("values.operator_not_equals", {
                            ns: "reports",
                            defaultValue: "Not Equals",
                        }),
                    },
                    {
                        value: "greater_than",
                        label: t("values.operator_greater_than", {
                            ns: "reports",
                            defaultValue: "Greater Than",
                        }),
                    },
                    {
                        value: "less_than",
                        label: t("values.operator_less_than", {
                            ns: "reports",
                            defaultValue: "Less Than",
                        }),
                    },
                    {
                        value: "greater_or_equal",
                        label: t("values.operator_greater_or_equal", {
                            ns: "reports",
                            defaultValue: "Greater or Equal",
                        }),
                    },
                    {
                        value: "less_or_equal",
                        label: t("values.operator_less_or_equal", {
                            ns: "reports",
                            defaultValue: "Less or Equal",
                        }),
                    },
                    {
                        value: "is_empty",
                        label: t("values.operator_is_empty", {
                            ns: "reports",
                            defaultValue: "Is Empty",
                        }),
                    },
                    {
                        value: "is_not_empty",
                        label: t("values.operator_is_not_empty", {
                            ns: "reports",
                            defaultValue: "Is Not Empty",
                        }),
                    },
                ];
            case "date":
            case "datetime":
                return [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                    {
                        value: "not_equals",
                        label: t("values.operator_not_equals", {
                            ns: "reports",
                            defaultValue: "Not Equals",
                        }),
                    },
                    {
                        value: "greater_than",
                        label: t("values.operator_greater_than", {
                            ns: "reports",
                            defaultValue: "Greater Than",
                        }),
                    },
                    {
                        value: "less_than",
                        label: t("values.operator_less_than", {
                            ns: "reports",
                            defaultValue: "Less Than",
                        }),
                    },
                    {
                        value: "greater_or_equal",
                        label: t("values.operator_greater_or_equal", {
                            ns: "reports",
                            defaultValue: "Greater or Equal",
                        }),
                    },
                    {
                        value: "less_or_equal",
                        label: t("values.operator_less_or_equal", {
                            ns: "reports",
                            defaultValue: "Less or Equal",
                        }),
                    },
                    {
                        value: "between",
                        label: t("values.operator_between", {
                            ns: "reports",
                            defaultValue: "Between",
                        }),
                    },
                    {
                        value: "is_empty",
                        label: t("values.operator_is_empty", {
                            ns: "reports",
                            defaultValue: "Is Empty",
                        }),
                    },
                    {
                        value: "is_not_empty",
                        label: t("values.operator_is_not_empty", {
                            ns: "reports",
                            defaultValue: "Is Not Empty",
                        }),
                    },
                ];
            case "boolean":
                return [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                ];
            case "enum":
                return [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                    {
                        value: "not_equals",
                        label: t("values.operator_not_equals", {
                            ns: "reports",
                            defaultValue: "Not Equals",
                        }),
                    },
                    {
                        value: "in",
                        label: t("values.operator_in", {
                            ns: "reports",
                            defaultValue: "In",
                        }),
                    },
                    {
                        value: "not_in",
                        label: t("values.operator_not_in", {
                            ns: "reports",
                            defaultValue: "Not In",
                        }),
                    },
                    {
                        value: "is_empty",
                        label: t("values.operator_is_empty", {
                            ns: "reports",
                            defaultValue: "Is Empty",
                        }),
                    },
                    {
                        value: "is_not_empty",
                        label: t("values.operator_is_not_empty", {
                            ns: "reports",
                            defaultValue: "Is Not Empty",
                        }),
                    },
                ];
            case "user":
                return [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                    {
                        value: "not_equals",
                        label: t("values.operator_not_equals", {
                            ns: "reports",
                            defaultValue: "Not Equals",
                        }),
                    },
                    {
                        value: "in",
                        label: t("values.operator_in", {
                            ns: "reports",
                            defaultValue: "In",
                        }),
                    },
                    {
                        value: "is_empty",
                        label: t("values.operator_is_empty", {
                            ns: "reports",
                            defaultValue: "Is Empty",
                        }),
                    },
                    {
                        value: "is_not_empty",
                        label: t("values.operator_is_not_empty", {
                            ns: "reports",
                            defaultValue: "Is Not Empty",
                        }),
                    },
                ];
            default:
                return [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                    {
                        value: "not_equals",
                        label: t("values.operator_not_equals", {
                            ns: "reports",
                            defaultValue: "Not Equals",
                        }),
                    },
                ];
        }
    };

    function getOperatorsForFilterField(
        fieldType: string,
        normalizedField: string
    ) {
        const base = getOperatorsForType(fieldType);
        if (PICK_LIST_ONLY_FIELD_KEYS.has(normalizedField)) {
            // Value is a set of codes, so single-value comparison is meaningless.
            return base.filter((op) =>
                ["in", "not_in", "is_empty", "is_not_empty"].includes(op.value)
            );
        }
        if (
            fieldType === "string" &&
            REPORT_LOOKUP_FIELD_KEYS_WITH_IN.has(normalizedField)
        ) {
            const inOp = {
                value: "in",
                label: t("values.operator_in", {
                    ns: "reports",
                    defaultValue: "In",
                }),
            };
            const idx = base.findIndex((o) => o.value === "not_equals");
            if (idx >= 0) {
                return [...base.slice(0, idx + 1), inOp, ...base.slice(idx + 1)];
            }
            return [inOp, ...base];
        }
        return base;
    }

    const handleAddFilter = () => {
        if (selectedTables.length === 0) return;

        const firstTable = selectedTables[0];
        const tableFields = getTableFields(firstTable);
        if (tableFields.length === 0) return;

        const firstField = tableFields[0];
        const normalizedFirst = normalizeFieldName(
            firstTable,
            firstField.name
        );
        const operators = getOperatorsForFilterField(
            firstField.type,
            normalizedFirst
        );

        onFiltersChange([
            ...filters,
            {
                table: firstTable,
                field: firstField.name,
                operator: operators[0].value,
                value: "",
            },
        ]);
    };

    const handleUpdateFilter = (
        index: number,
        field: keyof Filter,
        value: any
    ) => {
        const updated = [...filters];
        updated[index] = { ...updated[index], [field]: value };

        // If field changed, validate and reset operator to match field type
        if (field === "field") {
            updated[index].value = "";
            const normalizedField = normalizeFieldName(
                updated[index].table,
                value
            );
            const isOwnerField =
                normalizedField === "owner" || normalizedField === "owner_id";
            const fieldInfo = getFieldInfo(
                updated[index].table,
                normalizedField
            );
            if (fieldInfo) {
                // Treat owner/owner_id fields as user type (like created_by/modified_by)
                const fieldTypeForOperators = isOwnerField
                    ? "user"
                    : fieldInfo.type;
                const validOperators = getOperatorsForFilterField(
                    fieldTypeForOperators,
                    normalizedField
                );
                const currentOperator = updated[index].operator;
                const isValidOperator = validOperators.some(
                    (op) => op.value === currentOperator
                );
                if (!isValidOperator && validOperators.length > 0) {
                    // Reset to first valid operator
                    updated[index].operator = validOperators[0].value;
                }
            }
        } else if (field === "operator") {
            // Initialize value based on operator type
            if (value === "between") {
                const currentVal = updated[index].value;
                if (isDatePresetValue(currentVal)) {
                    const preset = currentVal.__datePreset;
                    const input = currentVal.__datePresetInput;
                    const range = resolveDatePresetRange(preset, input, false);
                    updated[index].value = range ?? ["", ""];
                } else {
                    updated[index].value = ["", ""];
                }
            } else if (value === "in" || value === "not_in") {
                updated[index].value = [];
            } else if (value === "is_empty" || value === "is_not_empty") {
                // For empty operators, set value to null (will be handled by backend)
                updated[index].value = null;
            } else {
                // For other operators, use single value
                const currentVal = updated[index].value;
                if (Array.isArray(currentVal)) {
                    updated[index].value = currentVal[0] || "";
                } else if (!isDatePresetValue(currentVal)) {
                    // Only reset if not a preset - preserve preset when changing operator
                    updated[index].value = "";
                }
            }
        }

        onFiltersChange(updated);
    };

    const handleRemoveFilter = (index: number) => {
        onFiltersChange(filters.filter((_, i) => i !== index));
    };

    // Toggle filter expansion
    const handleToggleFilter = (index: number) => {
        setExpandedFilters((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    // Generate human-readable filter description
    const getFilterDescription = React.useCallback(
        (filter: Filter): string => {
            const normalizedField = normalizeFieldName(filter.table, filter.field);
            const fieldInfo = getFieldInfo(filter.table, normalizedField);
            const tableLabel = getTableLabel(filter.table);
            const fieldLabel = fieldInfo?.label || normalizedField;
            
            // Get operators for this field type
            const isOwnerField =
                normalizedField === "owner" || normalizedField === "owner_id";
            const fieldTypeForOperators = isOwnerField
                ? "user"
                : fieldInfo?.type || "string";
            const operators = fieldInfo
                ? getOperatorsForFilterField(
                      fieldTypeForOperators,
                      normalizedField
                  )
                : [
                    {
                        value: "equals",
                        label: t("values.operator_equals", {
                            ns: "reports",
                            defaultValue: "Equals",
                        }),
                    },
                    {
                        value: "not_equals",
                        label: t("values.operator_not_equals", {
                            ns: "reports",
                            defaultValue: "Not Equals",
                        }),
                    },
                ];
            
            const operatorLabel = operators.find(
                (op) => op.value === filter.operator
            )?.label || filter.operator;

            // Format value for display
            const formatValue = (value: any): string => {
                if (value === null || value === undefined) return "";
                
                // Check if this is a date/datetime field
                const isDateField = fieldInfo?.type === "date" || fieldInfo?.type === "datetime";
                const formatType = fieldInfo?.type === "datetime" ? "datetime" : "date";
                
                // Get user locale and timezone
                const userLocale = session?.user?.locale || (i18n.language === "he" ? "he-IL" : "en-US");
                const userTimezone = getUserTimezone(session);
                
                if (Array.isArray(value)) {
                    // User field + "in": show names/emails, never raw ids (and avoid
                    // mis-reading two selected user ids as a "between" range).
                    if (
                        filter.operator === "in" &&
                        (fieldInfo?.type === "user" || isOwnerField)
                    ) {
                        const ids = value.filter(
                            (v) => v != null && v !== ""
                        ) as string[];
                        if (ids.length === 0) return "";
                        const unnamed = t("fields.unnamed_user", {
                            ns: "reports",
                            defaultValue: "User",
                        });
                        return ids
                            .map((id) => {
                                if (id === "__CURRENT_USER__") {
                                    return t("fields.current_user", {
                                        ns: "reports",
                                        defaultValue: "Current User",
                                    });
                                }
                                const u = users.find(
                                    (x) => String(x.id) === String(id)
                                );
                                if (!u) return unnamed;
                                return (
                                    u.name ||
                                    `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                                    u.email ||
                                    unnamed
                                );
                            })
                            .join(", ");
                    }
                    if (value.length === 2 && value[0] && value[1]) {
                        // Handle "between" operator for dates
                        if (isDateField) {
                            try {
                                const startDate = typeof value[0] === "string" ? new Date(value[0]) : value[0];
                                const endDate = typeof value[1] === "string" ? new Date(value[1]) : value[1];
                                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                                    const formattedStart = formatDateForDisplay(
                                        startDate,
                                        formatType,
                                        userLocale,
                                        userTimezone
                                    );
                                    const formattedEnd = formatDateForDisplay(
                                        endDate,
                                        formatType,
                                        userLocale,
                                        userTimezone
                                    );
                                    return `${formattedStart} - ${formattedEnd}`;
                                }
                            } catch {
                                // Fallback to string representation if formatting fails
                            }
                        }
                        return `${value[0]} - ${value[1]}`;
                    }
                    // Handle array of values
                    if (isDateField) {
                        return value
                            .filter(Boolean)
                            .map((v) => {
                                try {
                                    const dateValue = typeof v === "string" ? new Date(v) : v;
                                    if (!isNaN(dateValue.getTime())) {
                                        return formatDateForDisplay(
                                            dateValue,
                                            formatType,
                                            userLocale,
                                            userTimezone
                                        );
                                    }
                                } catch {
                                    // Fallback to string
                                }
                                return String(v);
                            })
                            .join(", ");
                    }
                    return value.filter(Boolean).join(", ");
                }
                
                // Format single date/datetime value (including date preset object)
                if (isDateField) {
                    if (
                        typeof value === "object" &&
                        value !== null &&
                        "__datePreset" in value
                    ) {
                        const p = (value as any).__datePreset as DatePreset;
                        const inp = (value as any).__datePresetInput as number | undefined;
                        const presetLabels: Record<string, string> = {
                            today: t("fields.date_preset_today", { ns: "reports", defaultValue: "Today" }),
                            yesterday: t("fields.date_preset_yesterday", { ns: "reports", defaultValue: "Yesterday" }),
                            tomorrow: t("fields.date_preset_tomorrow", { ns: "reports", defaultValue: "Tomorrow" }),
                            this_week: t("fields.date_preset_this_week", { ns: "reports", defaultValue: "This Week" }),
                            last_week: t("fields.date_preset_last_week", { ns: "reports", defaultValue: "Last Week" }),
                            next_week: t("fields.date_preset_next_week", { ns: "reports", defaultValue: "Next Week" }),
                            this_month: t("fields.date_preset_this_month", { ns: "reports", defaultValue: "This Month" }),
                            last_month: t("fields.date_preset_last_month", { ns: "reports", defaultValue: "Last Month" }),
                            next_month: t("fields.date_preset_next_month", { ns: "reports", defaultValue: "Next Month" }),
                            last_x_days: t("fields.date_preset_last_x_days", { ns: "reports", defaultValue: "Last X Days" }),
                            last_x_months: t("fields.date_preset_last_x_months", { ns: "reports", defaultValue: "Last X Months" }),
                            next_x_days: t("fields.date_preset_next_x_days", { ns: "reports", defaultValue: "Next X Days" }),
                            next_x_months: t("fields.date_preset_next_x_months", { ns: "reports", defaultValue: "Next X Months" }),
                        };
                        const label = presetLabels[p] || p;
                        if (p === "last_x_days" || p === "last_x_months" || p === "next_x_days" || p === "next_x_months") {
                            return inp ? label.replace(/X/i, String(inp)) : label;
                        }
                        return label;
                    }
                    let dateStr: string | null = null;
                    if (typeof value === "string") {
                        dateStr = value;
                    }
                    if (dateStr) {
                        try {
                            const dateValue = new Date(dateStr);
                            if (!isNaN(dateValue.getTime())) {
                                return formatDateForDisplay(
                                    dateValue,
                                    formatType,
                                    userLocale,
                                    userTimezone
                                );
                            }
                        } catch {
                            // Fallback to string representation if formatting fails
                        }
                    }
                }
                
                if (typeof value === "boolean") {
                    return value ? t("values.true", "True") : t("values.false", "False");
                }
                if (typeof value === "string" && value.length > 50) {
                    return `${value.substring(0, 50)  }...`;
                }
                return String(value);
            };

            const valueDisplay = formatValue(filter.value);
            const isEmptyOperator =
                filter.operator === "is_empty" || filter.operator === "is_not_empty";

            if (isEmptyOperator) {
                return `${tableLabel} - ${fieldLabel} ${operatorLabel}`;
            }

            if (valueDisplay) {
                return `${tableLabel} - ${fieldLabel} ${operatorLabel} ${valueDisplay}`;
            }

            return `${tableLabel} - ${fieldLabel} ${operatorLabel}`;
        },
        [t, getTableLabel, getFieldInfo, normalizeFieldName, getOperatorsForFilterField, session, i18n, users]
    );

    const renderValueInput = (filter: Filter, index: number) => {
        const fieldInfo = getFieldInfo(filter.table, filter.field);
        if (!fieldInfo) return null;

        // Treat owner/owner_id fields as user type (like created_by/modified_by)
        const normalizedField = normalizeFieldName(filter.table, filter.field);
        const isOwnerField =
            normalizedField === "owner" || normalizedField === "owner_id";
        const fieldType = isOwnerField ? "user" : fieldInfo.type;
        const fieldDisplayLabel = fieldInfo.label || normalizedField;
        const isBetween = filter.operator === "between";

        // Hide value input for empty/not empty operators
        const isEmptyOperator =
            filter.operator === "is_empty" ||
            filter.operator === "is_not_empty";
        if (isEmptyOperator) {
            return null;
        }


        // Handle Country.name field with Autocomplete (single) or Select + chips (in)
        if (normalizedField === "Country.name") {
            const isIn = filter.operator === "in";
            const nameList: string[] = Array.isArray(filter.value)
                ? (filter.value as string[]).filter(Boolean)
                : filter.value
                  ? [String(filter.value)]
                  : [];
            if (isIn) {
                const inOptions: ReportFilterInOption[] = countries.map(
                    (c) => ({
                        value: c.name,
                        label: `${c.emoji || "🏳️"} ${c.name}`,
                    })
                );
                return (
                    <ReportFilterInMultiSelect
                        idBase={`report-filter-Country-name-${index}`}
                        labelText={fieldDisplayLabel}
                        emptyPlaceholder={t(
                            "fields.select_country",
                            "Select country"
                        )}
                        searchPlaceholder={t(
                            "fields.search_placeholder",
                            "Search…"
                        )}
                        noOptionsLabel={t(
                            "fields.no_options_available",
                            "No options available"
                        )}
                        noResultsLabel={t(
                            "fields.no_search_results",
                            "No matches"
                        )}
                        loadingLabel={t("messages.loading", { ns: "common", defaultValue: "Loading…" })}
                        options={inOptions}
                        value={nameList}
                        onChange={(next) =>
                            handleUpdateFilter(index, "value", next)
                        }
                        isRTL={isRTL}
                        isHebrew={isHebrew}
                        loading={countriesLoading}
                    />
                );
            }
            const selectedCountry = countries.find(
                (c) => c.name === filter.value
            ) || null;
            return (
                <Autocomplete<CountryType>
                    size="small"
                    loading={countriesLoading}
                    options={countries}
                    value={selectedCountry}
                    onChange={(_, newValue) =>
                        handleUpdateFilter(
                            index,
                            "value",
                            newValue?.name || ""
                        )
                    }
                    getOptionLabel={(option) =>
                        `${option.emoji || "🏳️"} ${option.name}`
                    }
                    isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                    }
                    fullWidth
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isHebrew && {
                        "data-hebrew": true,
                        "data-rtl": true,
                    })}
                    sx={filterAutocompleteStyles}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                            <li
                                key={key}
                                {...otherProps}
                                style={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    paddingRight: isRTL ? "16px" : "14px",
                                    paddingLeft: isRTL ? "14px" : "16px",
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        width: "100%",
                                        direction: isRTL ? "rtl" : "ltr",
                                    }}
                                >
                                    <Typography>{option.emoji || "🏳️"}</Typography>
                                    <Typography>{option.name}</Typography>
                                </Box>
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={t("fields.value", "Value")}
                            placeholder={t(
                                "fields.select_country",
                                "Select country"
                            )}
                            size="small"
                            {...(isHebrew && { "data-hebrew": true })}
                            dir={isRTL ? "rtl" : "ltr"}
                            sx={filterTextFieldStyles}
                        />
                    )}
                />
            );
        }

        // Handle State.name field with Autocomplete (single) or Select + chips (in)
        if (normalizedField === "State.name") {
            const isIn = filter.operator === "in";
            const nameList: string[] = Array.isArray(filter.value)
                ? (filter.value as string[]).filter(Boolean)
                : filter.value
                  ? [String(filter.value)]
                  : [];
            if (isIn) {
                const inOptions: ReportFilterInOption[] = states.map((s) => ({
                    value: s.name,
                    label: s.name,
                }));
                return (
                    <ReportFilterInMultiSelect
                        idBase={`report-filter-State-name-${index}`}
                        labelText={fieldDisplayLabel}
                        emptyPlaceholder={t(
                            "fields.select_state",
                            "Select state"
                        )}
                        searchPlaceholder={t(
                            "fields.search_placeholder",
                            "Search…"
                        )}
                        noOptionsLabel={t(
                            "fields.no_options_available",
                            "No options available"
                        )}
                        noResultsLabel={t(
                            "fields.no_search_results",
                            "No matches"
                        )}
                        loadingLabel={t("messages.loading", { ns: "common", defaultValue: "Loading…" })}
                        options={inOptions}
                        value={nameList}
                        onChange={(next) =>
                            handleUpdateFilter(index, "value", next)
                        }
                        isRTL={isRTL}
                        isHebrew={isHebrew}
                        loading={statesLoading}
                    />
                );
            }
            const selectedState =
                states.find((s) => s.name === filter.value) || null;
            return (
                <Autocomplete<StateType>
                    size="small"
                    loading={statesLoading}
                    options={states}
                    value={selectedState}
                    onChange={(_, newValue) =>
                        handleUpdateFilter(
                            index,
                            "value",
                            newValue?.name || ""
                        )
                    }
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                    }
                    fullWidth
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isHebrew && {
                        "data-hebrew": true,
                        "data-rtl": true,
                    })}
                    sx={filterAutocompleteStyles}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                            <li
                                key={key}
                                {...otherProps}
                                style={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    paddingRight: isRTL ? "16px" : "14px",
                                    paddingLeft: isRTL ? "14px" : "16px",
                                }}
                            >
                                <Typography
                                    sx={{
                                        direction: isRTL ? "rtl" : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                        width: "100%",
                                    }}
                                >
                                    {option.name}
                                </Typography>
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={t("fields.value", "Value")}
                            placeholder={t("fields.select_state", "Select state")}
                            size="small"
                            {...(isHebrew && { "data-hebrew": true })}
                            dir={isRTL ? "rtl" : "ltr"}
                            sx={filterTextFieldStyles}
                        />
                    )}
                />
            );
        }

        // Handle BusinessUnit.name field with Autocomplete (single) or Select + chips (in)
        if (normalizedField === "BusinessUnit.name") {
            const isIn = filter.operator === "in";
            const nameList: string[] = Array.isArray(filter.value)
                ? (filter.value as string[]).filter(Boolean)
                : filter.value
                  ? [String(filter.value)]
                  : [];
            if (isIn) {
                const inOptions: ReportFilterInOption[] = businessUnits.map(
                    (bu) => ({
                        value: bu.name,
                        label: bu.name,
                    })
                );
                return (
                    <ReportFilterInMultiSelect
                        idBase={`report-filter-BusinessUnit-name-${index}`}
                        labelText={fieldDisplayLabel}
                        emptyPlaceholder={t(
                            "fields.select_business_unit",
                            {
                                ns: "business_unit",
                                defaultValue: "Select business unit",
                            }
                        )}
                        searchPlaceholder={t(
                            "fields.search_placeholder",
                            "Search…"
                        )}
                        noOptionsLabel={t(
                            "fields.no_options_available",
                            "No options available"
                        )}
                        noResultsLabel={t(
                            "fields.no_search_results",
                            "No matches"
                        )}
                        loadingLabel={t("messages.loading", { ns: "common", defaultValue: "Loading…" })}
                        options={inOptions}
                        value={nameList}
                        onChange={(next) =>
                            handleUpdateFilter(index, "value", next)
                        }
                        isRTL={isRTL}
                        isHebrew={isHebrew}
                        loading={businessUnitsLoading}
                    />
                );
            }
            const selectedBusinessUnit =
                businessUnits.find((bu) => bu.name === filter.value) || null;
            return (
                <Autocomplete<BusinessUnitType>
                    size="small"
                    loading={businessUnitsLoading}
                    options={businessUnits}
                    value={selectedBusinessUnit}
                    onChange={(_, newValue) =>
                        handleUpdateFilter(
                            index,
                            "value",
                            newValue?.name || ""
                        )
                    }
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                    }
                    fullWidth
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isHebrew && {
                        "data-hebrew": true,
                        "data-rtl": true,
                    })}
                    sx={filterAutocompleteStyles}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                            <li
                                key={key}
                                {...otherProps}
                                style={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    paddingRight: isRTL ? "16px" : "14px",
                                    paddingLeft: isRTL ? "14px" : "16px",
                                }}
                            >
                                <Typography
                                    sx={{
                                        direction: isRTL ? "rtl" : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                        width: "100%",
                                    }}
                                >
                                    {option.name}
                                </Typography>
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={t("fields.value", "Value")}
                            placeholder={t(
                                "fields.select_business_unit",
                                {
                                    ns: "business_unit",
                                    defaultValue: "Select business unit",
                                }
                            )}
                            size="small"
                            {...(isHebrew && { "data-hebrew": true })}
                            dir={isRTL ? "rtl" : "ltr"}
                            sx={filterTextFieldStyles}
                        />
                    )}
                />
            );
        }

        // Handle dispute_reason field with Autocomplete (single) or Select + chips (in)
        if (normalizedField === "dispute_reason") {
            const isIn = filter.operator === "in";
            const nameList: string[] = Array.isArray(filter.value)
                ? (filter.value as string[]).filter(Boolean)
                : filter.value
                  ? [String(filter.value)]
                  : [];
            if (isIn) {
                const inOptions: ReportFilterInOption[] =
                    disputeReasons.map((r) => ({
                        value: r.name,
                        label: r.name,
                    }));
                return (
                    <ReportFilterInMultiSelect
                        idBase={`report-filter-dispute-reason-${index}`}
                        labelText={fieldDisplayLabel}
                        emptyPlaceholder={t(
                            "fields.select_dispute_reason",
                            "Select dispute reason"
                        )}
                        searchPlaceholder={t(
                            "fields.search_placeholder",
                            "Search…"
                        )}
                        noOptionsLabel={t(
                            "fields.no_options_available",
                            "No options available"
                        )}
                        noResultsLabel={t(
                            "fields.no_search_results",
                            "No matches"
                        )}
                        loadingLabel={t("messages.loading", { ns: "common", defaultValue: "Loading…" })}
                        options={inOptions}
                        value={nameList}
                        onChange={(next) =>
                            handleUpdateFilter(index, "value", next)
                        }
                        isRTL={isRTL}
                        isHebrew={isHebrew}
                        loading={disputeReasonsLoading}
                    />
                );
            }
            const selectedReason =
                disputeReasons.find((r) => r.name === filter.value) || null;
            return (
                <Autocomplete<DisputeReasonType>
                    size="small"
                    loading={disputeReasonsLoading}
                    options={disputeReasons}
                    value={selectedReason}
                    onChange={(_, newValue) =>
                        handleUpdateFilter(
                            index,
                            "value",
                            newValue?.name || ""
                        )
                    }
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                    }
                    fullWidth
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isHebrew && {
                        "data-hebrew": true,
                        "data-rtl": true,
                    })}
                    sx={filterAutocompleteStyles}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                            <li
                                key={key}
                                {...otherProps}
                                style={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    paddingRight: isRTL ? "16px" : "14px",
                                    paddingLeft: isRTL ? "14px" : "16px",
                                }}
                            >
                                <Typography
                                    sx={{
                                        direction: isRTL ? "rtl" : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                        width: "100%",
                                    }}
                                >
                                    {option.name}
                                </Typography>
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={t("fields.value", "Value")}
                            placeholder={t(
                                "fields.select_dispute_reason",
                                "Select dispute reason"
                            )}
                            size="small"
                            {...(isHebrew && { "data-hebrew": true })}
                            dir={isRTL ? "rtl" : "ltr"}
                            sx={filterTextFieldStyles}
                        />
                    )}
                />
            );
        }

        // Handle customer_currency field with Autocomplete (single) or Select + chips (in)
        if (normalizedField === "customer_currency") {
            const isIn = filter.operator === "in";
            const codeList: string[] = Array.isArray(filter.value)
                ? (filter.value as string[]).filter(Boolean)
                : filter.value
                  ? [String(filter.value)]
                  : [];
            if (isIn) {
                const inOptions: ReportFilterInOption[] = currencies.map(
                    (c) => ({
                        value: c.code,
                        label: `${c.code} - ${c.name} (${c.symbol})`,
                    })
                );
                return (
                    <ReportFilterInMultiSelect
                        idBase={`report-filter-customer-currency-${index}`}
                        labelText={fieldDisplayLabel}
                        emptyPlaceholder={t(
                            "fields.select_currency",
                            "Select currency"
                        )}
                        searchPlaceholder={t(
                            "fields.search_placeholder",
                            "Search…"
                        )}
                        noOptionsLabel={t(
                            "fields.no_options_available",
                            "No options available"
                        )}
                        noResultsLabel={t(
                            "fields.no_search_results",
                            "No matches"
                        )}
                        loadingLabel={t("messages.loading", { ns: "common", defaultValue: "Loading…" })}
                        options={inOptions}
                        value={codeList}
                        onChange={(next) =>
                            handleUpdateFilter(index, "value", next)
                        }
                        isRTL={isRTL}
                        isHebrew={isHebrew}
                    />
                );
            }
            const selectedCurrency =
                currencies.find((c) => c.code === filter.value) || null;
            return (
                <Autocomplete<Currency>
                    size="small"
                    options={currencies}
                    value={selectedCurrency}
                    onChange={(_, newValue) =>
                        handleUpdateFilter(
                            index,
                            "value",
                            newValue?.code || ""
                        )
                    }
                    getOptionLabel={(option) =>
                        `${option.code} - ${option.name} (${option.symbol})`
                    }
                    isOptionEqualToValue={(option, value) =>
                        option.code === value.code
                    }
                    fullWidth
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isHebrew && {
                        "data-hebrew": true,
                        "data-rtl": true,
                    })}
                    sx={filterAutocompleteStyles}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                            <li
                                key={key}
                                {...otherProps}
                                style={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    paddingRight: isRTL ? "16px" : "14px",
                                    paddingLeft: isRTL ? "14px" : "16px",
                                }}
                            >
                                <Typography
                                    sx={{
                                        direction: isRTL ? "rtl" : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                        width: "100%",
                                    }}
                                >
                                    {option.code} - {option.name} ({option.symbol})
                                </Typography>
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={t("fields.value", "Value")}
                            placeholder={t(
                                "fields.select_currency",
                                "Select currency"
                            )}
                            size="small"
                            {...(isHebrew && { "data-hebrew": true })}
                            dir={isRTL ? "rtl" : "ltr"}
                            sx={filterTextFieldStyles}
                        />
                    )}
                />
            );
        }

        // Handle InsurancePolicy.policy_number (Customer relation; credit-gated in metadata)
        if (normalizedField === "InsurancePolicy.policy_number") {
            const isIn = filter.operator === "in";
            const numberList: string[] = Array.isArray(filter.value)
                ? (filter.value as string[]).filter(Boolean)
                : filter.value
                  ? [String(filter.value)]
                  : [];
            if (isIn) {
                const inOptions: ReportFilterInOption[] =
                    insurancePolicies.map((p) => ({
                        value: p.policy_number,
                        label: String(p.policy_number),
                    }));
                return (
                    <ReportFilterInMultiSelect
                        idBase={`report-filter-InsurancePolicy-pn-${index}`}
                        labelText={fieldDisplayLabel}
                        emptyPlaceholder={t(
                            "fields.select_insurance_policy",
                            "Select insurance policy"
                        )}
                        searchPlaceholder={t(
                            "fields.search_placeholder",
                            "Search…"
                        )}
                        noOptionsLabel={t(
                            "fields.no_options_available",
                            "No options available"
                        )}
                        noResultsLabel={t(
                            "fields.no_search_results",
                            "No matches"
                        )}
                        loadingLabel={t("messages.loading", { ns: "common", defaultValue: "Loading…" })}
                        options={inOptions}
                        value={numberList}
                        onChange={(next) =>
                            handleUpdateFilter(index, "value", next)
                        }
                        isRTL={isRTL}
                        isHebrew={isHebrew}
                        loading={insurancePoliciesLoading}
                    />
                );
            }
            const selectedPolicy =
                insurancePolicies.find(
                    (p) => p.policy_number === filter.value
                ) || null;
            return (
                <Autocomplete<InsurancePolicyOption>
                    size="small"
                    loading={insurancePoliciesLoading}
                    options={insurancePolicies}
                    value={selectedPolicy}
                    onChange={(_, newValue) =>
                        handleUpdateFilter(
                            index,
                            "value",
                            newValue?.policy_number || ""
                        )
                    }
                    getOptionLabel={(option) => String(option.policy_number)}
                    isOptionEqualToValue={(option, value) =>
                        option.id === value.id
                    }
                    fullWidth
                    dir={isRTL ? "rtl" : "ltr"}
                    {...(isHebrew && {
                        "data-hebrew": true,
                        "data-rtl": true,
                    })}
                    sx={filterAutocompleteStyles}
                    renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        return (
                            <li
                                key={key}
                                {...otherProps}
                                style={{
                                    direction: isRTL ? "rtl" : "ltr",
                                    textAlign: isRTL ? "right" : "left",
                                    paddingRight: isRTL ? "16px" : "14px",
                                    paddingLeft: isRTL ? "14px" : "16px",
                                }}
                            >
                                <Typography
                                    sx={{
                                        direction: isRTL ? "rtl" : "ltr",
                                        textAlign: isRTL ? "right" : "left",
                                        width: "100%",
                                    }}
                                >
                                    {option.policy_number}
                                </Typography>
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={t("fields.value", "Value")}
                            placeholder={t(
                                "fields.select_insurance_policy",
                                "Select insurance policy"
                            )}
                            size="small"
                            {...(isHebrew && { "data-hebrew": true })}
                            dir={isRTL ? "rtl" : "ltr"}
                            sx={filterTextFieldStyles}
                        />
                    )}
                />
            );
        }

        // Helper: empty string only for null/undefined/empty string, preserve 0 for number inputs
        const numericDisplayValue = (v: any) =>
            v === null || v === undefined || v === "" ? "" : v;

        // Helper to get start and end values for "between" operator
        const getBetweenValues = () => {
            if (Array.isArray(filter.value) && filter.value.length === 2) {
                return [
                    numericDisplayValue(filter.value[0]),
                    numericDisplayValue(filter.value[1]),
                ];
            }
            return [numericDisplayValue(filter.value), ""];
        };

        // Helper to update between values
        const updateBetweenValue = (position: 0 | 1, newValue: any) => {
            const [start, end] = getBetweenValues();
            const updated = [start, end];
            updated[position] = newValue;
            handleUpdateFilter(index, "value", updated);
        };

        switch (fieldType) {
            case "boolean":
                return (
                    <FormControlLabel
                        control={
                            <Switch
                                checked={
                                    filter.value === true ||
                                    filter.value === "true"
                                }
                                onChange={(e) =>
                                    handleUpdateFilter(
                                        index,
                                        "value",
                                        e.target.checked
                                    )
                                }
                                size="small"
                                {...(isHebrew && { "data-rtl": true })}
                            />
                        }
                        label={
                            filter.value === true || filter.value === "true"
                                ? t("values.true", "True")
                                : t("values.false", "False")
                        }
                        sx={{
                            margin: 0,
                            direction: isRTL ? "rtl" : "ltr",
                            "& .MuiFormControlLabel-label": {
                                marginLeft: isRTL ? 0 : theme.spacing(1),
                                marginRight: isRTL ? theme.spacing(1) : 0,
                            },
                        }}
                    />
                );

            case "enum":
                if (fieldInfo.options && fieldInfo.options.length > 0) {
                    // Sort enum options alphabetically
                    const sortedOptions = [...fieldInfo.options].sort((a, b) =>
                        String(a).localeCompare(String(b))
                    );
                    if (
                        filter.operator === "in" ||
                        filter.operator === "not_in"
                    ) {
                        // Multi-select for "in" operator (LogActivity-style: Select + Chips + Checkbox)
                        const selectedValues: string[] = Array.isArray(filter.value)
                            ? filter.value
                            : filter.value
                                ? [String(filter.value)]
                                : [];
                        return (
                            <FormControl
                                sx={{
                                    ...filterFormControlStyles,
                                    minWidth: 200,
                                    width: "100%",
                                }}
                                size="small"
                            >
                                <InputLabel
                                    id={`filter-enum-in-${index}`}
                                    sx={rtlTypographyStyles}
                                >
                                    {t("fields.value", "Value")}
                                </InputLabel>
                                <Select<string[]>
                                    labelId={`filter-enum-in-${index}`}
                                    multiple
                                    value={selectedValues}
                                    onChange={(e) => {
                                        const next = e.target.value as string[];
                                        handleUpdateFilter(index, "value", next);
                                    }}
                                    input={
                                        <OutlinedInput
                                            size="small"
                                            label={t("fields.value", "Value")}
                                        />
                                    }
                                    renderValue={(selected: string[]) => (
                                        <Box
                                            sx={{
                                                position: "relative",
                                                display: "flex",
                                                flexWrap: "wrap",
                                                gap: 0.5,
                                                maxHeight: 56,
                                                overflow: "auto",
                                                pr:
                                                    selected.length > 0 && !isRTL
                                                        ? "36px"
                                                        : 0,
                                                pl:
                                                    selected.length > 0 && isRTL
                                                        ? "36px"
                                                        : 0,
                                            }}
                                        >
                                            {selected.length === 0 ? (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={rtlTypographyStyles}
                                                >
                                                    {t(
                                                        "fields.select_options",
                                                        "Select options"
                                                    )}
                                                </Typography>
                                            ) : (
                                                selected.map((opt) => (
                                                    <Chip
                                                        key={opt}
                                                        label={formatEnumValueForDisplay(
                                                            opt,
                                                            filter.field,
                                                            filter.table
                                                        )}
                                                        size="small"
                                                        onMouseDown={(e) => {
                                                            // Prevent the Select from opening when clicking the chip delete icon
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                        }}
                                                        onDelete={(e) => {
                                                            // Ensure we only remove the chip and do not toggle the dropdown
                                                            (e as any)?.preventDefault?.();
                                                            (e as any)?.stopPropagation?.();
                                                            const next = selected.filter(
                                                                (v) => v !== opt
                                                            );
                                                            handleUpdateFilter(
                                                                index,
                                                                "value",
                                                                next
                                                            );
                                                        }}
                                                    />
                                                ))
                                            )}
                                            {selected.length > 0 && (
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleUpdateFilter(
                                                            index,
                                                            "value",
                                                            []
                                                        );
                                                    }}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                    }}
                                                    sx={{
                                                        position: "absolute",
                                                        right: isRTL
                                                            ? "auto"
                                                            : 32,
                                                        left: isRTL ? 32 : "auto",
                                                        top: "50%",
                                                        transform: "translateY(-50%)",
                                                        height: 20,
                                                        width: 20,
                                                    }}
                                                >
                                                    <ClearIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Box>
                                    )}
                                    MenuProps={{
                                        PaperProps: {
                                            style: { maxHeight: 300 },
                                        },
                                        keepMounted: true,
                                    }}
                                    sx={rtlTypographyStyles}
                                >
                                    {sortedOptions.map((option) => {
                                        const optStr = String(option);
                                        const isSelected =
                                            selectedValues.includes(optStr);
                                        return (
                                            <MenuItem
                                                key={optStr}
                                                value={optStr}
                                                sx={rtlMenuItemStyles}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    sx={{ p: 0 }}
                                                />
                                                <ListItemText
                                                    primary={formatEnumValueForDisplay(
                                                        optStr,
                                                        filter.field,
                                                        filter.table
                                                    )}
                                                    primaryTypographyProps={{
                                                        fontSize: "0.875rem",
                                                    }}
                                                    sx={rtlTypographyStyles}
                                                />
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                        );
                    } else {
                        // Single select for other operators
                        return (
                            <FormControl
                                sx={{ ...filterFormControlStyles, width: "100%" }}
                                size="small"
                            >
                                <InputLabel sx={rtlTypographyStyles}>
                                    {t("fields.value", "Value")}
                                </InputLabel>
                                <Select
                                    value={filter.value || ""}
                                    onChange={(e) =>
                                        handleUpdateFilter(
                                            index,
                                            "value",
                                            e.target.value
                                        )
                                    }
                                    label={t("fields.value", "Value")}
                                    size="small"
                                    sx={rtlTypographyStyles}
                                >
                                    {sortedOptions.map((option) => (
                                        <MenuItem
                                            key={option}
                                            value={option}
                                            sx={rtlMenuItemStyles}
                                        >
                                            {formatEnumValueForDisplay(
                                                String(option),
                                                filter.field,
                                                filter.table
                                            )}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        );
                    }
                }
                return (
                    <TextField
                        label={t("fields.value", "Value")}
                        value={filter.value || ""}
                        onChange={(e) =>
                            handleUpdateFilter(index, "value", e.target.value)
                        }
                        fullWidth
                        size="small"
                        {...(isHebrew && { "data-hebrew": true })}
                        dir={isRTL ? "rtl" : "ltr"}
                    />
                );

            case "date": {
                if (isBetween) {
                    const [startValue, endValue] = getBetweenValues();
                    return (
                        <Box sx={betweenRangePickerLayoutSx.row}>
                            <Box sx={betweenRangePickerLayoutSx.item}>
                                <DatePicker
                                    label={t(
                                        "fields.start_value",
                                        "Start Date"
                                    )}
                                    format={datePickerFormat}
                                    value={
                                        startValue ? moment(startValue) : null
                                    }
                                    onChange={(newValue: Moment | null) =>
                                        updateBetweenValue(
                                            0,
                                            newValue?.toISOString() || ""
                                        )
                                    }
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            required: true,
                                            error: !startValue,
                                            ...(isHebrew && { "data-hebrew": true }),
                                            dir: isRTL ? "rtl" : "ltr",
                                            sx: betweenRangePickerLayoutSx.textField,
                                        },
                                    }}
                                />
                            </Box>
                            <Box sx={betweenRangePickerLayoutSx.item}>
                                <DatePicker
                                    label={t("fields.end_value", "End Date")}
                                    format={datePickerFormat}
                                    value={endValue ? moment(endValue) : null}
                                    onChange={(newValue: Moment | null) =>
                                        updateBetweenValue(
                                            1,
                                            newValue?.toISOString() || ""
                                        )
                                    }
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            required: true,
                                            error: !endValue,
                                            ...(isHebrew && { "data-hebrew": true }),
                                            dir: isRTL ? "rtl" : "ltr",
                                            sx: betweenRangePickerLayoutSx.textField,
                                        },
                                    }}
                                />
                            </Box>
                        </Box>
                    );
                }

                // Single date with preset selector
                const currentDateMode = dateMode[index] || "custom";
                const currentDatePreset = datePreset[index] || "custom";
                const currentDatePresetInput = datePresetInput[index] || 7;
                const currentDatePresetOption = datePresetOptions.find(
                    (opt) => opt.value === currentDatePreset
                ) || datePresetOptions[datePresetOptions.length - 1];

                return (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            gap: 1,
                            alignItems: "center",
                            flex: "1 1 auto",
                            minWidth: 0,
                            overflow: "visible",
                            "& > *": {
                                margin: 0,
                            },
                        }}
                    >
                        <Autocomplete
                            size="small"
                            options={datePresetOptions}
                            value={currentDatePresetOption}
                            onChange={(_, newValue) => {
                                if (!newValue) return;

                                const newPreset = newValue.value;
                                setDatePreset((prev) => ({
                                    ...prev,
                                    [index]: newPreset,
                                }));

                                if (newPreset === "custom") {
                                    setDateMode((prev) => ({
                                        ...prev,
                                        [index]: "custom",
                                    }));
                                    // Convert preset to actual date when switching to custom
                                    const currentVal = filters[index]?.value;
                                    if (
                                        currentVal &&
                                        typeof currentVal === "object" &&
                                        "__datePreset" in currentVal
                                    ) {
                                        const p = (currentVal as any).__datePreset as DatePreset;
                                        const inp = (currentVal as any).__datePresetInput as number | undefined;
                                        const calculatedDate = resolveDatePreset(
                                            p,
                                            p === "last_x_days" || p === "last_x_months" || p === "next_x_days" || p === "next_x_months"
                                                ? inp
                                                : undefined,
                                            false
                                        );
                                        if (calculatedDate) {
                                            handleUpdateFilter(index, "value", calculatedDate);
                                        }
                                    }
                                } else {
                                    setDateMode((prev) => ({
                                        ...prev,
                                        [index]: "preset",
                                    }));
                                    // Store preset so it persists and can be restored on load
                                    const presetValue: {
                                        __datePreset: DatePreset;
                                        __datePresetInput?: number;
                                    } = {
                                        __datePreset: newPreset,
                                    };
                                    if (
                                        newPreset === "last_x_days" ||
                                        newPreset === "last_x_months" ||
                                        newPreset === "next_x_days" ||
                                        newPreset === "next_x_months"
                                    ) {
                                        presetValue.__datePresetInput =
                                            currentDatePresetInput;
                                    }
                                    handleUpdateFilter(index, "value", presetValue);
                                }
                            }}
                            getOptionLabel={(option) => option.label}
                            isOptionEqualToValue={(option, value) =>
                                option.value === value.value
                            }
                            dir={isRTL ? "rtl" : "ltr"}
                            {...(isHebrew && {
                                "data-hebrew": true,
                                "data-rtl": true,
                            })}
                            sx={{
                                ...filterAutocompleteStyles,
                                minWidth: 200,
                                "& .MuiInputLabel-root": {
                                    whiteSpace: "nowrap",
                                    overflow: "visible",
                                    textOverflow: "clip",
                                },
                            }}
                            renderOption={(props, option) => {
                                const { key, ...otherProps } = props;
                                return (
                                    <li
                                        key={key}
                                        {...otherProps}
                                        style={{
                                            direction: isRTL ? "rtl" : "ltr",
                                            textAlign: isRTL
                                                ? "right"
                                                : "left",
                                            paddingRight: isRTL
                                                ? "16px"
                                                : "14px",
                                            paddingLeft: isRTL
                                                ? "14px"
                                                : "16px",
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                ...rtlTypographyStyles,
                                                width: "100%",
                                            }}
                                        >
                                            {option.label}
                                        </Typography>
                                    </li>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t("fields.date_preset", {
                                        ns: "reports",
                                        defaultValue: "Date Preset",
                                    })}
                                    size="small"
                                    {...(isHebrew && {
                                        "data-hebrew": true,
                                    })}
                                    dir={isRTL ? "rtl" : "ltr"}
                                    sx={filterTextFieldStyles}
                                />
                            )}
                        />

                        {(currentDatePreset === "last_x_days" ||
                            currentDatePreset === "last_x_months" ||
                            currentDatePreset === "next_x_days" ||
                            currentDatePreset === "next_x_months") && (
                                <TextField
                                    type="number"
                                    size="small"
                                    value={currentDatePresetInput}
                                    onChange={(e) => {
                                        const numValue =
                                            parseInt(e.target.value) || 1;
                                        setDatePresetInput((prev) => ({
                                            ...prev,
                                            [index]: numValue,
                                        }));
                                        const calculatedDate =
                                            resolveDatePreset(
                                                currentDatePreset,
                                                numValue,
                                                false
                                            );
                                        if (calculatedDate) {
                                            handleUpdateFilter(
                                                index,
                                                "value",
                                                calculatedDate
                                            );
                                        }
                                    }}
                                    inputProps={{ min: 1, max: 365 }}
                                    sx={{
                                        ...filterTextFieldStyles,
                                        minWidth: 100,
                                        maxWidth: 100,
                                    }}
                                    {...(isHebrew && { "data-hebrew": true })}
                                    dir={isRTL ? "rtl" : "ltr"}
                                    placeholder={
                                        currentDatePreset === "last_x_days" ||
                                            currentDatePreset === "next_x_days"
                                            ? t("fields.days", {
                                                ns: "reports",
                                                defaultValue: "Days",
                                            })
                                            : t("fields.months", {
                                                ns: "reports",
                                                defaultValue: "Months",
                                            })
                                    }
                                />
                            )}

                        {currentDateMode === "custom" && (
                            <Box
                                sx={{
                                    minWidth: 220,
                                    flex: "0 1 auto",
                                    maxWidth: 350,
                                    width: "100%",
                                    overflow: "visible",
                                }}
                            >
                                <DatePicker
                                    label={t("fields.value", "Value")}
                                    format={datePickerFormat}
                                    value={
                                        getDateDisplayValue(filter.value)
                                            ? moment(getDateDisplayValue(filter.value))
                                            : null
                                    }
                                    onChange={(newValue: Moment | null) => {
                                        // When user manually changes date, ensure we're in custom mode
                                        setDateMode((prev) => ({
                                            ...prev,
                                            [index]: "custom",
                                        }));
                                        setDatePreset((prev) => ({
                                            ...prev,
                                            [index]: "custom",
                                        }));
                                        handleUpdateFilter(
                                            index,
                                            "value",
                                            newValue?.toISOString() || ""
                                        );
                                    }}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            ...(isHebrew && {
                                                "data-hebrew": true,
                                            }),
                                            dir: isRTL ? "rtl" : "ltr",
                                            sx: {
                                                margin: 0,
                                                width: "100%",
                                                maxWidth: "100%",
                                                "& .MuiFormControl-root": {
                                                    margin: 0,
                                                    width: "100%",
                                                    maxWidth: "100%",
                                                },
                                                "& .MuiOutlinedInput-root": {
                                                    width: "100%",
                                                    maxWidth: "100%",
                                                },
                                                "& .MuiInputBase-root": {
                                                    width: "100%",
                                                    maxWidth: "100%",
                                                },
                                                "& .MuiInputLabel-root": {
                                                    whiteSpace: "nowrap",
                                                    overflow: "visible",
                                                    textOverflow: "clip",
                                                },
                                            },
                                        },
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                );
            }

            case "datetime": {
                if (isBetween) {
                    const [startValue, endValue] = getBetweenValues();
                    return (
                        <Box sx={betweenRangePickerLayoutSx.row}>
                            <Box sx={betweenRangePickerLayoutSx.item}>
                                <DateTimePicker
                                    label={t(
                                        "fields.start_value",
                                        "Start Date/Time"
                                    )}
                                    format={dateTimePickerFormat}
                                    value={
                                        startValue ? moment(startValue) : null
                                    }
                                    onChange={(newValue: Moment | null) =>
                                        updateBetweenValue(
                                            0,
                                            newValue?.toISOString() || ""
                                        )
                                    }
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            required: true,
                                            error: !startValue,
                                            ...(isHebrew && { "data-hebrew": true }),
                                            dir: isRTL ? "rtl" : "ltr",
                                            sx: betweenRangePickerLayoutSx.textField,
                                        },
                                    }}
                                />
                            </Box>
                            <Box sx={betweenRangePickerLayoutSx.item}>
                                <DateTimePicker
                                    label={t(
                                        "fields.end_value",
                                        "End Date/Time"
                                    )}
                                    format={dateTimePickerFormat}
                                    value={endValue ? moment(endValue) : null}
                                    onChange={(newValue: Moment | null) =>
                                        updateBetweenValue(
                                            1,
                                            newValue?.toISOString() || ""
                                        )
                                    }
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            required: true,
                                            error: !endValue,
                                            ...(isHebrew && { "data-hebrew": true }),
                                            dir: isRTL ? "rtl" : "ltr",
                                            sx: betweenRangePickerLayoutSx.textField,
                                        },
                                    }}
                                />
                            </Box>
                        </Box>
                    );
                }
                // Single datetime with preset selector
                const currentDateTimeMode = dateMode[index] || "custom";
                const currentDateTimePreset = datePreset[index] || "custom";
                const currentDateTimePresetInput = datePresetInput[index] || 7;
                const currentDateTimePresetOption = datePresetOptions.find(
                    (opt) => opt.value === currentDateTimePreset
                ) || datePresetOptions[datePresetOptions.length - 1];

                return (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            gap: 1,
                            alignItems: "center",
                            flex: "1 1 auto",
                            minWidth: 0,
                            overflow: "visible",
                            "& > *": {
                                margin: 0,
                            },
                        }}
                    >
                        <Autocomplete
                            size="small"
                            options={datePresetOptions}
                            value={currentDateTimePresetOption}
                            onChange={(_, newValue) => {
                                if (!newValue) return;

                                const newPreset = newValue.value;
                                setDatePreset((prev) => ({
                                    ...prev,
                                    [index]: newPreset,
                                }));

                                if (newPreset === "custom") {
                                    setDateMode((prev) => ({
                                        ...prev,
                                        [index]: "custom",
                                    }));
                                    setDatePreset((prev) => ({
                                        ...prev,
                                        [index]: "custom",
                                    }));
                                    // Convert preset to actual date when switching to custom
                                    const currentVal = filters[index]?.value;
                                    if (
                                        currentVal &&
                                        typeof currentVal === "object" &&
                                        "__datePreset" in currentVal
                                    ) {
                                        const p = (currentVal as any).__datePreset as DatePreset;
                                        const inp = (currentVal as any).__datePresetInput as number | undefined;
                                        const calculatedDate = resolveDatePreset(
                                            p,
                                            p === "last_x_days" || p === "last_x_months" || p === "next_x_days" || p === "next_x_months"
                                                ? inp
                                                : undefined,
                                            true
                                        );
                                        if (calculatedDate) {
                                            handleUpdateFilter(index, "value", calculatedDate);
                                        }
                                    }
                                } else {
                                    setDateMode((prev) => ({
                                        ...prev,
                                        [index]: "preset",
                                    }));
                                    // Store preset so it persists and can be restored on load
                                    const presetValue: {
                                        __datePreset: DatePreset;
                                        __datePresetInput?: number;
                                    } = {
                                        __datePreset: newPreset,
                                    };
                                    if (
                                        newPreset === "last_x_days" ||
                                        newPreset === "last_x_months" ||
                                        newPreset === "next_x_days" ||
                                        newPreset === "next_x_months"
                                    ) {
                                        presetValue.__datePresetInput =
                                            currentDateTimePresetInput;
                                    }
                                    handleUpdateFilter(index, "value", presetValue);
                                }
                            }}
                            getOptionLabel={(option) => option.label}
                            isOptionEqualToValue={(option, value) =>
                                option.value === value.value
                            }
                            dir={isRTL ? "rtl" : "ltr"}
                            {...(isHebrew && {
                                "data-hebrew": true,
                                "data-rtl": true,
                            })}
                            sx={{
                                ...filterAutocompleteStyles,
                                minWidth: 200,
                                "& .MuiInputLabel-root": {
                                    whiteSpace: "nowrap",
                                    overflow: "visible",
                                    textOverflow: "clip",
                                },
                            }}
                            renderOption={(props, option) => {
                                const { key, ...otherProps } = props;
                                return (
                                    <li
                                        key={key}
                                        {...otherProps}
                                        style={{
                                            direction: isRTL ? "rtl" : "ltr",
                                            textAlign: isRTL
                                                ? "right"
                                                : "left",
                                            paddingRight: isRTL
                                                ? "16px"
                                                : "14px",
                                            paddingLeft: isRTL
                                                ? "14px"
                                                : "16px",
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                ...rtlTypographyStyles,
                                                width: "100%",
                                            }}
                                        >
                                            {option.label}
                                        </Typography>
                                    </li>
                                );
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t("fields.date_preset", {
                                        ns: "reports",
                                        defaultValue: "Date Preset",
                                    })}
                                    size="small"
                                    {...(isHebrew && {
                                        "data-hebrew": true,
                                    })}
                                    dir={isRTL ? "rtl" : "ltr"}
                                    sx={filterTextFieldStyles}
                                />
                            )}
                        />

                        {(currentDateTimePreset === "last_x_days" ||
                            currentDateTimePreset === "last_x_months" ||
                            currentDateTimePreset === "next_x_days" ||
                            currentDateTimePreset === "next_x_months") && (
                                <TextField
                                    type="number"
                                    size="small"
                                    value={currentDateTimePresetInput}
                                    onChange={(e) => {
                                        const numValue =
                                            parseInt(e.target.value) || 1;
                                        setDatePresetInput((prev) => ({
                                            ...prev,
                                            [index]: numValue,
                                        }));
                                        handleUpdateFilter(index, "value", {
                                            __datePreset: currentDateTimePreset as DatePreset,
                                            __datePresetInput: numValue,
                                        });
                                    }}
                                    inputProps={{ min: 1, max: 365 }}
                                    sx={{
                                        ...filterTextFieldStyles,
                                        minWidth: 100,
                                        maxWidth: 100,
                                    }}
                                    {...(isHebrew && { "data-hebrew": true })}
                                    dir={isRTL ? "rtl" : "ltr"}
                                    placeholder={
                                        currentDateTimePreset === "last_x_days" ||
                                            currentDateTimePreset === "next_x_days"
                                            ? t("fields.days", {
                                                ns: "reports",
                                                defaultValue: "Days",
                                            })
                                            : t("fields.months", {
                                                ns: "reports",
                                                defaultValue: "Months",
                                            })
                                    }
                                />
                            )}

                        {currentDateTimeMode === "custom" && (
                            <Box
                                sx={{
                                    minWidth: 220,
                                    flex: "1 1 auto",
                                    maxWidth: 350,
                                }}
                            >
                                <DateTimePicker
                                    label={t("fields.value", "Value")}
                                    format={dateTimePickerFormat}
                                    value={
                                        getDateDisplayValue(filter.value, true)
                                            ? moment(getDateDisplayValue(filter.value, true))
                                            : null
                                    }
                                    onChange={(newValue: Moment | null) => {
                                        // When user manually changes datetime, ensure we're in custom mode
                                        setDateMode((prev) => ({
                                            ...prev,
                                            [index]: "custom",
                                        }));
                                        setDatePreset((prev) => ({
                                            ...prev,
                                            [index]: "custom",
                                        }));
                                        handleUpdateFilter(
                                            index,
                                            "value",
                                            newValue?.toISOString() || ""
                                        );
                                    }}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            ...(isHebrew && {
                                                "data-hebrew": true,
                                            }),
                                            dir: isRTL ? "rtl" : "ltr",
                                            sx: {
                                                margin: 0,
                                                width: "100%",
                                                maxWidth: "100%",
                                                "& .MuiFormControl-root": {
                                                    margin: 0,
                                                    width: "100%",
                                                    maxWidth: "100%",
                                                },
                                                "& .MuiOutlinedInput-root": {
                                                    width: "100%",
                                                    maxWidth: "100%",
                                                },
                                                "& .MuiInputBase-root": {
                                                    width: "100%",
                                                    maxWidth: "100%",
                                                },
                                                "& .MuiInputLabel-root": {
                                                    whiteSpace: "nowrap",
                                                    overflow: "visible",
                                                    textOverflow: "clip",
                                                },
                                            },
                                        },
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                );
            }

            case "number":
            case "decimal":
                if (isBetween) {
                    const [startValue, endValue] = getBetweenValues();
                    return (
                        <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
                            <TextField
                                label={t("fields.start_value", "Start Value")}
                                type="number"
                                value={startValue}
                                onChange={(e) =>
                                    updateBetweenValue(
                                        0,
                                        e.target.value
                                            ? parseFloat(e.target.value)
                                            : ""
                                    )
                                }
                                fullWidth
                                size="small"
                                required
                                error={startValue === ""}
                                {...(isHebrew && { "data-hebrew": true })}
                                dir={isRTL ? "rtl" : "ltr"}
                                inputProps={{
                                    step: fieldType === "decimal" ? 0.01 : 1,
                                }}
                            />
                            <TextField
                                label={t("fields.end_value", "End Value")}
                                type="number"
                                value={endValue}
                                onChange={(e) =>
                                    updateBetweenValue(
                                        1,
                                        e.target.value
                                            ? parseFloat(e.target.value)
                                            : ""
                                    )
                                }
                                fullWidth
                                size="small"
                                required
                                error={endValue === ""}
                                {...(isHebrew && { "data-hebrew": true })}
                                dir={isRTL ? "rtl" : "ltr"}
                                inputProps={{
                                    step: fieldType === "decimal" ? 0.01 : 1,
                                }}
                            />
                        </Box>
                    );
                }
                return (
                    <TextField
                        label={t("fields.value", "Value")}
                        type="number"
                        value={numericDisplayValue(filter.value)}
                        onChange={(e) =>
                            handleUpdateFilter(
                                index,
                                "value",
                                e.target.value ? parseFloat(e.target.value) : ""
                            )
                        }
                        fullWidth
                        size="small"
                        {...(isHebrew && { "data-hebrew": true })}
                        dir={isRTL ? "rtl" : "ltr"}
                        inputProps={{
                            step: fieldType === "decimal" ? 0.01 : 1,
                        }}
                    />
                );

            case "user": {
                // Check if this is created_by, modified_by, assigned_to, or owner/owner_id field
                const normalizedField = normalizeFieldName(
                    filter.table,
                    filter.field
                );
                const isCreatedByOrModifiedByOrAssignedToOrOwner =
                    normalizedField === "created_by" ||
                    normalizedField === "modified_by" ||
                    normalizedField === "assigned_to" ||
                    normalizedField === "owner" ||
                    normalizedField === "owner_id";

                // Create user options for autocomplete
                const userOptions = users
                    .map((user) => ({
                        id: user.id,
                        label:
                            user.name ||
                            `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
                            user.email ||
                            t("fields.unnamed_user", {
                                ns: "reports",
                                defaultValue: "User",
                            }),
                        email: user.email,
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label));

                // Add "Current User" option for created_by/modified_by/assigned_to/owner fields
                const currentUserOption = {
                    id: "__CURRENT_USER__",
                    label: t("fields.current_user", {
                        ns: "reports",
                        defaultValue: "Current User",
                    }),
                    email: "",
                };
                const allUserOptions = isCreatedByOrModifiedByOrAssignedToOrOwner
                    ? [currentUserOption, ...userOptions]
                    : userOptions;

                // Custom render option to make "Current User" more noticeable
                const renderUserOption = (props: any, option: any) => {
                    const isCurrentUser = option.id === "__CURRENT_USER__";
                    const { key: _key, ...restProps } = props;
                    return (
                        <Box
                            key={option.id}
                            component="li"
                            {...restProps}
                            sx={{
                                ...restProps.sx,
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                                paddingRight: isRTL ? "16px" : "14px",
                                paddingLeft: isRTL ? "14px" : "16px",
                                ...(isCurrentUser && {
                                    fontWeight: 600,
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.08
                                    ),
                                    "&:hover": {
                                        backgroundColor: alpha(
                                            theme.palette.primary.main,
                                            0.12
                                        ),
                                    },
                                }),
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    width: "100%",
                                    direction: isRTL ? "rtl" : "ltr",
                                    flexDirection: "row",
                                }}
                            >
                                {isRTL ? (
                                    <>
                                        <Box
                                            component="span"
                                            sx={{
                                                ...(isCurrentUser && {
                                                    color: theme.palette.primary.main,
                                                }),
                                            }}
                                        >
                                            {option.label}
                                        </Box>
                                        {isCurrentUser && (
                                            <Person
                                                sx={{
                                                    fontSize: "1.2rem",
                                                    color: theme.palette.primary.main,
                                                }}
                                            />
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {isCurrentUser && (
                                            <Person
                                                sx={{
                                                    fontSize: "1.2rem",
                                                    color: theme.palette.primary.main,
                                                }}
                                            />
                                        )}
                                        <Box
                                            component="span"
                                            sx={{
                                                ...(isCurrentUser && {
                                                    color: theme.palette.primary.main,
                                                }),
                                            }}
                                        >
                                            {option.label}
                                        </Box>
                                    </>
                                )}
                            </Box>
                        </Box>
                    );
                };

                if (filter.operator === "in") {
                    const selectedUserIds: string[] = Array.isArray(
                        filter.value
                    )
                        ? (filter.value as unknown[]).map(String).filter(Boolean)
                        : filter.value != null && filter.value !== ""
                          ? [String(filter.value)]
                          : [];
                    const inOptions: ReportFilterInOption[] = allUserOptions.map(
                        (opt) => ({
                            value: String(opt.id),
                            label: opt.label,
                        })
                    );
                    return (
                        <ReportFilterInMultiSelect
                            idBase={`report-filter-user-${normalizedField}-${index}`}
                            labelText={fieldDisplayLabel}
                            emptyPlaceholder={t(
                                "fields.select_users",
                                "Select users"
                            )}
                            searchPlaceholder={t(
                                "fields.search_placeholder",
                                "Search…"
                            )}
                            noOptionsLabel={t(
                                "fields.no_options_available",
                                "No options available"
                            )}
                            noResultsLabel={t(
                                "fields.no_search_results",
                                "No matches"
                            )}
                            loadingLabel={t("messages.loading", { ns: "common", defaultValue: "Loading…" })}
                            options={inOptions}
                            value={selectedUserIds}
                            onChange={(next) =>
                                handleUpdateFilter(index, "value", next)
                            }
                            isRTL={isRTL}
                            isHebrew={isHebrew}
                            loading={usersLoading}
                        />
                    );
                } else {
                    // Single select for other operators
                    const selectedUser = allUserOptions.find(
                        (opt) => opt.id === filter.value
                    );

                    return (
                        <Autocomplete
                            size="small"
                            loading={usersLoading}
                            options={allUserOptions}
                            value={selectedUser || null}
                            onChange={(_, newValue) =>
                                handleUpdateFilter(
                                    index,
                                    "value",
                                    newValue?.id || ""
                                )
                            }
                            getOptionLabel={(option) => option.label}
                            isOptionEqualToValue={(option, value) =>
                                option.id === value.id
                            }
                            fullWidth
                            dir={isRTL ? "rtl" : "ltr"}
                            {...(isHebrew && {
                                "data-hebrew": true,
                                "data-rtl": true,
                            })}
                            sx={filterAutocompleteStyles}
                            renderOption={renderUserOption}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t("fields.value", "Value")}
                                    placeholder={t(
                                        "fields.select_user",
                                        "Select user"
                                    )}
                                    fullWidth
                                    size="small"
                                    {...(isHebrew && { "data-hebrew": true })}
                                    dir={isRTL ? "rtl" : "ltr"}
                                    sx={filterTextFieldStyles}
                                />
                            )}
                        />
                    );
                }
            }

            default:
                if (isBetween) {
                    const [startValue, endValue] = getBetweenValues();
                    return (
                        <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
                            <TextField
                                label={t("fields.start_value", "Start Value")}
                                value={startValue || ""}
                                onChange={(e) =>
                                    updateBetweenValue(0, e.target.value)
                                }
                                fullWidth
                                size="small"
                                required
                                error={!startValue}
                                {...(isHebrew && { "data-hebrew": true })}
                                dir={isRTL ? "rtl" : "ltr"}
                            />
                            <TextField
                                label={t("fields.end_value", "End Value")}
                                value={endValue || ""}
                                onChange={(e) =>
                                    updateBetweenValue(1, e.target.value)
                                }
                                fullWidth
                                size="small"
                                required
                                error={!endValue}
                                {...(isHebrew && { "data-hebrew": true })}
                                dir={isRTL ? "rtl" : "ltr"}
                            />
                        </Box>
                    );
                }
                return (
                    <TextField
                        label={t("fields.value", "Value")}
                        value={filter.value || ""}
                        onChange={(e) =>
                            handleUpdateFilter(index, "value", e.target.value)
                        }
                        fullWidth
                        size="small"
                        {...(isHebrew && { "data-hebrew": true })}
                        dir={isRTL ? "rtl" : "ltr"}
                    />
                );
        }
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                direction: isRTL ? "rtl" : "ltr",
                textAlign: isRTL ? "right" : "left",
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexDirection: isRTL ? "row-reverse" : "row",
                }}
            >
                {isRTL ? (
                    <>
                        {!isViewer && (
                        <Button
                            variant="outlined"
                            startIcon={isRTL ? undefined : <Add />}
                            endIcon={isRTL ? <Add /> : undefined}
                            onClick={handleAddFilter}
                            disabled={selectedTables.length === 0}
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                "& .MuiButton-endIcon": {
                                    marginLeft: isRTL ? 0 : theme.spacing(1),
                                    marginRight: isRTL ? theme.spacing(1) : 0,
                                },
                                "& .MuiButton-startIcon": {
                                    marginRight: isRTL ? 0 : theme.spacing(1),
                                    marginLeft: isRTL ? theme.spacing(1) : 0,
                                },
                            }}
                        >
                            {t("actions.add_filter", "Add Filter")}
                        </Button>
                        )}
                        <Box>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={rtlTypographyStyles}
                            >
                                {t(
                                    "sections.add_filters_description",
                                    "Filter your report data based on field values. Multiple filters are combined using AND logic."
                                )}
                            </Typography>
                        </Box>
                    </>
                ) : (
                    <>
                        <Box>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={rtlTypographyStyles}
                            >
                                {t(
                                    "sections.add_filters_description",
                                    "Filter your report data based on field values. Multiple filters are combined using AND logic."
                                )}
                            </Typography>
                        </Box>
                        {!isViewer && (
                        <Button
                            variant="outlined"
                            startIcon={isRTL ? undefined : <Add />}
                            endIcon={isRTL ? <Add /> : undefined}
                            onClick={handleAddFilter}
                            disabled={selectedTables.length === 0}
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                "& .MuiButton-endIcon": {
                                    marginLeft: isRTL ? 0 : theme.spacing(1),
                                    marginRight: isRTL ? theme.spacing(1) : 0,
                                },
                                "& .MuiButton-startIcon": {
                                    marginRight: isRTL ? 0 : theme.spacing(1),
                                    marginLeft: isRTL ? theme.spacing(1) : 0,
                                },
                            }}
                        >
                            {t("actions.add_filter", "Add Filter")}
                        </Button>
                        )}
                    </>
                )}
            </Box>

            {filters.length === 0 && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        textAlign: "center",
                        bgcolor: "background.paper",
                        border: `1px dashed ${theme.palette.divider}`,
                    }}
                >
                    <Typography variant="body2" color="text.secondary">
                        {t(
                            "messages.no_filters",
                            "No filters added. Add filters to narrow down your report data."
                        )}
                    </Typography>
                </Paper>
            )}

            {filters.map((filter, index) => {
                const normalizedField = normalizeFieldName(
                    filter.table,
                    filter.field
                );
                const fieldInfo = getFieldInfo(filter.table, normalizedField);
                // Treat owner/owner_id fields as user type (like created_by/modified_by)
                const isOwnerField =
                    normalizedField === "owner" ||
                    normalizedField === "owner_id";
                const fieldTypeForOperators = isOwnerField
                    ? "user"
                    : fieldInfo?.type || "string";
                const operators = fieldInfo
                    ? getOperatorsForFilterField(
                          fieldTypeForOperators,
                          normalizedField
                      )
                    : [
                        {
                            value: "equals",
                            label: t("values.operator_equals", {
                                ns: "reports",
                                defaultValue: "Equals",
                            }),
                        },
                        {
                            value: "not_equals",
                            label: t("values.operator_not_equals", {
                                ns: "reports",
                                defaultValue: "Not Equals",
                            }),
                        },
                    ];

                // Get available fields for the table (excluding id fields, but allow owner/owner_id)
                const availableFields = getTableFields(filter.table).filter(
                    (f) => {
                        const fieldNameLower = f.name.toLowerCase();
                        // Allow owner/owner_id fields (they're user reference fields like created_by/modified_by)
                        if (
                            fieldNameLower === "owner" ||
                            fieldNameLower === "owner_id"
                        ) {
                            return true;
                        }
                        return (
                            fieldNameLower !== "id" &&
                            !fieldNameLower.endsWith("_id")
                        );
                    }
                );

                // Only use normalized field when it exists in options; otherwise keep empty
                // (do not auto-select the first field — that breaks Autocomplete clear).
                const resolvedField = availableFields.some(
                    (f) => f.name === normalizedField
                )
                    ? normalizedField
                    : "";

                const displayFilter = { ...filter, field: resolvedField };

                const filterDescription = getFilterDescription(filter);
                const isExpanded = expandedFilters.has(index);

                const filterFields = (
                    <>
                                {!isViewer && (
                                    <>
                                        {/* Table Selector */}
                                        <Autocomplete
                                            size="small"
                                            options={selectedTables}
                                            value={filter.table}
                                            onChange={(_, newValue) =>
                                                handleUpdateFilter(
                                                    index,
                                                    "table",
                                                    newValue || ""
                                                )
                                            }
                                            getOptionLabel={(option) =>
                                                getTableLabel(option)
                                            }
                                            dir={isRTL ? "rtl" : "ltr"}
                                            {...(isHebrew && {
                                                "data-hebrew": true,
                                                "data-rtl": true,
                                            })}
                                            sx={filterAutocompleteStyles}
                                            renderOption={(props, option) => {
                                                const { key, ...otherProps } = props;
                                                return (
                                                    <li
                                                        key={key}
                                                        {...otherProps}
                                                        style={{
                                                            direction: isRTL
                                                                ? "rtl"
                                                                : "ltr",
                                                            textAlign: isRTL
                                                                ? "right"
                                                                : "left",
                                                            paddingRight: isRTL
                                                                ? "16px"
                                                                : "14px",
                                                            paddingLeft: isRTL
                                                                ? "14px"
                                                                : "16px",
                                                        }}
                                                    >
                                                        <Typography
                                                            sx={{
                                                                ...rtlTypographyStyles,
                                                                width: "100%",
                                                            }}
                                                        >
                                                            {getTableLabel(option)}
                                                        </Typography>
                                                    </li>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={t(
                                                        "fields.table",
                                                        "Table"
                                                    )}
                                                    size="small"
                                                    {...(isHebrew && {
                                                        "data-hebrew": true,
                                                    })}
                                                    dir={isRTL ? "rtl" : "ltr"}
                                                    sx={filterTextFieldStyles}
                                                />
                                            )}
                                        />

                                        {/* Field Selector */}
                                        <Autocomplete
                                            size="small"
                                            options={availableFields}
                                            value={
                                                resolvedField
                                                    ? availableFields.find(
                                                          (f) =>
                                                              f.name ===
                                                              resolvedField
                                                      ) ?? null
                                                    : null
                                            }
                                            onChange={(_, newValue) =>
                                                handleUpdateFilter(
                                                    index,
                                                    "field",
                                                    newValue?.name || ""
                                                )
                                            }
                                            getOptionLabel={(option) =>
                                                option.label || option.name
                                            }
                                            isOptionEqualToValue={(
                                                option,
                                                value
                                            ) => option.name === value.name}
                                            dir={isRTL ? "rtl" : "ltr"}
                                            {...(isHebrew && {
                                                "data-hebrew": true,
                                                "data-rtl": true,
                                            })}
                                            sx={filterAutocompleteStyles}
                                            renderOption={(props, option) => {
                                                const { key, ...otherProps } = props;
                                                return (
                                                    <li
                                                        key={key}
                                                        {...otherProps}
                                                        style={{
                                                            direction: isRTL
                                                                ? "rtl"
                                                                : "ltr",
                                                            textAlign: isRTL
                                                                ? "right"
                                                                : "left",
                                                            paddingRight: isRTL
                                                                ? "16px"
                                                                : "14px",
                                                            paddingLeft: isRTL
                                                                ? "14px"
                                                                : "16px",
                                                        }}
                                                    >
                                                        <Typography
                                                            sx={{
                                                                ...rtlTypographyStyles,
                                                                width: "100%",
                                                            }}
                                                        >
                                                            {option.label ||
                                                                option.name}
                                                        </Typography>
                                                    </li>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={t(
                                                        "fields.field",
                                                        "Field"
                                                    )}
                                                    size="small"
                                                    {...(isHebrew && {
                                                        "data-hebrew": true,
                                                    })}
                                                    dir={isRTL ? "rtl" : "ltr"}
                                                    sx={filterTextFieldStyles}
                                                />
                                            )}
                                        />
                                    </>
                                )}

                                {/* Operator Selector */}
                                <Autocomplete
                                    size="small"
                                    options={operators}
                                    value={
                                        operators.find(
                                            (op) => op.value === displayFilter.operator
                                        ) || null
                                    }
                                    onChange={(_, newValue) =>
                                        handleUpdateFilter(
                                            index,
                                            "operator",
                                            newValue?.value || ""
                                        )
                                    }
                                    getOptionLabel={(option) => option.label}
                                    isOptionEqualToValue={(option, value) =>
                                        option.value === value.value
                                    }
                                    dir={isRTL ? "rtl" : "ltr"}
                                    {...(isHebrew && {
                                        "data-hebrew": true,
                                        "data-rtl": true,
                                    })}
                                    sx={filterAutocompleteStyles}
                                    renderOption={(props, option) => {
                                        const { key, ...otherProps } = props;
                                        return (
                                            <li
                                                key={key}
                                                {...otherProps}
                                                style={{
                                                    direction: isRTL ? "rtl" : "ltr",
                                                    textAlign: isRTL ? "right" : "left",
                                                    paddingRight: isRTL ? "16px" : "14px",
                                                    paddingLeft: isRTL ? "14px" : "16px",
                                                }}
                                            >
                                                <Typography
                                                    sx={{
                                                        ...rtlTypographyStyles,
                                                        width: "100%",
                                                    }}
                                                >
                                                    {option.label}
                                                </Typography>
                                            </li>
                                        );
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={t("fields.operator", "Operator")}
                                            size="small"
                                            {...(isHebrew && { "data-hebrew": true })}
                                            dir={isRTL ? "rtl" : "ltr"}
                                            sx={filterTextFieldStyles}
                                        />
                                    )}
                                />

                                {/* Value Input */}
                                <Box
                                    sx={{
                                        width: "100%",
                                        minWidth: 0,
                                        maxWidth: "100%",
                                    }}
                                >
                                    {renderValueInput(displayFilter, index)}
                                </Box>
                    </>
                );

                if (isViewer) {
                    return (
                        <React.Fragment key={index}>
                            {index > 0 && (
                                <Divider
                                    sx={{
                                        my: 0.75,
                                        width: "50%",
                                        mx: "auto",
                                        borderColor: alpha(
                                            theme.palette.primary.main,
                                            0.12
                                        ),
                                    }}
                                />
                            )}
                            <Box
                                sx={{
                                    pt: index > 0 ? 0.75 : 0,
                                    pb: 0.75,
                                    width: "100%",
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        fontWeight: 600,
                                        mb: validationErrors[index] ? 0.5 : 1.5,
                                        ...rtlTypographyStyles,
                                        color: "text.primary",
                                    }}
                                >
                                    {filterDescription}
                                </Typography>
                                {validationErrors[index] && (
                                    <Typography
                                        variant="caption"
                                        color="error"
                                        sx={{
                                            ...rtlTypographyStyles,
                                            display: "block",
                                            mb: 1.5,
                                        }}
                                    >
                                        {validationErrors[index]}
                                    </Typography>
                                )}
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                        width: "100%",
                                        minWidth: 0,
                                        maxWidth: "100%",
                                    }}
                                >
                                    {filterFields}
                                </Box>
                            </Box>
                        </React.Fragment>
                    );
                }

                return (
                    <Card
                        key={index}
                        elevation={0}
                        sx={{
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            transition: "all 0.2s ease-in-out",
                            maxWidth: 600,
                            width: "100%",
                            boxShadow: "none",
                            "&:hover": {
                                borderColor: theme.palette.primary.main,
                            },
                        }}
                    >
                        <CardContent
                            sx={{
                                p: 0,
                                "&:last-child": { pb: 0 },
                            }}
                        >
                            <Box
                                component="div"
                                role="button"
                                tabIndex={0}
                                onClick={() => handleToggleFilter(index)}
                                onKeyDown={(e) => {
                                    if (
                                        e.key === "Enter" ||
                                        e.key === " "
                                    ) {
                                        e.preventDefault();
                                        handleToggleFilter(index);
                                    }
                                }}
                                sx={{
                                    width: "100%",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    p: 2,
                                    pb: isExpanded ? 1 : 2,
                                    flexDirection: isRTL ? "row-reverse" : "row",
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    textAlign: isRTL ? "right" : "left",
                                    "&:hover": {
                                        backgroundColor: alpha(
                                            theme.palette.primary.main,
                                            0.08
                                        ),
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        flex: 1,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        flexDirection: isRTL ? "row-reverse" : "row",
                                        minWidth: 0,
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        sx={{
                                            color: "text.secondary",
                                            transform: isExpanded
                                                ? "rotate(180deg)"
                                                : "rotate(0deg)",
                                            transition: "transform 0.2s",
                                        }}
                                    >
                                        <ExpandMore />
                                    </IconButton>
                                    <Box
                                        sx={{
                                            flex: 1,
                                            minWidth: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 0.5,
                                        }}
                                    >
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontWeight: 500,
                                                ...rtlTypographyStyles,
                                                color: "text.primary",
                                            }}
                                        >
                                            {filterDescription}
                                        </Typography>
                                        {validationErrors[index] && (
                                            <Typography
                                                variant="caption"
                                                color="error"
                                                sx={{
                                                    ...rtlTypographyStyles,
                                                }}
                                            >
                                                {validationErrors[index]}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                                <Tooltip
                                    title={t("actions.delete", { ns: "common" })}
                                    arrow
                                    enterDelay={300}
                                    leaveDelay={100}
                                    placement="bottom"
                                    PopperProps={{
                                        sx: {
                                            "& .MuiTooltip-tooltip": {
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            },
                                            "& .MuiTooltip-arrow": {
                                                ...(i18n.language === "he" && {
                                                    transform: "scaleX(-1)",
                                                }),
                                            },
                                        },
                                    }}
                                >
                                    <IconButton
                                        size="small"
                                        aria-label={t("actions.delete", { ns: "common" })}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveFilter(index);
                                        }}
                                        sx={{
                                            color: "primary.main",
                                            "&:hover": {
                                                backgroundColor: alpha(
                                                    theme.palette.primary.main,
                                                    0.1
                                                ),
                                            },
                                        }}
                                    >
                                        <Delete fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            <Collapse in={isExpanded}>
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 2,
                                        px: 2,
                                        pt: 2,
                                        pb: 2,
                                    }}
                                >
                                    {filterFields}
                                </Box>
                            </Collapse>
                        </CardContent>
                    </Card>
                );
            })}
        </Box>
    );
};

export default FilterBuilder;
