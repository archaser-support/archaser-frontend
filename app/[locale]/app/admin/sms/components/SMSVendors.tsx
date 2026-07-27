"use client";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import {
    Add as AddIcon,
    Business as BusinessIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
} from "@mui/icons-material";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Switch,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import { CurrencySelect } from "@/components/LocationSelects";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { getEndlessScrollToolbarTooltipProps } from "@/shared/layout-components/grid/endlessScrollToolbarTooltip";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { ExportFormat } from "@/shared/utility/exportToExcel";

interface SMSVendor {
    id: number;
    name: string;
    provider: string;
    api_key?: string;
    api_secret?: string;
    account_sid?: string;
    auth_token?: string;
    webhook_url?: string;
    is_active: boolean;
    priority: number;
    cost_per_sms?: number;
    currency: string;
    use_account_sender_name?: boolean;
    created_at: string;
    modified_at: string;
}

const SMSVendors = () => {
    const { t, i18n } = useTranslation(["sms", "common"]);
    const queryClient = useQueryClient();
    const windowWidth = useWindowWidth();
    const { success, error: showError } = useToast();
    const theme = useTheme();

    const [openDialog, setOpenDialog] = useState(false);
    const [editingVendor, setEditingVendor] = useState<SMSVendor | null>(null);
    // Removed unused openTestDialog
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        id: number | null;
    }>({
        isOpen: false,
        id: null,
    });
    const [isDeleting, setIsDeleting] = useState(false);

    const isRTL = i18n.language === "he";
    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "provider", sort: "asc" },
    ]);
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Handle page-wide scrolling to scroll the table
    useEffect(() => {
        const findScrollableContainer = (): HTMLElement | null => {
            if (!tableContainerRef.current) return null;

            // The scrollable container is a direct child div with overflow-y: auto
            // Look for divs that have overflow styles
            const allDivs =
                tableContainerRef.current.querySelectorAll<HTMLElement>("div");

            for (const div of Array.from(allDivs)) {
                const style = window.getComputedStyle(div);
                // Check if it's scrollable vertically
                if (
                    (style.overflowY === "auto" ||
                        style.overflowY === "scroll") &&
                    div.scrollHeight > div.clientHeight
                ) {
                    return div;
                }
            }
            return null;
        };

        const handleWheel = (e: WheelEvent) => {
            // Only handle vertical scrolling
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return; // Horizontal scroll, let it pass through
            }

            const container = findScrollableContainer();
            if (!container) return;

            // Check if the table container is visible and in viewport
            const containerRect = container.getBoundingClientRect();
            const isVisible =
                containerRect.top < window.innerHeight &&
                containerRect.bottom > 0 &&
                containerRect.width > 0 &&
                containerRect.height > 0;

            if (!isVisible) return;

            const { scrollTop, scrollHeight, clientHeight } = container;
            const canScrollUp = scrollTop > 0;
            const canScrollDown = scrollTop < scrollHeight - clientHeight;

            // Only intercept scroll if table can scroll in that direction
            const scrollingDown = e.deltaY > 0;
            const scrollingUp = e.deltaY < 0;

            if (
                (scrollingDown && canScrollDown) ||
                (scrollingUp && canScrollUp)
            ) {
                e.preventDefault();
                e.stopPropagation();
                container.scrollTop += e.deltaY;
            }
        };

        // Add wheel event listener with passive: false to allow preventDefault
        window.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            window.removeEventListener("wheel", handleWheel);
        };
    }, []);

    // Removed unused testData
    const [formData, setFormData] = useState({
        provider: "",
        api_key: "",
        api_secret: "",
        account_sid: "",
        auth_token: "",
        webhook_url: "",
        is_active: true,
        priority: 1,
        cost_per_sms: "",
        currency: "USD",
        use_account_sender_name: false,
    });

    // Fetch SMS vendors
    const {
        data: vendors,
        isLoading,
        error,
    } = useQuery({
        queryKey: ["sms-vendors"],
        queryFn: async () => {
            const response = await api.get("/api/sms/vendors");
            return response.data;
        },
    });

    // Create vendor mutation
    const createVendorMutation = useMutation({
        mutationFn: async (vendorData: any) => {
            const response = await api.post("/api/sms/vendors", vendorData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sms-vendors"] });
            success(t("messages.vendors_create_success"));
            handleCloseDialog();
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error || t("common.messages.error")
            );
        },
    });

    // Update vendor mutation
    const updateVendorMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const response = await api.put(`/api/sms/vendors/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sms-vendors"] });
            success(t("messages.vendors_update_success"));
            handleCloseDialog();
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error || t("common.messages.error")
            );
        },
    });

    // Delete vendor mutation
    const deleteVendorMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/api/sms/vendors/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["sms-vendors"] });
            success(t("messages.vendors_delete_success"));
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error || t("common.messages.error")
            );
        },
    });

    const handleOpenDialog = (vendor?: SMSVendor) => {
        if (vendor) {
            setEditingVendor(vendor);
            setFormData({
                provider: vendor.provider,
                api_key: vendor.api_key || "",
                api_secret: vendor.api_secret || "",
                account_sid: vendor.account_sid || "",
                auth_token: vendor.auth_token || "",
                webhook_url: vendor.webhook_url || "",
                is_active: vendor.is_active,
                priority: vendor.priority,
                cost_per_sms: vendor.cost_per_sms?.toString() || "",
                currency: vendor.currency,
                use_account_sender_name:
                    vendor.use_account_sender_name || false,
            });
        } else {
            setEditingVendor(null);
            setFormData({
                provider: "",
                api_key: "",
                api_secret: "",
                account_sid: "",
                auth_token: "",
                webhook_url: "",
                is_active: true,
                priority: 1,
                cost_per_sms: "",
                currency: "USD",
                use_account_sender_name: false,
            });
        }
        setOpenDialog(true);
    };

    // Export handler for SMS vendors
    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            try {
                // Use the existing vendors data instead of making a new API call
                const rawVendors = vendors || [];

                const transformedVendors = rawVendors.map(
                    (vendor: SMSVendor) => {
                        return {
                            id: vendor.id,
                            provider: vendor.provider,
                            priority: vendor.priority,
                            cost_per_sms: vendor.cost_per_sms,
                            currency: vendor.currency,
                            status: vendor.is_active,
                            raw: vendor,
                        };
                    }
                );

                return transformedVendors;
            } catch (error) {
                console.error("Export failed:", error);
                throw error;
            }
        },
        [vendors]
    );

    const handleCloseDialog = () => {
        setOpenDialog(false);
    };

    // Reset drag position when Add/Edit Vendor dialog closes
    const handleSubmit = () => {
        // Validate provider-specific required fields
        if (!formData.provider) {
            showError(t("messages.vendors_provider_required"));
            return;
        }

        if (formData.provider === "inforu") {
            if (!formData.api_key || !formData.api_secret) {
                showError(t("messages.vendors_inforu_credentials_required"));
                return;
            }
        }

        if (formData.provider === "twilio") {
            if (!formData.account_sid || !formData.auth_token) {
                showError(t("messages.vendors_twilio_credentials_required"));
                return;
            }
        }

        const submitData = {
            ...formData,
            cost_per_sms: formData.cost_per_sms
                ? parseFloat(formData.cost_per_sms)
                : null,
        };

        if (editingVendor) {
            updateVendorMutation.mutate({
                id: editingVendor.id,
                data: submitData,
            });
        } else {
            createVendorMutation.mutate(submitData);
        }
    };

    const handleDelete = (id: number) => {
        setDeleteConfirmation({ isOpen: true, id });
    };

    const confirmDelete = useCallback(async () => {
        if (!deleteConfirmation.id) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteVendorMutation.mutateAsync(deleteConfirmation.id);
            setDeleteConfirmation({ isOpen: false, id: null });
        } catch (_error) {
            // Error handling is done in the mutation
        } finally {
            setIsDeleting(false);
        }
    }, [deleteConfirmation.id, deleteVendorMutation]);

    const noop = useCallback(() => { }, []);

    const columnVisibilityModel = {
        provider: windowWidth >= BREAKPOINTS.MOBILE,
        priority: windowWidth >= BREAKPOINTS.TABLET,
        cost_per_sms: windowWidth >= BREAKPOINTS.DESKTOP,
        currency: windowWidth >= BREAKPOINTS.DESKTOP,
        status: windowWidth >= BREAKPOINTS.MOBILE,
        actions: true,
    };

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "provider",
                headerName: t("fields.vendors_provider"),
                flex: 1,
                minWidth: 150,
                sortable: true,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <BusinessIcon
                            sx={{ fontSize: 20, color: "primary.main" }}
                        />
                        <Typography variant="body2" fontWeight={500}>
                            {params.value}
                        </Typography>
                    </Box>
                ),
            },
            {
                field: "priority",
                headerName: t("fields.vendors_priority"),
                flex: 1,
                minWidth: 100,
                sortable: true,
                renderCell: (params) => (
                    <Typography variant="body2" fontWeight={500}>
                        {params.value}
                    </Typography>
                ),
            },
            {
                field: "cost_per_sms",
                headerName: t("fields.vendors_cost_per_sms"),
                flex: 1,
                minWidth: 120,
                sortable: true,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.value ? `$${params.value}` : "-"}
                    </Typography>
                ),
            },
            {
                field: "currency",
                headerName: t("fields.vendors_currency"),
                flex: 1,
                minWidth: 100,
                sortable: true,
            },
            {
                field: "status",
                headerName: t("fields.vendors_status"),
                flex: 1,
                minWidth: 100,
                sortable: true,
                renderCell: (params) => {
                    const isActive = params.value === true;
                    return (
                        <Chip
                            label={
                                isActive
                                    ? t("values.status_active", {
                                        ns: "common",
                                    })
                                    : t("values.status_inactive", {
                                        ns: "common",
                                    })
                            }
                            size="small"
                            data-status={isActive ? "active" : "inactive"}
                        />
                    );
                },
            },
            {
                field: "actions",
                headerName: t("actions.vendors_actions"),
                flex: 0.5,
                minWidth: 120,
                sortable: false,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip
                            title={t("actions.edit", { ns: "common" })}
                            arrow
                        >
                            <IconButton
                                color="primary"
                                size="small"
                                type="button"
                                className="toolbar-button"
                                onClick={() => handleOpenDialog(params.row.raw)}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip
                            title={t("actions.delete", { ns: "common" })}
                            arrow
                        >
                            <IconButton
                                color="primary"
                                size="small"
                                type="button"
                                className="toolbar-button"
                                onClick={() => handleDelete(params.value)}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ),
            },
        ],
        [t]
    );

    const rows = useMemo(() => {
        let mappedRows =
            vendors?.map((vendor: SMSVendor) => ({
                id: vendor.id,
                provider: vendor.provider,
                priority: vendor.priority,
                cost_per_sms: vendor.cost_per_sms,
                currency: vendor.currency,
                status: vendor.is_active,
                actions: vendor.id,
                raw: vendor,
            })) || [];

        // Client-side search filtering
        if (debouncedSearch) {
            const searchLower = debouncedSearch.toLowerCase();
            mappedRows = mappedRows.filter((row: (typeof mappedRows)[0]) => {
                return (
                    row.provider?.toLowerCase().includes(searchLower) ||
                    row.currency?.toLowerCase().includes(searchLower) ||
                    String(row.priority).includes(searchLower) ||
                    (row.cost_per_sms != null &&
                        String(row.cost_per_sms).includes(searchLower)) ||
                    (row.status
                        ? t("values.status_active", { ns: "common" })
                        : t("values.status_inactive", { ns: "common" })
                    )
                        .toLowerCase()
                        .includes(searchLower)
                );
            });
        }

        // Client-side sorting
        if (sortModel && sortModel.length > 0) {
            const sortField = sortModel[0].field;
            const sortDirection = sortModel[0].sort;

            return [...mappedRows].sort((a, b) => {
                let aValue = a[sortField as keyof typeof a];
                let bValue = b[sortField as keyof typeof b];

                // Handle null/undefined values
                if (aValue == null) aValue = "";
                if (bValue == null) bValue = "";

                // Handle boolean values (for status field)
                if (
                    typeof aValue === "boolean" &&
                    typeof bValue === "boolean"
                ) {
                    if (aValue === bValue) return 0;
                    return sortDirection === "asc"
                        ? aValue
                            ? 1
                            : -1
                        : aValue
                            ? -1
                            : 1;
                }

                // Handle numeric values
                if (typeof aValue === "number" && typeof bValue === "number") {
                    return sortDirection === "asc"
                        ? aValue - bValue
                        : bValue - aValue;
                }

                // Handle string values
                const aStr = String(aValue).toLowerCase();
                const bStr = String(bValue).toLowerCase();

                if (sortDirection === "asc") {
                    return aStr.localeCompare(bStr);
                } else {
                    return bStr.localeCompare(aStr);
                }
            });
        }

        return mappedRows;
    }, [vendors, sortModel, debouncedSearch, t]);

    return (
        <Box>
            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {t("messages.vendors_load_error")}
                </Alert>
            )}

            {/* Vendors DataGrid */}
            <Box
                ref={tableContainerRef}
                sx={{
                    position: "relative",
                    isolation: "isolate",
                }}
            >
                <EndlessScrollDataGrid
                    rows={rows}
                    columns={columns}
                    totalRecords={rows.length}
                    isLoading={isLoading}
                    onLoadMore={noop}
                    hasMore={false}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    searchValue={search}
                    onSearchChange={(value) => {
                        setSearch(value);
                    }}
                    searchPlaceholder={t("fields.search_placeholder", {
                        ns: "common",
                    })}
                    searchDebounceMs={500}
                    searchDisabled={false}
                    searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                    customButtons={
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Tooltip
                                title={t("actions.vendors_add_vendor")}
                                {...getEndlessScrollToolbarTooltipProps(
                                    i18n.language === "he"
                                )}
                            >
                                <IconButton
                                    color="primary"
                                    size="small"
                                    type="button"
                                    className="toolbar-button"
                                    onClick={() => handleOpenDialog()}
                                >
                                    <Box
                                        sx={{
                                            position: "relative",
                                            display: "inline-flex",
                                        }}
                                    >
                                        <BusinessIcon />
                                        <AddIcon
                                            sx={{
                                                position: "absolute",
                                                right: -4,
                                                bottom: -4,
                                                fontSize: "0.8rem",
                                                backgroundColor: "primary.main",
                                                color: "primary.contrastText",
                                                borderRadius: "50%",
                                                padding: "2px",
                                            }}
                                        />
                                    </Box>
                                </IconButton>
                            </Tooltip>
                        </Box>
                    }
                    columnVisibilityModel={columnVisibilityModel}
                    fillViewport={true}
                    resizableColumns={true}
                    noRowsMessage={t("fields.vendors_no_vendors")}
                    noRowsDescription={t(
                        "actions.vendors_no_vendors_description"
                    )}
                    onExport={handleExport}
                    exportDisabled={isLoading || rows.length === 0}
                    language={i18n.language}
                />
            </Box>

            {/* Add/Edit Vendor Dialog */}
            <AppDialog
                open={openDialog}
                onClose={handleCloseDialog}
                drag
                align
                slide
                isRTL={isRTL}
                paperWidth="380px"
                paperMaxHeight="90vh"
                title={
                    editingVendor
                        ? t("actions.vendors_edit_vendor")
                        : t("actions.vendors_add_vendor")
                }
                titleIcon={<BusinessIcon aria-hidden="true" />}
                ariaLabelledBy="sms-vendor-dialog-title"
                ariaDescribedBy="sms-vendor-dialog-description"
                actions={
                    <>
                        <Button
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            onClick={handleCloseDialog}
                            fullWidth={false}
                            disabled={
                                createVendorMutation.isPending ||
                                updateVendorMutation.isPending
                            }
                            sx={{
                                mr: isRTL ? 0 : theme.spacing(1),
                                ml: isRTL ? theme.spacing(1) : 0,
                            }}
                        >
                            {t("actions.cancel", { ns: "common" })}
                        </Button>
                        <Button
                            variant="contained"
                            size="small"
                            className="save-button"
                            onClick={
                                createVendorMutation.isPending ||
                                    updateVendorMutation.isPending
                                    ? undefined
                                    : handleSubmit
                            }
                            fullWidth={false}
                            disabled={
                                createVendorMutation.isPending ||
                                updateVendorMutation.isPending
                            }
                            endIcon={
                                createVendorMutation.isPending ||
                                    updateVendorMutation.isPending ? (
                                    <CircularProgress
                                        size={16}
                                        sx={{ color: "inherit" }}
                                    />
                                ) : undefined
                            }
                            sx={{
                                direction: isRTL ? "rtl" : "ltr",
                                "& .MuiButton-endIcon": {
                                    marginLeft: isRTL ? 0 : theme.spacing(1),
                                    marginRight: isRTL ? theme.spacing(1) : 0,
                                },
                            }}
                        >
                            {t("actions.save", { ns: "common" })}
                        </Button>
                    </>
                }
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        pt: 1,
                    }}
                >
                    {/* Row 1: Provider Dropdown */}
                    <FormControl fullWidth size="small" required>
                        <InputLabel>
                            {t("fields.vendors_provider")}
                        </InputLabel>
                        <Select
                            value={formData.provider}
                            onChange={(e) => {
                                const newProvider = e.target.value;
                                // Reset provider-specific fields when changing provider
                                setFormData({
                                    ...formData,
                                    provider: newProvider,
                                    api_key: "",
                                    api_secret: "",
                                    account_sid: "",
                                    auth_token: "",
                                });
                            }}
                            label={t("fields.vendors_provider")}
                        >
                            <MenuItem value="inforu">Inforu</MenuItem>
                            <MenuItem value="twilio">Twilio</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Inforu Fields: API Key and API Secret */}
                    {formData.provider === "inforu" && (
                        <Box sx={{ display: "flex", gap: 2 }}>
                            <TextField
                                label={t("fields.vendors_api_key")}
                                value={formData.api_key}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        api_key: e.target.value,
                                    })
                                }
                                fullWidth
                                size="small"
                                variant="outlined"
                                type="password"
                                required
                            />
                            <TextField
                                label={t("fields.vendors_api_secret")}
                                value={formData.api_secret}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        api_secret: e.target.value,
                                    })
                                }
                                fullWidth
                                size="small"
                                variant="outlined"
                                type="password"
                                required
                            />
                        </Box>
                    )}

                    {/* Twilio Fields: Account SID and Auth Token */}
                    {formData.provider === "twilio" && (
                        <>
                            <Box sx={{ display: "flex", gap: 2 }}>
                                <TextField
                                    label={t("fields.vendors_account_sid")}
                                    value={formData.account_sid}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            account_sid: e.target.value,
                                        })
                                    }
                                    fullWidth
                                    size="small"
                                    variant="outlined"
                                    required
                                />
                                <TextField
                                    label={t("fields.vendors_auth_token")}
                                    value={formData.auth_token}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            auth_token: e.target.value,
                                        })
                                    }
                                    fullWidth
                                    size="small"
                                    variant="outlined"
                                    type="password"
                                    required
                                />
                            </Box>
                            <TextField
                                label={t("fields.vendors_webhook_url")}
                                value={formData.webhook_url}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        webhook_url: e.target.value,
                                    })
                                }
                                fullWidth
                                size="small"
                                variant="outlined"
                            />
                        </>
                    )}

                    {/* Row 4: Priority and Cost per SMS */}
                    <Box sx={{ display: "flex", gap: 2 }}>
                        <TextField
                            label={t("fields.vendors_priority")}
                            value={formData.priority}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    priority: parseInt(e.target.value),
                                })
                            }
                            type="number"
                            size="small"
                            variant="outlined"
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label={t("fields.vendors_cost_per_sms")}
                            value={formData.cost_per_sms}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    cost_per_sms: e.target.value,
                                })
                            }
                            type="number"
                            size="small"
                            variant="outlined"
                            inputProps={{ step: "0.01" }}
                            sx={{ flex: 1 }}
                        />
                    </Box>
                    {/* Row 5: Currency */}
                    <Box sx={{ flex: 1 }}>
                        <CurrencySelect
                            value={formData.currency}
                            onChange={(value) =>
                                setFormData({
                                    ...formData,
                                    currency: value,
                                })
                            }
                        />
                    </Box>

                    {/* Row 6: Status and Use Account Sender Name Switches */}
                    <Box sx={{ display: "flex", gap: 2 }}>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                flex: 1,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ mb: 1, fontWeight: 500 }}
                            >
                                {t("fields.status", { ns: "common" })}
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    minHeight: "40px",
                                }}
                            >
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.is_active}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    is_active:
                                                        e.target.checked,
                                                })
                                            }
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Typography
                                            variant="body2"
                                            sx={{ color: "text.secondary" }}
                                        >
                                            {formData.is_active
                                                ? t(
                                                    "values.status_active",
                                                    { ns: "common" }
                                                )
                                                : t(
                                                    "values.status_inactive",
                                                    { ns: "common" }
                                                )}
                                        </Typography>
                                    }
                                    sx={{
                                        m: 0, // Remove default margin
                                        "& .MuiFormControlLabel-label": {
                                            fontSize: "0.875rem",
                                            fontWeight: 500,
                                        },
                                    }}
                                />
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                flex: 1,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{ mb: 1, fontWeight: 500 }}
                            >
                                {t(
                                    "actions.vendors_use_account_sender_name"
                                )}
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    minHeight: "40px",
                                }}
                            >
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={
                                                formData.use_account_sender_name
                                            }
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    use_account_sender_name:
                                                        e.target.checked,
                                                })
                                            }
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                            }}
                                        >
                                            <Typography variant="body2">
                                                {formData.use_account_sender_name
                                                    ? t("fields.yes", {
                                                        ns: "common",
                                                    })
                                                    : t("fields.no", {
                                                        ns: "common",
                                                    })}
                                            </Typography>
                                            <Tooltip
                                                title={t(
                                                    "actions.vendors_use_account_sender_name_tooltip"
                                                )}
                                                arrow
                                            >
                                                <Box
                                                    sx={{ cursor: "help" }}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        (?)
                                                    </Typography>
                                                </Box>
                                            </Tooltip>
                                        </Box>
                                    }
                                    sx={{
                                        m: 0, // Remove default margin
                                        "& .MuiFormControlLabel-label": {
                                            fontSize: "0.875rem",
                                            fontWeight: 500,
                                        },
                                    }}
                                />
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </AppDialog>

            {/* Delete Confirmation Dialog */}
            <DeleteDialog
                isOpen={deleteConfirmation.isOpen}
                onClose={() => {
                    if (!isDeleting) {
                        setDeleteConfirmation({ isOpen: false, id: null });
                    }
                }}
                onConfirm={confirmDelete}
                title={t("actions.delete", { ns: "common" })}
                description={t("actions.vendors_delete_confirm_description")}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeleting}
                type="delete"
                locale={i18n.language}
            />
        </Box>
    );
};

export default SMSVendors;
