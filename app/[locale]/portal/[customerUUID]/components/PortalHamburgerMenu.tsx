"use client";

import {
    Business as BusinessIcon,
    CalendarToday as CalendarIcon,
    Close as CloseIcon,
    Gavel as GavelIcon,
    Home as HomeIcon,
    Menu as MenuIcon,
    Payment as PaymentIcon,
    PersonRemove as PersonRemoveIcon,
    Receipt as ReceiptIcon,
    Report as ReportIcon,
    Translate as TranslateIcon,
} from "@mui/icons-material";
import {
    Avatar,
    Box,
    Divider,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    ListItemIcon as MenuListItemIcon,
    Typography,
    useTheme,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getPortalLogoAvatarSx } from "@/app/theme/portalCard";
import { PORTAL_LOGO_AVATAR_BORDER_RADIUS_PX } from "@/app/theme/constants";
import { PORTAL_MENU_PAPER_CLASS } from "@/app/theme/portalMenu";
import { LanguageFlag } from "@/components/LocationSelects";
import { PortalUrls } from "@/utils/portalUrlUtils";

interface PortalHamburgerMenuProps {
    customerUUID: string;
    customerName: string | null;
    logo?: string | null;
}

interface PortalMenuItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    path: string;
    translationKey: string;
}

const PortalHamburgerMenu: React.FC<PortalHamburgerMenuProps> = ({
    customerUUID,
    customerName,
    logo,
}) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["portal", "common"]);
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [languageAnchor, setLanguageAnchor] = useState<null | HTMLElement>(
        null
    );
    const handleLanguageClick = (event: React.MouseEvent<HTMLElement>) => {
        setLanguageAnchor(event.currentTarget);
    };

    const handleLanguageClose = () => {
        setLanguageAnchor(null);
    };

    const handleLanguageChange = (language: string) => {
        // Store portal-specific language preference in cookie
        const cookieExpiry = 365 * 24 * 60 * 60; // 1 year
        document.cookie = `portal_language_preference=${language}; path=/; max-age=${cookieExpiry}; SameSite=Lax`;
        localStorage.setItem("portal_language_preference", language);

        setLanguageAnchor(null);

        // Update URL to reflect the new language - URL is the source of truth
        const currentPath = pathname || window.location.pathname;
        const newPath = currentPath.replace(/^\/[a-z]{2}/, `/${language}`);

        // Construct full URL for hard refresh
        const newUrl =
            window.location.origin + newPath + window.location.search;

        // Use hard refresh - full page reload with new locale
        window.location.href = newUrl;
    };

    const isLanguageMenuOpen = Boolean(languageAnchor);

    // Extract locale from pathname (source of truth)
    const currentLocale = pathname?.match(/^\/([a-z]{2})\//)?.[1] || "en";
    const isRTL = currentLocale === "he";

    // Determine the current language for LanguageFlag component
    const getCurrentLanguage = () => {
        return currentLocale === "he" ? "Hebrew" : "English";
    };

    const menuItems: PortalMenuItem[] = useMemo(
        () => [
            {
                id: "home",
                label: t("actions.navigation_home"),
                icon: <HomeIcon />,
                path: PortalUrls.home(customerUUID, currentLocale),
                translationKey: "portal.navigation.home",
            },
            {
                id: "invoices",
                label: t("actions.navigation_invoices"),
                icon: <ReceiptIcon />,
                path: PortalUrls.invoices(customerUUID, currentLocale),
                translationKey: "portal.navigation.invoices",
            },
            {
                id: "disputes",
                label: t("actions.navigation_disputes"),
                icon: <GavelIcon />,
                path: PortalUrls.disputes(customerUUID, currentLocale),
                translationKey: "portal.navigation.disputes",
            },
            {
                id: "payment",
                label: t("actions.navigation_payment"),
                icon: <PaymentIcon />,
                path: PortalUrls.makePayment(customerUUID, currentLocale),
                translationKey: "portal.navigation.payment",
            },
            {
                id: "promise-to-pay",
                label: t("actions.navigation_promise_to_pay"),
                icon: <CalendarIcon />,
                path: PortalUrls.promiseToPay(customerUUID, currentLocale),
                translationKey: "portal.navigation.promise_to_pay",
            },
            {
                id: "report-contact",
                label: t("actions.navigation_report_contact"),
                icon: <PersonRemoveIcon />,
                path: PortalUrls.reportWrongContact(
                    customerUUID,
                    currentLocale
                ),
                translationKey: "portal.navigation.report_contact",
            },
            {
                id: "create-dispute",
                label: t("actions.navigation_create_dispute"),
                icon: <ReportIcon />,
                path: PortalUrls.createDispute(customerUUID, currentLocale),
                translationKey: "portal.navigation.create_dispute",
            },
        ],
        [t, customerUUID, currentLocale]
    );

    const handleMenuToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleMenuItemClick = () => {
        setIsOpen(false);
    };

    const handleBackdropClick = () => {
        setIsOpen(false);
    };

    return (
        <>
            {/* Hamburger Menu Button */}
            <IconButton
                onClick={handleMenuToggle}
                sx={{
                    color: "white",
                    display: { xs: "flex", sm: "none" },
                    "&:hover": {
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                    },
                }}
                aria-label="Open menu"
            >
                <MenuIcon />
            </IconButton>

            {/* Drawer - opens from right for Hebrew (RTL), left for English */}
            <Drawer
                anchor={isRTL ? "right" : "left"}
                open={isOpen}
                onClose={handleBackdropClick}
                sx={(theme) => ({
                    "& .MuiDrawer-paper": {
                        width: { xs: "280px", sm: "320px" },
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        direction: isRTL ? "rtl" : "ltr",
                        backgroundColor: theme.palette.common.white,
                        boxShadow: `0 8px 32px ${theme.palette.mode === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)"}`,
                    },
                })}
            >
                {/* Header */}
                <Box
                    sx={(theme) => ({
                        flexShrink: 0,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                        color: theme.palette.common.white,
                        p: { xs: 1.25, sm: 2 },
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        minHeight: { xs: "48px", sm: "64px" },
                    })}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 } }}>
                        <Avatar
                            variant="square"
                            src={logo || undefined}
                            alt="Company Logo"
                            sx={(theme) => ({
                                ...getPortalLogoAvatarSx(theme),
                                width: { xs: "32px", sm: "40px" },
                                height: { xs: "32px", sm: "40px" },
                                backgroundColor: theme.palette.common.white,
                                color: theme.palette.primary.main,
                                "& img": {
                                    borderRadius: `${PORTAL_LOGO_AVATAR_BORDER_RADIUS_PX}px`,
                                    objectFit: "contain",
                                    width: "100%",
                                    height: "100%",
                                },
                            })}
                        >
                            {!logo && (
                                <BusinessIcon
                                    sx={{ fontSize: { xs: 20, sm: 24 } }}
                                />
                            )}
                        </Avatar>
                        <Typography
                            variant="h6"
                            sx={(theme) => ({
                                fontWeight: 600,
                                fontSize: { xs: "0.875rem", sm: "1rem" },
                                color: theme.palette.common.white,
                            })}
                        >
                            {customerName || "Portal"}
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={handleMenuToggle}
                        sx={(theme) => ({
                            color: theme.palette.common.white,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.1)",
                            },
                        })}
                        aria-label="Close menu"
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Navigation Items */}
                <Box sx={{ flex: 1, overflow: "auto" }}>
                    <List sx={{ py: 0 }}>
                        {menuItems.map((item, index) => {
                            // Extract path without locale prefix for comparison
                            const pathWithoutLocale =
                                pathname?.replace(/^\/[a-z]{2}/, "") || "";
                            const itemPathWithoutLocale =
                                item.path.replace(/^\/[a-z]{2}/, "") || "";

                            // Check if this menu item is active
                            // Special case: home should only match exactly, not as a prefix
                            const isActive =
                                pathWithoutLocale &&
                                (item.id === "home"
                                    ? pathWithoutLocale ===
                                    itemPathWithoutLocale
                                    : pathWithoutLocale ===
                                    itemPathWithoutLocale ||
                                    pathWithoutLocale.startsWith(
                                        `${itemPathWithoutLocale}/`
                                    ));

                            return (
                                <React.Fragment key={item.id}>
                                    <ListItem disablePadding>
                                        <ListItemButton
                                            component={Link}
                                            href={item.path}
                                            onClick={handleMenuItemClick}
                                            prefetch={true}
                                            sx={{
                                                py: { xs: 0.75, sm: 2 },
                                                px: 3,
                                                position: "relative",
                                                direction: isRTL ? "rtl" : "ltr",
                                                justifyContent: isRTL
                                                    ? "flex-end"
                                                    : "flex-start",
                                                backgroundColor: isActive
                                                    ? "rgba(107, 70, 193, 0.12)"
                                                    : "transparent",
                                                ...(isRTL
                                                    ? {
                                                        borderRight: isActive
                                                            ? `3px solid ${theme.palette.primary.main}`
                                                            : "3px solid transparent",
                                                    }
                                                    : {
                                                        borderLeft: isActive
                                                            ? `3px solid ${theme.palette.primary.main}`
                                                            : "3px solid transparent",
                                                    }),
                                                transition: "all 0.3s ease",
                                                "& .MuiListItemIcon-root": {
                                                    marginLeft: isRTL
                                                        ? theme.spacing(2)
                                                        : 0,
                                                    marginRight: isRTL
                                                        ? 0
                                                        : theme.spacing(2),
                                                },
                                                "&:hover": {
                                                    backgroundColor: isActive
                                                        ? "rgba(107, 70, 193, 0.16)"
                                                        : "rgba(107, 70, 193, 0.08)",
                                                },
                                                "&:active": {
                                                    backgroundColor:
                                                        "rgba(107, 70, 193, 0.12)",
                                                },
                                            }}
                                        >
                                            <ListItemIcon
                                                sx={{
                                                    color: theme.palette.primary
                                                        .main,
                                                    minWidth: "40px",
                                                    transition: "all 0.3s ease",
                                                    transform: isActive
                                                        ? "scale(1.1)"
                                                        : "scale(1)",
                                                }}
                                            >
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            fontWeight: isActive
                                                                ? 600
                                                                : 500,
                                                            color: isActive
                                                                ? theme.palette
                                                                    .primary
                                                                    .main
                                                                : theme.palette
                                                                    .text
                                                                    .primary,
                                                            direction: isRTL
                                                                ? "rtl"
                                                                : "ltr",
                                                            textAlign: isRTL
                                                                ? "right"
                                                                : "left",
                                                            width: "100%",
                                                            transition:
                                                                "all 0.3s ease",
                                                        }}
                                                    >
                                                        {item.label}
                                                    </Typography>
                                                }
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                    {index < menuItems.length - 1 && (
                                        <Divider sx={{ mx: 2 }} />
                                    )}
                                </React.Fragment>
                            );
                        })}
                        <Divider sx={{ mx: 2 }} />
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={handleLanguageClick}
                                sx={{
                                    py: { xs: 0.75, sm: 2 },
                                    px: 3,
                                    position: "relative",
                                    direction: isRTL ? "rtl" : "ltr",
                                    justifyContent: isRTL
                                        ? "flex-end"
                                        : "flex-start",
                                    transition: "all 0.3s ease",
                                    "& .MuiListItemIcon-root": {
                                        marginLeft: isRTL
                                            ? theme.spacing(2)
                                            : 0,
                                        marginRight: isRTL
                                            ? 0
                                            : theme.spacing(2),
                                    },
                                    "&:hover": {
                                        backgroundColor:
                                            "rgba(107, 70, 193, 0.08)",
                                    },
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        color: theme.palette.primary.main,
                                        minWidth: "40px",
                                    }}
                                >
                                    <TranslateIcon />
                                </ListItemIcon>
                                <ListItemText
                                    sx={{
                                        flex: 1,
                                        minWidth: 0,
                                        "& .MuiListItemText-primary": {
                                            textAlign: isRTL
                                                ? "right"
                                                : "left",
                                        },
                                        "& .MuiListItemText-secondary": {
                                            textAlign: isRTL
                                                ? "right"
                                                : "left",
                                        },
                                    }}
                                    primary={
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                fontWeight: 500,
                                                color: theme.palette.text
                                                    .primary,
                                                direction: isRTL
                                                    ? "rtl"
                                                    : "ltr",
                                                textAlign: isRTL
                                                    ? "right"
                                                    : "left",
                                                width: "100%",
                                            }}
                                        >
                                            {t("actions.navigation_language")}
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                color: theme.palette.text
                                                    .secondary,
                                                direction: isRTL
                                                    ? "rtl"
                                                    : "ltr",
                                                textAlign: isRTL
                                                    ? "right"
                                                    : "left",
                                                width: "100%",
                                                display: "block",
                                            }}
                                        >
                                            {currentLocale === "he"
                                                ? "עברית"
                                                : "English"}
                                        </Typography>
                                    }
                                />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>

                {/* Footer */}
                <Box
                    sx={(theme) => ({
                        flexShrink: 0,
                        p: 2,
                        borderTop: `1px solid ${theme.palette.grey[200]}`,
                        backgroundColor: theme.palette.grey[50],
                    })}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                flex: 1,
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    color: theme.palette.text.secondary,
                                    fontSize: "0.75rem",
                                    textAlign: "left",
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                {t("fields.general_powered_by")}
                            </Typography>
                            <Box
                                component="img"
                                src="/assets/images/brand-logos/logo.png"
                                alt="Archaser"
                                sx={{
                                    height: "16px",
                                    width: "auto",
                                    objectFit: "contain",
                                    filter: "brightness(0.7)",
                                    opacity: 0.8,
                                }}
                            />
                        </Box>

                        {/* Language selector */}
                        <IconButton
                            onClick={handleLanguageClick}
                            sx={{
                                color: theme.palette.primary.main,
                                padding: 0,
                                backgroundColor: "transparent",
                                "&:hover": {
                                    backgroundColor: "transparent",
                                },
                            }}
                            aria-label="Change language"
                        >
                            <LanguageFlag language={getCurrentLanguage()} />
                        </IconButton>
                    </Box>

                    {/* Language Menu */}
                    <Menu
                        anchorEl={languageAnchor}
                        open={isLanguageMenuOpen}
                        onClose={handleLanguageClose}
                        anchorOrigin={{
                            vertical: "top",
                            horizontal: "right",
                        }}
                        transformOrigin={{
                            vertical: "bottom",
                            horizontal: "right",
                        }}
                        slotProps={{
                            paper: {
                                className: PORTAL_MENU_PAPER_CLASS,
                                sx: (theme) =>
                                    theme.portalMenu.paperAboveAnchor(theme),
                            },
                        }}
                    >
                        <MenuItem
                            onClick={() => handleLanguageChange("en")}
                            selected={currentLocale === "en"}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                direction: "ltr",
                            }}
                        >
                            <MenuListItemIcon sx={{ minWidth: 24 }}>
                                <LanguageFlag language="English" />
                            </MenuListItemIcon>
                            English
                        </MenuItem>
                        <MenuItem
                            onClick={() => handleLanguageChange("he")}
                            selected={currentLocale === "he"}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                direction: "rtl",
                            }}
                        >
                            <MenuListItemIcon sx={{ minWidth: 24 }}>
                                <LanguageFlag language="Hebrew" />
                            </MenuListItemIcon>
                            עברית
                        </MenuItem>
                    </Menu>
                </Box>
            </Drawer>
        </>
    );
};

export default PortalHamburgerMenu;
