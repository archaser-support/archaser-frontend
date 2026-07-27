"use client";

import {
    Home as HomeIcon,
    Receipt as ReceiptIcon,
    Gavel as GavelIcon,
    Payment as PaymentIcon,
    CalendarToday as CalendarIcon,
    PersonRemove as PersonRemoveIcon,
    Report as ReportIcon,
} from "@mui/icons-material";
import {
    Box,
    useTheme,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { PORTAL_MENU_PAPER_CLASS } from "@/app/theme/portalMenu";
import { LanguageFlag } from "@/components/LocationSelects";
import { PortalUrls } from "@/utils/portalUrlUtils";

interface PortalDesktopMenuProps {
    customerUUID: string;
}

interface PortalMenuItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    path: string;
    translationKey: string;
}

const PortalDesktopMenu: React.FC<PortalDesktopMenuProps> = ({
    customerUUID,
}) => {
    const pathname = usePathname();
    const { t, i18n } = useTranslation(["portal", "common"]);
    const isRTL = i18n.language === "he";
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
        // Store portal-specific language preference
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

    // Determine the current language for LanguageFlag component
    const getCurrentLanguage = () => {
        return currentLocale === "he" ? "Hebrew" : "English";
    };

    const menuItems: PortalMenuItem[] = useMemo(
        () => [
            {
                id: "home",
                label: t("actions.navigation_home"),
                icon: <HomeIcon sx={{ fontSize: "1rem" }} />,
                path: PortalUrls.home(customerUUID, currentLocale),
                translationKey: "portal.navigation.home",
            },
            {
                id: "invoices",
                label: t("actions.navigation_invoices"),
                icon: <ReceiptIcon sx={{ fontSize: "1rem" }} />,
                path: PortalUrls.invoices(customerUUID, currentLocale),
                translationKey: "portal.navigation.invoices",
            },
            {
                id: "disputes",
                label: t("actions.navigation_disputes"),
                icon: <GavelIcon sx={{ fontSize: "1rem" }} />,
                path: PortalUrls.disputes(customerUUID, currentLocale),
                translationKey: "portal.navigation.disputes",
            },
            {
                id: "payment",
                label: t("actions.navigation_payment"),
                icon: <PaymentIcon sx={{ fontSize: "1rem" }} />,
                path: PortalUrls.makePayment(customerUUID, currentLocale),
                translationKey: "portal.navigation.payment",
            },
            {
                id: "promise-to-pay",
                label: t("actions.navigation_promise_to_pay"),
                icon: <CalendarIcon sx={{ fontSize: "1rem" }} />,
                path: PortalUrls.promiseToPay(customerUUID, currentLocale),
                translationKey: "portal.navigation.promise_to_pay",
            },
            {
                id: "report-contact",
                label: t("actions.navigation_report_contact"),
                icon: <PersonRemoveIcon sx={{ fontSize: "1rem" }} />,
                path: PortalUrls.reportWrongContact(
                    customerUUID,
                    currentLocale
                ),
                translationKey: "portal.navigation.report_contact",
            },
            {
                id: "create-dispute",
                label: t("actions.navigation_create_dispute"),
                icon: <ReportIcon sx={{ fontSize: "1rem" }} />,
                path: PortalUrls.createDispute(customerUUID, currentLocale),
                translationKey: "portal.navigation.create_dispute",
            },
        ],
        [t, customerUUID, currentLocale]
    );

    return (
        <Box
            sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                gap: 2,
                flexDirection: "row",
                direction: isRTL ? "rtl" : "ltr",
                opacity: 1,
            }}
        >
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
                        ? pathWithoutLocale === itemPathWithoutLocale
                        : pathWithoutLocale === itemPathWithoutLocale ||
                          pathWithoutLocale.startsWith(
                              `${itemPathWithoutLocale}/`
                          ));

                return (
                    <React.Fragment key={item.id}>
                        <Link
                            href={item.path}
                            prefetch={true}
                            style={{ textDecoration: "none", color: "inherit" }}
                        >
                            <Box
                                sx={(theme) => ({
                                    color: theme.palette.common.white,
                                    backgroundColor: isActive
                                        ? "rgba(255, 255, 255, 0.25)"
                                        : "transparent",
                                    padding: "6px 12px",
                                    fontSize: "0.75rem",
                                    fontWeight: isActive ? 600 : 500,
                                    textTransform: "none",
                                    minWidth: "auto",
                                    whiteSpace: "nowrap",
                                    border: "none",
                                    borderRadius:
                                        typeof theme.shape.borderRadius ===
                                        "number"
                                            ? theme.shape.borderRadius * 3
                                            : 6,
                                    transition: "all 0.2s ease-in-out",
                                    cursor: "pointer",
                                    userSelect: "none",
                                    position: "relative",
                                    boxShadow: isActive
                                        ? "0 2px 8px rgba(255, 255, 255, 0.2)"
                                        : "none",
                                    "&:hover": {
                                        backgroundColor: isActive
                                            ? "rgba(255, 255, 255, 0.3)"
                                            : "rgba(255, 255, 255, 0.15)",
                                        color: theme.palette.common.white,
                                        transform: "translateY(-1px)",
                                        boxShadow:
                                            "0 2px 8px rgba(255, 255, 255, 0.2)",
                                    },
                                    "&:active": {
                                        backgroundColor:
                                            "rgba(255, 255, 255, 0.25)",
                                        transform: "translateY(0)",
                                    },
                                    "&::after": isActive
                                        ? {
                                              content: '""',
                                              position: "absolute",
                                              bottom: "-2px",
                                              left: "50%",
                                              transform: "translateX(-50%)",
                                              width: "60%",
                                              height: "2px",
                                              backgroundColor:
                                                  theme.palette.common.white,
                                              borderRadius:
                                                  typeof theme.shape
                                                      .borderRadius === "number"
                                                      ? theme.shape.borderRadius
                                                      : 2,
                                              boxShadow:
                                                  "0 0 8px rgba(255, 255, 255, 0.6)",
                                          }
                                        : {},
                                })}
                            >
                                {item.label}
                            </Box>
                        </Link>
                        {index < menuItems.length - 1 && (
                            <Box
                                sx={{
                                    width: "1px",
                                    height: "12px",
                                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                                    borderRadius: "1px",
                                }}
                            />
                        )}
                    </React.Fragment>
                );
            })}

            {/* Language selector */}
            <Box
                sx={{
                    width: "1px",
                    height: "12px",
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    borderRadius: "1px",
                }}
            />
            <IconButton
                onClick={handleLanguageClick}
                sx={(theme) => ({
                    color: theme.palette.common.white,
                    padding: 0,
                    backgroundColor: "transparent",
                    "&:hover": {
                        backgroundColor: "transparent",
                    },
                })}
                aria-label="Change language"
            >
                <LanguageFlag language={getCurrentLanguage()} />
            </IconButton>

            {/* Language Menu */}
            <Menu
                anchorEl={languageAnchor}
                open={isLanguageMenuOpen}
                onClose={handleLanguageClose}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "right",
                }}
                transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
                slotProps={{
                    paper: {
                        className: PORTAL_MENU_PAPER_CLASS,
                        sx: (theme) => theme.portalMenu.paperBelowAnchor(theme),
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
                    <ListItemIcon sx={{ minWidth: 24 }}>
                        <LanguageFlag language="English" />
                    </ListItemIcon>
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
                    <ListItemIcon sx={{ minWidth: 24 }}>
                        <LanguageFlag language="Hebrew" />
                    </ListItemIcon>
                    עברית
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default PortalDesktopMenu;
