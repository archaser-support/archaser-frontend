"use client";
import EditIcon from "@mui/icons-material/Edit";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { CircularProgress, Button } from "@mui/material";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { styled, useTheme } from "@mui/material/styles";
import Switch from "@mui/material/Switch";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { GridColDef, GridSortModel } from "@mui/x-data-grid";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDebounce } from "use-debounce";

import UpsertContactModal from "@/app/[locale]/app/customers/[customerId]/UpsertContactModal";
import { ToolbarDropdownFilter } from "@/shared/components/ToolbarDropdownFilter";
import EndlessScrollDataGrid, {
    useVirtualInfiniteScroll,
    createApiQueryFn,
} from "@/shared/layout-components/grid/EndlessScrollDataGrid";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import api from "@/app/api";
import { getMetricStatCardBorderRadius } from "@/app/theme/metricStatCard";
import { Contact, InvalidContact } from "@/types/contact";
import { ExportFormat } from "@/shared/utility/exportToExcel";

// Styled Components
const StyledContainer = styled(Box)(({ theme }) => ({
    width: "100%",
    bgcolor: theme.palette.background.paper,
    borderRadius: getMetricStatCardBorderRadius(theme),
    minHeight: 400,
    position: "relative",
    isolation: "isolate",
}));

const StyledLoadingContainer = styled(Box)(({ theme: _theme }) => ({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "400px",
}));

const StyledFilterContainer = styled(Box)(({ theme }) => ({
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    alignItems: "stretch",
    flexWrap: "wrap",
    [theme.breakpoints.up("sm")]: {
        flexDirection: "row",
        gap: theme.spacing(2),
        alignItems: "center",
    },
}));

const StyledTypography = styled(Typography)(({ theme }) => ({
    color: theme.palette.text.primary,
})) as typeof Typography;

const StyledErrorTypography = styled(Typography)(({ theme }) => ({
    color: theme.palette.error.main,
    fontWeight: theme.typography.fontWeightMedium,
    whiteSpace: "normal",
    wordWrap: "break-word",
    lineHeight: 1.4,
})) as typeof Typography;

const StyledTooltipContainer = styled(Box)(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
}));

const StyledHelpIcon = styled(HelpOutlineIcon)(({ theme }) => ({
    fontSize: "0.875rem",
    color: theme.palette.text.secondary,
}));

interface CustomerListProps {
    clientType: "All" | "Person" | "Company";
}

// Status filter component for the toolbar
const StatusFilterComponent = ({
    filterStatus,
    setFilterStatus,
    t,
}: {
    filterStatus: "Active" | "Inactive";
    setFilterStatus: React.Dispatch<
        React.SetStateAction<"Active" | "Inactive">
    >;
    t: any;
}) => {
    const theme = useTheme();
    interface FilterOption {
        label: string;
        value: string;
    }

    const filterOptions: FilterOption[] = [
        {
            label: t("values.show_active_customers", { ns: "customers" }),
            value: "Active",
        },
        {
            label: t("values.show_inactive_customers", { ns: "customers" }),
            value: "Inactive",
        },
    ];

    const currentValue =
        filterOptions.find((option) => option.value === filterStatus) ||
        filterOptions[0];

    return (
        <StyledFilterContainer>
            <ToolbarDropdownFilter<FilterOption>
                value={currentValue}
                onChange={(newValue: FilterOption | null) => {
                    setFilterStatus(newValue?.value as "Active" | "Inactive");
                }}
                options={filterOptions}
                getOptionLabel={(option: FilterOption) => option.label}
                isOptionEqualToValue={(
                    option: FilterOption,
                    value: FilterOption
                ) => option.value === value.value}
                placeholder={t("values.status_filter", { ns: "customers" })}
                sx={{
                    minWidth: { xs: "100%", sm: theme.spacing(30) },
                    width: { xs: "100%", sm: theme.spacing(30) },
                }}
            />
        </StyledFilterContainer>
    );
};

