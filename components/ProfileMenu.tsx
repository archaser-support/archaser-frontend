"use client";
import { apiFetch } from "@/utils/apiFetch";

import { Person, Logout } from "@mui/icons-material";
import {
    Menu,
    Box,
    Typography,
    Avatar,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React from "react";
import { useTranslation } from "react-i18next";

type TransitionAny = React.ComponentType<any>;

interface ProfileMenuProps {
    anchorEl: HTMLElement | null;
    open: boolean;
    onClose: () => void;
    isHebrewUser: boolean;
    TransitionComponent?: TransitionAny;
    session: any;
    currentViewAsUser: any;
    effectiveUser: any;
    hasViewSettingsPermission?: boolean;
    loading?: boolean;
    onLogout: () => void;
}

const ProfileMenu: React.FC<ProfileMenuProps> = ({
    anchorEl,
    open,
    onClose,
    isHebrewUser,
    TransitionComponent,
    session,
    currentViewAsUser,
    effectiveUser,
    hasViewSettingsPermission = false,
    loading,
    onLogout,
}) => {
    const { t: tCommon } = useTranslation(["common"]);
    const { t: tUsers } = useTranslation(["users"]);
    const { t: tSecurityRoles } = useTranslation(["security_roles"]);
    const router = useRouter();

    // Fetch current user's data (including business unit) when not in view-as mode
    const { data: currentUserData } = useQuery({
        queryKey: ["current-user", session?.user?.id],
        queryFn: async () => {
            if (!session?.user?.id) return null;
            try {
                const response = await apiFetch(`/api/entities/users/${session.user.id}`
                );
                if (!response.ok) {
                    return null;
                }
                const userData = await response.json();
                return userData;
            } catch (error) {
                return null;
            }
        },
        enabled: !!session?.user?.id && !session?.user?.view_as_user_id,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });

    const getBusinessUnitName = () => {
        // If in view-as mode, use the view-as user's business unit
        if (
            session?.user?.view_as_user_id &&
            currentViewAsUser?.BusinessUnit?.name
        ) {
            return currentViewAsUser.BusinessUnit.name;
        }
        // Otherwise, use the current user's business unit
        if (currentUserData?.BusinessUnit?.name) {
            return currentUserData.BusinessUnit.name;
        }
        return null;
    };

    const getDisplayName = () => {
        if (session?.user?.view_as_user_id && currentViewAsUser) {
            if (currentViewAsUser.first_name && currentViewAsUser.last_name) {
                return `${currentViewAsUser.first_name} ${currentViewAsUser.last_name}`;
            }
            return currentViewAsUser.name || currentViewAsUser.email || "User";
        }
        return session?.user?.name || "User";
    };

    const getDisplayEmail = () => {
        if (session?.user?.view_as_user_id && currentViewAsUser) {
            return currentViewAsUser.email;
        }
        return session?.user?.email;
    };

    const getRoleTranslation = (role: string) => {
        if (!role) return "";
        // Use security_roles namespace with the role name directly (e.g., "archaser_admin", "System_Administrator")
        const translationKey = `values.${role}`;
        const translated = tSecurityRoles(translationKey, { defaultValue: "" });
        // If translation not found (empty string or same as key), format the role name as fallback
        if (!translated || translated === translationKey) {
            // Fallback: format the role name by replacing underscores with spaces and capitalizing
            return role
                .split("_")
                .map((word) => {
                    // Handle special case for "ARchaser Admin" (capitalize first two letters)
                    if (word.toLowerCase() === "archaser") {
                        return "ARchaser";
                    }
                    return (
                        word.charAt(0).toUpperCase() +
                        word.slice(1).toLowerCase()
                    );
                })
                .join(" ");
        }
        return translated;
    };

    return (
        <Menu
            sx={{ zIndex: (theme) => theme.zIndex.drawer - 2 }}
            anchorEl={anchorEl}
            open={open}
            onClose={onClose}
            TransitionComponent={TransitionComponent as any}
            anchorOrigin={{
                vertical: "bottom",
                horizontal: isHebrewUser ? "left" : "right",
            }}
            transformOrigin={{
                vertical: "top",
                horizontal: isHebrewUser ? "left" : "right",
            }}
            MenuListProps={{
                sx: {
                    padding: 0,
                },
            }}
            PaperProps={{
                sx: {
                    zIndex: (theme) => theme.zIndex.drawer - 2,
                    mt: 1.5,
                    backgroundColor: (theme) =>
                        alpha(theme.palette.common.white, 0.9),
                    backdropFilter: "blur(20px)",
                    border: "none",
                    borderRadius: (theme) =>
                        `${theme.appButton.sizeMedium.borderRadius}px`,
                    overflow: "hidden",
                    "& .MuiList-root": {
                        padding: 0,
                    },
                    minWidth: 280,
                    direction: isHebrewUser ? "rtl" : "ltr",
                    boxShadow:
                        "0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08)",
                    outline: "none",
                    "& .MuiMenuItem-root": {
                        color: (theme) => theme.palette.text.primary,
                        "&:hover": {
                            backgroundColor: (theme) =>
                                alpha(theme.palette.primary.main, 0.1),
                        },
                    },
                    "& .MuiDivider-root": {
                        display: "none",
                    },
                    "&::before, &::after": {
                        display: "none",
                    },
                    "& > *:first-of-type": {
                        borderTop: "none !important",
                    },
                },
            }}
        >
            {/* User Profile Card */}
            <Box
                sx={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: (theme) =>
                        session?.user?.view_as_user_id
                            ? `linear-gradient(135deg, ${theme.palette.error.main} 0%, ${theme.palette.warning.main} 100%)`
                            : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    color: (theme) => theme.palette.common.white,
                    position: "relative",
                    overflow: "hidden",
                }}
            >
                {session?.user?.view_as_user_id && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 0.75,
                            py: 1,
                            backgroundColor: (theme) =>
                                alpha(theme.palette.common.black, 0.15),
                            borderBottom: (theme) =>
                                `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
                            backdropFilter: "blur(10px)",
                        }}
                    >
                        <Box
                            sx={{
                                width: 6,
                                height: 6,
                                borderRadius: "50%",
                                backgroundColor: (theme) =>
                                    theme.palette.common.white,
                                animation: "pulse 2s infinite",
                                "@keyframes pulse": {
                                    "0%": { opacity: 1 },
                                    "50%": { opacity: 0.5 },
                                    "100%": { opacity: 1 },
                                },
                            }}
                        />
                        <Typography
                            variant={
                                isHebrewUser ? "hebrewBodyText" : "caption"
                            }
                            sx={{
                                fontWeight: 700,
                                fontSize: "0.65rem",
                                textTransform: "uppercase",
                                letterSpacing: "1px",
                                opacity: 0.95,
                            }}
                        >
                            {tCommon("view_as")}
                        </Typography>
                    </Box>
                )}

                <Box
                    sx={{
                        p: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        position: "relative",
                        zIndex: 1,
                        flexDirection: "row",
                    }}
                >
                    <Tooltip
                        title={getDisplayEmail() || ""}
                        placement="bottom"
                        arrow
                    >
                        <Avatar
                            sx={{
                                width: 48,
                                height: 48,
                                border: "3px solid rgba(255, 255, 255, 0.3)",
                                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                                cursor: "pointer",
                            }}
                        >
                            {/* Avatar image provided by parent IconButton; this is placeholder */}
                        </Avatar>
                    </Tooltip>
                    <Box
                        sx={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            direction: isHebrewUser ? "rtl" : "ltr",
                        }}
                    >
                        <Typography
                            variant={isHebrewUser ? "hebrewTitle" : "h6"}
                            sx={{
                                fontWeight: 700,
                                mb: effectiveUser?.role ? 0.5 : 0,
                                color: "white",
                            }}
                        >
                            {getDisplayName()}
                        </Typography>
                        {effectiveUser?.role && (
                            <Box
                                component="span"
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    px: 1.5,
                                    py: 0.25,
                                    borderRadius: 1,
                                    backgroundColor: (theme) =>
                                        alpha(theme.palette.common.white, 0.2),
                                    color: (theme) =>
                                        theme.palette.common.white,
                                    fontWeight: 600,
                                    fontSize: "0.75rem",
                                    height: 24,
                                    width: "fit-content",
                                    alignSelf: isHebrewUser
                                        ? "flex-start"
                                        : "flex-start",
                                    mb: getBusinessUnitName() ? 0.5 : 0,
                                    ...(isHebrewUser && {
                                        marginLeft: "auto",
                                        marginRight: 0,
                                    }),
                                }}
                            >
                                {getRoleTranslation(effectiveUser.role)}
                            </Box>
                        )}
                        {getBusinessUnitName() && (
                            <Typography
                                variant={
                                    isHebrewUser ? "hebrewBodyText" : "body2"
                                }
                                sx={{
                                    fontSize: "0.75rem",
                                    color: (theme) =>
                                        alpha(theme.palette.common.white, 0.85),
                                    fontWeight: 500,
                                    mt: effectiveUser?.role ? 0.5 : 0,
                                }}
                            >
                                {getBusinessUnitName()}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>

            <Box
                sx={{
                    p: 1,
                    backgroundColor: "transparent",
                    backdropFilter: "blur(20px)",
                }}
            >
                {session?.user?.view_as_user_id && currentViewAsUser ? (
                    <MenuItem
                        onClick={() => {
                            router.push(
                                `/app/settings/users/${session.user.view_as_user_id}`
                            );
                            onClose();
                        }}
                        sx={{
                            borderRadius: 2,
                            mb: 0.5,
                            py: 1.5,
                            backgroundColor: (theme) =>
                                alpha(theme.palette.error.main, 0.05),
                            "&:hover": {
                                backgroundColor: (theme) =>
                                    alpha(theme.palette.error.main, 0.1),
                                transform: `translateX(${isHebrewUser ? -4 : 4}px)`,
                                transition: "all 0.2s ease",
                            },
                        }}
                    >
                        <ListItemIcon
                            sx={{
                                minWidth: isHebrewUser ? "auto" : 40,
                                marginRight: isHebrewUser ? 0 : 1,
                                marginLeft: isHebrewUser ? 1 : 0,
                            }}
                        >
                            <Person
                                sx={{
                                    color: (theme) => theme.palette.error.main,
                                }}
                            />
                        </ListItemIcon>
                        <ListItemText
                            primary={
                                tCommon("actions.view_as_user_profile") ||
                                "Viewed User Profile"
                            }
                            secondary={getDisplayName()}
                            primaryTypographyProps={{
                                fontWeight: 600,
                                sx: {
                                    color: (theme) =>
                                        theme.palette.text.primary,
                                },
                            }}
                            secondaryTypographyProps={{
                                fontSize: "0.7rem",
                                sx: {
                                    color: (theme) =>
                                        theme.palette.text.secondary,
                                },
                            }}
                        />
                    </MenuItem>
                ) : (
                    <>
                        <MenuItem
                            onClick={() => {
                                router.push(
                                    `/app/settings/users/${session?.user?.id}`
                                );
                                onClose();
                            }}
                            sx={{
                                borderRadius: 2,
                                mb: 0.5,
                                py: 1.5,
                                "&:hover": {
                                    backgroundColor: (theme) =>
                                        alpha(theme.palette.primary.main, 0.1),
                                    transform: `translateX(${isHebrewUser ? -4 : 4}px)`,
                                    transition: "all 0.2s ease",
                                },
                            }}
                        >
                            <ListItemIcon
                                sx={{
                                    minWidth: isHebrewUser ? "auto" : 40,
                                    marginRight: isHebrewUser ? 0 : 1,
                                    marginLeft: isHebrewUser ? 1 : 0,
                                }}
                            >
                                <Person
                                    sx={{
                                        color: (theme) =>
                                            theme.palette.primary.main,
                                    }}
                                />
                            </ListItemIcon>
                            <ListItemText
                                primary={tCommon("actions.profile")}
                                primaryTypographyProps={{
                                    fontWeight: 500,
                                    sx: {
                                        color: (theme) =>
                                            theme.palette.text.primary,
                                    },
                                }}
                            />
                        </MenuItem>
                    </>
                )}

                <MenuItem
                    onClick={() => {
                        onLogout();
                        onClose();
                    }}
                    sx={{
                        borderRadius: 2,
                        py: 1.5,
                        "&:hover": {
                            backgroundColor: (theme) =>
                                alpha(theme.palette.error.main, 0.1),
                            transform: `translateX(${isHebrewUser ? -4 : 4}px)`,
                            transition: "all 0.2s ease",
                        },
                    }}
                >
                    <ListItemIcon
                        sx={{
                            minWidth: isHebrewUser ? "auto" : 40,
                            marginRight: isHebrewUser ? 0 : 1,
                            marginLeft: isHebrewUser ? 1 : 0,
                        }}
                    >
                        <Logout
                            sx={{
                                color: (theme) => theme.palette.error.main,
                                transform: isHebrewUser ? "scaleX(-1)" : "none",
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={tCommon("actions.logout")}
                        primaryTypographyProps={{
                            fontWeight: 500,
                            sx: {
                                color: (theme) => theme.palette.text.primary,
                            },
                        }}
                    />
                </MenuItem>
            </Box>
        </Menu>
    );
};

export default ProfileMenu;
