"use client";
import { apiFetch } from "@/utils/apiFetch";

import RestoreIcon from "@mui/icons-material/Restore";
import SaveIcon from "@mui/icons-material/Save";
import { Box, Button, Divider, Tooltip } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import React, { useCallback, useMemo, useState } from "react";

import { customerDashboardKpisQueryKey } from "@/app/[locale]/app/customers/[customerId]/customerDashboardKpisQuery";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    customerCheckpointQueryKey,
    fetchCustomerCheckpointStatus,
    restoreCustomerCheckpoint,
    saveCustomerCheckpoint,
} from "@/shared/services/customerCheckpointService";
import {
    formatDateForDisplay,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";

interface CustomerCheckpointActionsProps {
    customerId: number;
    customerAccountId: number;
    onAfterRestore?: () => void;
}

const isNonProduction =
    typeof process !== "undefined" && process.env.NODE_ENV !== "production";

const CustomerCheckpointActions: React.FC<CustomerCheckpointActionsProps> = ({
    customerId,
    customerAccountId,
    onAfterRestore,
}) => {
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const { showToast } = useToast();
    const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);

    const { data: accountData } = useQuery({
        queryKey: ["account", customerAccountId, "checkpoint-flag"],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/accounts/${customerAccountId}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch account");
            }
            return response.json() as Promise<{
                enable_customer_checkpoints?: boolean;
            }>;
        },
        enabled: isNonProduction && customerAccountId > 0,
        staleTime: 60_000,
    });

    const showCheckpointActions =
        isNonProduction && accountData?.enable_customer_checkpoints === true;

    const { data: checkpointStatus } = useQuery({
        queryKey: customerCheckpointQueryKey(customerId),
        queryFn: () => fetchCustomerCheckpointStatus(customerId),
        enabled: showCheckpointActions,
        staleTime: 30_000,
    });

    const hasCheckpoint = checkpointStatus?.exists === true;

    const invalidateCustomerPageQueries = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: ["customer", customerId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["customerTimeLineData"],
            }),
            queryClient.invalidateQueries({
                queryKey: ["activityTimeline", { customer_id: customerId }],
            }),
            queryClient.invalidateQueries({
                queryKey: ["customerActivities", customerId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["customerDisputes", customerId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["open_dispute", customerId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["stuck_activities", customerId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["customer-top-ups", customerId],
            }),
            queryClient.invalidateQueries({
                queryKey: ["customer-banks-relationships", customerId],
            }),
            queryClient.invalidateQueries({
                queryKey: customerDashboardKpisQueryKey(
                    customerId,
                    customerAccountId,
                    null
                ),
            }),
            queryClient.invalidateQueries({
                queryKey: ["view-execution"],
            }),
        ]);
    }, [customerAccountId, customerId, queryClient]);

    const saveMutation = useMutation({
        mutationFn: () => saveCustomerCheckpoint(customerId),
        onSuccess: async () => {
            showToast("Checkpoint saved", "success");
            await queryClient.invalidateQueries({
                queryKey: customerCheckpointQueryKey(customerId),
            });
        },
        onError: (error: Error) => {
            showToast(error.message, "error");
        },
    });

    const restoreMutation = useMutation({
        mutationFn: () => restoreCustomerCheckpoint(customerId),
        onSuccess: async () => {
            showToast("Checkpoint restored", "success");
            setIsRestoreDialogOpen(false);
            await invalidateCustomerPageQueries();
            onAfterRestore?.();
        },
        onError: (error: Error) => {
            showToast(error.message, "error");
        },
    });

    const formattedSavedAt = useMemo(() => {
        if (!checkpointStatus?.savedAt) {
            return null;
        }
        return formatDateForDisplay(
            checkpointStatus.savedAt,
            "datetime",
            getUserDateLocale(session),
            getUserTimezone(session)
        );
    }, [checkpointStatus?.savedAt, session]);

    const restoreDialogDescription = useMemo(() => {
        const parts = [
            "This will roll back invoices, payments, activities, disputes, and related customer data to the last saved checkpoint.",
        ];
        if (formattedSavedAt) {
            parts.push(`Last saved: ${formattedSavedAt}`);
        }
        if (checkpointStatus?.savedBy) {
            parts.push(`Saved by user: ${checkpointStatus.savedBy}`);
        }
        return parts.join(" ");
    }, [checkpointStatus?.savedBy, formattedSavedAt]);

    if (!showCheckpointActions) {
        return null;
    }

    return (
        <>
            <Divider
                orientation="vertical"
                flexItem
                sx={{
                    alignSelf: "center",
                    height: 20,
                    mx: 0.25,
                }}
            />
            <Box
                sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.5,
                    flexShrink: 0,
                }}
            >
                <Tooltip title="Save current customer state as a checkpoint">
                    <span>
                        <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                            disabled={saveMutation.isPending}
                            onClick={() => saveMutation.mutate()}
                            sx={{
                                fontSize: "0.7rem",
                                height: 24,
                                minWidth: 0,
                                px: 1,
                                whiteSpace: "nowrap",
                            }}
                        >
                            Save checkpoint
                        </Button>
                    </span>
                </Tooltip>
                <Tooltip
                    title={
                        hasCheckpoint
                            ? "Restore the last saved checkpoint"
                            : "Save a checkpoint first"
                    }
                >
                    <span>
                        <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            startIcon={<RestoreIcon sx={{ fontSize: 16 }} />}
                            disabled={
                                !hasCheckpoint || restoreMutation.isPending
                            }
                            onClick={() => setIsRestoreDialogOpen(true)}
                            sx={{
                                fontSize: "0.7rem",
                                height: 24,
                                minWidth: 0,
                                px: 1,
                                whiteSpace: "nowrap",
                            }}
                        >
                            Restore checkpoint
                        </Button>
                    </span>
                </Tooltip>
            </Box>

            <DeleteDialog
                isOpen={isRestoreDialogOpen}
                onClose={() => setIsRestoreDialogOpen(false)}
                onConfirm={() => restoreMutation.mutate()}
                title="Restore checkpoint"
                description={restoreDialogDescription}
                confirmLabel="Restore"
                cancelLabel="Cancel"
                isLoading={restoreMutation.isPending}
                type="warning"
                maxWidth="sm"
            />
        </>
    );
};

export default CustomerCheckpointActions;
