"use client";
import { apiFetch } from "@/utils/apiFetch";

import AppDialog from "@/shared/layout-components/modal/AppDialog";
import { Delete as DeleteIcon } from "@mui/icons-material";
import {
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    TextField,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface BusinessUnit {
    id: number;
    name: string;
    status: "Active" | "Inactive";
}

interface DeleteBusinessUnitDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reassignToBusinessUnitId?: number | null) => void;
    businessUnitId: number | null;
    accountId: number;
    isLoading?: boolean;
    errorMessage?: string;
}

export function DeleteBusinessUnitDialog({
    isOpen,
    onClose,
    onConfirm,
    businessUnitId,
    accountId,
    isLoading = false,
    errorMessage,
}: DeleteBusinessUnitDialogProps) {
    const { t, i18n } = useTranslation(["business_unit", "common"]);
    const theme = useTheme();
    const [selectedReassignBU, setSelectedReassignBU] =
        useState<BusinessUnit | null>(null);
    const [userCount, setUserCount] = useState<number | null>(null);
    const [hasUsers, setHasUsers] = useState(false);

    // Fetch users for this business unit
    const { data: usersData, isLoading: isLoadingUsers } = useQuery({
        queryKey: ["business-unit-users", businessUnitId],
        queryFn: async () => {
            if (!businessUnitId) return { users: [], count: 0 };
            const response = await apiFetch(`/api/entities/users?business_unit_id=${businessUnitId}&limit=1`
            );
            if (!response.ok) return { users: [], count: 0 };
            const data = await response.json();
            return {
                users: data.users || [],
                count: data.total || 0,
            };
        },
        enabled: isOpen && !!businessUnitId,
    });

    // Fetch active business units for reassignment dropdown
    const { data: activeBusinessUnitsData, isLoading: isLoadingBUs } = useQuery<
        BusinessUnit[]
    >({
        queryKey: ["active-business-units", accountId],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/accounts/${accountId}/business-units`
            );
            if (!response.ok) return [];
            const data = await response.json();
            const businessUnits = Array.isArray(data)
                ? data
                : Array.isArray(data?.data)
                    ? data.data
                    : [];
            // Filter to only active business units, excluding the one being deleted
            return businessUnits.filter(
                (bu: BusinessUnit) =>
                    bu.status === "Active" && bu.id !== businessUnitId
            );
        },
        enabled: isOpen && !!accountId && hasUsers,
    });

    const activeBusinessUnits = Array.isArray(activeBusinessUnitsData)
        ? activeBusinessUnitsData
        : [];

    useEffect(() => {
        if (usersData) {
            const count = usersData.count || 0;
            setUserCount(count);
            setHasUsers(count > 0);
        }
    }, [usersData]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedReassignBU(null);
            setUserCount(null);
            setHasUsers(false);
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (hasUsers && !selectedReassignBU) {
            return; // Don't allow deletion if users exist and no BU selected
        }
        onConfirm(selectedReassignBU?.id || null);
    };

    const canConfirm = !hasUsers || (hasUsers && selectedReassignBU !== null);

    return (
        <AppDialog
            open={isOpen}
            onClose={onClose}
            drag={false}
            align={false}
            slide={false}
            isRTL={i18n.language === "he"}
            title={
                <Box sx={{ display: "flex", alignItems: "center", gap: theme.spacing(1) }}>
                    <DeleteIcon />
                    {t("messages.delete_confirm_title", { ns: "business_unit" })}
                </Box>
            }
            titleIcon={null}
            ariaLabelledBy="delete-bu-dialog-title"
            ariaDescribedBy="delete-bu-dialog-description"
            maxWidth="sm"
            fullWidth
            actions={
                <>
                    <Button
                        onClick={onClose}
                        variant="outlined"
                        disabled={isLoading}
                        sx={{
                            mr: i18n.language === "he" ? 0 : theme.spacing(1),
                            ml: i18n.language === "he" ? theme.spacing(1) : 0,
                        }}
                    >
                        {t("actions.cancel", { ns: "common" })}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isLoading || !canConfirm}
                        variant="contained"
                        color="error"
                        sx={{
                            minWidth: "auto",
                            position: "relative",
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                            "&.Mui-disabled": {
                                backgroundColor:
                                    theme.palette.action.disabledBackground,
                                color: theme.palette.action.disabled,
                                cursor: "not-allowed",
                                opacity: 0.6,
                            },
                        }}
                    >
                        {t("actions.delete", { ns: "common" })}
                    </Button>
                </>
            }
        >
            <Box
                id="delete-bu-dialog-description"
                component="div"
                sx={{
                    paddingTop: theme.spacing(2),
                    direction: i18n.language === "he" ? "rtl" : "ltr",
                }}
            >
                {isLoadingUsers ? (
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            py: 2,
                        }}
                    >
                        <CircularProgress color="primary" size={24} />
                    </Box>
                ) : hasUsers ? (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                        }}
                    >
                        <Typography variant="body1" color="error">
                            {t("messages.delete_has_users", {
                                ns: "business_unit",
                                count: userCount || 0,
                            })}
                        </Typography>
                        <Autocomplete
                            options={activeBusinessUnits}
                            getOptionLabel={(option) => option.name}
                            isOptionEqualToValue={(option, value) =>
                                option.id === value?.id
                            }
                            value={selectedReassignBU}
                            onChange={(_, newValue) =>
                                setSelectedReassignBU(newValue)
                            }
                            loading={isLoadingBUs}
                            disabled={isLoading}
                            renderOption={(props, option) => {
                                const { key, ...otherProps } = props;
                                return (
                                    <Box
                                        component="li"
                                        key={key}
                                        {...otherProps}
                                        sx={{
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            pr:
                                                i18n.language === "he"
                                                    ? theme.spacing(2)
                                                    : theme.spacing(1.75),
                                            pl:
                                                i18n.language === "he"
                                                    ? theme.spacing(1.75)
                                                    : theme.spacing(2),
                                            "&.Mui-focused": {
                                                backgroundColor:
                                                    theme.palette.action.hover,
                                            },
                                            "&:hover": {
                                                backgroundColor:
                                                    theme.palette.action.hover,
                                            },
                                            "&.Mui-selected": {
                                                backgroundColor:
                                                    theme.palette.action
                                                        .selected,
                                                "&:hover": {
                                                    backgroundColor:
                                                        theme.palette.action
                                                            .selected,
                                                },
                                            },
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                                textAlign:
                                                    i18n.language === "he"
                                                        ? "right"
                                                        : "left",
                                                width: "100%",
                                                color: theme.palette.text
                                                    .primary,
                                            }}
                                        >
                                            {option.name || ""}
                                        </Typography>
                                    </Box>
                                );
                            }}
                            sx={{
                                "& .MuiAutocomplete-inputRoot": {
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                    "& .MuiAutocomplete-input": {
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    },
                                    "& input": {
                                        textAlign:
                                            i18n.language === "he"
                                                ? "right"
                                                : "left",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    },
                                },
                                "& .MuiAutocomplete-endAdornment": {
                                    right:
                                        i18n.language === "he"
                                            ? "auto"
                                            : undefined,
                                    left:
                                        i18n.language === "he"
                                            ? theme.spacing(1.5)
                                            : "auto",
                                },
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={
                                        t("fields.reassign_to_business_unit", {
                                            ns: "business_unit",
                                        }) || "Reassign to Business Unit"
                                    }
                                    required
                                    {...(i18n.language === "he" && {
                                        "data-hebrew": true,
                                    })}
                                    dir={i18n.language === "he" ? "rtl" : "ltr"}
                                    {...(i18n.language === "he" && {
                                        "data-rtl": true,
                                    })}
                                    sx={{
                                        "& .MuiInputBase-input": {
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        },
                                        "& .MuiOutlinedInput-input": {
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        },
                                        "& .MuiInputLabel-root": {
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        },
                                    }}
                                />
                            )}
                            dir={i18n.language === "he" ? "rtl" : "ltr"}
                            {...(i18n.language === "he" && {
                                "data-rtl": true,
                            })}
                        />
                    </Box>
                ) : (
                    <Typography variant="body1">
                        {t("messages.delete_confirm_description", {
                            ns: "business_unit",
                        })}
                    </Typography>
                )}
                {errorMessage && (
                    <Typography
                        variant="body2"
                        sx={{
                            color: "error.main",
                            mt: 2,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        {errorMessage}
                    </Typography>
                )}
            </Box>
        </AppDialog>
    );
}
