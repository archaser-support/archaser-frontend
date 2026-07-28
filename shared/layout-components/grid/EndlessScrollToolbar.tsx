// eslint-disable-next-line import/order
import {
    Add as AddIcon,
    Clear as ClearIcon,
    ContentCopy as ContentCopyIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    FileDownload as FileDownloadIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Settings as SettingsIcon,
    Share as ShareIcon,
    StarBorder as StarBorderIcon,
    Star as StarIcon,
} from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    IconButton,
    InputAdornment,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Menu,
    MenuItem,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { Theme, alpha, useTheme } from "@mui/material/styles";
import { GridColDef } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import { TFunction } from "i18next";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getEndlessScrollToolbarTooltipProps } from "./endlessScrollToolbarTooltip";

export { getEndlessScrollToolbarTooltipProps };

interface EndlessScrollToolbarProps {
    customButtons?: React.ReactNode;
    bulkActionButton?: React.ReactNode;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    searchPlaceholder?: string;
    searchDisabled?: boolean;
    searchDirection?: "ltr" | "rtl";
    onSearchFocus?: () => void;
    onSearchBlur?: () => void;
    totalRecords?: number;
    // Export props
    columns?: GridColDef[];
    onExportClick?: () => void;
    exportDisabled?: boolean;
    // Report selector props
    reportSelector?: boolean;
    selectedReportId?: number | string | null;
    onReportChange?: (reportId: number | string | null) => void;
    hasCreateReportPermission?: boolean;
    onCreateReport?: () => void;
    hasEditReportPermission?: boolean;
    onEditReport?: (reportId: number) => void;
    hasDeleteReportPermission?: boolean;
    onDeleteReport?: (reportId: number) => void;
    hasCloneReportPermission?: boolean;
    onCloneReport?: (reportId: number) => void;
    reportContext?: string;
    // Share report props
    hasShareReportPermission?: boolean;
    onShareReport?: (reportId: number) => void;
    // User default report props
    onSetAsDefault?: (reportId: number) => void;
    isUserDefault?: boolean;
    // Refresh
    onRefresh?: () => void;
}

