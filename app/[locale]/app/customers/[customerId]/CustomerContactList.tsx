"use client";

import ContactsIcon from "@mui/icons-material/Contacts";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import {
    Box,
    Chip,
    IconButton,
    Tooltip,
    Typography,
    alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { GridRenderCellParams } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { Contact } from "@/types/contact";
import { Customer } from "@/types/Customer";

import UpsertContactModal from "./UpsertContactModal";

interface CustomerProp {
    customer: Customer;
}

// Add Contact Button Component
const AddContactButton = React.memo(
    ({
        onAddClick,
        disabled = false,
    }: {
        onAddClick: () => void;
        disabled?: boolean;
    }) => {
        const { t } = useTranslation(["contacts", "customers", "common", "reports"]);

        return (
            <Tooltip title={t("actions.add_contact", { ns: "contacts" })}>
                <span>
                    <IconButton
                        color="primary"
                        size="small"
                        className="toolbar-button"
                        onClick={onAddClick}
                        disabled={disabled}
                        aria-label={t("actions.add_contact", { ns: "contacts" })}
                    >
                        <PersonAddIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>
        );
    }
);

AddContactButton.displayName = "AddContactButton";

const CustomerContactList: React.FC<CustomerProp> = ({ customer }) => {
    const { t, i18n } = useTranslation([
        "customers",
        "common",
        "contacts",
        "reports",
    ]);
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const params = useParams();
    const searchParams = useSearchParams();
    const customerId = params?.customerId as string;
    const locale = params?.locale as string;
    const theme = useTheme();
    const { showToast } = useToast();

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
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasViewContactsPermission = userPermissions.includes("view_contacts");
    const hasManageContactsPermission =
        userPermissions.includes("manage_contacts");

    const [search, setSearch] = useState("");
    const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [contactListRefreshTrigger, setContactListRefreshTrigger] = useState(0);

    // Track view changes for debugging grid height issues
    const prevViewIdRef = React.useRef<number | null>(selectedViewId);
    const prevRowsLengthRef = React.useRef<number>(rows.length);

    useEffect(() => {
        const viewChanged = prevViewIdRef.current !== selectedViewId;
        const rowsChanged = prevRowsLengthRef.current !== rows.length;

        if (viewChanged) {
            prevViewIdRef.current = selectedViewId;
        }

        if (rowsChanged) {
            prevRowsLengthRef.current = rows.length;
        }
    }, [selectedViewId, rows.length, rows]);

    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        contact: Contact | null;
    }>({
        isOpen: false,
        contact: null,
    });
    const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(
        null
    );
    const [deactivateConfirmation, setDeactivateConfirmation] = useState<{
        isOpen: boolean;
        contact: Contact | null;
        errorData: any;
    }>({
        isOpen: false,
        contact: null,
        errorData: null,
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeactivating, setIsDeactivating] = useState(false);
    const [viewDeleteConfirmation, setViewDeleteConfirmation] = useState<{
        isOpen: boolean;
        viewId: number | null;
        viewName: string | null;
    }>({
        isOpen: false,
        viewId: null,
        viewName: null,
    });

    // Note: Removed cache invalidation on mount to prevent duplicate fetches
    // React Query handles caching automatically, and useViewExecution already fetches the default view

    // Handle openContact URL parameter to open contact modal
    // Pass only the ID - the modal will fetch the complete contact data
    useEffect(() => {
        const openContactId = searchParams?.get("openContact");
        if (openContactId) {
            const contactId = parseInt(openContactId, 10);
            if (!isNaN(contactId)) {
                setSelectedContact({ id: contactId } as Contact);
                setIsUpsertModalOpen(true);
            }
        }
    }, [searchParams]);

    // Stable search change handler
    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
    }, []);

    const refreshList = useCallback(
        async (source?: string) => {
            await queryClient.invalidateQueries({
                queryKey: ["view-execution"],
            });
            await queryClient.refetchQueries({
                queryKey: ["view-execution"],
            });
            await queryClient.invalidateQueries({
                queryKey: ["customer_contacts-virtual"],
            });
            await queryClient.refetchQueries({
                queryKey: ["customer_contacts-virtual"],
            });
        },
        [queryClient]
    );

    const handleDeleteContact = useCallback((contact: Contact | any) => {
        // Extract contact ID from report row data
        // The report execution service formats Contact.id field as "Contact.id" in the output
        // The row.id might be a generated value like "row-4", so we prioritize Contact.id
        const contactIdRaw = contact["Contact.id"] ?? contact.id;

        // Validate and convert to number - reject string IDs like "row-4"
        let contactId: number | null = null;
        if (contactIdRaw !== undefined && contactIdRaw !== null) {
            if (typeof contactIdRaw === 'number') {
                contactId = contactIdRaw;
            } else if (typeof contactIdRaw === 'string') {
                // Reject generated row IDs like "row-4" or "row-0"
                if (!contactIdRaw.startsWith('row-')) {
                    const parsed = parseInt(contactIdRaw, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        contactId = parsed;
                    }
                }
            }
        }

        if (!contactId) {
            // Log error for debugging with flattened structure
            const availableKeys = Object.keys(contact || {});
            const allValues = availableKeys.reduce((acc, key) => {
                acc[`key_${key}`] = contact[key];
                return acc;
            }, {} as Record<string, any>);

            console.error('[CustomerContactList] Failed to extract contact ID from row:', {
                contactIdRaw,
                contactIdRawType: typeof contactIdRaw,
                availableKeys,
                availableKeysCount: availableKeys.length,
                contactIdFromContactId: contact["Contact.id"],
                contactIdFromId: contact.id,
                allRowValues: allValues,
            });
            showToast(
                t("messages.delete_error", { ns: "contacts" }) + " (Invalid contact ID)",
                "error"
            );
            return;
        }

        // Pass only the ID - we'll fetch the full contact when needed
        setDeleteConfirmation({ isOpen: true, contact: { id: contactId } as Contact });
    }, [showToast, t]);

    const handleEditContact = useCallback((contact: Contact | any) => {
        // Extract contact ID from report row data
        // Priority: Contact.id (from report config) > id (but must be numeric, not "row-X")
        const contactIdRaw = contact["Contact.id"] || contact.id;

        // Validate and convert to number - reject string IDs like "row-4"
        let contactId: number | null = null;
        if (contactIdRaw !== undefined && contactIdRaw !== null) {
            if (typeof contactIdRaw === 'number') {
                contactId = contactIdRaw;
            } else if (typeof contactIdRaw === 'string' && !contactIdRaw.startsWith('row-')) {
                const parsed = parseInt(contactIdRaw, 10);
                if (!isNaN(parsed)) {
                    contactId = parsed;
                }
            }
        }

        if (!contactId) {
            // If no valid ID, fall back to passing the contact object (for backwards compatibility)
            setSelectedContact(contact as Contact);
        } else {
            // Pass only the ID - the modal will fetch the complete contact data
            setSelectedContact({ id: contactId } as Contact);
        }

        setIsUpsertModalOpen(true);
    }, []);

    const handleAddContact = useCallback(() => {
        setSelectedContact(null);
        setIsUpsertModalOpen(true);
    }, []);

    const handleCloseUpsertModal = useCallback(() => {
        setIsUpsertModalOpen(false);
        setSelectedContact(null);
    }, []);

    const handleUpsertSuccess = useCallback(async () => {
        handleCloseUpsertModal();
        // Refresh after closing so the grid is visible when data updates
        await refreshList("handleUpsertSuccess");
    }, [refreshList, handleCloseUpsertModal]);

    // Refresh contact list whenever the upsert modal closes (save or cancel)
    const prevUpsertModalOpenRef = React.useRef(false);
    useEffect(() => {
        const wasOpen = prevUpsertModalOpenRef.current;
        prevUpsertModalOpenRef.current = isUpsertModalOpen;
        if (wasOpen && !isUpsertModalOpen) {
            setContactListRefreshTrigger((t) => t + 1);
            void refreshList("useEffect-on-close");
        }
    }, [isUpsertModalOpen, refreshList]);

    // Handle delete view
    const handleDeleteView = useCallback(
        async (viewId: number) => {
            try {
                const response = await apiFetch(`/api/reports/${viewId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.report?.is_system) {
                        showToast(
                            t("reports.messages.cannot_delete_system_report", {
                                defaultValue: "System views cannot be deleted",
                            }),
                            "error"
                        );
                        return;
                    }
                    const viewName = data.report?.name || "";
                    setViewDeleteConfirmation({
                        isOpen: true,
                        viewId,
                        viewName,
                    });
                }
            } catch (error) {
                setViewDeleteConfirmation({
                    isOpen: true,
                    viewId,
                    viewName: "",
                });
            }
        },
        [showToast, t]
    );

    const handleConfirmDeleteView = useCallback(async () => {
        if (!viewDeleteConfirmation.viewId) return;

        try {
            const response = await apiFetch(`/api/reports/${viewDeleteConfirmation.viewId}`,
                {
                    method: "DELETE",
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete view");
            }

            if (selectedViewId === viewDeleteConfirmation.viewId) {
                setSelectedViewId(null);
            }

            await queryClient.invalidateQueries({
                queryKey: ["reports-list"],
            });

            setViewDeleteConfirmation({
                isOpen: false,
                viewId: null,
                viewName: null,
            });
            showToast(
                t("reports.messages.delete_report_success", {
                    defaultValue: "View deleted successfully",
                }),
                "success"
            );
        } catch (error) {
            showToast(
                error instanceof Error
                    ? error.message
                    : t("reports.messages.delete_report_error", {
                        defaultValue: "Failed to delete view",
                    }),
                "error"
            );
        }
    }, [
        viewDeleteConfirmation,
        selectedViewId,
        queryClient,
        showToast,
        t,
    ]);

    const handleCancelDeleteView = useCallback(() => {
        setViewDeleteConfirmation({
            isOpen: false,
            viewId: null,
            viewName: null,
        });
    }, []);

    const handleDeleteClick = async () => {
        if (!deleteConfirmation.contact?.id) return;

        setIsDeleting(true);
        try {
            await api.delete(
                `/entities/contacts/${deleteConfirmation.contact.id}`
            );

            // Close the modal
            setDeleteConfirmation({ isOpen: false, contact: null });

            // Refresh the contact list
            await refreshList();

            // Show success message
            showToast(
                t("messages.delete_success", { ns: "contacts" }),
                "success"
            );
        } catch (error: any) {
            // Handle structured error responses from API
            if (error?.response?.data?.errorKey) {
                const errorData = error.response.data;

                // Check if this is a deactivation scenario
                if (
                    errorData.hasRelatedActivities ||
                    errorData.hasFallbackContacts
                ) {
                    setDeactivateConfirmation({
                        isOpen: true,
                        contact: deleteConfirmation.contact,
                        errorData: errorData,
                    });
                    setDeleteConfirmation({ isOpen: false, contact: null });
                } else {
                    let errorMessage = t(`contact.${errorData.errorKey}`);

                    // Replace placeholders with actual values
                    if (errorData.count !== undefined) {
                        errorMessage = errorMessage.replace(
                            "{{count}}",
                            errorData.count.toString()
                        );
                    }
                    if (errorData.contacts !== undefined) {
                        errorMessage = errorMessage.replace(
                            "{{contacts}}",
                            errorData.contacts
                        );
                    }

                    showToast(errorMessage, "error");
                }
            } else {
                // Fallback to generic error message
                showToast(
                    error instanceof Error
                        ? error.message
                        : "Failed to delete contact",
                    "error"
                );
            }
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeactivateClick = async () => {
        if (!deactivateConfirmation.contact?.id) return;

        setIsDeactivating(true);
        try {
            await api.put(
                `/entities/contacts/${deactivateConfirmation.contact.id}`,
                {
                    status: "Inactive", // Deactivate the contact
                }
            );

            // Close the modal
            setDeactivateConfirmation({
                isOpen: false,
                contact: null,
                errorData: null,
            });

            // Refresh the contact list
            await refreshList();

            // Show success message
            showToast(
                t("messages.deactivate_success", { ns: "contacts" }),
                "success"
            );
        } catch (error: any) {
            showToast(
                error instanceof Error
                    ? error.message
                    : "Failed to deactivate contact",
                "error"
            );
        } finally {
            setIsDeactivating(false);
        }
    };

    // Custom cell renderers for report columns
    const customCellRenderers = useMemo(
        () => {
            const statusRenderer = (params: GridRenderCellParams<any>) => {
                // Handle both "status" and "Contact.status" key formats
                // Report data has dynamic keys like "Contact.status"
                const row = params.row as any;
                const statusValue = row?.status !== undefined
                    ? row.status
                    : row?.["Contact.status"] !== undefined
                        ? row["Contact.status"]
                        : params.value;
                const isActive = statusValue === "Active";
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
            };

            return {
                // Register for both key formats: "status" and "Contact.status"
                // Report execution service outputs keys as "Contact.status" format
                status: statusRenderer,
                "Contact.status": statusRenderer,
                // Handle full_name field (used in report config)
                full_name: (params: GridRenderCellParams<any>) => {
                    const fullName = params.value ||
                        params.row?.full_name ||
                        `${params.row?.first_name || ""} ${params.row?.last_name || ""}`.trim() ||
                        `${params.row?.["Contact.first_name"] || ""} ${params.row?.["Contact.last_name"] || ""}`.trim();
                    return hasViewContactsPermission || hasManageContactsPermission ? (
                        <Typography
                            component="span"
                            variant="body2"
                            className="truncate w-full"
                            data-interactive="true"
                            onClick={() => handleEditContact(params.row)}
                            sx={{
                                color: "primary.main",
                                cursor: "pointer",
                                textDecoration: "none",
                                "&:hover": {
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            {fullName || "-"}
                        </Typography>
                    ) : (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                        >
                            {fullName || "-"}
                        </Typography>
                    );
                },
                "Contact.full_name": (params: GridRenderCellParams<any>) => {
                    const fullName = params.value ||
                        params.row?.["Contact.full_name"] ||
                        params.row?.full_name ||
                        `${params.row?.["Contact.first_name"] || params.row?.first_name || ""} ${params.row?.["Contact.last_name"] || params.row?.last_name || ""}`.trim();
                    return hasViewContactsPermission || hasManageContactsPermission ? (
                        <Typography
                            component="span"
                            variant="body2"
                            className="truncate w-full"
                            data-interactive="true"
                            onClick={() => handleEditContact(params.row)}
                            sx={{
                                color: "primary.main",
                                cursor: "pointer",
                                textDecoration: "none",
                                "&:hover": {
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            {fullName || "-"}
                        </Typography>
                    ) : (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                        >
                            {fullName || "-"}
                        </Typography>
                    );
                },
                name: (params: GridRenderCellParams<any>) => {
                    const firstName = params.row?.first_name || "";
                    const lastName = params.row?.last_name || "";
                    const fullName = `${firstName} ${lastName}`.trim();
                    return hasViewContactsPermission || hasManageContactsPermission ? (
                        <Typography
                            component="span"
                            variant="body2"
                            className="truncate w-full"
                            data-interactive="true"
                            onClick={() => handleEditContact(params.row)}
                            sx={{
                                color: "primary.main",
                                cursor: "pointer",
                                textDecoration: "none",
                                "&:hover": {
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            {fullName}
                        </Typography>
                    ) : (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                        >
                            {fullName}
                        </Typography>
                    );
                },
                "Contact.first_name": (params: GridRenderCellParams<any>) => {
                    const firstName = params.value || params.row?.first_name || "";
                    const lastName = params.row?.last_name || "";
                    const fullName = `${firstName} ${lastName}`.trim();
                    return hasViewContactsPermission || hasManageContactsPermission ? (
                        <Typography
                            component="span"
                            variant="body2"
                            className="truncate w-full"
                            data-interactive="true"
                            onClick={() => handleEditContact(params.row)}
                            sx={{
                                color: "primary.main",
                                cursor: "pointer",
                                textDecoration: "none",
                                "&:hover": {
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            {firstName}
                        </Typography>
                    ) : (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                        >
                            {firstName}
                        </Typography>
                    );
                },
                "Contact.last_name": (params: GridRenderCellParams<any>) => {
                    const firstName = params.row?.first_name || "";
                    const lastName = params.value || params.row?.last_name || "";
                    const fullName = `${firstName} ${lastName}`.trim();
                    return hasViewContactsPermission || hasManageContactsPermission ? (
                        <Typography
                            component="span"
                            variant="body2"
                            className="truncate w-full"
                            data-interactive="true"
                            onClick={() => handleEditContact(params.row)}
                            sx={{
                                color: "primary.main",
                                cursor: "pointer",
                                textDecoration: "none",
                                "&:hover": {
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            {lastName}
                        </Typography>
                    ) : (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                        >
                            {lastName}
                        </Typography>
                    );
                },
                // Also support simple field names as fallback
                first_name: (params: GridRenderCellParams<any>) => {
                    const firstName = params.value || params.row?.first_name || "";
                    const lastName = params.row?.last_name || "";
                    const fullName = `${firstName} ${lastName}`.trim();
                    return hasViewContactsPermission || hasManageContactsPermission ? (
                        <Typography
                            component="span"
                            variant="body2"
                            className="truncate w-full"
                            data-interactive="true"
                            onClick={() => handleEditContact(params.row)}
                            sx={{
                                color: "primary.main",
                                cursor: "pointer",
                                textDecoration: "none",
                                "&:hover": {
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            {firstName}
                        </Typography>
                    ) : (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                        >
                            {firstName}
                        </Typography>
                    );
                },
                last_name: (params: GridRenderCellParams<any>) => {
                    const firstName = params.row?.first_name || "";
                    const lastName = params.value || params.row?.last_name || "";
                    const fullName = `${firstName} ${lastName}`.trim();
                    return hasViewContactsPermission || hasManageContactsPermission ? (
                        <Typography
                            component="span"
                            variant="body2"
                            className="truncate w-full"
                            data-interactive="true"
                            onClick={() => handleEditContact(params.row)}
                            sx={{
                                color: "primary.main",
                                cursor: "pointer",
                                textDecoration: "none",
                                "&:hover": {
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            {lastName}
                        </Typography>
                    ) : (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                        >
                            {lastName}
                        </Typography>
                    );
                },
                email: (params: GridRenderCellParams<any>) => {
                    const email = params.value || "";
                    return (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                            sx={{
                                color: params.value
                                    ? "text.primary"
                                    : "text.secondary",
                            }}
                        >
                            {email || "-"}
                        </Typography>
                    );
                },
                mobile: (params: GridRenderCellParams<any>) => {
                    const mobile = params.value || "";
                    return (
                        <Typography
                            variant="body2"
                            className="truncate w-full"
                            sx={{
                                color: params.value
                                    ? "text.primary"
                                    : "text.secondary",
                            }}
                        >
                            {mobile || "-"}
                        </Typography>
                    );
                },
                receives_standard_reminder: (
                    params: GridRenderCellParams<any>
                ) => {
                    const isEnabled = params.value;
                    return (
                        <Chip
                            label={
                                isEnabled
                                    ? t("fields.receiving", { ns: "contacts" })
                                    : t("fields.not_receiving", {
                                        ns: "contacts",
                                    })
                            }
                            size="small"
                            data-status={isEnabled ? "active" : "inactive"}
                        />
                    );
                },
                receives_escalated_reminder: (
                    params: GridRenderCellParams<any>
                ) => {
                    const isEnabled = params.value;
                    return (
                        <Chip
                            label={
                                isEnabled
                                    ? t("fields.receiving", { ns: "contacts" })
                                    : t("fields.not_receiving", {
                                        ns: "contacts",
                                    })
                            }
                            size="small"
                            data-status={isEnabled ? "active" : "inactive"}
                        />
                    );
                },
            };
        },
        [t, theme, hasViewContactsPermission, hasManageContactsPermission, handleEditContact]
    );

    // Actions column renderer
    const actionsColumnRenderer = useCallback(
        (params: GridRenderCellParams<any>) => {
            if (!hasManageContactsPermission) {
                return null;
            }
            return (
                <Box sx={{ display: "flex", gap: 1 }}>
                    <Tooltip
                        title={t("actions.delete_contact", {
                            ns: "contacts",
                        })}
                        arrow
                    >
                        <IconButton
                            size="small"
                            onClick={() => handleDeleteContact(params.row)}
                            sx={{
                                color: theme.palette.primary.main,
                                "&:hover": {
                                    backgroundColor: theme.palette.action.hover,
                                },
                            }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            );
        },
        [hasManageContactsPermission, t, theme, handleDeleteContact]
    );

    // Memoize additional filters - must be before early return to maintain hook order
    const additionalFilters = useMemo(
        () => [
            {
                table: "Contact",
                field: "customer_id",
                operator: "equals",
                value: Number(customerId),
            },
        ],
        [customerId]
    );

    // Check if user has permission to view contacts
    if (!hasViewContactsPermission) {
        return null; // Don't render the contact list if user doesn't have view permission
    }

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: theme.shape.borderRadius,
                position: "relative",
                isolation: "isolate",
            }}
        >
            {/* Header Section */}
            <Box
                sx={{
                    p: { xs: 1, sm: 1.25 },
                    mb: theme.spacing(1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <ContactsIcon
                        sx={{
                            color: "primary.main",
                            fontSize: { xs: 18, sm: 20 },
                        }}
                    />
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 500,
                            fontSize: { xs: "1rem", sm: "1.25rem" },
                        }}
                    >
                        {t("sections.contacts", { ns: "customers" })}
                    </Typography>
                </Box>
            </Box>

            {/* Virtual Grid */}
            <Box
                sx={{
                    position: "relative",
                    isolation: "isolate",
                }}
            >
                <ViewBasedDataGrid
                    context="customer_contacts"
                    searchValue={search}
                    onSearchChange={handleSearchChange}
                    refreshTrigger={contactListRefreshTrigger}
                    customButtons={
                        hasManageContactsPermission ? (
                            <AddContactButton onAddClick={handleAddContact} />
                        ) : null
                    }
                    additionalFilters={additionalFilters}
                    customCellRenderers={customCellRenderers}
                    actionsColumn={actionsColumnRenderer}
                    actionsColumnConfig={{
                        headerName: t("actions.actions", { ns: "common" }),
                        flex: 0.6,
                        minWidth: 100,
                    }}
                    fillViewport={false}
                    visibleRows={5}
                    onViewChange={(viewId) => {
                        setSelectedViewId(viewId);
                    }}
                    onRowsChange={setRows}
                    onDeleteView={handleDeleteView}
                    exportDisabled={false}
                    allowAddEditViews={false}
                />
            </Box>

            <UpsertContactModal
                isOpen={isUpsertModalOpen}
                initialContact={selectedContact || undefined}
                companyId={customer.company_id || 0}
                customerId={Number(customerId)}
                accountId={customer.account_id}
                closeModal={handleCloseUpsertModal}
                onCreateContact={handleUpsertSuccess}
            />
            <DeleteDialog
                isOpen={deleteConfirmation.isOpen}
                onClose={() => {
                    if (!isDeleting) {
                        setDeleteConfirmation({ isOpen: false, contact: null });
                    }
                }}
                onConfirm={handleDeleteClick}
                title={t("actions.delete_contact", { ns: "contacts" })}
                description={t("messages.delete_contact_confirmation", {
                    ns: "contacts",
                    defaultValue: "Are you sure you want to delete this contact? This action cannot be undone.",
                })}
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeleting}
                type="delete"
                maxWidth="xs"
                locale={locale}
            />
            <DeleteDialog
                isOpen={deactivateConfirmation.isOpen}
                onClose={() => {
                    if (!isDeactivating) {
                        setDeactivateConfirmation({
                            isOpen: false,
                            contact: null,
                            errorData: null,
                        });
                    }
                }}
                onConfirm={handleDeactivateClick}
                title={t("actions.deactivate_contact", { ns: "contacts" })}
                description={t("messages.deactivate_contact_confirmation", {
                    ns: "contacts",
                    defaultValue: "Are you sure you want to deactivate this contact?",
                })}
                confirmLabel={t("actions.deactivate", { ns: "contacts" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                isLoading={isDeactivating}
                type="warning"
                maxWidth="sm"
                locale={locale}
            />
            {/* Delete View Confirmation Dialog */}
            <DeleteDialog
                isOpen={viewDeleteConfirmation.isOpen}
                onClose={handleCancelDeleteView}
                onConfirm={handleConfirmDeleteView}
                title={t("reports.actions.delete_report", {
                    defaultValue: "Delete View",
                })}
                description={
                    viewDeleteConfirmation.viewName
                        ? t("reports.messages.delete_report_confirmation", {
                            defaultValue:
                                "Are you sure you want to delete this view?",
                        }) + ` "${viewDeleteConfirmation.viewName}"?`
                        : t("reports.messages.delete_report_confirmation", {
                            defaultValue:
                                "Are you sure you want to delete this view?",
                        })
                }
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                type="delete"
                locale={locale}
            />
        </Box>
    );
};

export default CustomerContactList;
