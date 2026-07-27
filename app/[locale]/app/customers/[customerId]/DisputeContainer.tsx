"use client";

import {
    Edit as EditIcon,
    ExpandMore as ExpandMoreIcon,
    PersonAdd as PersonAddIcon,
} from "@mui/icons-material";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Avatar,
    Box,
    Button,
    Chip,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
    useQueries,
    useQuery,
    useQueryClient,
    UseQueryResult,
} from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import ConfirmResolutionDialog from "@/shared/layout-components/modal/ConfirmResolutionDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    fetchOpenDispute,
    fetchUsers,
} from "@/shared/services/customerService";
import { Customer } from "@/types/Customer";
import { OpenDisputeResponse } from "@/types/CustomerDispute";
import { UserResponse } from "@/types/User";

import AssignUserModel from "./AssignUserModel";
import UpdateResolutionModal from "./UpdateResolutionModal";

interface Dispute {
    id: number;
    dispute_status: string;
    DisputeReason?: { name: string };
    dispute_resolution?: string;
    owner_id?: string;
    invoices?: Array<{ invoice_number: string }>;
    customer_comment?: string;
    contact_first_name?: string;
    contact_last_name?: string;
    contact_email?: string;
    contact_mobile?: string;
    resolution_comment?: string;
}

interface ApiUrls {
    disputes: {
        get: string;
        resolve: (_customerId: number, _disputeId: number) => string;
        updateStatus: (_customerId: number, _disputeId: number) => string;
    };
}

const API_URLS: ApiUrls = {
    disputes: {
        get: "/operations/disputes",
        resolve: (customerId: number, disputeId: number) =>
            `/entities/customers/${customerId}/disputes/${disputeId}/resolve-dispute`,
        updateStatus: (customerId: number, disputeId: number) =>
            `/entities/customers/${customerId}/disputes/${disputeId}/update-status`,
    },
};

interface UserOption {
    value: string;
    label: string;
}

interface DisputeResolutionOption {
    value: string;
    label: string;
}

interface DisputeContainerProps {
    customer: Customer;
    refreshTimeline: () => void;
    isActive?: boolean;
    refreshTrigger?: number;
}

// Custom ReadOnlyField component using MUI
const ReadOnlyField: React.FC<{ label: string; value?: string | null }> = ({
    label,
    value,
}) => (
    <Box sx={{ mb: 1.5 }}>
        <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            gutterBottom
            sx={{
                fontWeight: 600,
                fontSize: "0.75rem",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                mb: 0.5,
            }}
        >
            {label}
        </Typography>
        <Typography
            variant="body2"
            color="text.primary"
            sx={{
                fontWeight: 500,
                fontSize: "0.875rem",
                lineHeight: 1.4,
                minHeight: "1.2em",
            }}
        >
            {value || "-"}
        </Typography>
    </Box>
);