const CustomerWithInvalidContactList: React.FC<CustomerListProps> = ({
    clientType,
}) => {
    const { t, i18n } = useTranslation([
        "control_center",
        "contacts",
        "customers",
        "common",
    ]);
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const theme = useTheme();
    const searchParams = useSearchParams();

    const selectedUserId = searchParams?.get("selectedUserId");

    const [filterStatus, setFilterStatus] = useState<"Active" | "Inactive">(
        "Active"
    );
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 500);
    const [queryKeyVersion, setQueryKeyVersion] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] =
        useState<InvalidContact | null>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
        null
    );

    const [sortModel, setSortModel] = useState<GridSortModel>([
        { field: "name", sort: "asc" },
    ]);

    // Track previous values to prevent unnecessary resets
    const prevDebouncedSearchRef = useRef(debouncedSearch);
    const prevFilterStatusRef = useRef(filterStatus);
    const prevSelectedUserIdRef = useRef(selectedUserId);

    // Extract sort field and direction
    const sortField = sortModel[0]?.field;
    const sortDirection = sortModel[0]?.sort;

    // Create query key
    const queryKey = useMemo(
        () => [
            "invalid-contacts-virtual",
            {
                type: clientType,
                query: debouncedSearch,
                status: filterStatus,
                sortField,
                sortDirection,
                selectedUserId: selectedUserId || null,
                version: queryKeyVersion,
            },
        ],
        [
            clientType,
            debouncedSearch,
            filterStatus,
            sortField,
            sortDirection,
            selectedUserId,
            queryKeyVersion,
        ]
    );

    // Create query function for virtual infinite scroll
    const queryFn = useMemo(
        () =>
            createApiQueryFn(
                async (params: any) => {
                    const queryParams = new URLSearchParams();
                    queryParams.append("page", params.page.toString());
                    queryParams.append("limit", params.limit.toString());
                    if (params.type && params.type !== "All")
                        queryParams.append("filterType", params.type);
                    if (params.status)
                        queryParams.append("status", params.status);
                    if (params.sortField)
                        queryParams.append("sortField", params.sortField);
                    if (params.sortDirection)
                        queryParams.append(
                            "sortDirection",
                            params.sortDirection
                        );
                    if (params.query) queryParams.append("query", params.query);
                    if (params.selectedUserId)
                        queryParams.append(
                            "selectedUserId",
                            params.selectedUserId
                        );

                    const response = await api.get(
                        `/system/control-center?operation=customers-with-invalid-contact&${queryParams.toString()}`
                    );
                    return response.data;
                },
                {
                    type: clientType,
                    search: debouncedSearch,
                    status: filterStatus,
                    sortField: sortField || "",
                    sortDirection: sortDirection || "asc",
                    selectedUserId: selectedUserId || null,
                },
                "contacts",
                "totalRecords"
            ),
        [
            clientType,
            debouncedSearch,
            filterStatus,
            sortField,
            sortDirection,
            selectedUserId,
        ]
    );

    // Use virtual infinite scroll hook
    const {
        data: contacts,
        totalRecords,
        isLoading,
        hasMore,
        error,
        loadMore,
        reset,
    } = useVirtualInfiniteScroll<InvalidContact>({
        queryKey,
        queryFn,
    });

    // Reset when search/filter/selectedUserId changes
    React.useEffect(() => {
        const searchChanged =
            prevDebouncedSearchRef.current !== debouncedSearch;
        const filterChanged = prevFilterStatusRef.current !== filterStatus;
        const selectedUserIdChanged =
            prevSelectedUserIdRef.current !== selectedUserId;

        if (searchChanged || filterChanged || selectedUserIdChanged) {
            prevDebouncedSearchRef.current = debouncedSearch;
            prevFilterStatusRef.current = filterStatus;
            prevSelectedUserIdRef.current = selectedUserId;

            // Increment version to force new query
            setQueryKeyVersion((prev) => prev + 1);

            // Reset immediately when search or filter changes
            reset();
        }
    }, [debouncedSearch, filterStatus, selectedUserId, reset]);

    const refreshList = async () => {
        await queryClient.invalidateQueries({ queryKey: ["customer"] });
    };

    const getError = (contact: InvalidContact) => {
        const errors: string[] = [];

        // Check if contact status is not active (this shouldn't happen based on backend criteria, but keeping for safety)
        if (contact.status !== "Active") {
            errors.push(t("values.status_inactive", { ns: "common" }));
        }

        // Check for missing ALL contact methods (matches backend criteria)
        if (!contact.phone && !contact.mobile && !contact.email) {
            errors.push(
                t("validation.invalid_contact_missing_all_contact_methods", {
                    ns: "common",
                })
            );
        }

        // Check email status - only invalid if email status is problematic
        if (contact.email_status === "Bounced") {
            errors.push(t("messages.email_bounced", { ns: "control_center" }));
        } else if (contact.email_status === "Failure") {
            errors.push(t("messages.email_failure", { ns: "control_center" }));
        }

        // Check mobile status - only invalid if mobile status is problematic
        if (contact.mobile_status === "Failure") {
            errors.push(t("messages.mobile_failure", { ns: "control_center" }));
        }

        return errors.join("; ");
    };

    const rows = contacts.map((contact) => {
        const name = contact.Company?.name || "";

        return {
            id: contact.id,
            name,
            contact_name:
                `${contact.first_name} ${contact.last_name || ""}`.trim(),
            error: getError(contact),
            fullContact: contact,
        };
    });

    const columns: GridColDef[] = [
        {
            field: "contact_name",
            headerName: t("fields.name", { ns: "contacts" }),
            flex: 1,
            renderCell: (params: any) => {
                const customerId = getCustomerId(params.row.fullContact);
                const contactId = params.row.fullContact?.id;

                return (
                    <StyledTypography
                        component="span"
                        sx={{
                            color:
                                customerId > 0
                                    ? theme.palette.primary.main
                                    : theme.palette.text.primary,
                            cursor: customerId > 0 ? "pointer" : "default",
                            textDecoration:
                                customerId > 0 ? "underline" : "none",
                            textUnderlineOffset:
                                customerId > 0 ? "0.125em" : undefined,
                            "&:hover":
                                customerId > 0
                                    ? {
                                          color: theme.palette.primary.dark,
                                      }
                                    : {},
                        }}
                        onClick={() => {
                            if (customerId > 0 && contactId) {
                                setSelectedContact(params.row.fullContact);
                                setSelectedCustomerId(customerId);
                                setIsModalOpen(true);
                            }
                        }}
                    >
                        {params.row.contact_name}
                    </StyledTypography>
                );
            },
        },
        {
            field: "name",
            headerName: t("fields.company_name", { ns: "contacts" }),
            flex: 1,
            renderCell: (params: any) => {
                const customerId = getCustomerId(params.row.fullContact);

                return (
                    <StyledTypography
                        component="span"
                        sx={{
                            color:
                                customerId > 0
                                    ? theme.palette.primary.main
                                    : theme.palette.text.primary,
                            cursor: customerId > 0 ? "pointer" : "default",
                            textDecoration:
                                customerId > 0 ? "underline" : "none",
                            textUnderlineOffset:
                                customerId > 0 ? "0.125em" : undefined,
                            "&:hover":
                                customerId > 0
                                    ? {
                                          color: theme.palette.primary.dark,
                                      }
                                    : {},
                        }}
                        onClick={() => {
                            if (customerId > 0) {
                                // Navigate to customer page - keep this as navigation
                                window.location.href = `/app/customers/${customerId}`;
                            }
                        }}
                    >
                        {params.row.name}
                    </StyledTypography>
                );
            },
        },
        {
            field: "receives_standard_reminder",
            headerName: t("fields.standard_reminders", { ns: "contacts" }),
            flex: 1,
            sortable: false,
            filterable: false,
            renderHeader: () => (
                <Tooltip
                    title={t("tooltips.receives_standard_reminder", {
                        ns: "contacts",
                    })}
                >
                    <StyledTooltipContainer>
                        <StyledTypography variant="body2">
                            {t("fields.standard_reminders", { ns: "contacts" })}
                        </StyledTypography>
                        <StyledHelpIcon />
                    </StyledTooltipContainer>
                </Tooltip>
            ),
            renderCell: (params: any) => (
                <Box>
                    <Switch
                        checked={Boolean(
                            params.row.fullContact?.receives_standard_reminder
                        )}
                        size="small"
                    />
                </Box>
            ),
        },
        {
            field: "receives_escalated_reminder",
            headerName: t("fields.escalated_reminders", { ns: "contacts" }),
            flex: 1,
            sortable: false,
            filterable: false,
            renderHeader: () => (
                <Tooltip
                    title={t("tooltips.receives_escalated_reminder", {
                        ns: "contacts",
                    })}
                >
                    <StyledTooltipContainer>
                        <StyledTypography variant="body2">
                            {t("fields.escalated_reminders", {
                                ns: "contacts",
                            })}
                        </StyledTypography>
                        <StyledHelpIcon />
                    </StyledTooltipContainer>
                </Tooltip>
            ),
            renderCell: (params: any) => (
                <Box>
                    <Switch
                        checked={Boolean(
                            params.row.fullContact?.receives_escalated_reminder
                        )}
                        size="small"
                    />
                </Box>
            ),
        },
        {
            field: "error",
            headerName: t("messages.error_description", {
                ns: "control_center",
            }),
            flex: 1,
            sortable: false,
            filterable: false,
            renderCell: (params: any) => (
                <StyledErrorTypography component="span">
                    {params.value}
                </StyledErrorTypography>
            ),
        },
        {
            field: "actions",
            headerName: t("actions.actions", { ns: "common" }),
            sortable: false,
            filterable: false,
            width: 80,
            renderCell: (params: any) => {
                const customerId = getCustomerId(params.row.fullContact);
                return (
                    <IconButton
                        size="small"
                        onClick={() => {
                            if (customerId > 0) {
                                setSelectedContact(params.row.fullContact);
                                setSelectedCustomerId(customerId);
                                setIsModalOpen(true);
                            }
                        }}
                        disabled={customerId === 0}
                        color="primary"
                        title={t("actions.edit", { ns: "common" })}
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                );
            },
        },
    ];

    const convertToContact = (invalidContact: InvalidContact): Contact => ({
        ...invalidContact,
        Activity: [],
        Company: {
            ...invalidContact.Company,
            created_at: new Date(),
            modified_at: new Date(),
            company_number: null,
            created_by: invalidContact.Company?.created_by || null,
            modified_by: invalidContact.Company?.modified_by || null,
        },
        // Ensure these fields are present with default values if missing
        receives_standard_reminder:
            invalidContact.receives_standard_reminder ?? false,
        receives_escalated_reminder:
            invalidContact.receives_escalated_reminder ?? false,
        company_wide_address: invalidContact.company_wide_address ?? false,
    });

    const getCustomerId = (contact: InvalidContact | null): number => {
        if (!contact?.Company?.Customer) {
            return 0;
        }

        const customers = contact.Company.Customer;
        if (Array.isArray(customers) && customers.length > 0) {
            const customer = customers.find((d: any) => d && d.id);
            if (customer) {
                return customer.id;
            }
        }

        return 0;
    };

    // Export handler for invalid contacts
    const handleExport = useCallback(
        async (
            _selectedColumns: string[],
            _fileName: string,
            _format: ExportFormat
        ) => {
            try {
                // Use the existing contacts data from the hook
                const rawContacts = contacts || [];

                const transformedContacts = rawContacts.map(
                    (contact: InvalidContact) => {
                        const customerId = getCustomerId(contact);
                        const name = contact.Company?.name || "";
                        const contactName =
                            `${contact.first_name} ${contact.last_name || ""}`.trim();

                        return {
                            id: contact.id,
                            name,
                            contact_name: contactName,
                            error: getError(contact),
                            customer_id: customerId,
                            receives_standard_reminder:
                                contact.receives_standard_reminder ?? false,
                            receives_escalated_reminder:
                                contact.receives_escalated_reminder ?? false,
                            raw: contact,
                        };
                    }
                );

                return transformedContacts;
            } catch (error) {
                console.error("Export failed:", error);
                throw error;
            }
        },
        [contacts]
    );

    // Error state
    if (error) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    minHeight: 400,
                    flexDirection: "column",
                    gap: 2,
                }}
            >
                <Typography variant="h6" color="error">
                    {t("messages.error_fetching_data", { ns: "common" })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {error instanceof Error
                        ? error.message
                        : "Unknown error occurred"}
                </Typography>
                <Button variant="outlined" color="primary" onClick={reset}>
                    {t("actions.retry", { ns: "common" })}
                </Button>
            </Box>
        );
    }

    return (
        <StyledContainer>
            {isLoading && contacts.length === 0 ? (
                <StyledLoadingContainer>
                    <CircularProgress size={40} />
                </StyledLoadingContainer>
            ) : (
                <Box
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
                        resizableColumns={true}
                        customButtons={
                            <StatusFilterComponent
                                filterStatus={filterStatus}
                                setFilterStatus={setFilterStatus}
                                t={t}
                            />
                        }
                        searchValue={search}
                        onSearchChange={setSearch}
                        searchPlaceholder={t("fields.search_placeholder", {
                            ns: "common",
                        })}
                        searchDebounceMs={500}
                        searchDisabled={false}
                        searchDirection={i18n.language === "he" ? "rtl" : "ltr"}
                        noRowsMessage={t("messages.no_customers_found", {
                            ns: "customers",
                        })}
                        noRowsDescription={t(
                            "messages.no_results_description",
                            {
                                ns: "common",
                            }
                        )}
                        language={i18n.language}
                        fillViewport={true}
                        onExport={handleExport}
                        exportContextInfo={{
                            pageName: "invalid_contacts",
                            customPrefix: "invalid_contacts_export",
                        }}
                    />
                </Box>
            )}
            {selectedCustomerId && selectedContact && (
                <UpsertContactModal
                    isOpen={isModalOpen}
                    initialContact={convertToContact(selectedContact)}
                    companyId={selectedContact.Company?.id || 0}
                    customerId={selectedCustomerId}
                    closeModal={() => {
                        setIsModalOpen(false);
                        setSelectedContact(null);
                        setSelectedCustomerId(null);
                    }}
                />
            )}
        </StyledContainer>
    );
};

export default CustomerWithInvalidContactList;
