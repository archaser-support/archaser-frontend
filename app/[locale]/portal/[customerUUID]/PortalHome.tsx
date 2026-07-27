"use client";
import "@/utils/logoCacheManager"; // Initialize cache manager
import {
    CalendarToday,
    Gavel,
    Payment,
    PersonRemove,
} from "@mui/icons-material";
import { Box, Button, Card, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

import {
    getPortalCardSx,
    PORTAL_ACTION_CARD_CLASS,
    PORTAL_CARD_CLASS,
} from "@/app/theme/portalCard";
import { useRouter } from "next/navigation";
import { memo, ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";

// Centralized function to check if customer has outstanding debt
const checkHasOutstandingDebt = (
    customerDetails: any,
    collectionPeriod?: any
) => {
    // Primary check: Use total_invoices_overdue as the main indicator
    const totalInvoicesOverdue = customerDetails.total_invoices_overdue || 0;
    const numberOfOverdueInvoices =
        customerDetails.number_of_overdue_invoices || 0;
    const totalDueAmount = customerDetails.total_due_amount || 0;

    // Secondary check: Currency-specific amounts (fallback)
    const dueAmount1 = customerDetails.customer_due_amount1 || 0;
    const dueAmount2 = customerDetails.customer_due_amount2 || 0;
    const overdueAmount1 = collectionPeriod?.customer_outstanding_amount1 || 0;
    const overdueAmount2 = collectionPeriod?.customer_outstanding_amount2 || 0;

    // Prioritize total_invoices_overdue as the primary indicator
    const result =
        totalInvoicesOverdue > 0 ||
        numberOfOverdueInvoices > 0 ||
        totalDueAmount > 0 ||
        dueAmount1 > 0 ||
        dueAmount2 > 0 ||
        overdueAmount1 > 0 ||
        overdueAmount2 > 0;

    return result;
};

// Function to determine invoice scenario
const getInvoiceScenario = (customerDetails: any, collectionPeriod?: any) => {
    const totalInvoicesOverdue = customerDetails.total_invoices_overdue || 0;
    const numberOfOverdueInvoices =
        customerDetails.number_of_overdue_invoices || 0;
    const totalDueAmount = customerDetails.total_due_amount || 0;
    const dueAmount1 = customerDetails.customer_due_amount1 || 0;
    const dueAmount2 = customerDetails.customer_due_amount2 || 0;
    const overdueAmount1 = collectionPeriod?.customer_outstanding_amount1 || 0;
    const overdueAmount2 = collectionPeriod?.customer_outstanding_amount2 || 0;

    const hasOverdue =
        totalInvoicesOverdue > 0 ||
        numberOfOverdueInvoices > 0 ||
        overdueAmount1 > 0 ||
        overdueAmount2 > 0;
    const hasDue = totalDueAmount > 0 || dueAmount1 > 0 || dueAmount2 > 0;

    if (hasOverdue && hasDue) {
        return "both";
    } else if (hasOverdue && !hasDue) {
        return "overdue_only";
    } else if (!hasOverdue && hasDue) {
        return "due_only";
    } else {
        return "none";
    }
};

import { useLogoPreloader } from "@/hooks/useLogoPreloader";
import { PortalUrls } from "@/utils/portalUrlUtils";
import {
    resolveCustomerFirstCurrency,
    formatAmountWithoutSymbol,
} from "@/utils/stringFormatters";

import type { ICustomerDetails } from "./page";

// Types
interface CustomerDetailsProps {
    customerDetails: ICustomerDetails;
}

interface HeroSectionProps {
    customerName: string;
    totalOverdue: number;
    customer_currency1?: string;
    customer_outstanding_amount1?: number;
    customer_currency2?: string;
    customer_outstanding_amount2?: number;
    // Add due amount props
    customer_due_amount1?: number;
    customer_due_currency1?: string;
    customer_due_amount2?: number;
    customer_due_currency2?: string;
    // Add total amount props
    total_due_amount?: number;
    total_outstanding_amount?: number;
    total_invoices_overdue?: number;
    number_of_overdue_invoices?: number;
    currency?: string;
    customerUUID: string;
    disputeCount?: number;
    nextPaymentDate?: string;
    currentCategory?: string | undefined;
    language?: string;
}

interface SecondaryActionsProps {
    customerUUID: string;
    language?: string;
}

interface ActionCardProps {
    title: string;
    subtitle: string;
    icon: ReactNode;
    color: string;
    onClick: () => void;
}

// Theme styles - extracted for better organization
const getStyles = (theme: Theme) => ({
    container: {
        width: "100%",
    },
    heroSection: {
        pt: { xs: 2, sm: 3 },
        pb: { xs: 1, sm: 2 },
        px: { xs: 0, sm: 3 },
        textAlign: "center",
        position: "relative",
        width: "100%",
    },
    heroContent: {
        position: "relative",
        zIndex: 1,
    },
    heroTitle: {
        mb: 2,
        fontWeight: 700,
        fontSize: { xs: "1.75rem", sm: "2.5rem", md: "3rem" },
    },
    cardContainer: {
        p: { xs: 1, sm: 2 },
        maxWidth: { xs: "95%", sm: 800, md: 1000 },
        mx: "auto",
        width: "100%",
        boxSizing: "border-box",
    },
    glassCard: {
        borderRadius: theme.portalCard.borderRadius(theme),
        border: theme.portalCard.border(theme),
        backgroundColor: theme.palette.background.paper,
        boxShadow: "none",
        backgroundImage: "none",
        p: { xs: 1.5, sm: 2 },
        position: "relative",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box",
    },
    cardContent: {
        position: "relative",
        zIndex: 1,
        display: "flex",
        flexDirection: "column",
    },
    cardRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: { xs: "wrap", sm: "nowrap" },
        gap: 2,
        direction: "inherit",
    },
    cardText: {
        flex: 1,
        minWidth: 0,
    },
    heroButton: theme.portalButton.hero(),
    actionGrid: {
        display: "grid",
        gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(2, 1fr)",
            md: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
        },
        gap: { xs: 1.5, sm: 2 },
        boxShadow: "none",
        "& > *": {
            boxShadow: "none !important",
            backgroundImage: "none !important",
            "--Paper-shadow": "none",
            filter: "none",
        },
    },
    actionCard: {
        borderRadius: theme.portalCard.borderRadius(theme),
        border: theme.portalCard.border(theme),
        backgroundColor: theme.palette.background.paper,
        boxShadow: "none",
        backgroundImage: "none",
        p: 2,
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color 0.2s ease-in-out",
        filter: "none",
        "&:hover": {
            boxShadow: "none !important",
        },
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        mx: "auto",
        mb: 1.5,
        boxShadow: "none !important",
        filter: "none",
    },
});