const DisputeContainer: React.FC<DisputeContainerProps> = ({
    customer,
    refreshTimeline,
    isActive = false,
    refreshTrigger = 0,
}) => {
    const { t, i18n } = useTranslation(["disputes", "common"]);
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const theme = useTheme();
    const cardBorderRadius = theme.appButton.borderRadius;

    // Fetch user permissions to check for assign_dispute permission
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await api.get("/permissions/me");
            return response.data;
        },
        enabled: !!session?.user?.id,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasAssignDisputePermission =
        userPermissions.includes("assign_dispute");
    const hasResolveDisputePermission =
        userPermissions.includes("resolve_dispute");
    const [expandedDisputeId, setExpandedDisputeId] = useState<number | null>(
        null
    );
    const [selectedDisputeId, setSelectedDisputeId] = useState<number | null>(
        null
    );
    const [isAssignUserModalOpen, setIsAssignUserModalOpen] = useState(false);
    const [isUpdateResolutionModalOpen, setIsUpdateResolutionModalOpen] =
        useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [disputeResolution, setDisputeResolution] = useState<string | null>(
        null
    );
    const [isUpdatingStatus, setIsUpdatingStatus] = useState<number | null>(
        null
    ); // Track which dispute is being updated
    const [isResolvingDispute, setIsResolvingDispute] = useState(false); // Track if resolving dispute
    const [confirmDialogError, setConfirmDialogError] = useState<string | null>(
        null
    );
    const searchParams = useSearchParams();
    const processedDisputes = useRef<Set<number>>(new Set()); // Track which disputes have been processed for auto-status update


    // Get user's language for query key to ensure fresh data when language changes
    const userLanguage = session?.user?.language || "English";

    const { data, isLoading, refetch, error } = useQuery({
        queryKey: ["customerDisputes", customer.id, userLanguage],
        queryFn: () =>
            api
                .get(API_URLS.disputes.get, {
                    params: {
                        customer_id: customer.id,
                        sortField: "id",
                        sortDirection: "asc",
                    },
                })
                .then((res) => res.data),
        enabled: !!customer.id,
        staleTime: 0, // Always consider data stale to ensure fresh data
    });

    // Centralized function to handle "Under Review" status updates
    const handleUnderReviewStatusUpdate = useCallback(
        async (disputeId: number) => {
            // Prevent duplicate calls
            if (
                isUpdatingStatus === disputeId ||
                processedDisputes.current.has(disputeId)
            ) {
                return;
            }

            try {
                // Check if status is already "Under_Review"
                const currentDispute = data?.disputes?.find(
                    (d: Dispute) => d.id === disputeId
                );
                if (
                    currentDispute &&
                    currentDispute.dispute_status === "Under_Review"
                ) {
                    return; // Already in "Under_Review" status
                }

                setIsUpdatingStatus(disputeId);
                processedDisputes.current.add(disputeId);

                await api.put(
                    API_URLS.disputes.updateStatus(customer.id, disputeId),
                    {
                        dispute_status: "Under_Review",
                    }
                );

                showToast(
                    t("messages.status_status_updated_successfully"),
                    "success"
                );

                // Refresh data
                await refetch();
                refreshTimeline();
            } catch (error) {
                console.error(
                    "Error updating dispute status to Under Review:",
                    error
                );
                showToast(
                    error instanceof Error
                        ? error.message
                        : t("messages.status_failed_to_update_status"),
                    "error"
                );
                // Remove from processed set on error so it can be retried
                processedDisputes.current.delete(disputeId);
            } finally {
                setIsUpdatingStatus(null);
            }
        },
        [
            data?.disputes,
            isUpdatingStatus,
            customer.id,
            showToast,
            t,
            refetch,
            refreshTimeline,
        ]
    );

    // Refresh mechanism - invalidate queries when refreshTrigger changes
    useEffect(() => {
        if (
            refreshTrigger !== undefined &&
            refreshTrigger !== null &&
            customer?.id
        ) {
            // Invalidate all relevant dispute queries
            queryClient.invalidateQueries({
                queryKey: ["customerDisputes", customer.id],
            });
            queryClient.invalidateQueries({
                queryKey: ["open_dispute", customer.id],
                exact: false, // Invalidate all queries that start with this key (including language variants)
            });

            // Also refetch the current data
            refetch();
        }
    }, [refreshTrigger, customer?.id, queryClient, refetch]);

    useEffect(() => {
        const openDisputeId = searchParams?.get("openDispute");
        if (openDisputeId && data?.disputes) {
            const disputeId = parseInt(openDisputeId, 10);
            setExpandedDisputeId(disputeId);

            const dispute = data.disputes.find(
                (d: Dispute) => d.id === disputeId
            );
            if (dispute && dispute.dispute_status === "New") {
                handleUnderReviewStatusUpdate(disputeId);
            }
        }
    }, [searchParams, data?.disputes, handleUnderReviewStatusUpdate]);

    // Clean up processed disputes when customer changes
    useEffect(() => {
        processedDisputes.current.clear();
    }, [customer?.id]);

    // Create resolution options with fallback values to ensure they're always available
    const getGeneralDisputeResolutionOptions =
        (): DisputeResolutionOption[] => [
            {
                value: "Denied",
                label: t("values.status_denied") || "Denied",
            },
            {
                value: "Cancelled",
                label: t("values.status_cancelled") || "Cancelled",
            },
            {
                value: "Accepted_Settled_partly",
                label:
                    t("values.status_accepted_settled_partly") ||
                    "Accepted, Settled Partly",
            },
            {
                value: "Accepted_Settled_in_full",
                label:
                    t("values.status_accepted_settled_in_full") ||
                    "Accepted, Settled in Full",
            },
            {
                value: "Admin_Fixed_Balance_Unchanged",
                label:
                    t("values.status_admin_fixed_balance_unchanged") ||
                    "Admin Fixed – Balance Unchanged",
            },
        ];

    const getContactDisputeResolutionOptions =
        (): DisputeResolutionOption[] => [
            {
                value: "Denied",
                label: t("values.status_denied") || "Denied",
            },
            {
                value: "Cancelled",
                label: t("values.status_cancelled") || "Cancelled",
            },
            {
                value: "Accepted",
                label: t("values.status_accepted") || "Accepted",
            },
        ];

    const refreshData = async () => {
        // Call refreshTimeline to trigger parent component refresh
        refreshTimeline();

        // Invalidate all relevant queries for comprehensive refresh
        await queryClient.invalidateQueries({
            queryKey: ["customer", `${customer?.id}`],
        });
        await queryClient.invalidateQueries({
            queryKey: ["customerDisputes", customer?.id],
        });

        // Also invalidate timeline-related queries to ensure ActivityTimeline refreshes
        await queryClient.invalidateQueries({
            queryKey: ["customerTimeLineData"],
        });
        await queryClient.invalidateQueries({
            queryKey: ["activityTimeline", { customer_id: customer?.id }],
        });
        await queryClient.invalidateQueries({
            queryKey: ["customerActivities", customer?.id],
        });

        // Refetch the current disputes data
        await refetch();
    };

    const makeApiCall = async (
        endpoint: string,
        method: string,
        body: object,
        params?: Record<string, any>
    ) => {
        try {
            const response = await api({
                method,
                url: endpoint,
                data: body,
                params,
            });
            return { success: true, data: response.data };
        } catch (error) {
            console.error(t("messages.messages_api_call_failed"), error);
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : t("messages.messages_api_call_failed"),
            };
        }
    };

    const handleAction = async () => {
        const errors: { [key: string]: string } = {};

        if (!disputeResolution) {
            setConfirmDialogError(t("messages.resolution_resolution_required"));
            return;
        }

        setConfirmDialogError(null);

        if (!isModalOpen && !selectedDisputeId) {
            setIsModalOpen(true);
            return;
        }

        // Prevent duplicate submissions
        if (isResolvingDispute) {
            return;
        }

        setIsResolvingDispute(true);

        if (!selectedDisputeId) return;

        try {
            await api.put(
                API_URLS.disputes.resolve(customer.id, selectedDisputeId),
                {
                    dispute_status: "Resolved",
                    dispute_resolution: disputeResolution,
                    dispute_comment: disputeResolution || "Resolution updated",
                }
            );
            showToast(
                t("messages.messages_dispute_saved_successfully"),
                "success"
            );
            refreshData();
        } catch (error) {
            console.error(
                t("messages.messages_failed_to_update_dispute"),
                error
            );
            showToast(
                error instanceof Error
                    ? error.message
                    : t("messages.messages_failed_to_update_dispute"),
                "error"
            );
        } finally {
            setIsResolvingDispute(false);
            setIsModalOpen(false);
        }
    };

    // Fetch data with useQueries (using userLanguage from above)
    const results = useQueries({
        queries: [
            {
                queryKey: ["open_dispute", customer.id, userLanguage],
                queryFn: fetchOpenDispute,
                enabled: !!customer.id && isActive,
                refetchOnWindowFocus: false,
                staleTime: 0, // Always consider data stale to ensure fresh data
                retry: 3,
            },
            {
                queryKey: [
                    "users",
                    customer.account_id,
                    "Active",
                    1,
                    50,
                    customer.business_unit_id ?? null,
                ],
                queryFn: fetchUsers,
                enabled: !!customer.account_id && isActive,
                refetchOnWindowFocus: false,
                retry: 3,
            },
        ],
    });

    const [openDisputeResult, usersResult] = results as [
        UseQueryResult<OpenDisputeResponse, Error>,
        UseQueryResult<UserResponse, Error>,
    ];

    useEffect(() => {
        const unresolvedDisputes = openDisputeResult.data?.disputes || [];
        // Use the first unresolved dispute's resolution if available
        const firstDispute = unresolvedDisputes[0];
        if (firstDispute) {
            setDisputeResolution(firstDispute.dispute_resolution);
        } else {
            setDisputeResolution(null);
        }
    }, [openDisputeResult.data]);

    // Handle users data
    const userList = usersResult.data?.users || [];
    const users: UserOption[] = userList.map((user) => ({
        value: user.id,
        label: `${user.first_name || ""} ${user.last_name || ""}`,
    }));

    // Handle dispute card expansion
    const handleDisputeCardExpand = async (
        disputeId: number,
        currentStatus: string
    ) => {
        // If the dispute is in "New" status, update it to "Under_Review"
        if (currentStatus === "New") {
            await handleUnderReviewStatusUpdate(disputeId);
        }

        // Toggle expansion state
        setExpandedDisputeId(
            expandedDisputeId === disputeId ? null : disputeId
        );
    };

    if (isLoading) {
        return null;
    }

    if (error) {
        return (
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="200px"
            >
                <Typography color="error" variant="h6">
                    {t("messages.no_disputes_found")}
                </Typography>
            </Box>
        );
    }

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
            }}
        >
            <Stack spacing={2}>
                {data?.disputes
                    ?.sort((a: Dispute, b: Dispute) => a.id - b.id)
                    ?.map((dispute: Dispute) => {
                        const isExpanded = expandedDisputeId === dispute.id;
                        const isContactDispute =
                            dispute.DisputeReason?.name ===
                            "I am not working there anymore" ||
                            dispute.DisputeReason?.name ===
                            "Not the right contact person in the company" ||
                            dispute.DisputeReason?.name ===
                            "Contact Information Issue";

                        const assignedUser = users.find(
                            (u: any) => u.value === dispute.owner_id
                        );
                        const userInitials = assignedUser?.label
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase();

                        return (
                            <Accordion
                                key={dispute.id}
                                expanded={isExpanded}
                                onChange={async (event, newExpandedState) => {
                                    // Handle status update if needed (only when expanding)
                                    if (newExpandedState && dispute.dispute_status === "New") {
                                        await handleUnderReviewStatusUpdate(dispute.id);
                                    }
                                    // Update expansion state
                                    setExpandedDisputeId(
                                        newExpandedState ? dispute.id : null
                                    );
                                }}
                                sx={{
                                    mb: { xs: 1, sm: 1.5 },
                                    width: "100%",
                                    minWidth: { xs: "350px", sm: "350px" },
                                    maxWidth: "100%",
                                    boxShadow: "none",
                                    border: 1,
                                    borderColor: "divider",
                                    overflow: "hidden", // Ensure border radius is visible
                                    "&:before": {
                                        display: "none", // Remove default accordion divider
                                    },
                                    borderRadius: `${cardBorderRadius}px !important`,
                                    "& .MuiAccordionSummary-root": {
                                        borderRadius: "inherit !important",
                                    },
                                    "&.Mui-expanded": {
                                        mb: { xs: 1, sm: 1.5 },
                                    },
                                    "& .MuiAccordionDetails-root": {
                                        borderRadius: `0 0 ${cardBorderRadius}px ${cardBorderRadius}px !important`,
                                        overflow: "hidden",
                                    },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "primary.main",
                                                "& .MuiSvgIcon-root": {
                                                    fontSize: "1.25rem",
                                                },
                                            }}
                                        >
                                            <ExpandMoreIcon />
                                        </Box>
                                    }
                                    sx={{
                                        py: 1,
                                        px: 1.5,
                                        minHeight: "auto", // Prevent height change on expand
                                        overflow: "hidden", // Ensure border radius is visible
                                        "&:not(.Mui-expanded)": {
                                            borderRadius: `${cardBorderRadius}px !important`,
                                        },
                                        "&.Mui-expanded": {
                                            minHeight: "auto",
                                            borderTopLeftRadius: `${cardBorderRadius}px !important`,
                                            borderTopRightRadius: `${cardBorderRadius}px !important`,
                                            borderBottomLeftRadius: "0 !important",
                                            borderBottomRightRadius: "0 !important",
                                        },
                                        "&:hover": {
                                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                            transition:
                                                "background-color 0.2s ease",
                                        },
                                        "& .MuiAccordionSummary-content": {
                                            margin: 0,
                                            alignItems: "center",
                                            "&.Mui-expanded": {
                                                margin: 0, // Keep margin consistent
                                            },
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1.5,
                                            flex: 1,
                                            minWidth: 0,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                flex: 1,
                                                minWidth: 0,
                                            }}
                                        >
                                            <Typography
                                                variant="h6"
                                                component="span"
                                                sx={{
                                                    fontWeight: 500,
                                                    fontSize: { xs: "1rem", sm: "1.25rem" },
                                                    color: "text.primary",
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {t(
                                                    "fields.details_dispute"
                                                )}{" "}
                                                #{dispute.id}
                                            </Typography>
                                            <Chip
                                                label={t(
                                                    `values.dispute_status_${(dispute.dispute_status || "").toLowerCase()}`,
                                                    {
                                                        defaultValue:
                                                            dispute.dispute_status,
                                                    }
                                                )}
                                                color={
                                                    dispute.dispute_status ===
                                                        "Resolved"
                                                        ? "success"
                                                        : "warning"
                                                }
                                                size="small"
                                                variant="filled"
                                                sx={{
                                                    fontWeight: 600,
                                                    fontSize: "0.7rem",
                                                    height: "20px",
                                                    "& .MuiChip-label": {
                                                        px: 1,
                                                        fontSize: "0.7rem",
                                                    },
                                                }}
                                            />
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 1,
                                                flexShrink: 0,
                                            }}
                                        >
                                            {dispute.owner_id && (
                                                <Tooltip
                                                    title={
                                                        assignedUser?.label ||
                                                        t(
                                                            "fields.assignment_unassigned"
                                                        )
                                                    }
                                                >
                                                    <Avatar
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            fontSize: "0.8rem",
                                                            fontWeight: 600,
                                                            bgcolor:
                                                                "primary.main",
                                                            color: "white",
                                                            border: 2,
                                                            borderColor:
                                                                "background.paper",
                                                            boxShadow: "none",
                                                        }}
                                                    >
                                                        {userInitials}
                                                    </Avatar>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails
                                    sx={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        px: 2,
                                        pb: 2,
                                        borderRadius: `0 0 ${cardBorderRadius}px ${cardBorderRadius}px`,
                                        overflow: "hidden", // Ensure border radius is visible
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 1,
                                        }}
                                    >
                                        {/* Assigned User Row */}
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent:
                                                    "space-between",
                                                alignItems: "flex-start",
                                            }}
                                        >
                                            <Box sx={{ flex: 1 }}>
                                                <ReadOnlyField
                                                    label={t(
                                                        "fields.assignment_assigned_user"
                                                    )}
                                                    value={
                                                        assignedUser?.label ||
                                                        t(
                                                            "fields.assignment_unassigned"
                                                        )
                                                    }
                                                />
                                            </Box>
                                            <Tooltip
                                                title={
                                                    hasAssignDisputePermission
                                                        ? t(
                                                            "actions.assignment_assign_user"
                                                        )
                                                        : t(
                                                            "messages.no_permission_to_assign_dispute",
                                                            {
                                                                ns: "disputes",
                                                                defaultValue:
                                                                    "You do not have permission to assign disputes",
                                                            }
                                                        )
                                                }
                                            >
                                                <span>
                                                    <IconButton
                                                        color="primary"
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDisputeId(
                                                                dispute.id
                                                            );
                                                            setIsAssignUserModalOpen(
                                                                true
                                                            );
                                                        }}
                                                        disabled={
                                                            !hasAssignDisputePermission
                                                        }
                                                        className="toolbar-button"
                                                        sx={{
                                                            opacity:
                                                                hasAssignDisputePermission
                                                                    ? 1
                                                                    : 0.5,
                                                        }}
                                                    >
                                                        <PersonAddIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Box>

                                        {/* Dispute Reason */}
                                        <ReadOnlyField
                                            label={t(
                                                "fields.details_dispute_reason"
                                            )}
                                            value={
                                                dispute.DisputeReason?.name
                                            }
                                        />

                                        {/* Invoices/Contact fields */}
                                        {!isContactDispute && (
                                            <ReadOnlyField
                                                label={t(
                                                    "fields.details_invoices"
                                                )}
                                                value={
                                                    Array.isArray(
                                                        dispute.invoices
                                                    )
                                                        ? dispute.invoices
                                                            .map(
                                                                (
                                                                    inv: any
                                                                ) =>
                                                                    inv.invoice_number
                                                            )
                                                            .join(", ")
                                                        : t(
                                                            "fields.details_no_invoices_found"
                                                        )
                                                }
                                            />
                                        )}

                                        <ReadOnlyField
                                            label={t(
                                                "fields.details_dispute_comment"
                                            )}
                                            value={
                                                dispute.customer_comment ||
                                                t(
                                                    "fields.details_no_comment"
                                                )
                                            }
                                        />

                                        {isContactDispute && (
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: 2,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        flex: "1 1 200px",
                                                    }}
                                                >
                                                    <ReadOnlyField
                                                        label={t(
                                                            "fields.details_first_name"
                                                        )}
                                                        value={
                                                            dispute.contact_first_name
                                                        }
                                                    />
                                                </Box>
                                                <Box
                                                    sx={{
                                                        flex: "1 1 200px",
                                                    }}
                                                >
                                                    <ReadOnlyField
                                                        label={t(
                                                            "fields.details_last_name"
                                                        )}
                                                        value={
                                                            dispute.contact_last_name
                                                        }
                                                    />
                                                </Box>
                                                <Box
                                                    sx={{
                                                        flex: "1 1 200px",
                                                    }}
                                                >
                                                    <ReadOnlyField
                                                        label={t(
                                                            "fields.details_email"
                                                        )}
                                                        value={
                                                            dispute.contact_email
                                                        }
                                                    />
                                                </Box>
                                                <Box
                                                    sx={{
                                                        flex: "1 1 200px",
                                                    }}
                                                >
                                                    <ReadOnlyField
                                                        label={t(
                                                            "fields.details_mobile"
                                                        )}
                                                        value={
                                                            dispute.contact_mobile
                                                        }
                                                    />
                                                </Box>
                                            </Box>
                                        )}

                                        {/* Resolution Row */}
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent:
                                                    "space-between",
                                                alignItems: "flex-start",
                                            }}
                                        >
                                            <Box sx={{ flex: 1 }}>
                                                <ReadOnlyField
                                                    label={t(
                                                        "fields.resolution_resolution"
                                                    )}
                                                    value={
                                                        dispute.dispute_resolution
                                                            ? t(
                                                                `values.status_${dispute.dispute_resolution.toLowerCase().replace(/[\s-]+/g, "_")}`,
                                                                {
                                                                    defaultValue:
                                                                        dispute.dispute_resolution,
                                                                }
                                                            )
                                                            : ""
                                                    }
                                                />
                                            </Box>
                                            <Tooltip
                                                title={
                                                    hasResolveDisputePermission
                                                        ? t(
                                                            "actions.resolution_update_resolution"
                                                        )
                                                        : t(
                                                            "messages.no_permission_to_resolve_dispute",
                                                            {
                                                                ns: "disputes",
                                                                defaultValue:
                                                                    "You do not have permission to resolve disputes",
                                                            }
                                                        )
                                                }
                                            >
                                                <span>
                                                    <IconButton
                                                        color="primary"
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDisputeId(
                                                                dispute.id
                                                            );
                                                            setIsUpdateResolutionModalOpen(
                                                                true
                                                            );
                                                        }}
                                                        disabled={
                                                            !hasResolveDisputePermission
                                                        }
                                                        className="toolbar-button"
                                                        sx={{
                                                            opacity:
                                                                hasResolveDisputePermission
                                                                    ? 1
                                                                    : 0.5,
                                                        }}
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Box>

                                        <ReadOnlyField
                                            label={t(
                                                "fields.resolution_resolution_comment"
                                            )}
                                            value={
                                                dispute.resolution_comment ||
                                                t(
                                                    "fields.details_no_comment"
                                                )
                                            }
                                        />

                                        {/* Resolve Dispute Button */}
                                        <Box
                                            sx={{
                                                display: "flex",
                                                justifyContent: "flex-end",
                                            }}
                                        >
                                            <Tooltip
                                                title={
                                                    hasResolveDisputePermission
                                                        ? t(
                                                            "actions.resolution_resolved_dispute"
                                                        )
                                                        : t(
                                                            "messages.no_permission_to_resolve_dispute",
                                                            {
                                                                ns: "disputes",
                                                                defaultValue:
                                                                    "You do not have permission to resolve disputes",
                                                            }
                                                        )
                                                }
                                            >
                                                <span>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDisputeId(
                                                                dispute.id
                                                            );
                                                            setConfirmDialogError(
                                                                null
                                                            );
                                                            setIsModalOpen(
                                                                true
                                                            );
                                                            setDisputeResolution(
                                                                dispute.dispute_resolution ||
                                                                null
                                                            );
                                                        }}
                                                        disabled={
                                                            dispute.dispute_status ===
                                                            "Resolved" ||
                                                            !hasResolveDisputePermission
                                                        }
                                                        fullWidth={false}
                                                        sx={{
                                                            opacity:
                                                                hasResolveDisputePermission
                                                                    ? 1
                                                                    : 0.5,
                                                            direction: i18n.language === "he" ? "rtl" : "ltr",
                                                        }}
                                                    >
                                                        {t(
                                                            "actions.resolution_resolved_dispute"
                                                        )}
                                                    </Button>
                                                </span>
                                            </Tooltip>
                                        </Box>
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        );
                    })}

                {/* Confirmation Dialog */}
                <ConfirmResolutionDialog
                    isOpen={isModalOpen}
                    onClose={() => {
                        if (!isResolvingDispute) {
                            setIsModalOpen(false);
                            setSelectedDisputeId(null);
                            setConfirmDialogError(null);
                        }
                    }}
                    onConfirm={async () => {
                        if (selectedDisputeId) {
                            await handleAction();
                        }
                    }}
                    title={t("messages.resolution_confirm_resolution")}
                    description={t(
                        "messages.resolution_confirm_resolution_message"
                    )}
                    confirmLabel={t("actions.save", { ns: "common" })}
                    cancelLabel={t("actions.cancel", { ns: "common" })}
                    isLoading={isResolvingDispute}
                    errorMessage={confirmDialogError || undefined}
                    maxWidth="sm"
                    locale={i18n.language}
                />

                <AssignUserModel
                    disputeId={selectedDisputeId}
                    refreshTimeline={() => {
                        refreshTimeline();
                        refetch();
                    }}
                    isModalOpen={isAssignUserModalOpen}
                    setIsModalOpen={setIsAssignUserModalOpen}
                    selectedUser={null}
                    users={users}
                    customerId={customer?.id ?? 0}
                />

                <UpdateResolutionModal
                    customerId={customer?.id ?? 0}
                    disputeId={selectedDisputeId}
                    isModalOpen={isUpdateResolutionModalOpen}
                    setIsModalOpen={setIsUpdateResolutionModalOpen}
                    disputeResolution={disputeResolution}
                    setDisputeResolution={(resolution: string) => {
                        setDisputeResolution(resolution);
                        refetch();
                        refreshTimeline();
                    }}
                    resolutionOptions={(() => {
                        // If no dispute is selected or data is not loaded, use general options
                        if (!selectedDisputeId || !data?.disputes) {
                            return getGeneralDisputeResolutionOptions();
                        }

                        const selectedDispute = data.disputes.find(
                            (d: any) => d.id === selectedDisputeId
                        );
                        if (!selectedDispute) {
                            return getGeneralDisputeResolutionOptions();
                        }

                        const disputeReasonName =
                            selectedDispute.DisputeReason?.name;

                        // Check if it's a contact-related dispute
                        if (
                            disputeReasonName ===
                            "I am not working there anymore" ||
                            disputeReasonName ===
                            "Not the right contact person in the company" ||
                            disputeReasonName === "Contact Information Issue"
                        ) {
                            return getContactDisputeResolutionOptions();
                        }

                        // Default to general options
                        return getGeneralDisputeResolutionOptions();
                    })()}
                />
            </Stack>
        </div>
    );
};

export default DisputeContainer;
