"use client";

import {
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
} from "@mui/icons-material";
import {
    Box,
    Paper,
    Typography,
    Button,
    Stack,
    Avatar,
    Breadcrumbs,
    Link,
    useTheme,
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

interface UserHeaderProps {
    user: {
        id?: string;
        first_name: string;
        last_name: string;
        email: string;
        role: string;
        status: string;
    };
    isEditing: boolean;
    isSaving: boolean;
    onEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    isNewUser?: boolean;
    isOwnProfile?: boolean;
    accountName?: string;
    accountId?: string;
    isSaveDisabled?: boolean;
    hasManageUsersPermission?: boolean;
}

const UserHeader: React.FC<UserHeaderProps> = ({
    user,
    isEditing,
    isSaving,
    onEdit,
    onSave,
    onCancel,
    isNewUser = false,
    isOwnProfile = false,
    accountName,
    accountId,
    isSaveDisabled = false,
    hasManageUsersPermission = false,
}) => {
    const { t, i18n } = useTranslation(["settings", "common"]);
    const theme = useTheme();
    const isHebrew = i18n.language === "he";

    const getUserDisplayName = () => {
        if (isNewUser) {
            return t("actions.add_user", { ns: "users" });
        }

        // Always try to show the user's full name first
        const fullName = `${user.first_name} ${user.last_name}`.trim();
        if (fullName) {
            return fullName;
        }

        // Fallback for unnamed users
        if (isOwnProfile) {
            return t("sections.my_profile", { ns: "users" });
        }

        return t("values.status_unnamed_user", { ns: "users" });
    };

    const getUserInitials = () => {
        if (isNewUser) {
            return "U";
        }
        const firstName = user.first_name || "";
        const lastName = user.last_name || "";
        return (
            `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U"
        );
    };

    return (
        <Paper
            sx={{
                p: 4,
                mb: 3,
                background: "white",
                borderRadius: 2,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                border: "1px solid #e0e0e0",
                position: "relative",
                overflow: "hidden",
            }}
            elevation={0}
        >
            {/* Background Pattern */}
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: "200px",
                    height: "100%",
                    background:
                        "linear-gradient(135deg, rgba(25, 118, 210, 0.03) 0%, rgba(25, 118, 210, 0.08) 100%)",
                    clipPath: "polygon(100% 0, 0% 100%, 100% 100%)",
                }}
            />

            <Box sx={{ position: "relative", zIndex: 1 }}>
                {/* Breadcrumbs */}
                <Breadcrumbs
                    sx={{
                        mb: 3,
                        width: "100%",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                        "& .MuiBreadcrumbs-ol": {
                            flexWrap: "nowrap",
                            overflow: "hidden",
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                        },
                        "& .MuiBreadcrumbs-li": {
                            minWidth: 0,
                            flexShrink: 1,
                            maxWidth: "none",
                        },
                        "& .MuiBreadcrumbs-separator": {
                            marginLeft:
                                i18n.language === "he" ? 0 : theme.spacing(1),
                            marginRight:
                                i18n.language === "he" ? theme.spacing(1) : 0,
                        },
                    }}
                >
                    {(() => {
                        const breadcrumbItems =
                            accountId && accountName
                                ? [
                                    <Link
                                        key="accounts"
                                        component="button"
                                        variant="body1"
                                        onClick={() => window.history.back()}
                                        sx={{
                                            textDecoration: "none",
                                            color: "primary.main",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            minWidth: 0,
                                            flexShrink: 1,
                                            display: "block",
                                            maxWidth: "none",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        }}
                                    >
                                        {t("sections.accounts_title", {
                                            ns: "accounts",
                                        })}
                                    </Link>,
                                    <Link
                                        key="account-name"
                                        component="button"
                                        variant="body1"
                                        onClick={() => window.history.back()}
                                        sx={{
                                            textDecoration: "none",
                                            color: "primary.main",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            minWidth: 0,
                                            flexShrink: 1,
                                            display: "block",
                                            maxWidth: "none",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        }}
                                    >
                                        {accountName}
                                    </Link>,
                                    <Typography
                                        key="current"
                                        color="text.primary"
                                        sx={{
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            minWidth: 0,
                                            flexShrink: 1,
                                            display: "block",
                                            maxWidth: "none",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        }}
                                    >
                                        {isNewUser
                                            ? t("actions.add_user", {
                                                ns: "users",
                                            })
                                            : getUserDisplayName()}
                                    </Typography>,
                                ]
                                : [
                                    <Link
                                        key="settings"
                                        component="button"
                                        variant="body1"
                                        onClick={() => window.history.back()}
                                        sx={{
                                            textDecoration: "none",
                                            color: "primary.main",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            minWidth: 0,
                                            flexShrink: 1,
                                            display: "block",
                                            maxWidth: "none",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        }}
                                    >
                                        {t("fields.title", {
                                            ns: "settings",
                                        })}
                                    </Link>,
                                    <Typography
                                        key="current"
                                        color="text.primary"
                                        sx={{
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            minWidth: 0,
                                            flexShrink: 1,
                                            display: "block",
                                            maxWidth: "none",
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                            textAlign:
                                                i18n.language === "he"
                                                    ? "right"
                                                    : "left",
                                        }}
                                    >
                                        {isNewUser
                                            ? t("actions.add_user", {
                                                ns: "users",
                                            })
                                            : getUserDisplayName()}
                                    </Typography>,
                                ];
                        return isHebrew
                            ? breadcrumbItems.slice().reverse()
                            : breadcrumbItems;
                    })()}
                </Breadcrumbs>

                <Box
                    sx={{
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        gap: 3,
                        alignItems: { xs: "stretch", sm: "center" },
                        justifyContent: "space-between",
                    }}
                >
                    {/* User Info Section */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Avatar
                            sx={{
                                width: 72,
                                height: 72,
                                bgcolor: "primary.main",
                                color: "white",
                                border: "2px solid #e0e0e0",
                                fontSize: "1.5rem",
                                fontWeight: 600,
                            }}
                        >
                            {getUserInitials()}
                        </Avatar>

                        <Box>
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: { xs: "1.5rem", sm: "2rem" },
                                    color: "text.primary",
                                    mb: 0.5,
                                }}
                            >
                                {getUserDisplayName()}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Action Buttons Section */}
                    <Box>
                        <Stack
                            direction="row"
                            alignItems="center"
                            className="edit-action-button-group"
                            sx={{
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {/* Edit/Save/Cancel Buttons */}
                            {!isNewUser &&
                                !isEditing &&
                                hasManageUsersPermission && (
                                    <Button
                                        variant="contained"
                                        onClick={onEdit}
                                        sx={{
                                            bgcolor: "primary.main",
                                            color: "white",
                                            textTransform: "none",
                                            fontWeight: 600,
                                            boxShadow:
                                                "0 2px 8px rgba(25, 118, 210, 0.3)",
                                            "&:hover": {
                                                bgcolor: "primary.dark",
                                                boxShadow:
                                                    "0 4px 12px rgba(25, 118, 210, 0.4)",
                                                transform: "translateY(-1px)",
                                            },
                                            "&:active": {
                                                transform: "translateY(0)",
                                            },
                                            transition: "all 0.2s ease-in-out",
                                        }}
                                    >
                                        {t("actions.edit", { ns: "common" })}
                                    </Button>
                                )}

                            {(isNewUser || isEditing) && (
                                <>
                                    <Button
                                        variant="outlined"
                                        className="cancel-button"
                                        onClick={onCancel}
                                        disabled={isSaving}
                                    >
                                        {t("actions.cancel", { ns: "common" })}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={
                                            isSaving || isSaveDisabled
                                                ? undefined
                                                : onSave
                                        }
                                        fullWidth={false}
                                        className="save-button"
                                        disabled={isSaving || isSaveDisabled}
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
                                </>
                            )}
                        </Stack>
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
};

export default UserHeader;