const EndlessScrollToolbarComponent: React.FC<EndlessScrollToolbarProps> = ({
    customButtons,
    bulkActionButton,
    searchValue = "",
    onSearchChange,
    searchPlaceholder,
    searchDisabled = false,
    searchDirection: propSearchDirection,
    onSearchFocus,
    onSearchBlur,
    totalRecords = 0,
    columns = [],
    onExportClick,
    exportDisabled = false,
    reportSelector = false,
    selectedReportId,
    onReportChange,
    hasCreateReportPermission = false,
    onCreateReport,
    hasEditReportPermission = false,
    onEditReport,
    hasDeleteReportPermission = false,
    onDeleteReport,
    hasCloneReportPermission = false,
    onCloneReport,
    reportContext,
    hasShareReportPermission = false,
    onShareReport,
    onSetAsDefault,
    isUserDefault = false,
    onRefresh,
}) => {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const theme = useTheme();
    const { data: session, status } = useSession();
    const isHebrew = i18n.language === "he";

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user && status === "authenticated",
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
        refetchOnWindowFocus: false,
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasExportPermission = userPermissions.includes("export_data");

    // Fetch reports if report selector is enabled
    const { data: reportsData, isLoading: reportsLoading } = useQuery<{
        reports: Array<{
            id: number;
            name: string;
            description?: string;
            is_system?: boolean;
            is_shared?: boolean;
            is_shared_by_me?: boolean;
            is_default?: boolean;
            context?: string;
        }>;
    }>({
        queryKey: ["reports-list", session?.user?.account_id, reportContext],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (reportContext) {
                params.append("context", reportContext);
            }
            const url = `/api/reports${params.toString() ? `?${params.toString()}` : ""}`;
            const response = await api.get(url);
            return response.data;
        },
        enabled:
            reportSelector && !!session?.user && status === "authenticated",
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes to reduce excessive refetching
        refetchOnWindowFocus: false, // Disable to prevent excessive refetching on focus
        refetchOnMount: "always", // Ensure newly created/cloned reports appear after navigation back
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    });

    // Fetch user default report to show icon in dropdown
    const { data: userDefaultReportData } = useQuery<{
        report: { id: number } | null;
    }>({
        queryKey: ["user-default-report", session?.user?.id, reportContext],
        queryFn: async () => {
            if (!session?.user?.id || !reportContext) return { report: null };
            const response = await api.get(
                `/api/reports/user-default?context=${reportContext}`
            );
            return response.data;
        },
        enabled:
            reportSelector &&
            !!session?.user?.id &&
            !!reportContext &&
            status === "authenticated",
        staleTime: 0, // Always consider stale to ensure fresh data on mount
        refetchOnMount: true, // Always refetch on mount to get latest default
        refetchOnWindowFocus: false, // Disable to prevent excessive refetching on focus
    });

    const userDefaultReportId = userDefaultReportData?.report?.id || null;

    // Note: Removed forced refetch on enable - React Query will handle this automatically
    // The query is already configured with staleTime and refetchOnMount: false
    // This prevents excessive refetching when components mount/unmount

    // Refs to track state changes
    const lastSelectedReportIdRef = useRef<number | string | null>(null);
    const lastPropSelectedReportIdRef = useRef<number | string | null>(null);
    const lastAllReportsRef = useRef<Array<{ id: number | string; name: string }>>([]);
    const reportSelectorInputRef = useRef<HTMLInputElement | null>(null);
    const [isSelectedReportNameTruncated, setIsSelectedReportNameTruncated] =
        useState(false);

    // Process reports from API (includes system reports)
    // Sort: custom views first, then system views
    const allReports = useMemo(() => {
        // Check if userDefaultReportId exists in the reports list
        // If it doesn't exist, fall back to system defaults
        const userDefaultExists = userDefaultReportId !== null &&
            userDefaultReportId !== undefined &&
            reportsData?.reports?.some((r) => r.id === userDefaultReportId);

        const reports =
            reportsData?.reports?.map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                isSystem: r.is_system === true,
                isShared: r.is_shared === true,
                isSharedByMe: r.is_shared_by_me === true,
                // User-specific defaults take precedence over system defaults
                // If user has a default that exists in the list, only that report is marked as default
                // Otherwise, show system defaults (is_default === true)
                isDefault: userDefaultExists
                    ? userDefaultReportId === r.id
                    : Boolean(r.is_default),
                group: r.is_system === true ? "system" : "custom",
                uniqueName: (r as any).unique_name || null,
            })) || [];

        // Some accounts can return duplicate report rows (same system seed/name
        // repeated, sometimes once as system and once as custom). De-dupe by a
        // normalized key and prefer custom over system for the same logical report.
        const normalizeReportName = (name: string) =>
            String(name || "")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, " ");
        const dedupeMap = new Map<string, (typeof reports)[number]>();
        for (const report of reports) {
            const normalizedName = normalizeReportName(report.name);
            const keyBase = report.isSystem
                ? `system:${normalizedName}`
                : `${report.context || "global"}:${report.uniqueName || normalizedName}`;
            const key = keyBase.trim();
            if (!key) {
                dedupeMap.set(`id:${report.id}`, report);
                continue;
            }
            const existing = dedupeMap.get(key);
            if (!existing) {
                dedupeMap.set(key, report);
                continue;
            }
            // Prefer non-system entries when duplicate names collide.
            if (existing.isSystem && !report.isSystem) {
                dedupeMap.set(key, report);
            }
        }
        const dedupedReports = Array.from(dedupeMap.values());

        // Sort: custom views first, then system views
        const sortedReports = dedupedReports.sort((a, b) => {
            if (a.isSystem === b.isSystem) return 0;
            return a.isSystem ? 1 : -1;
        });

        // Track allReports changes for debugging if needed
        const currentReportIds = sortedReports.map(r => ({ id: r.id, name: r.name }));
        const previousReportIds = lastAllReportsRef.current.map(r => r.id);
        const currentReportIdsOnly = currentReportIds.map(r => r.id);

        if (JSON.stringify(previousReportIds) !== JSON.stringify(currentReportIdsOnly)) {
            lastAllReportsRef.current = currentReportIds;
        }

        return sortedReports;
    }, [reportsData, userDefaultReportId, selectedReportId]);

    // Fetch selected report individually if it's not in the list
    const selectedReportIdNumber = selectedReportId
        ? (typeof selectedReportId === 'string' ? parseInt(selectedReportId, 10) : selectedReportId)
        : null;

    const isSelectedReportInList = useMemo(() => {
        if (!selectedReportIdNumber) return false;
        return allReports.some(r => {
            const reportId = typeof r.id === 'string' ? parseInt(r.id, 10) : r.id;
            return reportId === selectedReportIdNumber;
        });
    }, [selectedReportIdNumber, allReports]);

    const { data: selectedReportData } = useQuery<{
        id: number;
        name: string;
        description?: string;
        is_system?: boolean;
        is_shared?: boolean;
        is_shared_by_me?: boolean;
        is_default?: boolean;
        context?: string;
    }>({
        queryKey: ["report", selectedReportIdNumber],
        queryFn: async () => {
            if (!selectedReportIdNumber) return null;
            const response = await api.get(`/api/reports/${selectedReportIdNumber}`);
            return response.data.report;
        },
        enabled: !!selectedReportIdNumber && !isSelectedReportInList && !reportsLoading && reportSelector,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    // Get selected report - include fetched report if not in list
    const selectedReport = useMemo(() => {
        if (!selectedReportId) {
            return null;
        }

        // Track selectedReportId changes
        if (lastSelectedReportIdRef.current !== selectedReportId) {
            lastSelectedReportIdRef.current = selectedReportId;
        }

        // Try to find by exact match first
        let found = allReports.find((r) => r.id === selectedReportId) || null;

        // If not found, try type coercion (number vs string)
        if (!found) {
            const selectedAsNumber = typeof selectedReportId === 'string' ? parseInt(selectedReportId, 10) : selectedReportId;
            found = allReports.find((r) => {
                const reportIdAsNumber = typeof r.id === 'string' ? parseInt(r.id, 10) : r.id;
                return r.id === selectedReportId ||
                    reportIdAsNumber === selectedAsNumber;
            }) || null;
        }

        // If still not found but we have the fetched report data, use it
        if (!found && selectedReportData) {
            found = {
                id: selectedReportData.id,
                name: selectedReportData.name,
                description: selectedReportData.description,
                isSystem: selectedReportData.is_system === true,
                isShared: selectedReportData.is_shared === true,
                isSharedByMe: selectedReportData.is_shared_by_me === true,
                // User-specific defaults take precedence over system defaults
                isDefault: userDefaultReportId
                    ? userDefaultReportId === selectedReportData.id
                    : selectedReportData.is_default === true,
                group: selectedReportData.is_system === true ? "system" : "custom",
            };
        }

        return found;
    }, [selectedReportId, allReports, selectedReportData, userDefaultReportId]);

    // Calculate if settings menu will have any items
    // Must be after selectedReport is defined
    const hasSettingsMenuItems = useMemo(() => {
        // Create View
        if (hasCreateReportPermission && onCreateReport) {
            return true;
        }

        // Edit Report (only for non-system reports)
        if (
            selectedReport &&
            !selectedReport.isSystem &&
            hasEditReportPermission &&
            onEditReport &&
            typeof selectedReport.id === "number"
        ) {
            return true;
        }

        // Clone View
        if (
            selectedReport &&
            hasCloneReportPermission &&
            onCloneReport &&
            typeof selectedReport.id === "number"
        ) {
            return true;
        }

        // Share (only for non-system reports)
        if (
            selectedReport &&
            !selectedReport.isSystem &&
            hasShareReportPermission &&
            onShareReport &&
            typeof selectedReport.id === "number"
        ) {
            return true;
        }

        // Set as Default (only if not already default)
        if (
            selectedReport &&
            typeof selectedReport.id === "number" &&
            onSetAsDefault &&
            !selectedReport.isDefault
        ) {
            return true;
        }

        // Delete Report (only for non-system reports)
        if (
            selectedReport &&
            !selectedReport.isSystem &&
            hasDeleteReportPermission &&
            onDeleteReport &&
            typeof selectedReport.id === "number"
        ) {
            return true;
        }

        return false;
    }, [
        hasCreateReportPermission,
        onCreateReport,
        selectedReport,
        hasEditReportPermission,
        onEditReport,
        hasCloneReportPermission,
        onCloneReport,
        hasShareReportPermission,
        onShareReport,
        onSetAsDefault,
        hasDeleteReportPermission,
        onDeleteReport,
    ]);

    // Auto-detect search direction from language if not provided
    const searchDirection =
        propSearchDirection || (i18n.language === "he" ? "rtl" : "ltr");
    const [localSearchValue, setLocalSearchValue] = useState(searchValue);
    const [isFocused, setIsFocused] = useState(false);
    const [settingsMenuAnchor, setSettingsMenuAnchor] =
        useState<null | HTMLElement>(null);

    // Track selectedReportId prop changes from parent
    useEffect(() => {
        if (lastPropSelectedReportIdRef.current !== selectedReportId) {
            lastPropSelectedReportIdRef.current = selectedReportId ?? null;
        }
    }, [selectedReportId, selectedReport]);

    // Update local value when prop changes - but only if not focused to prevent focus loss
    useEffect(() => {
        if (!isFocused && searchValue !== localSearchValue) {
            setLocalSearchValue(searchValue);
        }
    }, [searchValue, isFocused, localSearchValue]);

    // Memoized callbacks
    const handleSearchChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            setLocalSearchValue(event.target.value);
        },
        []
    );

    const handleSearchSubmit = useCallback(() => {
        onSearchChange?.(localSearchValue);
    }, [onSearchChange, localSearchValue]);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                handleSearchSubmit();
            }
        },
        [handleSearchSubmit]
    );

    const handleClearSearch = useCallback(() => {
        setLocalSearchValue("");
        onSearchChange?.("");
    }, [onSearchChange]);

    const handleFocus = useCallback(() => {
        setIsFocused(true);
        onSearchFocus?.();
    }, [onSearchFocus]);

    const handleBlur = useCallback(() => {
        setIsFocused(false);
        onSearchBlur?.();
    }, [onSearchBlur]);

    const searchIconAdornment = useMemo(
        () => (
            <InputAdornment
                position="start"
                sx={{
                    marginInlineEnd: theme.spacing(0.5),
                    paddingInlineStart: theme.spacing(1),
                    minWidth: "auto",
                    width: "auto",
                }}
            >
                <Box
                    onClick={handleSearchSubmit}
                    onMouseDown={(e) => e.preventDefault()}
                    sx={{
                        cursor: "pointer",
                        padding: "0",
                        borderRadius: "4px",
                        width: "20px",
                        height: "20px",
                        minWidth: "20px",
                        minHeight: "20px",
                        color: "rgb(var(--primary-rgb))",
                        "&:hover": {
                            backgroundColor: "rgba(var(--primary-rgb), 0.08)",
                        },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <SearchIcon fontSize="small" />
                </Box>
            </InputAdornment>
        ),
        [handleSearchSubmit, theme]
    );

    // Memoize search field styles
    const toolbarInputHeightPx = theme.appButton.toolbarControl.height;
    const toolbarInputLineHeightPx = toolbarInputHeightPx - 2;

    const searchFieldStyles = useMemo(
        () => ({
            // MUI 7: sx applies to TextField root (= FormControl); do not target nested .MuiFormControl-root
            height: `${toolbarInputHeightPx}px`,
            minHeight: `${toolbarInputHeightPx}px`,
            maxHeight: `${toolbarInputHeightPx}px`,
            margin: 0,
            marginBottom: 0,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            alignSelf: "center",
            flexShrink: 0,
            boxSizing: "border-box",
            "& .MuiOutlinedInput-root, & .MuiInputBase-root": {
                direction: searchDirection,
                backgroundColor: theme.palette.background.paper,
                padding: "0 !important",
                "& fieldset, & .MuiOutlinedInput-notchedOutline": {
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    margin: 0,
                    padding: 0,
                    borderColor: theme.palette.divider,
                    borderWidth: "1px",
                },
                "&:hover fieldset": {
                    borderColor: theme.palette.divider,
                },
                "&.Mui-focused fieldset": {
                    borderColor: theme.palette.primary.main,
                    borderWidth: "1px",
                },
                "&.MuiInputBase-adornedStart": {
                    paddingInlineStart: `${theme.spacing(1)} !important`,
                    paddingInlineEnd: "0 !important",
                    gap: theme.spacing(0.5),
                },
                "&.MuiInputBase-adornedEnd": {
                    paddingInlineEnd: `${theme.spacing(1)} !important`,
                    paddingInlineStart: "0 !important",
                },
            },
            "& .MuiInputBase-root.input-toolbar-height .MuiInputBase-input, & .MuiInputBase-root.input-toolbar-height .MuiOutlinedInput-input, & .MuiInputBase-root.input-toolbar-height input.MuiInputBase-inputSizeSmall":
            {
                direction: searchDirection,
                textAlign: searchDirection === "rtl" ? "right" : "left",
                flex: "1 1 auto",
                minWidth: 0,
                height: `${toolbarInputLineHeightPx}px !important`,
                minHeight: `${toolbarInputLineHeightPx}px !important`,
                maxHeight: `${toolbarInputLineHeightPx}px !important`,
                margin: "0 !important",
                padding: "0 !important",
                paddingInlineEnd: "8px !important",
                lineHeight: `${toolbarInputLineHeightPx}px !important`,
                fontSize: { xs: "0.75rem", sm: "0.8125rem", md: "0.875rem" },
                boxSizing: "border-box",
                alignSelf: "center",
                appearance: "none",
                WebkitAppearance: "none",
                "&::placeholder": {
                    textAlign: searchDirection === "rtl" ? "right" : "left",
                    direction: searchDirection,
                    lineHeight: `${toolbarInputLineHeightPx}px`,
                    opacity: 1,
                },
            },
            "& .MuiInputAdornment-root": {
                margin: "0 !important",
                paddingTop: 0,
                paddingBottom: 0,
                height: "auto !important",
                maxHeight: "none !important",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "center",
                flexShrink: 0,
                minWidth: "auto",
                width: "auto",
                "& > span.notranslate": {
                    display: "none",
                    width: 0,
                    minWidth: 0,
                },
            },
            "& .MuiInputAdornment-positionStart": {
                margin: "0 !important",
                marginInlineEnd: theme.spacing(0.5),
                paddingInlineStart: theme.spacing(1),
                minWidth: "auto",
                width: "auto",
            },
            "& .MuiInputAdornment-positionEnd": {
                margin: "0 !important",
                paddingInlineEnd: theme.spacing(1),
                minWidth: "auto",
                width: "auto",
            },
            "& .MuiSvgIcon-root": {
                fontSize: { xs: "0.9rem", sm: "1rem", md: "1.1rem" },
            },
        }),
        [searchDirection, theme, toolbarInputHeightPx, toolbarInputLineHeightPx]
    );

    const toolbarTooltipProps = useMemo(
        () => getEndlessScrollToolbarTooltipProps(isHebrew),
        [isHebrew]
    );

    const checkSelectedReportNameTruncation = useCallback(() => {
        const input = reportSelectorInputRef.current;
        if (!input) {
            setIsSelectedReportNameTruncated(false);
            return;
        }
        setIsSelectedReportNameTruncated(
            input.scrollWidth > input.clientWidth + 0.5
        );
    }, []);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            checkSelectedReportNameTruncation();
        });
        window.addEventListener("resize", checkSelectedReportNameTruncation);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener(
                "resize",
                checkSelectedReportNameTruncation
            );
        };
    }, [checkSelectedReportNameTruncation, selectedReportId, selectedReport?.name]);

    // Memoize toolbar container styles
    const toolbarStyles = useMemo(
        () => ({
            paddingBlock: theme.spacing(0.625),
            paddingInlineStart: 0,
            paddingInlineEnd: 0,
            border: "none",
            borderRadius: theme.shape.borderRadius,
            marginBottom: theme.spacing(1),
            backgroundColor: theme.palette.background.paper,
            display: "flex",
            flexDirection: "row" as const,
            gap: theme.spacing(0.5),
            alignItems: "center",
            minHeight: "42px",
            direction:
                i18n.language === "he" ? ("rtl" as const) : ("ltr" as const),
            flexWrap: "nowrap" as const,
            overflow: "visible",
            justifyContent: "space-between",
            width: "100%",
            boxSizing: "border-box",
            boxShadow: "none",
        }),
        [theme, i18n.language]
    );

    return (
        <Box sx={toolbarStyles} className="endless-scroll-toolbar">
            {/* Left Section: Report Selector and Custom Buttons */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    alignSelf: "center",
                    gap: theme.spacing(1),
                    minHeight: 0,
                }}
            >
                {/* Report Selector */}
                {reportSelector && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            alignSelf: "center",
                            gap: theme.spacing(0.5),
                            // No minWidth: container shrinks to dropdown width so there's no empty space before custom buttons
                            "& .MuiAutocomplete-root": {
                                display: "flex",
                                alignItems: "center",
                                alignSelf: "center",
                                height: `${theme.appButton.toolbarControl.height}px`,
                                maxHeight: `${theme.appButton.toolbarControl.height}px`,
                            },
                        }}
                    >
                        <Autocomplete
                            className="toolbar-autocomplete"
                            value={selectedReport}
                            onChange={(event, newValue) => {
                                const newReportId = newValue?.id || null;
                                onReportChange?.(newReportId);
                            }}
                            options={allReports}
                            groupBy={(option) => {
                                return option.isSystem
                                    ? t("sections.system_views", {
                                        ns: "reports",
                                        defaultValue: "System Views"
                                    })
                                    : t("sections.custom_views", {
                                        defaultValue: "Custom Views"
                                    });
                            }}
                            getOptionLabel={(option) => option.name}
                            getOptionKey={(option) => option.id}
                            isOptionEqualToValue={(option, value) => {
                                // Handle type coercion for number vs string IDs
                                if (option.id === value.id) return true;
                                const optionId = typeof option.id === 'string' ? parseInt(option.id, 10) : option.id;
                                const valueId = typeof value.id === 'string' ? parseInt(value.id, 10) : value.id;
                                return optionId === valueId;
                            }}
                            loading={reportsLoading}
                            size="small"
                            dir={isHebrew ? "rtl" : "ltr"}
                            {...(isHebrew && {
                                "data-hebrew": true,
                                "data-rtl": true,
                            })}
                            sx={{
                                minWidth: { xs: 180, sm: 220, md: 280 },
                                display: "flex",
                                alignItems: "center",
                                "& .MuiAutocomplete-endAdornment": {
                                    right: isHebrew ? "auto" : "9px",
                                    left: isHebrew ? "9px" : "auto",
                                },
                                "& .MuiFormControl-root": {
                                    padding: 0,
                                    margin: 0,
                                    height: `${theme.appButton.toolbarControl.height}px`,
                                    minHeight: `${theme.appButton.toolbarControl.height}px`,
                                    maxHeight: `${theme.appButton.toolbarControl.height}px`,
                                },
                                "& .MuiOutlinedInput-root": {
                                    backgroundColor:
                                        theme.palette.background.paper,
                                    height: "32px",
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "0 !important",
                                    overflow: "hidden",
                                    borderRadius: `${theme.appButton.toolbarControl.borderRadius}px`,
                                    "& fieldset, & .MuiOutlinedInput-notchedOutline": {
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        margin: 0,
                                        padding: 0,
                                        borderColor: theme.palette.divider,
                                        borderWidth: "1px",
                                        borderRadius: `${theme.appButton.toolbarControl.borderRadius}px`,
                                    },
                                },
                                "& .MuiInputBase-input": {
                                    fontSize: {
                                        xs: "0.75rem",
                                        sm: "0.8rem",
                                        md: "0.875rem",
                                    },
                                    py: 0,
                                    paddingLeft: isHebrew ? undefined : "3px !important",
                                    paddingRight: isHebrew ? "3px !important" : "8px !important",
                                    display: "flex",
                                    alignItems: "center",
                                },
                                "& .MuiOutlinedInput-input": {
                                    paddingLeft: isHebrew ? undefined : "3px !important",
                                    paddingRight: isHebrew ? "3px !important" : undefined,
                                },
                                "& .MuiInputBase-inputAdornedStart": {
                                    paddingLeft: isHebrew ? undefined : "3px !important",
                                    paddingRight: isHebrew ? "3px !important" : undefined,
                                },
                                "& .MuiAutocomplete-inputRoot": {
                                    padding: "0 !important",
                                    paddingRight: isHebrew ? "0 !important" : "32px !important",
                                    paddingLeft: isHebrew ? "32px !important" : "0 !important",
                                    "& .MuiInputBase-input": {
                                        paddingLeft: isHebrew ? undefined : "3px !important",
                                        paddingRight: isHebrew ? "3px !important" : "8px !important",
                                    },
                                    "& .MuiOutlinedInput-input": {
                                        paddingLeft: isHebrew ? undefined : "3px !important",
                                        paddingRight: isHebrew ? "3px !important" : "8px !important",
                                    },
                                },
                                "& .MuiAutocomplete-paper": {
                                    padding: "0 !important",
                                    direction: isHebrew ? "rtl" : "ltr",
                                    "& .MuiAutocomplete-listbox": {
                                        padding: "0 !important",
                                        "& li": {
                                            padding: "0 !important",
                                            margin: "0 !important",
                                            minHeight: "auto !important",
                                            "& .MuiListSubheader-root": {
                                                padding: "0 !important",
                                                margin: "0 !important",
                                                minHeight: "auto !important",
                                                height: "auto !important",
                                                lineHeight: "1.2 !important",
                                            },
                                        },
                                    },
                                },
                            }}
                            renderInput={(params) => {
                                const {
                                    InputProps: paramsInputProps,
                                    inputProps: paramsInputHtmlProps,
                                    ...textFieldParams
                                } = params;
                                const selectedReportName =
                                    selectedReport?.name ?? "";
                                return (
                                <Tooltip
                                    title={
                                        isSelectedReportNameTruncated &&
                                        selectedReportName
                                            ? selectedReportName
                                            : ""
                                    }
                                    disableHoverListener={
                                        !isSelectedReportNameTruncated ||
                                        !selectedReportName
                                    }
                                    {...toolbarTooltipProps}
                                >
                                <TextField
                                    {...textFieldParams}
                                    margin="none"
                                    size="small"
                                    placeholder={t("fields.select_report", {
                                        defaultValue: "Select Report",
                                    })}
                                    dir={isHebrew ? "rtl" : "ltr"}
                                    {...(isHebrew && { "data-hebrew": true })}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            padding: "0 !important",
                                        },
                                        "& .MuiInputBase-input": {
                                            paddingLeft: isHebrew ? undefined : "3px !important",
                                            paddingRight: isHebrew ? "3px !important" : "8px !important",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        },
                                        "& .MuiOutlinedInput-input": {
                                            paddingLeft: isHebrew ? undefined : "3px !important",
                                            paddingRight: isHebrew ? "3px !important" : undefined,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        },
                                        "& .MuiInputBase-inputAdornedStart": {
                                            paddingLeft: isHebrew ? undefined : "3px !important",
                                            paddingRight: isHebrew ? "3px !important" : undefined,
                                        },
                                    }}
                                    slotProps={{
                                        htmlInput: {
                                            ...paramsInputHtmlProps,
                                            ref: (el: HTMLInputElement | null) => {
                                                reportSelectorInputRef.current = el;
                                                const paramRef =
                                                    paramsInputHtmlProps?.ref;
                                                if (typeof paramRef === "function") {
                                                    paramRef(el);
                                                } else if (paramRef) {
                                                    (
                                                        paramRef as React.MutableRefObject<HTMLInputElement | null>
                                                    ).current = el;
                                                }
                                                if (el) {
                                                    requestAnimationFrame(() => {
                                                        checkSelectedReportNameTruncation();
                                                    });
                                                }
                                            },
                                        },
                                        input: {
                                            ...paramsInputProps,
                                            className: [
                                                "input-toolbar-height",
                                                paramsInputProps?.className,
                                            ]
                                                .filter(Boolean)
                                                .join(" "),
                                            startAdornment: (
                                                <>
                                                    {selectedReport?.isDefault ? (
                                                        <InputAdornment
                                                            position="start"
                                                            sx={{
                                                                marginRight: isHebrew ? theme.spacing(0.25) : 0,
                                                                marginLeft: isHebrew ? 0 : theme.spacing(0.25),
                                                            }}
                                                        >
                                                            <StarIcon
                                                                fontSize="small"
                                                                sx={{
                                                                    color: theme.palette.primary.main,
                                                                    fontSize: "1rem",
                                                                    marginLeft: "5px",
                                                                    marginRight: "5px",
                                                                }}
                                                            />
                                                        </InputAdornment>
                                                    ) : selectedReport ? (
                                                        <InputAdornment
                                                            position="start"
                                                            sx={{
                                                                marginRight: isHebrew ? theme.spacing(0.25) : 0,
                                                                marginLeft: isHebrew ? 0 : theme.spacing(0.25),
                                                                width: "0.5rem",
                                                                minWidth: "0.5rem",
                                                            }}
                                                        />
                                                    ) : null}
                                                    {paramsInputProps?.startAdornment}
                                                </>
                                            ),
                                        },
                                    }}
                                />
                                </Tooltip>
                                );
                            }}
                            renderGroup={(params) => (
                                <React.Fragment key={params.key}>
                                    <ListSubheader
                                        component="li"
                                        sx={{
                                            backgroundColor: alpha(
                                                theme.palette.primary.main,
                                                0.08
                                            ),
                                            fontWeight: 700,
                                            fontSize: "0.7rem",
                                            textTransform: "uppercase",
                                            color: theme.palette.primary.main,
                                            letterSpacing: "0.5px",
                                            pt: 1,
                                            pb: 1,
                                            px: 0,
                                            m: 0,
                                            minHeight: "auto !important",
                                            height: "auto !important",
                                            lineHeight: "1.2 !important",
                                            direction: isHebrew ? "rtl" : "ltr",
                                            textAlign: isHebrew ? "right" : "left",
                                            borderLeft: isHebrew ? "none" : `3px solid ${theme.palette.primary.main}`,
                                            borderRight: isHebrew ? `3px solid ${theme.palette.primary.main}` : "none",
                                            "&.MuiListSubheader-root": {
                                                padding: isHebrew
                                                    ? "4px 4px 4px 0 !important"
                                                    : "4px 0 4px 4px !important",
                                                margin: "0 !important",
                                                minHeight: "auto !important",
                                                height: "auto !important",
                                            },
                                        }}
                                    >
                                        {params.group}
                                    </ListSubheader>
                                    {params.children}
                                </React.Fragment>
                            )}
                            renderOption={(props, option) => {
                                const { key, ...restProps } = props;
                                return (
                                    <li
                                        key={key}
                                        {...restProps}
                                        style={{
                                            ...restProps.style,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            width: "100%",
                                            direction: isHebrew ? "rtl" : "ltr",
                                            paddingLeft: isHebrew ? 0 : theme.spacing(2),
                                            paddingRight: isHebrew ? theme.spacing(2) : 0,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                flex: 1,
                                                direction: isHebrew ? "rtl" : "ltr",
                                            }}
                                        >
                                            {option.isDefault && (
                                                <StarIcon
                                                    fontSize="small"
                                                    sx={{
                                                        color: theme.palette.primary.main,
                                                        fontSize: "1rem",
                                                    }}
                                                />
                                            )}
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    direction: isHebrew ? "rtl" : "ltr",
                                                    textAlign: isHebrew ? "right" : "left",
                                                    width: "100%",
                                                }}
                                            >
                                                {option.name}
                                            </Typography>
                                            {option.isSharedByMe && (
                                                <Tooltip
                                                    title={t("tooltips.you_are_sharing_this_report", {
                                                        defaultValue: "You are sharing this report",
                                                    })}
                                                    arrow
                                                    placement="bottom"
                                                >
                                                    <ShareIcon
                                                        fontSize="small"
                                                        sx={{
                                                            color: theme.palette.primary.main,
                                                            fontSize: "1rem",
                                                            marginRight: isHebrew ? 0 : theme.spacing(1),
                                                            marginLeft: isHebrew ? theme.spacing(1) : 0,
                                                        }}
                                                    />
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </li>
                                );
                            }}
                        />
                    </Box>
                )}
                {customButtons}
            </Box>

            {/* Settings Menu */}
            <Menu
                anchorEl={settingsMenuAnchor}
                open={Boolean(settingsMenuAnchor)}
                onClose={() => setSettingsMenuAnchor(null)}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: i18n.language === "he" ? "right" : "left",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: i18n.language === "he" ? "right" : "left",
                }}
                PaperProps={{
                    sx: {
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        minWidth: 180,
                    },
                }}
            >
                {hasCreateReportPermission && onCreateReport && (
                    <MenuItem
                        onClick={() => {
                            onCreateReport();
                            setSettingsMenuAnchor(null);
                        }}
                        sx={{
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <ListItemIcon sx={{ color: "primary.main" }}>
                            <AddIcon
                                fontSize="small"
                                sx={{
                                    mr: i18n.language === "he" ? 0 : 2,
                                    ml: i18n.language === "he" ? 2 : 0,
                                }}
                            />
                        </ListItemIcon>
                        <ListItemText>
                            {t("actions.create_view", {
                                defaultValue: "Create View",
                            })}
                        </ListItemText>
                    </MenuItem>
                )}
                {selectedReport &&
                    !selectedReport.isSystem &&
                    hasEditReportPermission &&
                    onEditReport &&
                    typeof selectedReport.id === "number" && (
                        <MenuItem
                            onClick={() => {
                                onEditReport(selectedReport.id as number);
                                setSettingsMenuAnchor(null);
                            }}
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <ListItemIcon sx={{ color: "primary.main" }}>
                                <EditIcon
                                    fontSize="small"
                                    sx={{
                                        mr: i18n.language === "he" ? 0 : 2,
                                        ml: i18n.language === "he" ? 2 : 0,
                                    }}
                                />
                            </ListItemIcon>
                            <ListItemText>
                                {t("actions.edit_report", {
                                    defaultValue: "Edit Report",
                                })}
                            </ListItemText>
                        </MenuItem>
                    )}
                {selectedReport &&
                    hasCloneReportPermission &&
                    onCloneReport &&
                    typeof selectedReport.id === "number" && (
                        <MenuItem
                            onClick={() => {
                                onCloneReport(selectedReport.id as number);
                                setSettingsMenuAnchor(null);
                            }}
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                "&:hover": {
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.08
                                    ),
                                },
                            }}
                        >
                            <ListItemIcon sx={{ color: "primary.main" }}>
                                <ContentCopyIcon
                                    fontSize="small"
                                    sx={{
                                        mr: i18n.language === "he" ? 0 : 2,
                                        ml: i18n.language === "he" ? 2 : 0,
                                    }}
                                />
                            </ListItemIcon>
                            <ListItemText>
                                {t("actions.clone_view", {
                                    defaultValue: "Clone View",
                                })}
                            </ListItemText>
                        </MenuItem>
                    )}
                {selectedReport &&
                    !selectedReport.isSystem &&
                    hasShareReportPermission &&
                    onShareReport &&
                    typeof selectedReport.id === "number" && (
                        <MenuItem
                            onClick={() => {
                                onShareReport(selectedReport.id as number);
                                setSettingsMenuAnchor(null);
                            }}
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <ListItemIcon sx={{ color: "primary.main" }}>
                                <ShareIcon
                                    fontSize="small"
                                    sx={{
                                        mr: i18n.language === "he" ? 0 : 2,
                                        ml: i18n.language === "he" ? 2 : 0,
                                    }}
                                />
                            </ListItemIcon>
                            <ListItemText>
                                {t("actions.share", {
                                    defaultValue: "Share",
                                })}
                            </ListItemText>
                        </MenuItem>
                    )}
                {selectedReport &&
                    typeof selectedReport.id === "number" &&
                    // Show "Set as Default" only if report is not already a default
                    // Setting a new default will automatically clear the previous one
                    onSetAsDefault && !selectedReport.isDefault && (
                        <MenuItem
                            onClick={() => {
                                onSetAsDefault(selectedReport.id as number);
                                setSettingsMenuAnchor(null);
                            }}
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <ListItemIcon sx={{ color: "primary.main" }}>
                                <StarBorderIcon
                                    fontSize="small"
                                    sx={{
                                        mr: i18n.language === "he" ? 0 : 2,
                                        ml: i18n.language === "he" ? 2 : 0,
                                    }}
                                />
                            </ListItemIcon>
                            <ListItemText>
                                {t("actions.set_as_default", {
                                    defaultValue: "Set as Default",
                                })}
                            </ListItemText>
                        </MenuItem>
                    )}
                {selectedReport &&
                    !selectedReport.isSystem &&
                    hasDeleteReportPermission &&
                    onDeleteReport &&
                    typeof selectedReport.id === "number" && (
                        <MenuItem
                            onClick={() => {
                                onDeleteReport(selectedReport.id as number);
                                setSettingsMenuAnchor(null);
                            }}
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                "&:hover": {
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.08
                                    ),
                                },
                            }}
                        >
                            <ListItemIcon sx={{ color: "primary.main" }}>
                                <DeleteIcon
                                    fontSize="small"
                                    sx={{
                                        mr: i18n.language === "he" ? 0 : 2,
                                        ml: i18n.language === "he" ? 2 : 0,
                                    }}
                                />
                            </ListItemIcon>
                            <ListItemText>
                                {t("actions.delete_report", {
                                    defaultValue: "Delete Report",
                                })}
                            </ListItemText>
                        </MenuItem>
                    )}
            </Menu>

            {/* Right Section: Bulk Action, Export Button, Search Field and Record Count */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    alignSelf: "center",
                    gap: theme.spacing(1),
                    minHeight: 0,
                    "& .toolbar-search-field": {
                        marginBottom: "0 !important",
                    },
                }}
            >
                {/* Bulk Action Button */}
                {bulkActionButton && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
                        {bulkActionButton}
                    </Box>
                )}

                {/* Export Button - Only show if user has export_data permission */}
                {onExportClick && columns.length > 0 && hasExportPermission && (
                    <Tooltip
                        title={t("actions.export", { ns: "common" })}
                        {...toolbarTooltipProps}
                    >
                        <span>
                            <Button
                                color="primary"
                                size="small"
                                variant="outlined"
                                className="toolbar-button"
                                onClick={onExportClick}
                                disabled={exportDisabled || totalRecords === 0}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <FileDownloadIcon fontSize="small" />
                            </Button>
                        </span>
                    </Tooltip>
                )}

                {/* Refresh button */}
                {onRefresh && (
                    <Tooltip
                        title={t("actions.refresh", { ns: "common" })}
                        {...toolbarTooltipProps}
                    >
                        <span>
                            <IconButton
                                color="primary"
                                size="small"
                                className="toolbar-button"
                                onClick={onRefresh}
                            >
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}

                {/* Settings / Config button (after download) */}
                {reportSelector && (
                    <Tooltip
                        title={t("sections.view_settings", { ns: "reports" })}
                        {...toolbarTooltipProps}
                    >
                        <span>
                            <IconButton
                                color="primary"
                                size="small"
                                className="toolbar-button"
                                onClick={(e) =>
                                    setSettingsMenuAnchor(e.currentTarget)
                                }
                                disabled={!hasSettingsMenuItems}
                            >
                                <SettingsIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                )}

                {/* Search Field */}
                {onSearchChange && (
                    <Box
                        sx={{
                            width: { xs: 100, sm: 140, md: 200 },
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            alignSelf: "center",
                            height: `${toolbarInputHeightPx}px`,
                            minHeight: `${toolbarInputHeightPx}px`,
                            maxHeight: `${toolbarInputHeightPx}px`,
                            overflow: "visible",
                        }}
                    >
                        <TextField
                            className="toolbar-search-field"
                            margin="none"
                            size="small"
                            value={localSearchValue}
                            onChange={handleSearchChange}
                            onKeyDown={handleKeyDown}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder={
                                searchPlaceholder ||
                                t("common.search_placeholder")
                            }
                            disabled={searchDisabled}
                            fullWidth
                            dir={searchDirection}
                            {...(searchDirection === "rtl" && {
                                "data-rtl": true,
                                "data-hebrew": true,
                            })}
                            sx={searchFieldStyles}
                            inputProps={{
                                dir: searchDirection,
                                style: {
                                    textAlign:
                                        searchDirection === "rtl"
                                            ? "right"
                                            : "left",
                                    direction: searchDirection,
                                },
                            }}
                            slotProps={{
                                input: {
                                    className: "input-toolbar-height",
                                    startAdornment: searchIconAdornment,
                                    endAdornment: localSearchValue ? (
                                        <InputAdornment
                                            position="end"
                                            sx={{
                                                paddingInlineEnd: theme.spacing(1),
                                                minWidth: "auto",
                                                width: "auto",
                                            }}
                                        >
                                            <IconButton
                                                color="primary"
                                                onClick={handleClearSearch}
                                                edge="end"
                                                size="small"
                                                sx={{
                                                    padding: theme.spacing(0.5),
                                                    margin: 0,
                                                    "&:hover": {
                                                        backgroundColor: alpha(
                                                            theme.palette.primary.main,
                                                            0.08
                                                        ),
                                                    },
                                                }}
                                            >
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ) : undefined,
                                },
                            }}
                        />
                    </Box>
                )}

                {/* Record Count - Always visible */}
                <RecordCount totalRecords={totalRecords} theme={theme} t={t} />
            </Box>
        </Box>
    );
};