// Utility functions
const formatAmount = (amount: number, currency?: string): string => {
    const formattedAmount = formatAmountWithoutSymbol(amount);
    return currency ? `${formattedAmount} ${currency}` : `${formattedAmount}`;
};

// Main Component
export default function PortalHome({ customerDetails }: CustomerDetailsProps) {
    const theme = useTheme();
    const {
        customerUUID,
        customerName,
        logo,
        CustomerCollectionPeriod: {
            currency,
            customer_currency1,
            total_outstanding_amount,
            customer_outstanding_amount1,
            customer_outstanding_amount2,
            customer_currency2,
        },
        nextPaymentDate,
        disputeCount,
        language,
    } = customerDetails;

    const { t, i18n } = useTranslation(["portal", "invoices", "common"]);
    const styles = getStyles(theme);

    // No language sync needed - TranslationsProvider initializes i18n with URL locale
    // URL is the source of truth, i18n is initialized correctly on server

    // Preload logo for better performance across portal pages
    useLogoPreloader({
        s3Paths: logo ? [logo] : [],
        immediate: false,
        delay: 2000, // Preload after 2 seconds to not interfere with initial load
    });

    return (
        <Box sx={styles.container}>
            <Box sx={{ mt: 2 }}>
                <HeroSection
                    customerName={customerDetails.customerName}
                    totalOverdue={customerDetails.totalOverdue}
                    customer_currency1={customer_currency1 || undefined}
                    customer_outstanding_amount1={
                        customer_outstanding_amount1 || undefined
                    }
                    customer_currency2={customer_currency2 || undefined}
                    customer_outstanding_amount2={
                        customer_outstanding_amount2 || undefined
                    }
                    // Add due amount props
                    customer_due_amount1={
                        customerDetails.customer_due_amount1 || undefined
                    }
                    customer_due_currency1={
                        customerDetails.customer_due_currency1 || undefined
                    }
                    customer_due_amount2={
                        customerDetails.customer_due_amount2 || undefined
                    }
                    customer_due_currency2={
                        customerDetails.customer_due_currency2 || undefined
                    }
                    // Add total amount props
                    total_due_amount={
                        customerDetails.total_due_amount || undefined
                    }
                    total_invoices_overdue={
                        customerDetails.total_invoices_overdue || undefined
                    }
                    number_of_overdue_invoices={
                        customerDetails.number_of_overdue_invoices || undefined
                    }
                    currency={
                        resolveCustomerFirstCurrency({
                            customerCurrencyPrimary:
                                customerDetails.customer_due_currency1,
                            customerCurrencySecondary:
                                customerDetails.customer_due_currency2,
                            collectionCurrencyPrimary: customer_currency1,
                            collectionCurrencySecondary: customer_currency2,
                            fallbackCurrency: customerDetails.currency || currency,
                        }) || undefined
                    }
                    customerUUID={customerUUID}
                    disputeCount={disputeCount}
                    nextPaymentDate={nextPaymentDate}
                    currentCategory={
                        customerDetails.promise_to_pay
                            ? "Promise to pay"
                            : undefined
                    }
                    language={language}
                />
            </Box>

            <SecondaryActions customerUUID={customerUUID} language={language} />
        </Box>
    );
}

