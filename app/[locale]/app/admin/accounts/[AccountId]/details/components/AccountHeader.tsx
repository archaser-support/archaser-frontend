"use client";

import {
    AccountBalance as AccountIcon,
    Business as BusinessIcon,
    CloudUpload as CloudUploadIcon,
    Delete as DeleteIcon,
} from "@mui/icons-material";
import {
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Grid,
    Paper,
    Stack,
    Typography,
    useTheme,
} from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileUploadServiceClient } from "@/lib/fileUploadServiceClient";

import { AccountDisplayData } from "../types";

interface AccountHeaderProps {
    customer: AccountDisplayData;
    isEditing: boolean;
    isSaving: boolean;
    onSave: () => void;
    onCancel: () => void;
    onFieldChange?: (key: string, value: any) => void;
    decodeLogo: (logoData?: string | null) => string;
    isNewAccount?: boolean;
}

const AccountHeader: React.FC<AccountHeaderProps> = ({
    customer,
    isEditing,
    isSaving,
    onSave,
    onCancel,
    onFieldChange,
    decodeLogo,
    isNewAccount = false,
}) => {
    const { t, i18n } = useTranslation(["accounts", "common"]);
    const theme = useTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [logoUrl, setLogoUrl] = useState<string>("");

    // Calculate deletion status
    const calculateGracePeriodDays = (deletedAt: string | Date): number => {
        const deleted = new Date(deletedAt);
        const gracePeriodEnds = new Date(deleted);
        gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 30);

        const now = new Date();
        const diffTime = gracePeriodEnds.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    };

    const customerAny = customer as any;
    const isDeleted = customerAny?.deleted_at;
    const gracePeriodDays = isDeleted
        ? calculateGracePeriodDays(customerAny.deleted_at)
        : 0;
    const canRestore = isDeleted && gracePeriodDays > 0;

    // Fetch presigned URL for S3 logo
    useEffect(() => {
        const fetchLogoUrl = async () => {
            if (customer.logo && typeof customer.logo === "string") {
                // Check if it's an S3 file path (not a data URL or binary data)
                if (FileUploadServiceClient.isS3File(customer.logo)) {
                    try {
                        const presignedUrl =
                            await FileUploadServiceClient.getFileUrl(
                                customer.logo
                            );
                        setLogoUrl(presignedUrl);
                    } catch (_error) {
                        setLogoUrl("");
                    }
                } else {
                    // It's either a data URL or binary data, use decodeLogo
                    const decodedUrl = decodeLogo(customer.logo);
                    setLogoUrl(decodedUrl);
                }
            } else {
                setLogoUrl("");
            }
        };

        fetchLogoUrl();
    }, [customer.logo, decodeLogo]);

    // Handle logo file selection
    const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith("image/")) {
                alert(t("validation.invalid_file_type", { ns: "accounts" }));
                return;
            }

            // Validate file size (5MB limit to match API)
            if (file.size > 5 * 1024 * 1024) {
                alert(t("validation.file_too_large", { ns: "accounts" }));
                return;
            }

            // Store the file object for S3 upload
            if (onFieldChange) {
                onFieldChange("logoFile", file);
            }

            // Create preview for display
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                // Update the customer logo preview through the parent component
                if (onFieldChange) {
                    onFieldChange("logoPreview", result);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Paper
            sx={{
                p: theme.spacing(2),
                mb: theme.spacing(3),
                bgcolor: "transparent",
                backgroundImage: "none",
                boxShadow: "none",
                border: "none",
                animation: "slideUpHeader 0.6s ease-out forwards",
                opacity: 0,
                transform: "translateY(20px)",
                "@keyframes slideUpHeader": {
                    "0%": {
                        opacity: 0,
                        transform: "translateY(20px)",
                    },
                    "100%": {
                        opacity: 1,
                        transform: "translateY(0)",
                    },
                },
            }}
            elevation={0}
        >
            <Box>
                <Grid
                    container
                    spacing={3}
                    alignItems="center"
                    justifyContent="space-between"
                >
                    {/* Logo Section */}
                    <Grid size={{ xs: 12, sm: "auto" }}>
                        <Box
                            sx={{
                                position: "relative",
                                display: "flex",
                                alignItems: "center",
                            }}
                        >
                            <Avatar
                                sx={{
                                    width: 56,
                                    height: 56,
                                    bgcolor: "#f5f5f5",
                                    color: "#666",
                                    border: "2px solid #e0e0e0",
                                    fontSize: "1.25rem",
                                    cursor: isEditing ? "pointer" : "default",
                                    "&:hover": isEditing
                                        ? {
                                            borderColor: "primary.main",
                                            boxShadow:
                                                "0 2px 8px rgba(25, 118, 210, 0.2)",
                                        }
                                        : {},
                                }}
                                onClick={
                                    isEditing
                                        ? () => fileInputRef.current?.click()
                                        : undefined
                                }
                            >
                                {((customer as any).logoPreview || logoUrl) &&
                                    !(customer as any).deleteLogo ? (
                                    <Box
                                        component="img"
                                        src={
                                            (customer as any).logoPreview ||
                                            logoUrl
                                        }
                                        alt="Account Logo"
                                        sx={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            borderRadius: "50%",
                                        }}
                                    />
                                ) : (
                                    <BusinessIcon fontSize="large" />
                                )}
                            </Avatar>

                            {/* Upload Icon Overlay */}
                            {isEditing && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        top: 0,
                                        right: 0,
                                        bgcolor: "primary.main",
                                        color: "white",
                                        borderRadius: "50%",
                                        width: 24,
                                        height: 24,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        cursor: "pointer",
                                        "&:hover": {
                                            bgcolor: "primary.dark",
                                        },
                                    }}
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
                                >
                                    <CloudUploadIcon sx={{ fontSize: 16 }} />
                                </Box>
                            )}

                            {/* Delete Logo Button */}
                            {isEditing &&
                                ((customer as any).logoPreview || logoUrl) &&
                                !(customer as any).deleteLogo && (
                                    <Box
                                        sx={{
                                            position: "absolute",
                                            top: 0,
                                            left: 0,
                                            bgcolor: "#f44336",
                                            color: "white",
                                            borderRadius: "50%",
                                            width: 24,
                                            height: 24,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                            "&:hover": {
                                                bgcolor: "#d32f2f",
                                            },
                                        }}
                                        onClick={() => {
                                            if (onFieldChange) {
                                                // Clear the preview and file
                                                onFieldChange("logoFile", null);
                                                onFieldChange(
                                                    "logoPreview",
                                                    null
                                                );
                                                // Set flag to delete existing logo from database and S3
                                                onFieldChange(
                                                    "deleteLogo",
                                                    true
                                                );
                                                // Clear the logo URL to show default icon immediately
                                                setLogoUrl("");
                                            }
                                        }}
                                    >
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                    </Box>
                                )}

                            {/* Status Badge */}
                            <Chip
                                label={
                                    isDeleted
                                        ? canRestore
                                            ? `Deleted (${gracePeriodDays}d)`
                                            : "Anonymized"
                                        : customer.status === "Active"
                                            ? t("values.status_active", {
                                                ns: "common",
                                            })
                                            : t("values.status_inactive", {
                                                ns: "common",
                                            })
                                }
                                size="small"
                                data-status={
                                    isDeleted
                                        ? "deleted"
                                        : (customer.status?.toLowerCase() ||
                                            "active") === "active"
                                            ? "active"
                                            : "inactive"
                                }
                                sx={{
                                    position: "absolute",
                                    bottom: -4,
                                    right: -4,
                                    boxShadow: theme.shadows[2],
                                    backgroundColor: isDeleted
                                        ? canRestore
                                            ? theme.palette.warning.main
                                            : theme.palette.grey[600]
                                        : undefined,
                                    color: isDeleted ? "white" : undefined,
                                }}
                            />
                        </Box>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            style={{ display: "none" }}
                        />
                    </Grid>

                    {/* Account Information */}
                    <Grid size={{ xs: 12, sm: 6, md: 8 }}>
                        <Stack spacing={2}>
                            <Box>
                                <Typography
                                    variant="h5"
                                    sx={{
                                        fontSize: "1.25rem",
                                        fontWeight: 600,
                                        color: theme.palette.text.primary,
                                        mb: 0.5,
                                        lineHeight: 1.3,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        textAlign: "center",
                                    }}
                                >
                                    {isNewAccount
                                        ? t("actions.add_new_account", {
                                            ns: "accounts",
                                        })
                                        : customer.name}
                                </Typography>

                                <Stack
                                    direction="row"
                                    spacing={1.5}
                                    alignItems="center"
                                    justifyContent="center"
                                >
                                    <Stack
                                        direction="row"
                                        spacing={0.5}
                                        alignItems="center"
                                    >
                                        <AccountIcon
                                            sx={{ fontSize: 18, color: "#666" }}
                                        />
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontSize: "0.875rem",
                                                fontWeight: 400,
                                                color: theme.palette.text
                                                    .secondary,
                                                lineHeight: 1.5,
                                                textAlign: "center",
                                            }}
                                        >
                                            {isNewAccount
                                                ? t(
                                                    "messages.enter_company_details",
                                                    { ns: "accounts" }
                                                )
                                                : customer.company_number}
                                        </Typography>
                                    </Stack>
                                </Stack>
                            </Box>
                        </Stack>
                    </Grid>

                    {/* Action Buttons */}
                    <Grid
                        size={{ xs: 12, sm: 3, md: 2 }}
                        sx={{ display: "flex", justifyContent: "flex-end" }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Button
                                variant="outlined"
                                className="cancel-button"
                                onClick={onCancel}
                                disabled={isSaving}
                            >
                                {t("actions.cancel", { ns: "common" })}
                            </Button>
                            {/* Only show Save button when editing is enabled */}
                            {isEditing && (
                                <Button
                                    variant="contained"
                                    onClick={isSaving ? undefined : onSave}
                                    fullWidth={false}
                                    className="save-button"
                                    endIcon={
                                        isSaving ? (
                                            <CircularProgress
                                                size={24}
                                                sx={{
                                                    color: theme.palette.common
                                                        .white,
                                                }}
                                            />
                                        ) : undefined
                                    }
                                    disabled={isSaving}
                                    sx={{
                                        "& .MuiButton-endIcon": {
                                            marginRight:
                                                i18n.language === "he"
                                                    ? theme.spacing(1)
                                                    : undefined,
                                            marginLeft:
                                                i18n.language !== "he"
                                                    ? undefined
                                                    : theme.spacing(1),
                                        },
                                    }}
                                >
                                    {t("actions.save", { ns: "common" })}
                                </Button>
                            )}
                        </Stack>
                    </Grid>
                </Grid>
            </Box>
        </Paper>
    );
};

export default AccountHeader;
