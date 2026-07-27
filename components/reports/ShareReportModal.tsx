"use client";

import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Group as GroupIcon, Person as PersonIcon, Share as ShareIcon, Visibility as ViewIcon } from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    Divider,
    FormControlLabel,
    IconButton,
    Radio,
    RadioGroup,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface ShareReportModalProps {
    open: boolean;
    onClose: () => void;
    reportId: number;
    reportName: string;
    accountId: number;
}

interface Share {
    id: number;
    shared_with_user_id?: string;
    shared_with_role?: string;
    permission: "view" | "edit";
    created_at: string;
    User_ReportShare_shared_with_user_idToUser?: {
        id: string;
        name: string;
        email: string;
    };
}

interface User {
    id: string;
    name: string;
    email: string;
}

const USER_ROLES = [
    "archaser_admin",
    "Account_Manager",
    "Bookkeeper",
    "CFO",
    "Collection_Manager",
    "Collection_Agent",
    "Data_Analyst",
    "Customer_Service_Representative",
    "Auditor",
    "IT_Support",
    "System_Administrator",
] as const;

const PERMISSION_OPTIONS: Array<{ value: "view" | "edit" }> = [
    { value: "view" },
    { value: "edit" },
];

const ShareReportModal: React.FC<ShareReportModalProps> = ({
    open,
    onClose,
    reportId,
    reportName,
    accountId,
}) => {
    const { t, i18n } = useTranslation(["reports", "common", "security_roles"]);
    const theme = useTheme();
    const { showToast } = useToast();
    const { data: session } = useSession();
    const queryClient = useQueryClient();
    const isRTL = i18n.language === "he";


    // Form state
    const [shareType, setShareType] = useState<"user" | "role">("user");
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedRole, setSelectedRole] = useState<string>("");
    const [permission, setPermission] = useState<"view" | "edit">("view");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Local state for pending changes
    interface PendingShare {
        tempId: string; // Temporary ID for pending shares
        shared_with_user_id?: string;
        shared_with_role?: string;
        permission: "view" | "edit";
        User_ReportShare_shared_with_user_idToUser?: User;
    }
    const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
    const [removedShareIds, setRemovedShareIds] = useState<Set<number>>(new Set());
    // Track shares that need to be updated (shareId -> new permission)
    const [updatedShares, setUpdatedShares] = useState<Map<number, "view" | "edit">>(new Map());

    // Fetch existing shares
    const { data: sharesData, isLoading: isLoadingShares } = useQuery<{ shares: Share[] }>({
        queryKey: ["report-shares", reportId],
        queryFn: async () => {
            const response = await api.get(`/api/reports/${reportId}/share`);
            return response.data;
        },
        enabled: open && !!reportId,
    });

    const shares = sharesData?.shares || [];

    // Fetch users
    const { data: usersData, isLoading: isLoadingUsers } = useQuery<{ users: User[] }>({
        queryKey: ["users", accountId],
        queryFn: async () => {
            const response = await api.get("/api/entities/users", {
                params: {
                    account_id: accountId,
                    page: 1,
                    limit: 1000,
                },
            });
            return response.data;
        },
        enabled: open && !!accountId,
    });

    // Combined display shares (existing - removed + pending + updated)
    const displayShares = useMemo(() => {
        // Existing shares minus removed ones (but include ones being updated)
        const activeShares = shares
            .filter((share) => !removedShareIds.has(share.id) || updatedShares.has(share.id))
            .map((share) => {
                // If this share is being updated, use the new permission
                if (updatedShares.has(share.id)) {
                    return {
                        ...share,
                        permission: updatedShares.get(share.id)!,
                    };
                }
                return share;
            });

        // Convert pending shares to display format
        const pendingDisplayShares = pendingShares.map((pending) => ({
            id: pending.tempId,
            shared_with_user_id: pending.shared_with_user_id,
            shared_with_role: pending.shared_with_role,
            permission: pending.permission,
            User_ReportShare_shared_with_user_idToUser: pending.User_ReportShare_shared_with_user_idToUser,
        }));

        return [...activeShares, ...pendingDisplayShares];
    }, [shares, removedShareIds, pendingShares, updatedShares]);

    // Filter out the current user and already-shared users from the list (including pending)
    const users = useMemo(() => {
        const allUsers = usersData?.users || [];
        const currentUserId = session?.user?.id;

        // Get list of user IDs that are already shared (existing + pending)
        const sharedUserIds = new Set<string>();

        // Add existing shares (not removed, unless being updated)
        shares
            .filter((share) =>
                share.shared_with_user_id &&
                (!removedShareIds.has(share.id) || updatedShares.has(share.id))
            )
            .forEach((share) => sharedUserIds.add(share.shared_with_user_id!));

        // Add pending shares
        pendingShares
            .filter((pending) => pending.shared_with_user_id)
            .forEach((pending) => sharedUserIds.add(pending.shared_with_user_id!));

        let filtered = allUsers;
        if (currentUserId) {
            filtered = filtered.filter((user) => user.id !== currentUserId);
        }

        // Filter out already-shared users
        return filtered.filter((user) => !sharedUserIds.has(user.id));
    }, [usersData?.users, session?.user?.id, shares, removedShareIds, pendingShares]);

    // Filter out already-shared roles from the list (including pending)
    const availableRoles = useMemo(() => {
        // Get list of roles that are already shared (existing + pending)
        const sharedRoles = new Set<string>();

        // Add existing shares (not removed, unless being updated)
        shares
            .filter((share) =>
                share.shared_with_role &&
                (!removedShareIds.has(share.id) || updatedShares.has(share.id))
            )
            .forEach((share) => sharedRoles.add(share.shared_with_role!));

        // Add pending shares
        pendingShares
            .filter((pending) => pending.shared_with_role)
            .forEach((pending) => sharedRoles.add(pending.shared_with_role!));

        return USER_ROLES.filter(
            (role) => role !== "archaser_admin" && !sharedRoles.has(role)
        );
    }, [shares, removedShareIds, pendingShares]);

    // Save all changes mutation
    const saveChangesMutation = useMutation({
        mutationFn: async () => {
            // First, update shares that were deleted and re-added (update instead of delete+create)
            for (const [shareId, newPermission] of Array.from(updatedShares.entries())) {
                const share = shares.find((s) => s.id === shareId);
                if (share) {
                    await api.post(`/api/reports/${reportId}/share`, {
                        shared_with_user_id: share.shared_with_user_id,
                        shared_with_role: share.shared_with_role,
                        permission: newPermission,
                    });
                }
            }

            // Then remove all deleted shares (excluding ones being updated)
            const sharesToDelete = Array.from(removedShareIds).filter(
                (shareId) => !updatedShares.has(shareId)
            );
            for (const shareId of sharesToDelete) {
                await api.delete(`/api/reports/${reportId}/share?shareId=${shareId}`);
            }

            // Small delay to ensure deletes are fully committed before adds
            if (sharesToDelete.length > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Finally, add all new pending shares (sequential to avoid race conditions)
            for (const pending of pendingShares) {
                try {
                    await api.post(`/api/reports/${reportId}/share`, {
                        shared_with_user_id: pending.shared_with_user_id,
                        shared_with_role: pending.shared_with_role,
                        permission: pending.permission,
                    });
                } catch (error: any) {
                    // If error is about record not found, it might be a race condition
                    // The backend should handle this, but log for debugging
                    if (error?.response?.status !== 500) {
                        throw error;
                    }
                    // For 500 errors, retry once after a short delay
                    await new Promise(resolve => setTimeout(resolve, 200));
                    await api.post(`/api/reports/${reportId}/share`, {
                        shared_with_user_id: pending.shared_with_user_id,
                        shared_with_role: pending.shared_with_role,
                        permission: pending.permission,
                    });
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["report-shares", reportId] });

            // Also invalidate reports list so the dropdown updates for all users
            // The query key pattern is ["reports-list", accountId, context]
            // We need to invalidate all variations of the query key
            const allQueries = queryClient.getQueryCache().getAll();
            const reportsListQueries = allQueries.filter((query) =>
                query.queryKey[0] === "reports-list"
            );

            // Remove queries from cache to force fresh fetch
            reportsListQueries.forEach((query) => {
                queryClient.removeQueries({ queryKey: query.queryKey });
            });

            queryClient.invalidateQueries({
                queryKey: ["reports-list"],
                refetchType: 'active', // Only refetch active queries
            });

            // Also explicitly refetch to ensure immediate update (fire and forget)
            // Use 'all' type to refetch even disabled queries, since the query might be disabled
            // but we still need to update the cache for when it becomes enabled
            queryClient.refetchQueries({
                queryKey: ["reports-list"],
                type: 'all', // Refetch all queries matching the key, even if disabled
            });

            showToast(t("messages.save_success", "Changes saved successfully"), "success");
            resetAll();
            onClose();
        },
        onError: (error: any) => {
            showToast(
                error.response?.data?.error || t("messages.save_error", "Failed to save changes"),
                "error"
            );
        },
    });

    // Reset form when modal opens/closes
    useEffect(() => {
        if (open) {
            resetAll();
        }
    }, [open]);

    const resetForm = () => {
        setShareType("user");
        setSelectedUser(null);
        setSelectedRole("");
        setPermission("view");
    };

    const resetAll = () => {
        resetForm();
        setPendingShares([]);
        setRemovedShareIds(new Set());
        setUpdatedShares(new Map());
    };

    const handleCancel = () => {
        if (!isSubmitting && !saveChangesMutation.isPending) {
            resetAll();
            onClose();
        }
    };

    const getTranslatedRoleName = (role: string): string => {
        if (!role) return "";
        const translationKey = `values.${role}`;
        const translated = t(translationKey, {
            ns: "security_roles",
            defaultValue: role,
        });
        return translated;
    };

    const handleAddToPending = () => {
        // Check if already in pending or existing shares
        const userId = shareType === "user" ? selectedUser?.id : undefined;
        const role = shareType === "role" ? selectedRole : undefined;

        // Check if it's a duplicate in pending shares
        const isDuplicateInPending = pendingShares.some(
            (pending) =>
                (pending.shared_with_user_id && pending.shared_with_user_id === userId) ||
                (pending.shared_with_role && pending.shared_with_role === role)
        );

        // Check if it's already in existing shares (not removed, or being updated)
        const existingShare = shares.find(
            (share) =>
                (!removedShareIds.has(share.id) || updatedShares.has(share.id)) &&
                ((share.shared_with_user_id && share.shared_with_user_id === userId) ||
                    (share.shared_with_role && share.shared_with_role === role))
        );

        if (isDuplicateInPending || existingShare) {
            showToast(t("messages.duplicate_share", "This user/role is already shared"), "warning");
            return;
        }

        // Check if there's a removed share with the same user/role - if so, update it instead
        const removedShare = shares.find(
            (share) =>
                removedShareIds.has(share.id) &&
                !updatedShares.has(share.id) &&
                ((share.shared_with_user_id && share.shared_with_user_id === userId) ||
                    (share.shared_with_role && share.shared_with_role === role))
        );

        if (removedShare) {
            // Update the existing share instead of deleting and creating
            setRemovedShareIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(removedShare.id);
                return newSet;
            });
            setUpdatedShares((prev) => {
                const newMap = new Map(prev);
                newMap.set(removedShare.id, permission);
                return newMap;
            });
            resetForm();
            return;
        }

        // Add to pending shares (new share)
        const newPendingShare: PendingShare = {
            tempId: `pending-${Date.now()}-${Math.random()}`,
            shared_with_user_id: userId,
            shared_with_role: role,
            permission,
            User_ReportShare_shared_with_user_idToUser: selectedUser || undefined,
        };

        setPendingShares([...pendingShares, newPendingShare]);
        resetForm();
    };

    // Check if plus button should be disabled
    const isAddButtonDisabled = useMemo(() => {
        if (isSubmitting || saveChangesMutation.isPending) return true;
        if (shareType === "user" && !selectedUser) return true;
        if (shareType === "role" && !selectedRole) return true;
        return false;
    }, [isSubmitting, saveChangesMutation.isPending, shareType, selectedUser, selectedRole]);

    const handleRemoveShare = (shareId: number | string) => {
        // Check if it's a pending share (tempId) or existing share (number)
        if (typeof shareId === "string" && shareId.startsWith("pending-")) {
            // Remove from pending shares
            setPendingShares(pendingShares.filter((pending) => pending.tempId !== shareId));
        } else {
            const numericShareId = shareId as number;
            // If this share is being updated, remove it from updatedShares
            if (updatedShares.has(numericShareId)) {
                setUpdatedShares((prev) => {
                    const newMap = new Map(prev);
                    newMap.delete(numericShareId);
                    return newMap;
                });
            }
            // Add to removed shares set
            setRemovedShareIds(new Set([...Array.from(removedShareIds), numericShareId]));
        }
    };

    const handleSave = async () => {
        if (pendingShares.length === 0 && removedShareIds.size === 0 && updatedShares.size === 0) {
            onClose();
            return;
        }

        setIsSubmitting(true);
        try {
            await saveChangesMutation.mutateAsync();
        } catch (error) {
            // Error handling is done in mutation
        } finally {
            setIsSubmitting(false);
        }
    };

    // Memoized RTL styles
    const textFieldSx = useMemo(
        () => ({
            "& .MuiInputBase-input": {
                textAlign: isRTL ? "right" : "left",
                direction: isRTL ? "rtl" : "ltr",
            },
            "& .MuiInputLabel-root": {
                textAlign: isRTL ? "right" : "left",
                direction: isRTL ? "rtl" : "ltr",
            },
            "& .MuiOutlinedInput-root": {
                alignItems: "center",
            },
        }),
        [isRTL]
    );

    const tooltipPopperProps = useMemo(
        () => ({
            sx: {
                "& .MuiTooltip-tooltip": {
                    direction: isRTL ? "rtl" : "ltr",
                    textAlign: isRTL ? "right" : "left",
                },
            },
        }),
        [isRTL]
    );

    return (
        <AppDialog
            open={open}
            onClose={handleCancel}
            drag
            align
            slide
            isRTL={isRTL}
            paperWidth="450px"
            paperMaxHeight="90vh"
            title={t("sections.share_modal_title")}
            titleIcon={<ShareIcon aria-hidden="true" />}
            ariaLabelledBy="share-report-dialog-title"
            ariaDescribedBy="share-report-dialog-description"
            actions={
                <>
                    <Button
                        onClick={handleCancel}
                        variant="outlined"
                        size="small"
                        className="cancel-button"
                        fullWidth={false}
                        disabled={isSubmitting || saveChangesMutation.isPending}
                        sx={{
                            mr: isRTL ? 0 : theme.spacing(1),
                            ml: isRTL ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        size="small"
                        className="save-button"
                        fullWidth={false}
                        disabled={isSubmitting || saveChangesMutation.isPending || (pendingShares.length === 0 && removedShareIds.size === 0 && updatedShares.size === 0)}
                        endIcon={
                            isSubmitting || saveChangesMutation.isPending ? (
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
                id="share-report-dialog-description"
                component="div"
                sx={{
                    "&:first-of-type": {
                        paddingTop: theme.spacing(1.5),
                    },
                    direction: isRTL ? "rtl" : "ltr",
                    p: 2,
                    flex: "1 1 auto",
                    minHeight: 0,
                    overflow: "auto",
                }}
            >
                <form
                    onSubmit={(e) => { e.preventDefault(); handleAddToPending(); }}
                    dir={isRTL ? "rtl" : "ltr"}
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: { xs: 1.5, sm: 2 },
                            width: "100%",
                            mx: "auto",
                            direction: isRTL ? "rtl" : "ltr",
                        }}
                    >
                        {/* Section 1: Share New */}
                        <Box>
                            <Box
                                sx={{
                                    display: "grid",
                                    gap: 1.5,
                                    alignItems: "flex-end", // Align form fields at the bottom (input level) to account for labels
                                    "@media (min-width: 600px)": {
                                        gridTemplateColumns: "1fr 180px", // User/role takes 1 part, permission + button takes 180px
                                        padding: "4px 2px 4px 4px", // Reduce right padding
                                    },
                                    "@media (max-width: 599px)": {
                                        gridTemplateColumns: "1fr",
                                        padding: "4px",
                                    },
                                }}
                            >
                                {/* Share Type Selection */}
                                <Box sx={{
                                    gridColumn: { xs: "1", sm: "1 / -1" },
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: isRTL ? "flex-end" : "flex-start",
                                    direction: isRTL ? "rtl" : "ltr",
                                }}>
                                    <Typography variant="body2" sx={{
                                        mb: 1,
                                        textAlign: isRTL ? "right" : "left",
                                        direction: isRTL ? "rtl" : "ltr",
                                        width: "100%",
                                    }}>
                                        {t("sections.share_with")}
                                    </Typography>
                                    <RadioGroup
                                        row={true}
                                        value={shareType}
                                        onChange={(e) => {
                                            setShareType(e.target.value as "user" | "role");
                                            setSelectedUser(null);
                                            setSelectedRole("");
                                        }}
                                        sx={{
                                            direction: isRTL ? "rtl" : "ltr",
                                            flexDirection: isRTL ? "row-reverse" : "row",
                                            gap: 2,
                                            justifyContent: isRTL ? "flex-end" : "flex-start",
                                            width: "100%",
                                        }}
                                    >
                                        <FormControlLabel
                                            value="user"
                                            control={<Radio />}
                                            label={
                                                <Box sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    direction: isRTL ? "rtl" : "ltr",
                                                    flexDirection: "row",
                                                }}>
                                                    {isRTL ? (
                                                        <>
                                                            <PersonIcon fontSize="small" />
                                                            <Typography sx={{
                                                                direction: isRTL ? "rtl" : "ltr",
                                                                textAlign: isRTL ? "right" : "left",
                                                            }}>{t("fields.share_with_user")}</Typography>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PersonIcon fontSize="small" />
                                                            <Typography sx={{
                                                                direction: isRTL ? "rtl" : "ltr",
                                                                textAlign: isRTL ? "right" : "left",
                                                            }}>{t("fields.share_with_user")}</Typography>
                                                        </>
                                                    )}
                                                </Box>
                                            }
                                            sx={{
                                                direction: isRTL ? "rtl" : "ltr",
                                                justifyContent: isRTL ? "flex-end" : "flex-start",
                                                "& .MuiFormControlLabel-label": {
                                                    marginLeft: isRTL ? 0 : theme.spacing(1),
                                                    marginRight: isRTL ? theme.spacing(1) : 0,
                                                },
                                            }}
                                        />
                                        <FormControlLabel
                                            value="role"
                                            control={<Radio />}
                                            label={
                                                <Box sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 0.5,
                                                    direction: isRTL ? "rtl" : "ltr",
                                                    flexDirection: "row",
                                                }}>
                                                    {isRTL ? (
                                                        <>
                                                            <GroupIcon fontSize="small" />
                                                            <Typography sx={{
                                                                direction: isRTL ? "rtl" : "ltr",
                                                                textAlign: isRTL ? "right" : "left",
                                                            }}>{t("fields.share_with_role")}</Typography>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <GroupIcon fontSize="small" />
                                                            <Typography sx={{
                                                                direction: isRTL ? "rtl" : "ltr",
                                                                textAlign: isRTL ? "right" : "left",
                                                            }}>{t("fields.share_with_role")}</Typography>
                                                        </>
                                                    )}
                                                </Box>
                                            }
                                            sx={{
                                                direction: isRTL ? "rtl" : "ltr",
                                                justifyContent: isRTL ? "flex-end" : "flex-start",
                                                "& .MuiFormControlLabel-label": {
                                                    marginLeft: isRTL ? 0 : theme.spacing(1),
                                                    marginRight: isRTL ? theme.spacing(1) : 0,
                                                },
                                            }}
                                        />
                                    </RadioGroup>
                                </Box>

                                {/* User Selection */}
                                {shareType === "user" && (
                                    <Box sx={{ display: "flex", alignItems: "flex-end", width: "100%" }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "flex-end",
                                                width: "100%",
                                                "& > *": {
                                                    margin: 0,
                                                },
                                            }}
                                        >
                                            <Autocomplete
                                                value={selectedUser}
                                                onChange={(_, newValue) => {
                                                    setSelectedUser(newValue);
                                                }}
                                                options={users}
                                                getOptionLabel={(option) => option.name || option.email || ""}
                                                loading={isLoadingUsers}
                                                disabled={isSubmitting || saveChangesMutation.isPending}
                                                dir={isRTL ? "rtl" : "ltr"}
                                                {...(isRTL ? {
                                                    "data-hebrew": true,
                                                    "data-rtl": true,
                                                } : {})}
                                                renderOption={(props, option) => {
                                                    const { key, ...otherProps } = props;
                                                    return (
                                                        <Box
                                                            component="li"
                                                            key={key}
                                                            {...otherProps}
                                                            sx={{
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
                                                                {option.name || option.email || ""}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                }}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label={t("fields.select_user")}
                                                        dir={isRTL ? "rtl" : "ltr"}
                                                        {...(isRTL ? { "data-hebrew": true } : {})}
                                                        sx={textFieldSx}
                                                        fullWidth
                                                    />
                                                )}
                                                slotProps={{
                                                    popper: {
                                                        sx: {
                                                            direction: isRTL ? "rtl" : "ltr",
                                                            "& .MuiAutocomplete-listbox": {
                                                                direction: isRTL ? "rtl" : "ltr",
                                                                "& li": {
                                                                    direction: isRTL ? "rtl" : "ltr",
                                                                    textAlign: isRTL ? "right" : "left",
                                                                },
                                                            },
                                                        },
                                                    },
                                                }}
                                                sx={{
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
                                                    "& .MuiAutocomplete-endAdornment": {
                                                        right: isRTL ? "auto" : "9px",
                                                        left: isRTL ? "9px" : "auto",
                                                        position: "absolute",
                                                    },
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                )}

                                {/* Role Selection */}
                                {shareType === "role" && (
                                    <Box sx={{ display: "flex", alignItems: "flex-end", width: "100%" }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "flex-end",
                                                width: "100%",
                                                "& > *": {
                                                    margin: 0,
                                                },
                                            }}
                                        >
                                            <Autocomplete
                                                value={selectedRole}
                                                onChange={(_, newValue) => {
                                                    setSelectedRole(newValue || "");
                                                }}
                                                options={availableRoles}
                                                getOptionLabel={(option) => getTranslatedRoleName(option)}
                                                disabled={isSubmitting || saveChangesMutation.isPending}
                                                dir={isRTL ? "rtl" : "ltr"}
                                                {...(isRTL ? {
                                                    "data-hebrew": true,
                                                    "data-rtl": true,
                                                } : {})}
                                                renderOption={(props, option) => {
                                                    const { key, ...otherProps } = props;
                                                    return (
                                                        <Box
                                                            component="li"
                                                            key={key}
                                                            {...otherProps}
                                                            sx={{
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
                                                                {getTranslatedRoleName(option)}
                                                            </Typography>
                                                        </Box>
                                                    );
                                                }}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label={t("fields.select_role")}
                                                        dir={isRTL ? "rtl" : "ltr"}
                                                        {...(isRTL ? { "data-hebrew": true } : {})}
                                                        sx={textFieldSx}
                                                        fullWidth
                                                    />
                                                )}
                                                slotProps={{
                                                    popper: {
                                                        sx: {
                                                            direction: isRTL ? "rtl" : "ltr",
                                                            "& .MuiAutocomplete-listbox": {
                                                                direction: isRTL ? "rtl" : "ltr",
                                                                "& li": {
                                                                    direction: isRTL ? "rtl" : "ltr",
                                                                    textAlign: isRTL ? "right" : "left",
                                                                },
                                                            },
                                                        },
                                                    },
                                                }}
                                                sx={{
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
                                                    "& .MuiAutocomplete-endAdornment": {
                                                        right: isRTL ? "auto" : "9px",
                                                        left: isRTL ? "9px" : "auto",
                                                        position: "absolute",
                                                    },
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                )}

                                {/* Permission Selection */}
                                <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.75, minWidth: 0 }}>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "flex-end",
                                            flexShrink: 0,
                                            width: "140px",
                                            "& > *": {
                                                margin: 0,
                                            },
                                        }}
                                    >
                                        <Autocomplete
                                            value={PERMISSION_OPTIONS.find((opt) => opt.value === permission) || null}
                                            onChange={(_, newValue) => {
                                                if (newValue) {
                                                    setPermission(newValue.value);
                                                }
                                            }}
                                            options={PERMISSION_OPTIONS}
                                            getOptionLabel={(option) => t(`values.permission_${option.value}`)}
                                            disabled={isSubmitting || saveChangesMutation.isPending}
                                            size="small"
                                            dir={isRTL ? "rtl" : "ltr"}
                                            {...(isRTL && {
                                                "data-hebrew": true,
                                                "data-rtl": true,
                                            })}
                                            renderOption={(props, option) => {
                                                const { key, ...otherProps } = props;
                                                return (
                                                    <Box
                                                        component="li"
                                                        key={key}
                                                        {...otherProps}
                                                        sx={{
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
                                                            {t(`values.permission_${option.value}`)}
                                                        </Typography>
                                                    </Box>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label={t("fields.permission")}
                                                    dir={isRTL ? "rtl" : "ltr"}
                                                    {...(isRTL ? { "data-hebrew": true } : {})}
                                                    sx={textFieldSx}
                                                    fullWidth
                                                />
                                            )}
                                            slotProps={{
                                                popper: {
                                                    sx: {
                                                        direction: isRTL ? "rtl" : "ltr",
                                                        "& .MuiAutocomplete-listbox": {
                                                            direction: isRTL ? "rtl" : "ltr",
                                                            "& li": {
                                                                direction: isRTL ? "rtl" : "ltr",
                                                                textAlign: isRTL ? "right" : "left",
                                                            },
                                                        },
                                                    },
                                                },
                                            }}
                                            sx={{
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
                                                "& .MuiAutocomplete-endAdornment": {
                                                    right: isRTL ? "auto" : "9px",
                                                    left: isRTL ? "9px" : "auto",
                                                    position: "absolute",
                                                },
                                            }}
                                        />
                                    </Box>
                                    <Tooltip
                                        title={t("tooltips.add_share", "Add share")}
                                        arrow
                                        placement="bottom"
                                        PopperProps={tooltipPopperProps}
                                    >
                                        <span>
                                            <IconButton
                                                onClick={handleAddToPending}
                                                disabled={isAddButtonDisabled}
                                                color="primary"
                                                size="small"
                                                sx={{
                                                    width: "36px",
                                                    height: "36px",
                                                }}
                                            >
                                                <AddIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Box>
                            </Box>
                        </Box>

                        <Divider />

                        {/* Existing Shares */}
                        <Box>
                            {isLoadingShares ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                                    <CircularProgress color="primary" size={24} />
                                </Box>
                            ) : displayShares.length === 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                                    {t("messages.no_shares")}
                                </Typography>
                            ) : (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                                    {displayShares.map((share) => (
                                        <Box
                                            key={share.id}
                                            sx={{
                                                py: 0.5,
                                                px: 1,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                direction: isRTL ? "rtl" : "ltr",
                                            }}
                                        >
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                                <Tooltip
                                                    title={
                                                        share.permission === "view"
                                                            ? t("values.permission_view")
                                                            : t("values.permission_edit")
                                                    }
                                                    arrow
                                                    placement="bottom"
                                                    PopperProps={tooltipPopperProps}
                                                >
                                                    {share.permission === "edit" ? (
                                                        <EditIcon
                                                            fontSize="small"
                                                            sx={{
                                                                color: theme.palette.primary.main,
                                                            }}
                                                        />
                                                    ) : (
                                                        <ViewIcon
                                                            fontSize="small"
                                                            sx={{
                                                                color: theme.palette.primary.main,
                                                            }}
                                                        />
                                                    )}
                                                </Tooltip>
                                                {share.shared_with_user_id ? (
                                                    <Tooltip
                                                        title={
                                                            share.User_ReportShare_shared_with_user_idToUser?.email || ""
                                                        }
                                                        arrow
                                                        placement="bottom"
                                                        PopperProps={tooltipPopperProps}
                                                        disableHoverListener={!share.User_ReportShare_shared_with_user_idToUser?.email}
                                                    >
                                                        <Typography variant="body1" fontWeight={500}>
                                                            {share.User_ReportShare_shared_with_user_idToUser?.name ||
                                                                share.User_ReportShare_shared_with_user_idToUser?.email ||
                                                                t("messages.unknown_user")}
                                                        </Typography>
                                                    </Tooltip>
                                                ) : (
                                                    <Typography variant="body1" fontWeight={500}>
                                                        {getTranslatedRoleName(share.shared_with_role || "")}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <IconButton
                                                onClick={() => handleRemoveShare(share.id)}
                                                disabled={isSubmitting || saveChangesMutation.isPending}
                                                color="primary"
                                                size="small"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </Box>
                    </Box>
                </form>
            </Box>
        </AppDialog>
    );
};

export default ShareReportModal;