// Memoized record count component to prevent unnecessary re-renders
const RecordCount = React.memo<{
    totalRecords: number;
    theme: Theme;
    t: TFunction;
}>(({ totalRecords, theme, t }) => {
    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                width: "auto", // Allow width to grow
                minWidth: "fit-content", // Ensure it can expand
            }}
        >
            <Box
                sx={{
                    px: theme.spacing(2.5), // 20px left and right padding
                    py: 0, // Remove vertical padding to match Export Button
                    borderRadius: `${theme.appButton.toolbarControl.borderRadius}px`,
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: theme.spacing(0.5),
                    height: `${theme.appButton.toolbarControl.height}px`,
                    minHeight: `${theme.appButton.toolbarControl.height}px`,
                    maxHeight: `${theme.appButton.toolbarControl.height}px`,
                    boxSizing: "border-box",
                    width: "auto",
                    minWidth: "fit-content",
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        color: "text.secondary",
                        fontSize: {
                            xs: "0.75rem",
                            sm: "0.8125rem",
                            md: "0.875rem",
                        },
                        fontWeight: 500,
                    }}
                >
                    {t("fields.total_records", { ns: "common" })}:
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: "primary.main",
                        fontSize: {
                            xs: "0.75rem",
                            sm: "0.8125rem",
                            md: "0.875rem",
                        },
                        fontWeight: 600,
                    }}
                >
                    {totalRecords}
                </Typography>
            </Box>
        </Box>
    );
});

RecordCount.displayName = "RecordCount";

// Memoize the entire component to prevent unnecessary re-renders
const EndlessScrollToolbar = React.memo(EndlessScrollToolbarComponent);

EndlessScrollToolbar.displayName = "EndlessScrollToolbar";

export default EndlessScrollToolbar;
