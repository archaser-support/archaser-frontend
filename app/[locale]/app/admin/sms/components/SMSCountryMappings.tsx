"use client";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Public as PublicIcon,
} from "@mui/icons-material";
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControl,
    FormControlLabel,
    IconButton,
    Switch,
    TextField,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

import { CountrySelect, CurrencySelect } from "@/components/LocationSelects";
import EndlessScrollDataGrid, {
    BREAKPOINTS,
    useVirtualInfiniteScroll,
    useWindowWidth,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { getEndlessScrollToolbarTooltipProps } from "@/shared/layout-components/grid/endlessScrollToolbarTooltip";
import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

interface CountrySMSVendor {
    id: number;
    country_id: number;
    vendor_id: number;
    comment?: string;
    phone_number?: string;
    is_default: boolean;
    is_active: boolean;
    cost_per_sms?: number;
    currency?: string;
    created_at: string;
    modified_at: string;
    Country: {
        id: number;
        name: string;
        iso2: string;
    };
    SMSVendor: {
        id: number;
        name: string;
        provider: string;
        is_active: boolean;
    };
}

const SMSCountryMappings = () => {
    const { t, i18n } = useTranslation(["sms", "common"]);
    const queryClient = useQueryClient();
    const theme = useTheme();
    const windowWidth = useWindowWidth();
    const { success, error: showError } = useToast();

    const [openDialog, setOpenDialog] = useState(false);
    const [editingMapping, setEditingMapping] =
        useState<CountrySMSVendor | null>(null);
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
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
        { field: "country", sort: "asc" },
    ]);
    const prevDebouncedSearchRef = useRef(debouncedSearch);
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

    const [formData, setFormData] = useState({
        country: null as any,
        vendor_id: "",
        comment: "",
        phone_number: "",
        is_default: false,
        is_active: true,
        cost_per_sms: "",
        currency: "USD",
    });

    const [formErrors, setFormErrors] = useState({
        country: "",
        vendor_id: "",
        phone_number: "",
    });

    // Create query key
    const queryKey = useMemo(
        () => [
            "sms-country-mappings-virtual",
            {
                search: debouncedSearch,
                sortField: sortModel[0]?.field,
                sortDirection: sortModel[0]?.sort,
            },
        ],
        [debouncedSearch, sortModel[0]?.field, sortModel[0]?.sort]
    );

    // Use virtual infinite scroll hook
    const {
        data: mappings,
        totalRecords,
        isLoading,
        isLoadingMore: _isLoadingMore,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll<CountrySMSVendor>({
        queryKey,
        queryFn: async (page: number = 1) => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "20",
            });

            if (debouncedSearch) {
                params.append("search", debouncedSearch);
            }

            if (sortModel && sortModel.length > 0 && sortModel[0].field) {
                params.append("sortField", sortModel[0].field);
                params.append("sortDirection", sortModel[0].sort || "asc");
            }

            const response = await api.get(
                `/api/sms/country-vendors?${params}`
            );

            return {
                data: response.data.mappings || [],
                totalRecords: response.data.totalRecords || 0,
                hasMore:
                    (response.data.mappings?.length || 0) > 0 &&
                    page < Math.ceil((response.data.totalRecords || 0) / 20),
            };
        },
        pageSize: 20,
    });

    // Get vendors from the existing mappings data
    const vendors = useMemo(() => {
        if (!mappings) return [];

        // Extract unique vendors from mappings
        const uniqueVendors = mappings.reduce((acc: any[], mapping: any) => {
            if (
                mapping.SMSVendor &&
                !acc.find((v) => v.id === mapping.SMSVendor.id)
            ) {
                acc.push(mapping.SMSVendor);
            }
            return acc;
        }, []);

        return uniqueVendors;
    }, [mappings]);

    // Filter vendors based on selected country
    const availableVendors = useMemo(() => {
        if (!formData.country) {
            return vendors || [];
        }

        // Filter vendors that have mappings for the selected country
        const countryMappings =
            mappings?.filter(
                (mapping: any) => mapping.country_id === formData.country.id
            ) || [];

        const availableVendorIds = countryMappings.map(
            (mapping: any) => mapping.vendor_id
        );
        const filtered = vendors.filter((vendor: any) =>
            availableVendorIds.includes(vendor.id)
        );

        return filtered;
    }, [vendors, formData.country, mappings]);

    // Determine if selected vendor is Twilio (for conditional required field)
    const selectedVendor = useMemo(() => {
        return (availableVendors || []).find(
            (v: any) => v.id.toString() === formData.vendor_id
        );
    }, [availableVendors, formData.vendor_id]);
    const isTwilioSelected =
        selectedVendor?.provider?.toLowerCase() === "twilio";

    // Create mapping mutation
    const createMappingMutation = useMutation({
        mutationFn: async (mappingData: any) => {
            const response = await api.post(
                "/api/sms/country-vendors",
                mappingData
            );
            return response.data;
        },
        onSuccess: () => {
            // Invalidate queries first
            queryClient.invalidateQueries({
                queryKey: ["sms-country-mappings-virtual"],
                exact: false,
            });

            // Reset the virtual scroll data with a small delay to ensure API completion
            setTimeout(() => {
                reset();
            }, 100);

            success(t("actions.country_mappings_create_success"));
            handleCloseDialog();
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error || t("common.messages.error")
            );
        },
    });

    // Update mapping mutation
    const updateMappingMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: any }) => {
            const response = await api.put(
                `/api/sms/country-vendors/${id}`,
                data
            );
            return response.data;
        },
        onSuccess: () => {
            // Invalidate queries first
            queryClient.invalidateQueries({
                queryKey: ["sms-country-mappings-virtual"],
                exact: false,
            });

            // Reset the virtual scroll data with a small delay to ensure API completion
            setTimeout(() => {
                reset();
            }, 100);

            success(t("messages.country_mappings_update_success"));
            handleCloseDialog();
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error || t("common.messages.error")
            );
        },
    });

    // Delete mapping mutation
    const deleteMappingMutation = useMutation({
        mutationFn: async (id: number) => {
            await api.delete(`/api/sms/country-vendors/${id}`);
        },
        onSuccess: () => {
            // Invalidate queries first
            queryClient.invalidateQueries({
                queryKey: ["sms-country-mappings-virtual"],
                exact: false,
            });

            // Reset the virtual scroll data with a small delay to ensure API completion
            setTimeout(() => {
                reset();
            }, 100);

            success(t("actions.country_mappings_delete_success"));
        },
        onError: (error: any) => {
            showError(
                error.response?.data?.error || t("common.messages.error")
            );
        },
    });

    const handleOpenDialog = (mapping?: CountrySMSVendor) => {
        if (mapping) {
            setEditingMapping(mapping);
            setFormData({
                country: {
                    id: mapping.Country.id,
                    name: mapping.Country.name,
                    iso2: mapping.Country.iso2,
                },
                vendor_id: mapping.vendor_id.toString(),
                comment: mapping.comment || "",
                phone_number: mapping.phone_number || "",
                is_default: mapping.is_default,
                is_active: mapping.is_active,
                cost_per_sms: mapping.cost_per_sms?.toString() || "",
                currency: resolveCustomerFirstCurrency({
                    fallbackCurrency: mapping.currency,
                }),
            });
        } else {
            setEditingMapping(null);
            setFormData({
                country: null,
                vendor_id: "",
                comment: "",
                phone_number: "",
                is_default: false,
                is_active: true,
                cost_per_sms: "",
                currency: resolveCustomerFirstCurrency({}),
            });
        }
        setFormErrors({
            country: "",
            vendor_id: "",
            phone_number: "",
        });
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingMapping(null);
        setFormData({
            country: null,
            vendor_id: "",
            comment: "",
            phone_number: "",
            is_default: false,
            is_active: true,
            cost_per_sms: "",
            currency: "USD",
        });
        setFormErrors({
            country: "",
            vendor_id: "",
            phone_number: "",
        });
    };

    // Reset drag position when Add/Edit Mapping dialog closes
    const validateForm = () => {
        const errors = {
            country: "",
            vendor_id: "",
            phone_number: "",
        };

        if (!formData.country) {
            errors.country = t("validation.country_required");
        }
        if (!formData.vendor_id) {
            errors.vendor_id = t("validation.vendor_required");
        }

        // Validate phone_number for Twilio
        const selectedVendor = (vendors || []).find(
            (v: any) => v.id.toString() === formData.vendor_id
        );
        const isTwilio = selectedVendor?.provider?.toLowerCase() === "twilio";

        if (isTwilio && !formData.phone_number?.trim()) {
            errors.phone_number = t(
                "validation.phone_number_required_for_twilio"
            );
        }

        setFormErrors(errors);
        return !Object.values(errors).some((error) => error !== "");
    };

    const handleSubmit = () => {
        if (!validateForm()) return;

        const submitData = {
            country_id: formData.country.id,
            vendor_id: parseInt(formData.vendor_id),
            comment: formData.comment,
            phone_number: formData.phone_number,
            is_default: formData.is_default,
            is_active: formData.is_active,
            cost_per_sms: formData.cost_per_sms
                ? parseFloat(formData.cost_per_sms)
                : null,
            currency: formData.currency,
        };

        if (editingMapping) {
            updateMappingMutation.mutate({
                id: editingMapping.id,
                data: submitData,
            });
        } else {
            createMappingMutation.mutate(submitData);
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
            await deleteMappingMutation.mutateAsync(deleteConfirmation.id);
            setDeleteConfirmation({ isOpen: false, id: null });
        } catch (_error) {
            // Error handling is done in the mutation
        } finally {
            setIsDeleting(false);
        }
    }, [deleteConfirmation.id, deleteMappingMutation]);

    const columns: GridColDef[] = useMemo(
        () => [
            {
                field: "country",
                headerName: t("fields.country_mappings_country"),
                flex: 1,
                minWidth: 150,
                sortable: true,
                renderCell: (params) => (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <PublicIcon
                            sx={{ fontSize: 20, color: "primary.main" }}
                        />
                        <Typography variant="body2" fontWeight={500}>
                            {params.value.name}
                        </Typography>
                    </Box>
                ),
            },
            {
                field: "vendor",
                headerName: t("fields.country_mappings_vendor"),
                flex: 1,
                minWidth: 200,
                sortable: true,
                renderCell: (params) => (
                    <Typography variant="body2" fontWeight={500}>
                        {params.value.name}
                    </Typography>
                ),
            },
            {
                field: "phone_number",
                headerName: t("fields.country_mappings_phone_number"),
                flex: 1,
                minWidth: 150,
                sortable: true,
                renderCell: (params) => (
                    <Typography variant="body2">
                        {params.value || "-"}
                    </Typography>
                ),
            },
            {
                field: "cost_per_sms",
                headerName: t("fields.country_mappings_cost_per_sms"),
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
                headerName: t("fields.country_mappings_currency"),
                flex: 1,
                minWidth: 100,
                sortable: true,
            },
            {
                field: "is_default",
                headerName: t("fields.country_mappings_is_default"),
                flex: 1,
                minWidth: 120,
                sortable: true,
                renderCell: (params) => (
                    <Chip
                        label={
                            params.value
                                ? t("fields.yes", { ns: "common" })
                                : t("fields.no", { ns: "common" })
                        }
                        size="small"
                        data-status={params.value ? "active" : "inactive"}
                    />
                ),
            },
            {
                field: "is_active",
                headerName: t("fields.status", { ns: "common" }),
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
                headerName: t("actions.country_mappings_actions"),
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

    // Data transformation
    const mapMappingToRow = useCallback(
        (mapping: CountrySMSVendor) => ({
            id: mapping.id,
            country: mapping.Country,
            vendor: mapping.SMSVendor,
            phone_number: mapping.phone_number,
            cost_per_sms: mapping.cost_per_sms,
            currency: mapping.currency,
            is_default: mapping.is_default,
            is_active: mapping.is_active,
            actions: mapping.id,
            raw: mapping,
        }),
        []
    );

    // Transform data to rows
    const rows = useMemo(() => {
        return mappings.map(mapMappingToRow);
    }, [mappings, mapMappingToRow]);

    // Reset when search changes (but not for sort changes)
    useEffect(() => {
        if (debouncedSearch !== prevDebouncedSearchRef.current) {
            prevDebouncedSearchRef.current = debouncedSearch;
            reset();
        }
    }, [debouncedSearch, reset]);

    return (
        <Box>
            {/* Error Alert */}
            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {t("messages.country_mappings_load_error")}
                </Alert>
            )}

            {/* Country Mappings DataGrid */}
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
                    totalRecords={totalRecords}
                    isLoading={isLoading}
                    onLoadMore={loadMore}
                    hasMore={hasMore}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    customButtons={
                        <Box sx={{ display: "flex", gap: theme.spacing(1) }}>
                            <Tooltip
                                title={t(
                                    "actions.country_mappings_add_mapping"
                                )}
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
                                        <PublicIcon />
                                        <AddIcon
                                            sx={{
                                                position: "absolute",
                                                right: theme.spacing(-0.5),
                                                bottom: theme.spacing(-0.5),
                                                fontSize:
                                                    theme.typography.caption
                                                        .fontSize,
                                                backgroundColor:
                                                    theme.palette.primary.main,
                                                color: theme.palette.primary
                                                    .contrastText,
                                                borderRadius: "50%",
                                                padding: theme.spacing(0.25),
                                            }}
                                        />
                                    </Box>
                                </IconButton>
                            </Tooltip>
                        </Box>
                    }
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
                    language={i18n.language}
                    fillViewport={true}
                    resizableColumns={true}
                    columnVisibilityModel={{
                        country: windowWidth >= BREAKPOINTS.MOBILE,
                        vendor: windowWidth >= BREAKPOINTS.MOBILE,
                        phone_number: windowWidth >= BREAKPOINTS.TABLET,
                        cost_per_sms: windowWidth >= BREAKPOINTS.TABLET,
                        currency: windowWidth >= BREAKPOINTS.DESKTOP,
                        is_default: windowWidth >= BREAKPOINTS.MOBILE,
                        is_active: windowWidth >= BREAKPOINTS.MOBILE,
                        actions: windowWidth >= BREAKPOINTS.MOBILE,
                    }}
                    noRowsMessage={t("fields.country_mappings_no_mappings")}
                    noRowsDescription={t(
                        "actions.country_mappings_no_mappings_description"
                    )}
                />
            </Box>

            {/* Add/Edit Mapping Dialog */}
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
                    editingMapping
                        ? t("actions.country_mappings_edit_mapping")
                        : t("actions.country_mappings_add_mapping")
                }
                titleIcon={<PublicIcon aria-hidden="true" />}
                ariaLabelledBy="country-mapping-dialog-title"
                ariaDescribedBy="country-mapping-dialog-description"
                actions={
                    <>
                        <Button
                            variant="outlined"
                            size="small"
                            className="cancel-button"
                            onClick={handleCloseDialog}
                            fullWidth={false}
                            disabled={
                                createMappingMutation.isPending ||
                                updateMappingMutation.isPending
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
                                createMappingMutation.isPending ||
                                    updateMappingMutation.isPending
                                    ? undefined
                                    : handleSubmit
                            }
                            fullWidth={false}
                            disabled={
                                createMappingMutation.isPending ||
                                updateMappingMutation.isPending
                            }
                            endIcon={
                                createMappingMutation.isPending ||
                                    updateMappingMutation.isPending ? (
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
                        gap: theme.spacing(2),
                        pt: theme.spacing(1),
                    }}
                >
                    <FormControl fullWidth error={!!formErrors.country}>
                        <CountrySelect
                            value={formData.country}
                            onChange={(value) => {
                                setFormData({
                                    ...formData,
                                    country: value,
                                    vendor_id: "",
                                });
                                // Clear country error when a value is selected
                                if (value && formErrors.country) {
                                    setFormErrors({
                                        ...formErrors,
                                        country: "",
                                    });
                                }
                            }}
                            label={t("fields.country_mappings_country")}
                            required
                            error={!!formErrors.country}
                            helperText={formErrors.country}
                        />
                    </FormControl>
                    <Autocomplete
                        options={availableVendors || []}
                        getOptionLabel={(option: any) => option.name || ""}
                        value={
                            availableVendors?.find(
                                (vendor: any) =>
                                    vendor.id.toString() ===
                                    formData.vendor_id
                            ) || null
                        }
                        onChange={(event, newValue) => {
                            setFormData({
                                ...formData,
                                vendor_id: newValue
                                    ? newValue.id.toString()
                                    : "",
                            });
                            // Clear vendor error when a value is selected
                            if (newValue && formErrors.vendor_id) {
                                setFormErrors({
                                    ...formErrors,
                                    vendor_id: "",
                                });
                            }
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t("fields.country_mappings_vendor")}
                                required
                                size="small"
                                error={!!formErrors.vendor_id}
                                helperText={formErrors.vendor_id}
                                sx={{
                                    mb: theme.spacing(1), // Use theme spacing
                                    "& .MuiOutlinedInput-root": {
                                        fontSize:
                                            theme.typography.body2.fontSize,
                                        height: theme.spacing(5), // Use theme spacing (40px)
                                        backgroundColor:
                                            theme.palette.background.paper,
                                        "& .MuiOutlinedInput-notchedOutline":
                                        {
                                            borderColor:
                                                theme.palette.divider,
                                        },
                                        "&:hover .MuiOutlinedInput-notchedOutline":
                                        {
                                            borderColor:
                                                theme.palette.primary
                                                    .main,
                                        },
                                        "&.Mui-focused .MuiOutlinedInput-notchedOutline":
                                        {
                                            borderColor:
                                                theme.palette.primary
                                                    .main,
                                            borderWidth: 2,
                                        },
                                        "&.Mui-error .MuiOutlinedInput-notchedOutline":
                                        {
                                            borderColor:
                                                theme.palette.error
                                                    .main,
                                        },
                                    },
                                    "& .MuiInputLabel-root": {
                                        fontSize:
                                            theme.typography.body2.fontSize,
                                        fontWeight:
                                            theme.typography
                                                .fontWeightMedium,
                                        "&.Mui-focused": {
                                            color: theme.palette.primary
                                                .main,
                                        },
                                        "&.Mui-error": {
                                            color: theme.palette.error.main,
                                        },
                                    },
                                    "& .MuiFormHelperText-root": {
                                        fontSize:
                                            theme.typography.caption
                                                .fontSize,
                                        color: theme.palette.text.secondary,
                                        "&.Mui-error": {
                                            color: theme.palette.error.main,
                                        },
                                    },
                                }}
                            />
                        )}
                        renderOption={(props, option: any) => (
                            <Box component="li" {...props}>
                                <Typography>{option.name}</Typography>
                            </Box>
                        )}
                        sx={{
                            width: "100%",
                        }}
                        noOptionsText={t("common.no_options")}
                        clearOnEscape
                        disableClearable={false}
                    />
                    <TextField
                        label={t("fields.country_mappings_phone_number")}
                        value={formData.phone_number}
                        onChange={(e) => {
                            setFormData({
                                ...formData,
                                phone_number: e.target.value,
                            });
                            // Clear error when user types
                            if (
                                e.target.value.trim() &&
                                formErrors.phone_number
                            ) {
                                setFormErrors({
                                    ...formErrors,
                                    phone_number: "",
                                });
                            }
                        }}
                        fullWidth
                        size="small"
                        variant="outlined"
                        required={isTwilioSelected}
                        error={!!formErrors.phone_number}
                        helperText={formErrors.phone_number}
                    />
                    <Box sx={{ display: "flex", gap: theme.spacing(2) }}>
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
                        <TextField
                            label={t(
                                "fields.country_mappings_cost_per_sms"
                            )}
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
                    <TextField
                        label={t("fields.country_mappings_comment")}
                        value={formData.comment}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                comment: e.target.value,
                            })
                        }
                        fullWidth
                        size="small"
                        variant="outlined"
                        multiline
                        rows={2}
                        {...(i18n.language === "he" && {
                            "data-hebrew": true,
                            multiline: true,
                        })}
                    />
                    <Box sx={{ display: "flex", gap: theme.spacing(2) }}>
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
                                {t("fields.country_mappings_is_default")}
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    minHeight: theme.spacing(5),
                                }}
                            >
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.is_default}
                                            onChange={(e) =>
                                                setFormData({
                                                    ...formData,
                                                    is_default:
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
                                            {formData.is_default
                                                ? t("fields.yes", {
                                                    ns: "common",
                                                })
                                                : t("fields.no", {
                                                    ns: "common",
                                                })}
                                        </Typography>
                                    }
                                    sx={{
                                        m: 0, // Remove default margin
                                        "& .MuiFormControlLabel-label": {
                                            fontSize:
                                                theme.typography.body2
                                                    .fontSize,
                                            fontWeight:
                                                theme.typography
                                                    .fontWeightMedium,
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
                                {t("fields.status", { ns: "common" })}
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    minHeight: theme.spacing(5),
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
                                            fontSize:
                                                theme.typography.body2
                                                    .fontSize,
                                            fontWeight:
                                                theme.typography
                                                    .fontWeightMedium,
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
                description={t(
                    "actions.country_mappings_delete_confirm_description"
                )}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeleting}
                type="delete"
                locale={i18n.language}
            />
        </Box>
    );
};

export default SMSCountryMappings;