// Memoized Hero Section
const HeroSection = memo(
    ({
        customerName,
        totalOverdue,
        customer_currency1,
        customer_outstanding_amount1,
        customer_currency2,
        customer_outstanding_amount2,
        customer_due_amount1,
        customer_due_currency1,
        customer_due_amount2,
        customer_due_currency2,
        total_due_amount,
        total_invoices_overdue,
        number_of_overdue_invoices,
        currency,
        customerUUID,
        disputeCount,
        nextPaymentDate,
        currentCategory,
        language,
    }: HeroSectionProps) => {
        const router = useRouter();
        const theme = useTheme();
        const { t, i18n } = useTranslation(["portal", "invoices", "common"]);
        const styles = getStyles(theme);

        const handleViewInvoices = useCallback(() => {
            router.push(PortalUrls.invoices(customerUUID, language));
        }, [router, customerUUID, language]);

        const handleViewDispute = useCallback(() => {
            router.push(PortalUrls.disputes(customerUUID, language));
        }, [router, customerUUID, language]);

        // Use centralized function to check outstanding debt and determine scenario
        const invoiceScenario = getInvoiceScenario(
            {
                total_invoices_overdue: total_invoices_overdue,
                number_of_overdue_invoices: number_of_overdue_invoices,
                total_due_amount: total_due_amount,
                customer_due_amount1: customer_due_amount1,
                customer_due_amount2: customer_due_amount2,
            },
            {
                customer_outstanding_amount1: customer_outstanding_amount1,
                customer_outstanding_amount2: customer_outstanding_amount2,
            }
        );
        const hasActiveDispute =
            disputeCount !== undefined &&
            disputeCount !== null &&
            disputeCount > 0;
        const fallbackOverdueDisplayCurrency = resolveCustomerFirstCurrency({
            collectionCurrencyPrimary: customer_currency1,
            collectionCurrencySecondary: customer_currency2,
            accountCurrency: currency,
        });
        const fallbackDueDisplayCurrency = resolveCustomerFirstCurrency({
            customerCurrencyPrimary: customer_due_currency1,
            customerCurrencySecondary: customer_due_currency2,
            accountCurrency: currency,
        });

        return (
            <Box sx={styles.heroSection}>
                <Box sx={styles.heroContent}>
                    {/* Account Summary Title - split on mobile for better readability */}
                    <Typography
                        variant={i18n.language === "he" ? "hebrewTitle" : "h3"}
                        component="div"
                        sx={(theme) => ({
                            fontWeight: 700,
                            fontSize: {
                                xs: "1.5rem",
                                sm: "2rem",
                                md: "2.5rem",
                            },
                            mb: { xs: 1, sm: 2 },
                            textAlign: "center",
                            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                            backgroundClip: "text",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        })}
                    >
                        <Box
                            component="span"
                            sx={{ display: { xs: "block", sm: "inline" } }}
                        >
                            {t("fields.general_account_summary_for")}
                        </Box>{" "}
                        <Box
                            component="span"
                            sx={{ display: { xs: "block", sm: "inline" } }}
                        >
                            {customerName}
                        </Box>
                    </Typography>

                    {(() => {
                        switch (invoiceScenario) {
                            case "overdue_only":
                                return (
                                    <Box sx={styles.cardContainer}>
                                        <Box sx={styles.glassCard}>
                                            <Box sx={styles.cardContent}>
                                                <Box
                                                    sx={{
                                                        ...styles.cardRow,
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            ...styles.cardText,
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            alignItems:
                                                                "center",
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "hebrewTitle"
                                                                    : "h4"
                                                            }
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: {
                                                                    xs: "1.25rem",
                                                                    sm: "2rem",
                                                                },
                                                                whiteSpace:
                                                                    "nowrap",
                                                                overflow:
                                                                    "hidden",
                                                                textOverflow:
                                                                    "ellipsis",
                                                                color: "text.primary",
                                                                ...(i18n.language !==
                                                                    "he" && {
                                                                    textAlign:
                                                                        "center",
                                                                }),
                                                            }}
                                                        >
                                                            {(() => {
                                                                let result = "";
                                                                if (
                                                                    customer_outstanding_amount1 &&
                                                                    customer_outstanding_amount1 >
                                                                    0
                                                                ) {
                                                                    result =
                                                                        formatAmount(
                                                                            customer_outstanding_amount1,
                                                                            customer_currency1 ||
                                                                                fallbackOverdueDisplayCurrency
                                                                        );
                                                                }
                                                                if (
                                                                    customer_outstanding_amount2 &&
                                                                    customer_outstanding_amount2 >
                                                                    0 &&
                                                                    customer_currency1 !==
                                                                    customer_currency2
                                                                ) {
                                                                    if (result)
                                                                        result +=
                                                                            " + ";
                                                                    result +=
                                                                        formatAmount(
                                                                            customer_outstanding_amount2,
                                                                            customer_currency2
                                                                        );
                                                                }
                                                                if (
                                                                    !result ||
                                                                    result ===
                                                                    "0"
                                                                ) {
                                                                    const totalInvoicesOverdue =
                                                                        total_invoices_overdue ||
                                                                        0;
                                                                    if (
                                                                        totalInvoicesOverdue >
                                                                        0
                                                                    ) {
                                                                        result =
                                                                            formatAmount(
                                                                                totalInvoicesOverdue,
                                                                                fallbackOverdueDisplayCurrency
                                                                            );
                                                                    }
                                                                }
                                                                return (
                                                                    result ||
                                                                    "0"
                                                                );
                                                            })()}
                                                        </Typography>
                                                        <Typography
                                                            variant={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "hebrewBodyText"
                                                                    : "body1"
                                                            }
                                                            sx={{
                                                                opacity: 0.9,
                                                                fontSize: {
                                                                    xs: "0.875rem",
                                                                    sm: "1rem",
                                                                },
                                                                color: "text.primary",
                                                                ...(i18n.language !==
                                                                    "he" && {
                                                                    textAlign:
                                                                        "center",
                                                                }),
                                                            }}
                                                        >
                                                            {t(
                                                                "fields.general_your_outstanding_amount"
                                                            )}
                                                        </Typography>
                                                        {hasActiveDispute && (
                                                            <Box sx={{ mt: 1 }}>
                                                                <Typography
                                                                    variant={
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "hebrewBodyText"
                                                                            : "body2"
                                                                    }
                                                                    sx={{
                                                                        color: "text.primary",
                                                                        fontWeight: 600,
                                                                        fontSize:
                                                                        {
                                                                            xs: "0.75rem",
                                                                            sm: "0.875rem",
                                                                        },
                                                                        ...(i18n.language !==
                                                                            "he" && {
                                                                            textAlign:
                                                                                "center",
                                                                        }),
                                                                    }}
                                                                >
                                                                    {t(
                                                                        "fields.dispute_creation_active_dispute"
                                                                    )}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            gap: 1,
                                                            alignItems:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "flex-start"
                                                                    : "flex-end",
                                                        }}
                                                    >
                                                        <Button
                                                            variant="contained"
                                                            size="medium"
                                                            onClick={
                                                                handleViewInvoices
                                                            }
                                                            sx={
                                                                styles.heroButton
                                                            }
                                                            aria-label="View overdue invoices"
                                                        >
                                                            {t(
                                                                "fields.view_invoices"
                                                            )}
                                                        </Button>
                                                        {hasActiveDispute && (
                                                            <Button
                                                                variant="contained"
                                                                size="medium"
                                                                onClick={
                                                                    handleViewDispute
                                                                }
                                                                sx={
                                                                    styles.heroButton
                                                                }
                                                                aria-label="View active dispute details"
                                                            >
                                                                {t(
                                                                    "actions.dispute_creation_review_dispute"
                                                                )}
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </Box>
                                                {nextPaymentDate &&
                                                    currentCategory && (
                                                        <Box
                                                            sx={{
                                                                mt: 2,
                                                                p: {
                                                                    xs: 1,
                                                                    sm: 2,
                                                                },
                                                                backgroundColor:
                                                                    theme
                                                                        .palette
                                                                        .mode ===
                                                                        "dark"
                                                                        ? alpha(
                                                                            theme
                                                                                .palette
                                                                                .common
                                                                                .white,
                                                                            0.05
                                                                        )
                                                                        : alpha(
                                                                            theme
                                                                                .palette
                                                                                .text
                                                                                .secondary,
                                                                            0.1
                                                                        ),
                                                                borderRadius:
                                                                    typeof theme
                                                                        .shape
                                                                        .borderRadius ===
                                                                        "number"
                                                                        ? theme
                                                                            .shape
                                                                            .borderRadius *
                                                                        4
                                                                        : 8,
                                                                border: theme.portalCard.border(theme),
                                                                ...(i18n.language !==
                                                                    "he" && {
                                                                    textAlign:
                                                                        "center",
                                                                }),
                                                            }}
                                                        >
                                                            <Typography
                                                                variant={
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "hebrewBodyText"
                                                                        : "body2"
                                                                }
                                                                sx={{
                                                                    color: theme
                                                                        .palette
                                                                        .text
                                                                        .primary,
                                                                    fontWeight: 600,
                                                                    fontSize: {
                                                                        xs: "0.875rem",
                                                                        sm: "1rem",
                                                                    },
                                                                    ...(i18n.language !==
                                                                        "he" && {
                                                                        textAlign:
                                                                            "center",
                                                                    }),
                                                                }}
                                                            >
                                                                {t(
                                                                    "fields.payment_next_payment_date"
                                                                )}{" "}
                                                                {nextPaymentDate
                                                                    ? new Date(
                                                                        nextPaymentDate
                                                                    ).toLocaleDateString(
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "he-IL"
                                                                            : "en-US"
                                                                    )
                                                                    : ""}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                            </Box>
                                        </Box>
                                    </Box>
                                );

                            case "due_only":
                                return (
                                    <Box sx={styles.cardContainer}>
                                        <Box sx={styles.glassCard}>
                                            <Box sx={styles.cardContent}>
                                                <Box
                                                    sx={{
                                                        ...styles.cardRow,
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            ...styles.cardText,
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            alignItems:
                                                                "center",
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "hebrewTitle"
                                                                    : "h4"
                                                            }
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: {
                                                                    xs: "1.25rem",
                                                                    sm: "2rem",
                                                                },
                                                                whiteSpace:
                                                                    "nowrap",
                                                                overflow:
                                                                    "hidden",
                                                                textOverflow:
                                                                    "ellipsis",
                                                                color: "text.primary",
                                                                ...(i18n.language !==
                                                                    "he" && {
                                                                    textAlign:
                                                                        "center",
                                                                }),
                                                            }}
                                                        >
                                                            {(() => {
                                                                let result = "";
                                                                if (
                                                                    customer_due_amount1 &&
                                                                    customer_due_amount1 >
                                                                    0
                                                                ) {
                                                                    result =
                                                                        formatAmount(
                                                                            customer_due_amount1,
                                                                            customer_due_currency1 ||
                                                                                fallbackDueDisplayCurrency
                                                                        );
                                                                }
                                                                if (
                                                                    customer_due_amount2 &&
                                                                    customer_due_amount2 >
                                                                    0 &&
                                                                    customer_due_currency1 !==
                                                                    customer_due_currency2
                                                                ) {
                                                                    if (result)
                                                                        result +=
                                                                            " + ";
                                                                    result +=
                                                                        formatAmount(
                                                                            customer_due_amount2,
                                                                            customer_due_currency2
                                                                        );
                                                                }
                                                                if (
                                                                    !result ||
                                                                    result ===
                                                                    "0"
                                                                ) {
                                                                    const totalDueAmount =
                                                                        total_due_amount ||
                                                                        0;
                                                                    if (
                                                                        totalDueAmount >
                                                                        0
                                                                    ) {
                                                                        result =
                                                                            formatAmount(
                                                                                totalDueAmount,
                                                                                fallbackDueDisplayCurrency
                                                                            );
                                                                    }
                                                                }
                                                                return (
                                                                    result ||
                                                                    "0"
                                                                );
                                                            })()}
                                                        </Typography>
                                                        <Typography
                                                            variant={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "hebrewBodyText"
                                                                    : "body1"
                                                            }
                                                            sx={{
                                                                opacity: 0.9,
                                                                fontSize: {
                                                                    xs: "0.875rem",
                                                                    sm: "1rem",
                                                                },
                                                                color: "text.primary",
                                                                ...(i18n.language !==
                                                                    "he" && {
                                                                    textAlign:
                                                                        "center",
                                                                }),
                                                            }}
                                                        >
                                                            {t(
                                                                "fields.general_your_due_amount"
                                                            )}
                                                        </Typography>
                                                        {hasActiveDispute && (
                                                            <Box sx={{ mt: 1 }}>
                                                                <Typography
                                                                    variant={
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "hebrewBodyText"
                                                                            : "body2"
                                                                    }
                                                                    sx={{
                                                                        color: "text.primary",
                                                                        fontWeight: 600,
                                                                        fontSize:
                                                                        {
                                                                            xs: "0.75rem",
                                                                            sm: "0.875rem",
                                                                        },
                                                                        ...(i18n.language !==
                                                                            "he" && {
                                                                            textAlign:
                                                                                "center",
                                                                        }),
                                                                    }}
                                                                >
                                                                    {t(
                                                                        "fields.dispute_creation_active_dispute"
                                                                    )}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            gap: 1,
                                                            alignItems:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "flex-start"
                                                                    : "flex-end",
                                                        }}
                                                    >
                                                        <Button
                                                            variant="contained"
                                                            size="medium"
                                                            onClick={
                                                                handleViewInvoices
                                                            }
                                                            sx={
                                                                styles.heroButton
                                                            }
                                                            aria-label="View invoices"
                                                        >
                                                            {t(
                                                                "fields.view_invoices"
                                                            )}
                                                        </Button>
                                                        {hasActiveDispute && (
                                                            <Button
                                                                variant="contained"
                                                                size="medium"
                                                                onClick={
                                                                    handleViewDispute
                                                                }
                                                                sx={
                                                                    styles.heroButton
                                                                }
                                                                aria-label="View active dispute details"
                                                            >
                                                                {t(
                                                                    "actions.dispute_creation_review_dispute"
                                                                )}
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                );

                            case "both":
                                return (
                                    <Box sx={styles.cardContainer}>
                                        <Box sx={styles.glassCard}>
                                            <Box sx={styles.cardContent}>
                                                <Box
                                                    sx={{
                                                        ...styles.cardRow,
                                                        direction:
                                                            i18n.language ===
                                                                "he"
                                                                ? "rtl"
                                                                : "ltr",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            ...styles.cardText,
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            alignItems:
                                                                "center",
                                                            direction:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "rtl"
                                                                    : "ltr",
                                                        }}
                                                    >
                                                        <Typography
                                                            variant={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "hebrewTitle"
                                                                    : "h4"
                                                            }
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: {
                                                                    xs: "1.25rem",
                                                                    sm: "2rem",
                                                                },
                                                                whiteSpace:
                                                                    "nowrap",
                                                                overflow:
                                                                    "hidden",
                                                                textOverflow:
                                                                    "ellipsis",
                                                                color: "text.primary",
                                                                ...(i18n.language !==
                                                                    "he" && {
                                                                    textAlign:
                                                                        "center",
                                                                }),
                                                            }}
                                                        >
                                                            {(() => {
                                                                let result = "";
                                                                // Show overdue amounts prominently
                                                                if (
                                                                    customer_outstanding_amount1 &&
                                                                    customer_outstanding_amount1 >
                                                                    0
                                                                ) {
                                                                    result =
                                                                        formatAmount(
                                                                            customer_outstanding_amount1,
                                                                            customer_currency1 ||
                                                                                fallbackOverdueDisplayCurrency
                                                                        );
                                                                }
                                                                if (
                                                                    customer_outstanding_amount2 &&
                                                                    customer_outstanding_amount2 >
                                                                    0 &&
                                                                    customer_currency1 !==
                                                                    customer_currency2
                                                                ) {
                                                                    if (result)
                                                                        result +=
                                                                            " + ";
                                                                    result +=
                                                                        formatAmount(
                                                                            customer_outstanding_amount2,
                                                                            customer_currency2
                                                                        );
                                                                }
                                                                if (
                                                                    !result ||
                                                                    result ===
                                                                    "0"
                                                                ) {
                                                                    const totalInvoicesOverdue =
                                                                        total_invoices_overdue ||
                                                                        0;
                                                                    if (
                                                                        totalInvoicesOverdue >
                                                                        0
                                                                    ) {
                                                                        result =
                                                                            formatAmount(
                                                                                totalInvoicesOverdue,
                                                                                fallbackOverdueDisplayCurrency
                                                                            );
                                                                    }
                                                                }
                                                                return (
                                                                    result ||
                                                                    "0"
                                                                );
                                                            })()}
                                                        </Typography>
                                                        <Typography
                                                            variant={
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "hebrewBodyText"
                                                                    : "body1"
                                                            }
                                                            sx={{
                                                                opacity: 0.9,
                                                                fontSize: {
                                                                    xs: "0.875rem",
                                                                    sm: "1rem",
                                                                },
                                                                color: "text.primary",
                                                                ...(i18n.language !==
                                                                    "he" && {
                                                                    textAlign:
                                                                        "center",
                                                                }),
                                                            }}
                                                        >
                                                            {t(
                                                                "fields.general_your_outstanding_amount"
                                                            )}
                                                        </Typography>
                                                        {hasActiveDispute && (
                                                            <Box sx={{ mt: 1 }}>
                                                                <Typography
                                                                    variant={
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "hebrewBodyText"
                                                                            : "body2"
                                                                    }
                                                                    sx={{
                                                                        color: "text.primary",
                                                                        fontWeight: 600,
                                                                        fontSize:
                                                                        {
                                                                            xs: "0.75rem",
                                                                            sm: "0.875rem",
                                                                        },
                                                                        ...(i18n.language !==
                                                                            "he" && {
                                                                            textAlign:
                                                                                "center",
                                                                        }),
                                                                    }}
                                                                >
                                                                    {t(
                                                                        "fields.dispute_creation_active_dispute"
                                                                    )}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                    <Box
                                                        sx={{
                                                            display: "flex",
                                                            flexDirection:
                                                                "column",
                                                            gap: 1,
                                                            alignItems:
                                                                i18n.language ===
                                                                    "he"
                                                                    ? "flex-start"
                                                                    : "flex-end",
                                                        }}
                                                    >
                                                        <Button
                                                            variant="contained"
                                                            size="medium"
                                                            onClick={
                                                                handleViewInvoices
                                                            }
                                                            sx={
                                                                styles.heroButton
                                                            }
                                                            aria-label="View overdue invoices"
                                                        >
                                                            {t(
                                                                "fields.view_invoices"
                                                            )}
                                                        </Button>
                                                        {hasActiveDispute && (
                                                            <Button
                                                                variant="contained"
                                                                size="medium"
                                                                onClick={
                                                                    handleViewDispute
                                                                }
                                                                sx={
                                                                    styles.heroButton
                                                                }
                                                                aria-label="View active dispute details"
                                                            >
                                                                {t(
                                                                    "actions.dispute_creation_review_dispute"
                                                                )}
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </Box>
                                                {nextPaymentDate &&
                                                    currentCategory && (
                                                        <Box
                                                            sx={{
                                                                mt: 2,
                                                                p: {
                                                                    xs: 1,
                                                                    sm: 2,
                                                                },
                                                                backgroundColor:
                                                                    theme
                                                                        .palette
                                                                        .mode ===
                                                                        "dark"
                                                                        ? alpha(
                                                                            theme
                                                                                .palette
                                                                                .common
                                                                                .white,
                                                                            0.05
                                                                        )
                                                                        : alpha(
                                                                            theme
                                                                                .palette
                                                                                .text
                                                                                .secondary,
                                                                            0.1
                                                                        ),
                                                                borderRadius:
                                                                    typeof theme
                                                                        .shape
                                                                        .borderRadius ===
                                                                        "number"
                                                                        ? theme
                                                                            .shape
                                                                            .borderRadius *
                                                                        4
                                                                        : 8,
                                                                border: theme.portalCard.border(theme),
                                                                ...(i18n.language !==
                                                                    "he" && {
                                                                    textAlign:
                                                                        "center",
                                                                }),
                                                            }}
                                                        >
                                                            <Typography
                                                                variant={
                                                                    i18n.language ===
                                                                        "he"
                                                                        ? "hebrewBodyText"
                                                                        : "body2"
                                                                }
                                                                sx={{
                                                                    color: theme
                                                                        .palette
                                                                        .text
                                                                        .primary,
                                                                    fontWeight: 600,
                                                                    fontSize: {
                                                                        xs: "0.875rem",
                                                                        sm: "1rem",
                                                                    },
                                                                    ...(i18n.language !==
                                                                        "he" && {
                                                                        textAlign:
                                                                            "center",
                                                                    }),
                                                                }}
                                                            >
                                                                {t(
                                                                    "fields.payment_next_payment_date"
                                                                )}{" "}
                                                                {nextPaymentDate
                                                                    ? new Date(
                                                                        nextPaymentDate
                                                                    ).toLocaleDateString(
                                                                        i18n.language ===
                                                                            "he"
                                                                            ? "he-IL"
                                                                            : "en-US"
                                                                    )
                                                                    : ""}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                            </Box>
                                        </Box>
                                    </Box>
                                );

                            case "none":
                            default:
                                return (
                                    <Box sx={styles.cardContainer}>
                                        <Card
                                            className={PORTAL_CARD_CLASS}
                                            elevation={0}
                                            sx={{
                                                ...getPortalCardSx(theme as Theme),
                                                border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                                                p: { xs: 2, sm: 4 },
                                                position: "relative",
                                                overflow: "hidden",
                                                width: "100%",
                                                boxSizing: "border-box",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    position: "absolute",
                                                    top: -30,
                                                    right: -30,
                                                    width: 120,
                                                    height: 120,
                                                    borderRadius: "50%",
                                                    backgroundColor: alpha(
                                                        theme.palette.success
                                                            .main,
                                                        0.05
                                                    ),
                                                    zIndex: 0,
                                                }}
                                            />
                                            <Box
                                                sx={{
                                                    position: "relative",
                                                    zIndex: 1,
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    textAlign: "center",
                                                    gap: 2,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 80,
                                                        height: 80,
                                                        borderRadius: "50%",
                                                        backgroundColor: alpha(
                                                            theme.palette
                                                                .success.main,
                                                            0.15
                                                        ),
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent:
                                                            "center",
                                                        mb: 2,
                                                    }}
                                                >
                                                    <Typography
                                                        variant="h2"
                                                        sx={{
                                                            color: theme.palette
                                                                .success.dark,
                                                            fontWeight: 700,
                                                            fontSize: "2rem",
                                                        }}
                                                    >
                                                        ✓
                                                    </Typography>
                                                </Box>
                                                <Typography
                                                    variant={
                                                        i18n.language === "he"
                                                            ? "hebrewTitle"
                                                            : "h4"
                                                    }
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: {
                                                            xs: "1.5rem",
                                                            sm: "2rem",
                                                        },
                                                        color: theme.palette
                                                            .text.primary,
                                                        ...(i18n.language !==
                                                            "he" && {
                                                            textAlign: "center",
                                                        }),
                                                    }}
                                                >
                                                    {t(
                                                        "messages.dispute_creation_all_invoices_paid"
                                                    )}
                                                </Typography>
                                                <Typography
                                                    variant={
                                                        i18n.language === "he"
                                                            ? "hebrewBodyText"
                                                            : "body1"
                                                    }
                                                    sx={{
                                                        fontSize: {
                                                            xs: "1rem",
                                                            sm: "1.125rem",
                                                        },
                                                        color: theme.palette
                                                            .text.secondary,
                                                        maxWidth: "400px",
                                                        lineHeight: 1.6,
                                                        ...(i18n.language !==
                                                            "he" && {
                                                            textAlign: "center",
                                                        }),
                                                    }}
                                                >
                                                    {t(
                                                        "messages.dispute_creation_no_outstanding_invoices_description"
                                                    )}
                                                </Typography>
                                            </Box>
                                        </Card>
                                    </Box>
                                );
                        }
                    })()}
                </Box>
            </Box>
        );
    }
);

HeroSection.displayName = "HeroSection";

// Memoized Secondary Actions
const SecondaryActions = memo(
    ({ customerUUID, language }: SecondaryActionsProps) => {
        const router = useRouter();
        const theme = useTheme();
        const { t, i18n } = useTranslation(["portal", "invoices", "common"]);
        const styles = getStyles(theme);

        const otherActions = [
            {
                title: t("actions.payment_pay_now"),
                subtitle: t("messages.general_assist_message"),
                icon: (
                    <Payment
                        sx={{
                            fontSize: 28,
                            color: theme.palette.common.white,
                        }}
                    />
                ),
                color: theme.palette.success.main,
                onClick: () =>
                    router.push(PortalUrls.makePayment(customerUUID, language)),
            },
            {
                title: t("actions.payment_schedule_payment"),
                subtitle: t("messages.payment_choose_future_payment_date"),
                icon: (
                    <CalendarToday
                        sx={{
                            fontSize: 28,
                            color: theme.palette.common.white,
                        }}
                    />
                ),
                color: theme.palette.warning.main,
                onClick: () =>
                    router.push(PortalUrls.promiseToPay(customerUUID, language)),
            },
            {
                title: t("actions.navigation_create_dispute"),
                subtitle: t("fields.dispute_creation_description"),
                icon: (
                    <Gavel
                        sx={{
                            fontSize: 28,
                            color: theme.palette.common.white,
                        }}
                    />
                ),
                color: theme.palette.error.main,
                onClick: () =>
                    router.push(PortalUrls.createDispute(customerUUID, language)),
            },
            {
                title: t("actions.contact_wrong_contact_person"),
                subtitle: t("messages.contact_wrong_contact_person_subtitle"),
                icon: (
                    <PersonRemove
                        sx={{
                            fontSize: 28,
                            color: theme.palette.common.white,
                        }}
                    />
                ),
                color: theme.palette.info.main,
                onClick: () =>
                    router.push(
                        PortalUrls.reportWrongContact(customerUUID, language)
                    ),
            },
        ];

        return (
            <Box
                sx={{
                    p: { xs: 1, sm: 2 },
                    maxWidth: { xs: "95%", sm: 800, md: 1000 },
                    mx: "auto",
                    mt: 1,
                }}
            >
                <Typography
                    variant="h6"
                    sx={{
                        mb: 1.5,
                        textAlign: "center",
                        color: theme.palette.text.secondary,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {t("messages.general_assist_with_repayment")}
                </Typography>

                <Box sx={styles.actionGrid}>
                    {otherActions.map((action, index) => (
                        <ActionCard
                            key={`${action.title}-${index}`}
                            title={action.title}
                            subtitle={action.subtitle}
                            icon={action.icon}
                            color={action.color}
                            onClick={action.onClick}
                        />
                    ))}
                </Box>

                <Typography
                    variant="body2"
                    sx={{
                        mt: 2,
                        textAlign: "center",
                        color: theme.palette.text.secondary,
                        fontSize: { xs: "1rem", sm: "1.125rem" },
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {t("messages.general_select_following_option")}
                </Typography>
            </Box>
        );
    }
);

SecondaryActions.displayName = "SecondaryActions";

// Memoized Action Card Component
const ActionCard = memo(
    ({ title, subtitle, icon, color, onClick }: ActionCardProps) => {
        const theme = useTheme();
        const { i18n } = useTranslation(["portal", "common"]);
        const styles = getStyles(theme);

        return (
            <Box
                className={PORTAL_ACTION_CARD_CLASS}
                sx={{
                    ...styles.actionCard,
                    "&:hover": {
                        ...styles.actionCard["&:hover"],
                        borderColor: color,
                    },
                }}
                onClick={onClick}
                role="button"
                tabIndex={0}
                aria-label={`${title}: ${subtitle}`}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onClick();
                    }
                }}
            >
                <Box sx={{ ...styles.actionIcon, backgroundColor: color }}>
                    {icon}
                </Box>
                <Typography
                    variant="h6"
                    sx={{
                        mb: 0.5,
                        fontWeight: 600,
                        textAlign: "center",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="body2"
                    sx={{
                        color: theme.palette.text.secondary,
                        textAlign: "center",
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    {subtitle}
                </Typography>
            </Box>
        );
    }
);

ActionCard.displayName = "ActionCard";
