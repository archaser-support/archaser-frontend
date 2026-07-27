"use client";
import {
    Category,
    Email as EmailIcon,
    GroupAdd,
    People,
} from "@mui/icons-material";
import {
    Box,
    CircularProgress,
    IconButton,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Popover,
    Tooltip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import InternalPageWrapper from "@/components/InternalPageWrapper";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import { fetchCustomerStats } from "@/shared/services/customerService";
import { CustomerStats } from "@/types/Customer";

import { BulkActionButton } from "@/shared/components/BulkActionButton";
import { ViewBasedDataGrid } from "@/shared/components/ViewBasedDataGrid";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { isCreditOnlyAccount } from "@/shared/utils/accountProducts";

import ShareReportModal from "@/components/reports/ShareReportModal";
import AccountStatsComponent from "./components/AccountStats";

// Dynamically import modals to prevent CSS chunking issues
const MassSendEmailModal = dynamic(
    () => import("./components/MassSendEmailModal").then((mod) => mod.default),
    {
        ssr: false,
        loading: () => null,
    }
);

const MassUpdateCategoryModal = dynamic(
    () => import("./components/MassUpdateCategoryModal").then((mod) => mod.default),
    {
        ssr: false,
        loading: () => null,
    }
);

interface CustomerListProps {
    clientType: "All" | "Person" | "Company";
}

const CustomerList: React.FC<CustomerListProps> = ({
    clientType: _clientType,
}) => {
    const { t, i18n } = useTranslation(["customers", "activities", "common"]);
    const router = useRouter();
    const theme = useTheme();
    const queryClient = useQueryClient();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const { success, error: showError } = useToast();

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
    const hasCreateCustomerPermission =
        userPermissions.includes("create_customer");

    const { data: accountProducts } = useQuery<{
        has_collection?: boolean;
        has_credit_insurance?: boolean;
    }>({
        queryKey: ["account-products", session?.user?.account_id],
        queryFn: async () => {
            const accountId = session?.user?.account_id;
            if (!accountId) {
                return {
                    has_collection: true,
                    has_credit_insurance: false,
                };
            }
            const response = await api.get(
                `/api/entities/accounts/${accountId}`
            );
            return {
                has_collection:
                    response.data?.has_collection !== undefined
                        ? response.data.has_collection
                        : true,
                has_credit_insurance:
                    response.data?.has_credit_insurance === true,
            };
        },
        enabled: !!session?.user?.account_id,
        staleTime: 60 * 1000,
    });

    const isCreditOnlyAccountUser = isCreditOnlyAccount(accountProducts);

    // Search state
    const [search, setSearch] = useState("");
    // Track if view was manually selected (not from URL or auto-selected)
    const [isManualSelection, setIsManualSelection] = useState(false);
    // Initialize selectedViewId from URL parameter if present (viewId or reportId)
    const [selectedViewId, setSelectedViewId] = useState<number | null>(() => {
        const viewIdParam = searchParams?.get("viewId") || searchParams?.get("reportId");
        if (viewIdParam) {
            const parsedId = parseInt(viewIdParam, 10);
            return isNaN(parsedId) ? null : parsedId;
        }
        return null;
    });
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [rows, setRows] = useState<any[]>([]);

    // Mass update state
    const [isMassUpdateModalOpen, setIsMassUpdateModalOpen] = useState(false);
    const [isMassSendEmailModalOpen, setIsMassSendEmailModalOpen] =
        useState(false);

    // Share report state
    const [shareModalState, setShareModalState] = useState<{
        isOpen: boolean;
        reportId: number | null;
        reportName: string;
    }>({
        isOpen: false,
        reportId: null,
        reportName: "",
    });

    // Actions menu state - using position instead of anchor element to avoid DOM issues
    const [menuPosition, setMenuPosition] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Delete confirmation state
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean;
        viewId: number | null;
        viewName: string | null;
    }>({
        isOpen: false,
        viewId: null,
        viewName: null,
    });

    // Fetch customer stats
    const { data: statsData, isLoading: statsLoading } = useQuery<{
        stats: CustomerStats;
    }>({
        queryKey: ["customerStats", {}],
        queryFn: fetchCustomerStats,
        refetchOnWindowFocus: false,
    });

    // Invalidate default view cache on mount to ensure fresh data after navigation
    useEffect(() => {
        if (session?.user?.id && session?.user?.account_id) {
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    return (
                        Array.isArray(key) &&
                        key[0] === "default-view" &&
                        key[1] === "customers" &&
                        key[2] === session.user.account_id &&
                        key[3] === session.user.id
                    );
                },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount

    // Handle mass update completion
    const handleMassUpdateComplete = useCallback(async () => {
        setSelectedRows([]);
        await queryClient.invalidateQueries({
            queryKey: ["view-execution"],
        });
    }, [queryClient]);

    // Handle mass send email completion
    const handleMassSendEmailComplete = useCallback(async () => {
        setSelectedRows([]);
        await queryClient.invalidateQueries({
            queryKey: ["view-execution"],
        });
    }, [queryClient]);

    // Restore viewId or reportId from URL on initial load or when searchParams change externally (e.g., browser back/forward)
    useEffect(() => {
        const viewIdParam = searchParams?.get("viewId") || searchParams?.get("reportId");
        if (viewIdParam) {
            const parsedId = parseInt(viewIdParam, 10);
            if (!isNaN(parsedId) && parsedId !== selectedViewId) {
                setSelectedViewId(parsedId);
                setIsManualSelection(false); // URL restoration is not a manual selection
            }
        }
        // Don't clear selectedViewId if URL param is removed - let default view mechanism work
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // Handle delete view
    const handleDeleteView = useCallback(
        async (viewId: number) => {
            try {
                const response = await apiFetch(`/api/reports/${viewId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.report?.is_system) {
                        showError(
                            t("reports.messages.cannot_delete_system_report", {
                                defaultValue: "System views cannot be deleted",
                            })
                        );
                        return;
                    }
                    const viewName = data.report?.name || "";
                    setDeleteConfirmation({
                        isOpen: true,
                        viewId,
                        viewName,
                    });
                }
            } catch (error) {
                setDeleteConfirmation({
                    isOpen: true,
                    viewId,
                    viewName: "",
                });
            }
        },
        [showError, t]
    );

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteConfirmation.viewId) return;

        try {
            const response = await apiFetch(`/api/reports/${deleteConfirmation.viewId}`,
                {
                    method: "DELETE",
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to delete view");
            }

            if (selectedViewId === deleteConfirmation.viewId) {
                setSelectedViewId(null);
            }

            await queryClient.invalidateQueries({
                queryKey: ["reports-list"],
            });

            setDeleteConfirmation({
                isOpen: false,
                viewId: null,
                viewName: null,
            });
            success(
                t("reports.messages.delete_report_success", {
                    defaultValue: "View deleted successfully",
                })
            );
        } catch (error) {
            showError(
                error instanceof Error
                    ? error.message
                    : t("reports.messages.delete_report_error", {
                        defaultValue: "Failed to delete view",
                    })
            );
        }
    }, [
        deleteConfirmation,
        selectedViewId,
        queryClient,
        success,
        showError,
        t,
    ]);

    const handleCancelDelete = useCallback(() => {
        setDeleteConfirmation({
            isOpen: false,
            viewId: null,
            viewName: null,
        });
    }, []);

    // Actions menu handlers
    const handleActionsMenuClose = useCallback(() => {
        setMenuPosition(null);
    }, []);

    const handleMassSendEmail = useCallback(() => {
        handleActionsMenuClose();
        setIsMassSendEmailModalOpen(true);
    }, [handleActionsMenuClose]);

    const handleMassUpdateCategory = useCallback(() => {
        handleActionsMenuClose();
        setIsMassUpdateModalOpen(true);
    }, [handleActionsMenuClose]);

    // Handle share view
    const handleShareView = useCallback(
        async (viewId: number) => {
            try {
                const response = await apiFetch(`/api/reports/${viewId}`);
                if (response.ok) {
                    const data = await response.json();
                    const report = data.report;
                    if (report?.is_system) {
                        showError(
                            t("reports.messages.cannot_share_system_report", {
                                defaultValue: "System reports cannot be shared",
                            })
                        );
                        return;
                    }
                    setShareModalState({
                        isOpen: true,
                        reportId: viewId,
                        reportName: report?.name || "",
                    });
                } else {
                    showError(
                        t("reports.messages.error_fetching_data", {
                            defaultValue: "Error fetching report data",
                        })
                    );
                }
            } catch (error) {
                showError(
                    error instanceof Error
                        ? error.message
                        : t("reports.messages.error_fetching_data", {
                            defaultValue: "Error fetching report data",
                        })
                );
            }
        },
        [showError, t]
    );

    // Custom buttons component (without bulk action)
    const CustomButtonsComponent = useMemo(() => {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: theme.spacing(2),
                    alignItems: "center",
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                {hasCreateCustomerPermission && (
                    <Tooltip
                        title={t("actions.add_customer", { ns: "customers" })}
                        arrow
                        enterDelay={300}
                        leaveDelay={100}
                        placement="bottom"
                        PopperProps={{
                            sx: {
                                "& .MuiTooltip-tooltip": {
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
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
                            color="primary"
                            size="small"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push("/app/customers/new");
                            }}
                            className="toolbar-button"
                        >
                            <GroupAdd />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
        );
    }, [hasCreateCustomerPermission, theme, i18n.language, t, router]);

    // Bulk action button component
    const BulkActionButtonComponent = useMemo(
        () => (
            <BulkActionButton
                selectedRowsCount={selectedRows.length}
                onClick={(event) => {
                    // Use event.currentTarget to get the button element directly
                    // This avoids fragile DOM queries that break in production builds
                    // (data-testid attributes are stripped in production)
                    const buttonElement = event.currentTarget;
                    const rect = buttonElement.getBoundingClientRect();
                    const position = {
                        top: rect.bottom + window.scrollY,
                        left: i18n.language === "he"
                            ? rect.right + window.scrollX  // For RTL: align right edge of menu with right edge of button
                            : rect.left + window.scrollX,  // For LTR: align left edge of menu with left edge of button
                    };
                    setMenuPosition(position);
                }}
            />
        ),
        [selectedRows.length, i18n.language]
    );

    return (
        <InternalPageWrapper>
            <Box
                sx={{
                    bgcolor: "background.default",
                    borderRadius: theme.shape.borderRadius,
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minHeight: 0,
                }}
            >
                {/* Header Section */}
                <PageHeader
                    title={t("sections.title")}
                    description={t("sections.description")}
                />

                {/* Stats Section */}
                <AccountStatsComponent
                    statsData={statsData}
                    statsLoading={statsLoading}
                />

                {/* Virtual Grid - mount only after stats have loaded so viewport height is correct */}
                {statsLoading ? (
                    <Box
                        sx={{
                            minHeight: 400,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "background.paper",
                            borderRadius: 1,
                        }}
                    >
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box
                        ref={tableContainerRef}
                        sx={{
                            position: "relative",
                            isolation: "isolate",
                            flex: 1,
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            // Override toolbar alignment to ensure view dropdown aligns with custom buttons
                            "& .endless-scroll-toolbar": {
                                "& > div:first-of-type": {
                                    // Left section containing report selector and custom buttons
                                    display: "flex",
                                    alignItems: "center",
                                    "& > div:first-of-type": {
                                        // Report selector container
                                        display: "flex",
                                        alignItems: "center",
                                        "& .MuiAutocomplete-root": {
                                            display: "flex",
                                            alignItems: "center",
                                            "& .MuiOutlinedInput-root": {
                                                display: "flex",
                                                alignItems: "center",
                                            },
                                        },
                                    },
                                },
                            },
                        }}
                    >
                        <ViewBasedDataGrid
                            context="customers"
                            searchValue={search}
                            onSearchChange={setSearch}
                            customButtons={CustomButtonsComponent}
                            bulkActionButton={BulkActionButtonComponent}
                            defaultViewId={(() => {
                                // Only pass defaultViewId if it came from URL (not a manual selection)
                                // This allows the default view query to run and detect changes
                                return !isManualSelection && selectedViewId
                                    ? selectedViewId
                                    : undefined;
                            })()}
                            onViewChange={(viewId) => {
                                setSelectedViewId(viewId);
                                // Mark as manual selection when user explicitly changes the view
                                if (viewId !== null) {
                                    setIsManualSelection(true);
                                } else {
                                    setIsManualSelection(false);
                                }
                            }}
                            exportDisabled={false}
                            selectedRows={selectedRows}
                            onSelectedRowsChange={(newSelection) => {
                                setSelectedRows(newSelection);
                            }}
                            onRowsChange={setRows}
                            onDeleteView={handleDeleteView}
                            onShareView={handleShareView}
                            enableMultiSelect={true}
                            viewportRecalcDependency={
                                statsLoading ? "loading" : "ready"
                            }
                            hideCollectionCategoryDisplay={
                                isCreditOnlyAccountUser
                            }
                        />
                    </Box>
                )}

                {/* Actions Menu */}
                {menuPosition && (
                    <Popover
                        open={Boolean(menuPosition)}
                        onClose={handleActionsMenuClose}
                        anchorReference="anchorPosition"
                        anchorPosition={menuPosition}
                        anchorOrigin={{
                            vertical: "top",
                            horizontal:
                                i18n.language === "he" ? "right" : "left",
                        }}
                        transformOrigin={{
                            vertical: "top",
                            horizontal:
                                i18n.language === "he" ? "right" : "left",
                        }}
                        PaperProps={{
                            sx: {
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                                minWidth: 220,
                                mt: 0.5,
                            },
                        }}
                    >
                        <MenuItem onClick={handleMassSendEmail}>
                            <ListItemIcon>
                                <EmailIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>
                                {t("actions.mass_send_email", {
                                    ns: "activities",
                                })}
                            </ListItemText>
                        </MenuItem>
                        {!isCreditOnlyAccountUser ? (
                            <MenuItem onClick={handleMassUpdateCategory}>
                                <ListItemIcon>
                                    <Category fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>
                                    {t("actions.mass_update_category", {
                                        ns: "activities",
                                    })}
                                </ListItemText>
                            </MenuItem>
                        ) : null}
                    </Popover>
                )}

                {/* Mass Send Email Modal */}
                <MassSendEmailModal
                    isOpen={isMassSendEmailModalOpen}
                    closeModal={() => setIsMassSendEmailModalOpen(false)}
                    selectedRows={rows.filter((row) =>
                        selectedRows.includes(row.id)
                    )}
                    onUpdateComplete={handleMassSendEmailComplete}
                />

                {/* Mass Update Category Modal */}
                <MassUpdateCategoryModal
                    isOpen={isMassUpdateModalOpen}
                    closeModal={() => setIsMassUpdateModalOpen(false)}
                    selectedRows={rows.filter((row) =>
                        selectedRows.includes(row.id)
                    )}
                    onUpdateComplete={handleMassUpdateComplete}
                />

                {/* Share Report Modal */}
                {shareModalState.isOpen && shareModalState.reportId && (
                    <ShareReportModal
                        open={shareModalState.isOpen}
                        onClose={() =>
                            setShareModalState({
                                isOpen: false,
                                reportId: null,
                                reportName: "",
                            })
                        }
                        reportId={shareModalState.reportId}
                        reportName={shareModalState.reportName}
                        accountId={
                            (session?.user as any)?.view_as_user_account_id ||
                            session?.user?.account_id ||
                            0
                        }
                    />
                )}

                {/* Delete View Confirmation Dialog */}
                <DeleteDialog
                    isOpen={deleteConfirmation.isOpen}
                    onClose={handleCancelDelete}
                    onConfirm={handleConfirmDelete}
                    title={t("reports.actions.delete_report", {
                        defaultValue: "Delete View",
                    })}
                    description={
                        deleteConfirmation.viewName
                            ? t("reports.messages.delete_report_confirmation", {
                                defaultValue:
                                    "Are you sure you want to delete this view?",
                            }) + ` "${deleteConfirmation.viewName}"?`
                            : t("reports.messages.delete_report_confirmation", {
                                defaultValue:
                                    "Are you sure you want to delete this view?",
                            })
                    }
                    confirmLabel={t("actions.delete", { ns: "common" })}
                    cancelLabel={t("actions.cancel", { ns: "common" })}
                    type="delete"
                    locale={i18n.language}
                />
            </Box>
        </InternalPageWrapper>
    );
};

export default CustomerList;
