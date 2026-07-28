"use client";

import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import BlockIcon from "@mui/icons-material/Block";
import GavelIcon from "@mui/icons-material/Gavel";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PublicIcon from "@mui/icons-material/Public";
import ReceiptIcon from "@mui/icons-material/Receipt";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import SecurityIcon from "@mui/icons-material/Security";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningIcon from "@mui/icons-material/Warning";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    alpha,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
    useTheme,
} from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api, { apiFetch } from "@/app/api";
import { addDays, parseISO, startOfDay } from "date-fns";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import {
    deriveSecondaryAmountFromInvoiceBucketRatio,
    resolveCapacityGapDisplayAmounts,
    resolveCustomerCreditInsuranceSecondaryCurrency,
    resolveCustomerDueSecondaryFromInvoiceBuckets,
    resolveCustomerOverdueSecondaryFromInvoiceBuckets,
    resolveCustomerTotalArSecondaryFromInvoiceBuckets,
    resolveInvoiceBucketRatioArPair,
} from "@/shared/creditInsurance/invoiceBucketAmounts";
import {
    type CustomerWithPolicyFields,
    getActiveCustomerPolicyFromCustomer,
    isZeroApprovedLimit,
} from "@/shared/customerPolicyAdapter";
import { currencies } from "@/shared/data/common/currencies";
import { useToast } from "@/shared/layout-components/toast/ToastProvider";
import {
    fetchCustomerById,
    fetchStuckActivities,
} from "@/shared/services/customerService";
import { isCreditOnlyAccount as isCreditOnlyAccountUtil } from "@/shared/utils/accountProducts";
import { Customer } from "@/types/Customer";
import { getCustomerPortalUrl } from "@/utils/appUrls";
import {
    formatDateForDisplay,
    getCountryTimezone,
    getUserDateLocale,
    getUserTimezone,
} from "@/utils/datetimeOperations";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

import ChangeCollectionCategoryModal from "./ChangeCollectionCategoryModal";
import CustomerCheckpointActions from "./CustomerCheckpointActions";
import {
    isCreditDashboardSectionEligible,
    resolveCustomerOverdueDisplayMetrics,
} from "./customerDashboardCardViewModel";
import {
    customerDashboardKpisQueryKey,
    fetchCustomerDashboardKpis,
} from "./customerDashboardKpisQuery";
import CustomerHeaderNotificationBanner from "./CustomerHeaderNotificationBanner";
import UpsertContactModal from "./UpsertContactModal";

interface CustomerHeaderProps {
    customer_id: string;
    onTimelineRefresh?: () => void;
    hideOpenPortal?: boolean;
    renderMode?: "full";
    /** When omitted, resolved from account `has_collection` (shared `account` query). */
    isCollectionAccount?: boolean;
    /** When omitted, resolved from account `has_credit_insurance`. */
    isCreditInsuranceAccount?: boolean;
    /** When omitted, resolved from account product flags. */
    isCreditOnlyAccount?: boolean;
}

function formatCategoryLabel(
    category: string | null | undefined,
    translate: (key: string, options?: { defaultValue?: string }) => string
) {
    if (!category) {
        return "—";
    }
    const key = `values.category_${category.toLowerCase().replace(/[_\s]/g, "_")}`;
    return translate(key, { defaultValue: category });
}

function canChangeCollectionCategory(category: string | null | undefined) {
    return (
        category != null &&
        category !== "Dispute" &&
        category !== "Promise_to_pay"
    );
}

function getCategoryChipSx(category: string | null | undefined, theme: Theme) {
    const palette = theme.palette.chartPalette;
    const baseChipSx = {
        height: 24,
        borderRadius: `${theme.appButton.borderRadius}px`,
        fontWeight: 500,
        fontSize: "0.75rem",
        boxShadow: "none",
        border: "none",
        "& .MuiChip-label": {
            px: 1.5,
            fontSize: "0.75rem",
            fontWeight: 500,
            lineHeight: 1,
        },
    };
    const withPalette = (
        mainOpacity: number,
        color: string = palette.main
    ) => ({
        backgroundColor: alpha(color, mainOpacity),
        color,
    });

    switch (category) {
        case "Automated":
            return { ...baseChipSx, ...withPalette(0.1) };
        case "Agent":
            return { ...baseChipSx, ...withPalette(0.15) };
        case "Legal":
            return { ...baseChipSx, ...withPalette(0.2, palette.dark) };
        case "Promise_to_pay":
            return { ...baseChipSx, ...withPalette(0.12) };
        case "Dispute":
            return { ...baseChipSx, ...withPalette(0.18) };
        default:
            return { ...baseChipSx, ...withPalette(0.08) };
    }
}

const METADATA_LABEL_SX = {
    fontWeight: 500,
    flexShrink: 0,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "center",
    height: 24,
} as const;

const METADATA_CHIP_SX = {
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    alignSelf: "center",
    "& .MuiChip-label": {
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
    },
} as const;

const getCurrencySymbol = (currencyCode: string): string => {
    const currency = currencies.find((c) => c.code === currencyCode);
    return currency?.symbol || currencyCode;
};

function formatDualCurrencyCreditInsuranceLine(
    langHebrew: boolean,
    accountAmount: number,
    accountCurrency: string,
    secondaryAmount: number | null | undefined,
    secondaryCurrency: string | null | undefined
): string {
    const amountLocale = langHebrew ? "he-IL" : "en-US";
    const acctSym = getCurrencySymbol(accountCurrency);
    const main = formatAmountWithoutSymbol(accountAmount, amountLocale);
    const mainPart = langHebrew ? `${main} ${acctSym}` : `${acctSym} ${main}`;
    if (
        secondaryCurrency &&
        secondaryAmount != null &&
        Number.isFinite(secondaryAmount)
    ) {
        const secSym = getCurrencySymbol(secondaryCurrency);
        const sec = formatAmountWithoutSymbol(secondaryAmount, amountLocale);
        const secPart = langHebrew ? `${sec} ${secSym}` : `${secSym} ${sec}`;
        return `${secPart} (${mainPart})`;
    }
    return mainPart;
}

const calculateTimeRemaining = (followUpDate: Date, t: any): string => {
    if (!followUpDate || isNaN(followUpDate.getTime())) {
        return "";
    }

    const now = new Date();
    const diff = followUpDate.getTime() - now.getTime();
    const diffInMinutes = Math.floor(diff / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diff < 0) {
        // Overdue
        const overdueHours = Math.abs(diffInHours);
        const overdueDays = Math.abs(diffInDays);
        if (overdueDays > 0) {
            return t(
                `fields.time_remaining_days_overdue_${overdueDays === 1 ? "one" : "other"}`,
                { count: overdueDays }
            );
        }
        return t(
            `fields.time_remaining_hours_overdue_${overdueHours === 1 ? "one" : "other"}`,
            { count: overdueHours }
        );
    }

    if (diffInDays > 0) {
        return t(
            `fields.time_remaining_days_remaining_${diffInDays === 1 ? "one" : "other"}`,
            { count: diffInDays }
        );
    }

    if (diffInHours > 0) {
        return t(
            `fields.time_remaining_hours_remaining_${diffInHours === 1 ? "one" : "other"}`,
            { count: diffInHours }
        );
    }

    if (diffInMinutes > 0) {
        return t(
            `fields.time_remaining_minutes_remaining_${diffInMinutes === 1 ? "one" : "other"}`,
            { count: diffInMinutes }
        );
    }

    return t("fields.time_remaining_due_now");
};

const pulseAnimation = `
@keyframes pulse {
    0% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.5;
        transform: scale(1.1);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}
`;

function isTopUpExpiringWithinDays(
    isoDate: string | null | undefined,
    days: number
): boolean {
    if (!isoDate) {
        return false;
    }
    const end = startOfDay(parseISO(isoDate));
    const today = startOfDay(new Date());
    const limit = addDays(today, days);
    return end >= today && end <= limit;
}

const CustomerHeader: React.FC<CustomerHeaderProps> = ({
    customer_id,
    onTimelineRefresh,
    hideOpenPortal = false,
    isCollectionAccount: isCollectionAccountProp,
    isCreditInsuranceAccount: isCreditInsuranceAccountProp,
    isCreditOnlyAccount: isCreditOnlyAccountProp,
}) => {
    const { data: session } = useSession();
    const { t, i18n } = useTranslation([
        "customers",
        "common",
        "activities",
        "agents",
    ]);
    const queryClient = useQueryClient();
    const router = useRouter();
    const pathname = usePathname();
    const { showToast } = useToast();
    const theme = useTheme();
    const notificationBannerBorderRadius = `${theme.appButton.borderRadius}px`;
    const [isCategoryChangeModalOpen, setIsCategoryChangeModalOpen] = useState(false);
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationData, setNotificationData] = useState<{
        customerDate: string;
        customerTime: string;
        userDate: string;
        userTime: string;
    } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const customerIdNumber = parseInt(customer_id, 10);

    const goToTopUpPoliciesTab = useCallback(() => {
        if (!pathname) {
            return;
        }
        router.push(`${pathname}?tab=policies#top-up-cover`);
    }, [pathname, router]);

    useEffect(() => {
        if (!document.getElementById("pulse-animation")) {
            const style = document.createElement("style");
            style.id = "pulse-animation";
            style.textContent = pulseAnimation;
            document.head.appendChild(style);
        }
    }, []);

    // Fetch user permissions
    const { data: userPermissionsData } = useQuery<{ permissions: string[] }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            session?.user?.role,
            session?.user?.account_id,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: !!session?.user,
        staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    });

    const userPermissions = userPermissionsData?.permissions || [];
    const hasManageContactsPermission =
        userPermissions.includes("manage_contacts");

    const {
        data: customer,
        isPending,
        error,
        refetch,
    } = useQuery<Customer, Error>({
        queryKey: ["customer", customerIdNumber],
        queryFn: fetchCustomerById,
        enabled: !!customer_id,
        retry: 3,
        staleTime: 30 * 1000,
        gcTime: 2 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    });

    const { data: accountData } = useQuery({
        queryKey: ["account", customer?.account_id],
        queryFn: async () => {
            const response = await apiFetch(`/api/entities/accounts/${customer?.account_id}`
            );
            if (!response.ok) {
                throw new Error("Failed to fetch account");
            }
            return response.json() as Promise<{
                has_collection?: boolean;
                has_credit_insurance?: boolean;
            }>;
        },
        enabled:
            !!customer?.account_id &&
            (isCollectionAccountProp === undefined ||
                isCreditInsuranceAccountProp === undefined ||
                isCreditOnlyAccountProp === undefined),
        staleTime: 0,
    });

    const isCreditOnlyAccount = useMemo(
        () =>
            isCreditOnlyAccountProp !== undefined
                ? isCreditOnlyAccountProp
                : isCreditOnlyAccountUtil(accountData),
        [isCreditOnlyAccountProp, accountData]
    );

    const hasCreditInsuranceProductForKpis =
        isCreditInsuranceAccountProp !== undefined
            ? isCreditInsuranceAccountProp
            : accountData?.has_credit_insurance === true ||
            (customer as Customer & { Account?: { has_credit_insurance?: boolean } })
                ?.Account?.has_credit_insurance === true;

    const creditKpiQuery = useQuery({
        queryKey: customerDashboardKpisQueryKey(
            customer!.id,
            customer!.account_id,
            null
        ),
        queryFn: () => fetchCustomerDashboardKpis(customer!.id, null),
        enabled:
            !!customer?.id &&
            hasCreditInsuranceProductForKpis &&
            isCreditDashboardSectionEligible(
                customer,
                hasCreditInsuranceProductForKpis
            ),
        staleTime: 60_000,
    });

    const { data: stuckActivitiesData } = useQuery({
        queryKey: ["stuck_activities", customerIdNumber],
        queryFn: fetchStuckActivities,
        enabled: !!customer_id && !isCreditOnlyAccount,
        retry: 3,
        staleTime: 30 * 1000,
        gcTime: 2 * 60 * 1000,
    });

    // Check SMS blocking status for the customer's country with SMS activities validation
    const { data: smsBlockingStatus } = useQuery({
        queryKey: [
            "sms-blocking-with-activities",
            customer?.country_id,
            customer?.account_id,
            customer?.id,
        ],
        queryFn: async () => {
            if (!customer?.country_id || !customer?.id) {
                return { isBlocked: false, hasSMSActivities: false };
            }
            const response = await apiFetch(`/api/sms/check-blocking-with-activities?countryId=${customer.country_id}&accountId=${customer.account_id}&customerId=${customer.id}`
            );
            if (!response.ok) {
                return { isBlocked: false, hasSMSActivities: false };
            }
            return response.json();
        },
        enabled:
            !!customer?.country_id &&
            !!customer?.account_id &&
            !!customer?.id &&
            !isCreditOnlyAccount,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
    });

    const getOpenCollectionPeriod = () => {
        if (customer?.CustomerCollectionPeriod) {
            customer.CustomerCollectionPeriod.forEach(() => {
                // Period data processing
            });
        }

        const openPeriod = customer?.CustomerCollectionPeriod?.find(
            (period: any) => !period.period_end_date
        );

        return openPeriod;
    };

    useEffect(() => {
        const collectionPeriod = getOpenCollectionPeriod();
        if (collectionPeriod && customer) {
            const shouldShowNotification = collectionPeriod.follow_up_time;

            if (shouldShowNotification && collectionPeriod.follow_up_time) {
                const followUpDate = new Date(collectionPeriod.follow_up_time);

                if (!isNaN(followUpDate.getTime())) {
                    // Use the user's locale preference for date formatting
                    const userLocale = getUserDateLocale(session);
                    const userTimezone = getUserTimezone(session);
                    const customerTimezone = getCountryTimezone(
                        customer.Country?.iso2,
                        customer.State?.iso2
                    );

                    // Customer view: follow-up converted to customer's own timezone.
                    const customerDateTime = formatDateForDisplay(
                        followUpDate,
                        "datetime",
                        userLocale,
                        customerTimezone
                    );
                    // User view: follow-up converted to logged-in user's timezone.
                    const userDateTime = formatDateForDisplay(
                        followUpDate,
                        "datetime",
                        userLocale,
                        userTimezone
                    );

                    const [customerDate, customerTime] = [
                        customerDateTime.split(", ")[0],
                        customerDateTime.split(", ")[1]?.slice(0, 5),
                    ];
                    const [userDate, userTime] = [
                        userDateTime.split(", ")[0],
                        userDateTime.split(", ")[1]?.slice(0, 5),
                    ];

                    setShowNotification(true);
                    setNotificationData({
                        customerDate: customerDate,
                        customerTime: customerTime,
                        userDate: userDate,
                        userTime: userTime,
                    });
                } else {
                    setShowNotification(false);
                    setNotificationData(null);
                }
            } else {
                setShowNotification(false);
                setNotificationData(null);
            }
        } else {
            setShowNotification(false);
            setNotificationData(null);
        }
    }, [customer, session?.user?.locale, session?.user?.timezone]);

    const extractCustomerName = (customer: Customer) => {
        if (!customer) return t("fields.unknown");
        return customer.Person
            ? `${customer.Person.first_name} ${customer.Person.last_name}`
            : customer.Company?.name || t("fields.unknown");
    };

    const handleClearFollowUp = React.useCallback(
        async (collectionPeriodId: number) => {
            try {
                const response = await apiFetch("/api/system/agents/follow-up", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: collectionPeriodId }),
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(
                        data.error ||
                        t("messages.failed_to_update_status", {
                            ns: "agents",
                        })
                    );
                }
                showToast(
                    t("messages.status_updated_successfully", {
                        ns: "agents",
                        defaultValue: "Status updated successfully",
                    }),
                    "success"
                );
                setShowNotification(false);
                setNotificationData(null);
                await queryClient.invalidateQueries({
                    queryKey: ["customer", customerIdNumber],
                });
                await refetch();
                if (onTimelineRefresh) {
                    onTimelineRefresh();
                }
            } catch (error) {
                showToast((error as Error).message, "error");
            }
        },
        [customerIdNumber, onTimelineRefresh, queryClient, refetch, showToast, t]
    );

    const handleCategoryUpdated = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: ["customer", customerIdNumber],
        });
        await refetch();
        onTimelineRefresh?.();
    }, [customerIdNumber, onTimelineRefresh, queryClient, refetch]);

    const getPortalUrl = (customer: Customer) => {
        if (!customer?.customer_uuid) return "";

        const url = getCustomerPortalUrl(
            customer.customer_uuid,
            (customer as any).Account?.sub_domain,
            customer.language
        );

        return url;
    };

    const EnhancedFollowUpNotification = ({
        message,
        followUpDate,
        isWithinBusinessHours = true,
        timeRemaining,
        onCancel,
        collectionPeriodId,
    }: {
        message: string;
        followUpDate: Date;
        isWithinBusinessHours?: boolean;
        timeRemaining?: string;
        onCancel?: (collectionPeriodId: number) => void;
        collectionPeriodId?: number;
    }) => {
        // Check if the follow-up date is overdue by comparing with current time
        const isUrgent =
            followUpDate &&
            new Date(followUpDate).getTime() < new Date().getTime();
        const isToday =
            followUpDate &&
            new Date(followUpDate).toDateString() === new Date().toDateString();

        const getNotificationStyle = () => {
            if (isUrgent) {
                return {
                    background: "linear-gradient(to right, #ffebee, #ffcdd2)",
                    borderColor: "error.main",
                    iconColor: "error.main",
                    iconBg: "linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)",
                };
            }
            if (!isWithinBusinessHours) {
                return {
                    background: "linear-gradient(to right, #fff3e0, #ffe0b2)",
                    borderColor: "warning.main",
                    iconColor: "warning.main",
                    iconBg: "linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)",
                };
            }
            if (isToday) {
                return {
                    background: "linear-gradient(to right, #e8f5e8, #c8e6c9)",
                    borderColor: "success.main",
                    iconColor: "success.main",
                    iconBg: "linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)",
                };
            }
            return {
                background: "linear-gradient(to right, #fafafa, #f5f5f5)",
                borderColor: "divider",
                iconColor: "info.main",
                iconBg: "linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)",
            };
        };

        const style = getNotificationStyle();

        return (
            <Paper
                elevation={0}
                sx={{
                    p: 0.75,
                    borderRadius: notificationBannerBorderRadius,
                    background: style.background,
                    border: "1px solid",
                    borderColor: style.borderColor,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    mb: 0.5,
                    boxShadow: "none",
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        flexShrink: 0,
                    }}
                >
                    <NotificationsIcon
                        sx={{ fontSize: 18, color: style.iconColor }}
                    />
                </Box>

                <Box
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        alignItems: "center",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            flexWrap: "wrap",
                            width: "100%",
                        }}
                    >
                        <Typography
                            variant="body2"
                            sx={{
                                color: "text.primary",
                                fontWeight: 500,
                                lineHeight: 1.5,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                flex: 1,
                                minWidth: 0,
                            }}
                        >
                            {message}
                        </Typography>

                        {timeRemaining && (
                            <Typography
                                variant="caption"
                                sx={{
                                    color: isUrgent
                                        ? "error.main"
                                        : "text.secondary",
                                    fontWeight: isUrgent ? 600 : 400,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    flexShrink: 0,
                                    whiteSpace: "nowrap",
                                    lineHeight: 1,
                                }}
                            >
                                <AccessTimeIcon sx={{ fontSize: 12 }} />
                                {timeRemaining}
                            </Typography>
                        )}
                    </Box>
                </Box>

                {onCancel && collectionPeriodId !== undefined && (
                    <Tooltip
                        title={t("fields.clear_follow_up_time", {
                            ns: "agents",
                            defaultValue: "Clear follow up time",
                        })}
                    >
                        <IconButton
                            size="small"
                            onClick={() => onCancel(collectionPeriodId)}
                            color="primary"
                            sx={{
                                flexShrink: 0,
                                "&:hover": {
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.08
                                    ),
                                },
                            }}
                        >
                            <RemoveCircleOutlineIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}

                {!isWithinBusinessHours && (
                    <Chip
                        label="Outside Business Hours"
                        size="small"
                        variant="outlined"
                        sx={{
                            fontSize: "0.7rem",
                            height: 20,
                            "& .MuiChip-label": { px: 1 },
                            borderColor: theme.palette.chartPalette.main,
                            color: theme.palette.chartPalette.main,
                        }}
                    />
                )}
            </Paper>
        );
    };

    const isRtl = i18n.language === "he";
    const accountCurrency = (
        customer as { Account?: { currency?: string } } | undefined
    )?.Account?.currency;
    const creditKpiCards = creditKpiQuery.data?.cards ?? null;

    const capacityGapDisplay = useMemo(() => {
        if (!customer) {
            return {
                primary: 0,
                secondary: null as number | null,
                secondaryCurrency: null as string | null,
            };
        }
        return resolveCapacityGapDisplayAmounts(
            customer as Parameters<typeof resolveCapacityGapDisplayAmounts>[0],
            creditKpiCards?.capacityGapAmount,
            {
                kpiGapSecondary: creditKpiCards?.capacityGapAmountSecondary,
                kpiSecondaryCurrency: creditKpiCards?.capacityGapLimitCurrency,
            }
        );
    }, [
        customer,
        creditKpiCards?.capacityGapAmount,
        creditKpiCards?.capacityGapAmountSecondary,
        creditKpiCards?.capacityGapLimitCurrency,
    ]);

    const headerSecondaryCurrency = useMemo(() => {
        if (!customer) {
            return null;
        }
        return (
            customer.credit_insurance_secondary_currency?.trim() ||
            resolveCustomerCreditInsuranceSecondaryCurrency(
                customer,
                accountCurrency
            )
        );
    }, [accountCurrency, customer]);
    const headerSecondaryCurrencyCode =
        headerSecondaryCurrency?.trim().toUpperCase() ?? null;
    const accountCurrencyCode = accountCurrency?.trim().toUpperCase() ?? "";
    const showHeaderDualCurrency = Boolean(
        headerSecondaryCurrencyCode &&
            accountCurrencyCode &&
            headerSecondaryCurrencyCode !== accountCurrencyCode
    );
    const headerArPrimary = Math.max(0, Number(customer?.total_ar ?? 0));
    const headerArSecondary = useMemo(() => {
        if (!customer || !headerSecondaryCurrencyCode) {
            return null;
        }
        if (
            customer.total_ar_secondary != null &&
            Number.isFinite(Number(customer.total_ar_secondary))
        ) {
            return Math.max(0, Number(customer.total_ar_secondary));
        }
        return resolveCustomerTotalArSecondaryFromInvoiceBuckets(
            customer,
            headerSecondaryCurrencyCode
        );
    }, [customer, headerSecondaryCurrencyCode]);
    const resolveHeaderSecondaryAmount = useCallback(
        (
            primaryAmount: number,
            bucketSecondary: number,
            arPair?: { arPrimary: number; arSecondary: number | null }
        ): number | null => {
            if (!customer || !showHeaderDualCurrency || !headerSecondaryCurrencyCode) {
                return null;
            }
            if (bucketSecondary > 0) {
                return bucketSecondary;
            }
            if (primaryAmount <= 0) {
                return 0;
            }
            const pair =
                arPair ??
                resolveInvoiceBucketRatioArPair(
                    customer,
                    headerSecondaryCurrencyCode,
                    headerArPrimary
                );
            return (
                deriveSecondaryAmountFromInvoiceBucketRatio(
                    primaryAmount,
                    pair.arPrimary,
                    pair.arSecondary ?? headerArSecondary
                ) ?? 0
            );
        },
        [
            customer,
            headerArPrimary,
            headerArSecondary,
            headerSecondaryCurrencyCode,
            showHeaderDualCurrency,
        ]
    );
    const formatHeaderAmount = useCallback(
        (amount: number | null | undefined, secondaryAmount?: number | null) => {
            if (amount == null || !Number.isFinite(amount)) {
                return "—";
            }
            const primary = Math.max(0, Number(amount));
            const secondary =
                showHeaderDualCurrency && secondaryAmount != null
                    ? Math.max(0, Number(secondaryAmount))
                    : null;
            return formatDualCurrencyCreditInsuranceLine(
                isRtl,
                primary,
                accountCurrency ?? "",
                secondary,
                showHeaderDualCurrency ? headerSecondaryCurrency : null
            );
        },
        [
            accountCurrency,
            headerSecondaryCurrency,
            isRtl,
            showHeaderDualCurrency,
        ]
    );
    const overduePrimaryAmount = Math.max(
        0,
        Number(customer?.total_overdue_amount ?? 0)
    );
    const duePrimaryAmount = Math.max(0, Number(customer?.total_due_amount ?? 0));
    const overdueSecondaryAmount = useMemo(() => {
        if (!customer) {
            return null;
        }
        return resolveHeaderSecondaryAmount(
            overduePrimaryAmount,
            headerSecondaryCurrencyCode
                ? resolveCustomerOverdueSecondaryFromInvoiceBuckets(
                      customer,
                      headerSecondaryCurrencyCode
                  )
                : 0
        );
    }, [
        customer,
        headerSecondaryCurrencyCode,
        overduePrimaryAmount,
        resolveHeaderSecondaryAmount,
    ]);
    const dueSecondaryAmount = useMemo(() => {
        if (!customer) {
            return null;
        }
        return resolveHeaderSecondaryAmount(
            duePrimaryAmount,
            headerSecondaryCurrencyCode
                ? resolveCustomerDueSecondaryFromInvoiceBuckets(
                      customer,
                      headerSecondaryCurrencyCode
                  )
                : 0
        );
    }, [
        customer,
        duePrimaryAmount,
        headerSecondaryCurrencyCode,
        resolveHeaderSecondaryAmount,
    ]);

    if (isPending) {
        return null;
    }

    if (error) {
        return (
            <Typography
                align="center"
                color="error"
                variant="h6"
                sx={{ py: 4 }}
            >
                {t("messages.error_message")}
            </Typography>
        );
    }

    if (!customer) {
        return null;
    }

    const isCollectionAccount =
        isCollectionAccountProp !== undefined
            ? isCollectionAccountProp
            : accountData?.has_collection !== false;
    const hasCreditInsuranceProduct =
        isCreditInsuranceAccountProp !== undefined
            ? isCreditInsuranceAccountProp
            : accountData?.has_credit_insurance === true ||
            (customer as Customer & { Account?: { has_credit_insurance?: boolean } })
                ?.Account?.has_credit_insurance === true;
    const showCollectionCards = isCollectionAccount || hasCreditInsuranceProduct;
    const showCreditSection = isCreditDashboardSectionEligible(
        customer,
        hasCreditInsuranceProduct
    );
    const headerMetricCardCount =
        (showCollectionCards ? 4 : 0) + (showCreditSection ? 2 : 0);

    const activePolicyForZeroLimit = getActiveCustomerPolicyFromCustomer(
        customer as CustomerWithPolicyFields
    );
    const showZeroApprovedLimitBanner =
        showCreditSection &&
        activePolicyForZeroLimit != null &&
        isZeroApprovedLimit(activePolicyForZeroLimit.approved_limit);

    const locale = isRtl ? "he-IL" : "en-US";
    const customerTimezone = getCountryTimezone(
        customer.Country?.iso2,
        customer.State?.iso2
    );

    const zeroLimitEffectiveDate =
        activePolicyForZeroLimit?.zero_limit_date != null
            ? formatDateForDisplay(
                activePolicyForZeroLimit.zero_limit_date,
                "date",
                locale,
                customerTimezone
            )
            : null;

    const zeroApprovedLimitBannerMessage = zeroLimitEffectiveDate
        ? t("credit_insurance.zero_approved_limit_banner_with_date", {
            ns: "customers",
            date: zeroLimitEffectiveDate,
            defaultValue:
                "Approved limit is 0 on the active customer policy (effective from {{date}}).",
        })
        : t("credit_insurance.zero_approved_limit_banner", {
            ns: "customers",
            defaultValue: "Approved limit is 0 on the active customer policy.",
        });

    const openPeriod = getOpenCollectionPeriod();
    const effectiveCategory =
        openPeriod?.current_category ?? customer.category_for_new_collection ?? null;
    const categoryLabel = formatCategoryLabel(effectiveCategory, (key, options) =>
        t(key, { ns: "customers", ...options })
    );
    const categoryLabelWithStep =
        effectiveCategory === "Automated" &&
            openPeriod?.last_automated_step != null &&
            Number.isFinite(Number(openPeriod.last_automated_step))
            ? `${categoryLabel} (${Number(openPeriod.last_automated_step)})`
            : categoryLabel;
    const showCategoryChangeButton =
        !isCreditOnlyAccount &&
        openPeriod != null &&
        canChangeCollectionCategory(effectiveCategory);
    const overdueDisplay = resolveCustomerOverdueDisplayMetrics(
        customer,
        openPeriod
    );

    const formatInvoiceCountSecondary = (count: number) =>
        `(${count} ${t("fields.invoices", { ns: "customers" })})`;
    const headerCompactValueFontSize = "0.875rem";
    const overdueDays = customer.oldest_invoice_overdue_date
        ? Math.max(
            0,
            Math.floor(
                (Date.now() -
                    new Date(customer.oldest_invoice_overdue_date).getTime()) /
                86_400_000
            )
        )
        : 0;

    return (
        <Paper
            ref={containerRef}
            elevation={0}
            sx={{
                p: { xs: 1, sm: 1.5 },
                width: "100%",
                minWidth: 0,
                maxWidth: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                border: "none",
            }}
        >
            <Stack
                spacing={{ xs: 1, sm: 1.5 }}
                sx={{
                    width: "100%",
                    minWidth: 0,
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    overflow: "hidden",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: { xs: "column", sm: "row" },
                        justifyContent: "space-between",
                        alignItems: { xs: "flex-start", sm: "center" },
                        gap: { xs: 1, sm: 0 },
                        width: "100%",
                        minWidth: 0,
                        maxWidth: "100%",
                        boxSizing: "border-box",
                        overflow: "hidden",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            direction: i18n.language === "he" ? "rtl" : "ltr",
                        }}
                    >
                        <Box
                            sx={{
                                flex: 1,
                                display: "flex",
                                flexDirection: "column",
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    flexWrap: "wrap",
                                }}
                            >
                                <Typography
                                    variant="h5"
                                    component="h1"
                                    sx={{
                                        fontWeight: 500,
                                        color: "text.primary",
                                        fontSize: {
                                            xs: "1.1rem",
                                            sm: "1.25rem",
                                            md: "1.5rem",
                                        },
                                    }}
                                >
                                    {extractCustomerName(customer)}
                                    {customer.customer_number ? (
                                        <Box
                                            component="span"
                                            sx={{
                                                fontSize: {
                                                    xs: "0.75rem",
                                                    sm: "0.8rem",
                                                    md: "0.875rem",
                                                },
                                                fontWeight: 400,
                                                color: "text.secondary",
                                                ml: 0.75,
                                            }}
                                        >
                                            {" "}({customer.customer_number})
                                        </Box>
                                    ) : null}
                                </Typography>
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
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 0.5,
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={METADATA_LABEL_SX}
                                    >
                                        {t("fields.status", { ns: "common" })}
                                    </Typography>
                                    <Chip
                                        label={
                                            customer.collection_status === "Active"
                                                ? t("values.status_active")
                                                : t("values.status_inactive")
                                        }
                                        size="small"
                                        data-status={
                                            customer.collection_status === "Active"
                                                ? "active"
                                                : "inactive"
                                        }
                                        sx={{
                                            ...METADATA_CHIP_SX,
                                            borderRadius: `${theme.appButton.borderRadius}px`,
                                        }}
                                    />
                                </Box>
                                {!isCreditOnlyAccount ? (
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
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={METADATA_LABEL_SX}
                                            >
                                                {t("fields.category")}
                                            </Typography>
                                            <Chip
                                                label={categoryLabelWithStep}
                                                size="small"
                                                sx={{
                                                    ...METADATA_CHIP_SX,
                                                    ...getCategoryChipSx(
                                                        effectiveCategory,
                                                        theme
                                                    ),
                                                }}
                                            />
                                        </Box>
                                    </>
                                ) : null}
                                {showCreditSection &&
                                    (customer as { has_top_up_policies?: boolean })
                                        ?.has_top_up_policies ? (
                                    <>
                                        {(customer as { has_active_top_up?: boolean })
                                            .has_active_top_up ? (
                                            <Chip
                                                label={t(
                                                    "credit_insurance.top_up_active_chip",
                                                    { ns: "customers" }
                                                )}
                                                size="small"
                                                icon={
                                                    <SecurityIcon
                                                        sx={{ fontSize: 14 }}
                                                    />
                                                }
                                                onClick={goToTopUpPoliciesTab}
                                                sx={{
                                                    ...METADATA_CHIP_SX,
                                                    cursor: "pointer",
                                                    backgroundColor: alpha(
                                                        theme.palette.success.main,
                                                        0.12
                                                    ),
                                                    color: theme.palette.success
                                                        .dark,
                                                }}
                                            />
                                        ) : null}
                                        {(customer as { has_scheduled_top_up?: boolean })
                                            .has_scheduled_top_up &&
                                            !(customer as { has_active_top_up?: boolean })
                                                .has_active_top_up ? (
                                            <Chip
                                                label={t(
                                                    "credit_insurance.top_up_scheduled_chip",
                                                    { ns: "customers" }
                                                )}
                                                size="small"
                                                onClick={goToTopUpPoliciesTab}
                                                sx={{
                                                    ...METADATA_CHIP_SX,
                                                    cursor: "pointer",
                                                    backgroundColor: alpha(
                                                        theme.palette.text.secondary,
                                                        0.08
                                                    ),
                                                }}
                                            />
                                        ) : null}
                                        {isTopUpExpiringWithinDays(
                                            (
                                                customer as {
                                                    top_up_expires_soonest?: string | null;
                                                }
                                            ).top_up_expires_soonest,
                                            30
                                        ) ? (
                                            <Chip
                                                label={t(
                                                    "credit_insurance.top_up_expires_chip",
                                                    {
                                                        ns: "customers",
                                                        date: formatDateForDisplay(
                                                            (
                                                                customer as {
                                                                    top_up_expires_soonest?: string | null;
                                                                }
                                                            ).top_up_expires_soonest!,
                                                            "date",
                                                            getUserDateLocale(
                                                                session
                                                            ),
                                                            getUserTimezone(
                                                                session
                                                            )
                                                        ),
                                                    }
                                                )}
                                                size="small"
                                                icon={
                                                    <WarningIcon
                                                        sx={{ fontSize: 14 }}
                                                    />
                                                }
                                                onClick={goToTopUpPoliciesTab}
                                                sx={{
                                                    ...METADATA_CHIP_SX,
                                                    cursor: "pointer",
                                                    backgroundColor: alpha(
                                                        theme.palette.warning.main,
                                                        0.15
                                                    ),
                                                    color: theme.palette.warning
                                                        .dark,
                                                }}
                                            />
                                        ) : null}
                                    </>
                                ) : null}
                                {customer?.account_id ? (
                                    <CustomerCheckpointActions
                                        customerId={customerIdNumber}
                                        customerAccountId={customer.account_id}
                                        onAfterRestore={handleCategoryUpdated}
                                    />
                                ) : null}
                                {showCategoryChangeButton && (
                                    <Tooltip
                                        title={t("actions.change_category")}
                                    >
                                        <Box
                                            component="span"
                                            sx={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                height: 24,
                                                lineHeight: 0,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <IconButton
                                                color="primary"
                                                size="small"
                                                onClick={() =>
                                                    setIsCategoryChangeModalOpen(
                                                        true
                                                    )
                                                }
                                                aria-label={t(
                                                    "actions.change_category"
                                                )}
                                                sx={{
                                                    width: 24,
                                                    height: 24,
                                                    p: 0,
                                                    "&:hover": {
                                                        backgroundColor: alpha(
                                                            theme.palette.primary
                                                                .main,
                                                            0.08
                                                        ),
                                                    },
                                                }}
                                            >
                                                <SwapHorizIcon
                                                    sx={{ fontSize: 20 }}
                                                />
                                            </IconButton>
                                        </Box>
                                    </Tooltip>
                                )}
                                {!hideOpenPortal && (
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
                                        <Tooltip
                                            title={t("actions.open_portal")}
                                            arrow
                                            enterDelay={300}
                                            leaveDelay={100}
                                            placement="bottom"
                                            PopperProps={{
                                                sx: {
                                                    "& .MuiTooltip-tooltip": {
                                                        direction:
                                                            i18n.language === "he"
                                                                ? "rtl"
                                                                : "rtl",
                                                    },
                                                    "& .MuiTooltip-arrow": {
                                                        ...(i18n.language ===
                                                            "he" && {
                                                            transform:
                                                                "scaleX(-1)",
                                                        }),
                                                    },
                                                },
                                            }}
                                        >
                                            <IconButton
                                                color="primary"
                                                size="small"
                                                onClick={() => {
                                                    if (customer?.id) {
                                                        const portalUrl =
                                                            getPortalUrl(customer);
                                                        window.open(
                                                            portalUrl,
                                                            "_blank"
                                                        );
                                                    }
                                                }}
                                            >
                                                <PublicIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </>
                                )}
                            </Box>
                        </Box>
                    </Box>
                </Box>

                {headerMetricCardCount > 0 && (
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm:
                                    headerMetricCardCount === 1
                                        ? "1fr"
                                        : "repeat(2, minmax(0, 1fr))",
                                md: `repeat(${headerMetricCardCount}, minmax(0, 1fr))`,
                            },
                            gap: { xs: 0.75, sm: 1 },
                            width: "100%",
                            minWidth: 0,
                        }}
                    >
                        {showCollectionCards && (
                            <>
                                <CreditMetricCard
                                    compact
                                    icon={<ReceiptIcon />}
                                    iconAccent="overdue"
                                    label={t("fields.total_outstanding_amount")}
                                    value={formatHeaderAmount(
                                        Math.max(
                                            0,
                                            Number(
                                                customer.total_overdue_amount ??
                                                    overdueDisplay.amount ??
                                                    0
                                            )
                                        ),
                                        overdueSecondaryAmount
                                    )}
                                    secondaryLine={formatInvoiceCountSecondary(
                                        overdueDisplay.invoiceCount
                                    )}
                                    compactValueFontSize={headerCompactValueFontSize}
                                    forceSecondaryLineBelow
                                    sx={{ minHeight: 105 }}
                                />
                                <CreditMetricCard
                                    compact
                                    icon={<TrendingUpIcon />}
                                    iconAccent="receivables"
                                    label={t("fields.total_due_amount")}
                                    value={formatHeaderAmount(
                                        duePrimaryAmount,
                                        dueSecondaryAmount
                                    )}
                                    secondaryLine={formatInvoiceCountSecondary(
                                        customer.no_of_due_invoices ?? 0
                                    )}
                                    compactValueFontSize={headerCompactValueFontSize}
                                    forceSecondaryLineBelow
                                    sx={{ minHeight: 105 }}
                                />
                                <CreditMetricCard
                                    compact
                                    icon={<AttachMoneyIcon />}
                                    iconAccent="receivables"
                                    label={t("credit_insurance.total_ar", {
                                        ns: "customers",
                                    })}
                                    value={formatHeaderAmount(
                                        headerArPrimary,
                                        headerArSecondary
                                    )}
                                    compactValueFontSize={headerCompactValueFontSize}
                                    forceSecondaryLineBelow
                                    sx={{ minHeight: 105 }}
                                />
                                <CreditMetricCard
                                    compact
                                    icon={<AccessTimeIcon />}
                                    iconAccent="overdue"
                                    label={t("fields.days_overdue")}
                                    value={`${overdueDays} ${t("fields.days", { ns: "customers" })}`}
                                    compactValueFontSize={headerCompactValueFontSize}
                                    forceSecondaryLineBelow
                                    sx={{ minHeight: 105 }}
                                />
                            </>
                        )}
                        {showCreditSection && (
                            <>
                                <CreditMetricCard
                                    compact
                                    icon={<WarningAmberIcon />}
                                    iconAccent="capacity"
                                    label={t("credit_insurance.capacity_gap", {
                                        ns: "customers",
                                    })}
                                    value={
                                        creditKpiQuery.isPending || !creditKpiCards
                                            ? t("messages.loading", { ns: "common" })
                                            : formatHeaderAmount(
                                                  capacityGapDisplay.primary,
                                                  capacityGapDisplay.secondary
                                              )
                                    }
                                    compactValueFontSize={headerCompactValueFontSize}
                                    forceSecondaryLineBelow
                                    sx={{ minHeight: 105 }}
                                />
                                <CreditMetricCard
                                    compact
                                    icon={<GavelIcon />}
                                    iconAccent="terms"
                                    label={t("credit_insurance.uninsured_amount", {
                                        ns: "customers",
                                    })}
                                    value={
                                        creditKpiQuery.isPending || !creditKpiCards
                                            ? t("messages.loading", { ns: "common" })
                                            : formatHeaderAmount(
                                                  creditKpiCards.uninsuredAmount,
                                                  creditKpiCards.uninsuredAmountSecondary
                                              )
                                    }
                                    compactValueFontSize={headerCompactValueFontSize}
                                    forceSecondaryLineBelow
                                    sx={{ minHeight: 105 }}
                                />
                            </>
                        )}
                    </Box>
                )}

                {showNotification && notificationData && (
                    <Box
                        sx={{
                            width: "100%",
                            minWidth: 0,
                            maxWidth: "100%",
                            boxSizing: "border-box",
                            overflow: "hidden",
                        }}
                    >
                        <EnhancedFollowUpNotification
                            message={t(
                                "messages.follow_up_notification_dual_time",
                                {
                                    customerDate: notificationData.customerDate,
                                    customerTime: notificationData.customerTime,
                                    userDate: notificationData.userDate,
                                    userTime: notificationData.userTime,
                                }
                            )}
                            followUpDate={
                                new Date(
                                    getOpenCollectionPeriod()?.follow_up_time ||
                                    ""
                                )
                            }
                            isWithinBusinessHours={true}
                            timeRemaining={calculateTimeRemaining(
                                new Date(
                                    getOpenCollectionPeriod()?.follow_up_time ||
                                    ""
                                ),
                                t
                            )}
                            onCancel={handleClearFollowUp}
                            collectionPeriodId={
                                getOpenCollectionPeriod()?.id
                            }
                        />
                    </Box>
                )}

                {Boolean(customer?.overdue_block) && showCreditSection && (
                    <CustomerHeaderNotificationBanner
                        variant="error"
                        borderRadius={notificationBannerBorderRadius}
                        icon={
                            <WarningIcon
                                sx={{ fontSize: 18, color: "error.main" }}
                            />
                        }
                        message={t("credit_insurance.overdue_block_banner", {
                            ns: "customers",
                            defaultValue:
                                "Overdue block: this customer is past the MEP deadline from the oldest overdue invoice.",
                        })}
                    />
                )}

                {showZeroApprovedLimitBanner && (
                    <CustomerHeaderNotificationBanner
                        variant="warning"
                        borderRadius={notificationBannerBorderRadius}
                        icon={
                            <WarningIcon
                                sx={{ fontSize: 18, color: "warning.main" }}
                            />
                        }
                        message={zeroApprovedLimitBannerMessage}
                    />
                )}

                {((stuckActivitiesData as any)?.hasStuckActivities ||
                    customer?.automation_stuck_no_contacts === true) &&
                    !isCreditOnlyAccount && (
                        <CustomerHeaderNotificationBanner
                            variant="warning"
                            borderRadius={notificationBannerBorderRadius}
                            icon={
                                <WarningIcon
                                    sx={{ fontSize: 18, color: "warning.main" }}
                                />
                            }
                            message={t("messages.stuck_activity_notification")}
                            action={
                                customer?.type === "Company" &&
                                    customer?.company_id &&
                                    hasManageContactsPermission ? (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        color="warning"
                                        sx={{
                                            fontSize: "0.7rem",
                                            height: 28,
                                            minWidth: 80,
                                            "& .MuiButton-label": { px: 1 },
                                        }}
                                        onClick={() => {
                                            setIsContactModalOpen(true);
                                        }}
                                    >
                                        {t("actions.add_contact")}
                                    </Button>
                                ) : undefined
                            }
                        />
                    )}

                {smsBlockingStatus?.isBlocked && !isCreditOnlyAccount && (
                    <CustomerHeaderNotificationBanner
                        variant="warning"
                        borderRadius={notificationBannerBorderRadius}
                        icon={<BlockIcon sx={{ fontSize: 18, color: "warning.main" }} />}
                        message={t("messages.sms_blocked_message")}
                    />
                )}
            </Stack>

            {/* Only render UpsertContactModal for Company customers with valid company_id */}
            {customer?.type === "Company" && customer?.company_id && (
                <UpsertContactModal
                    isOpen={isContactModalOpen}
                    closeModal={() => setIsContactModalOpen(false)}
                    initialContact={undefined}
                    companyId={Number(customer.company_id)}
                    customerId={customerIdNumber}
                    accountId={customer.account_id}
                />
            )}

            {showCategoryChangeButton && (
                <ChangeCollectionCategoryModal
                    isOpen={isCategoryChangeModalOpen}
                    closeModal={() => setIsCategoryChangeModalOpen(false)}
                    customerId={customer.id}
                    currentCategory={effectiveCategory}
                    CustomerCollectionPeriodId={openPeriod?.id ?? 0}
                    refreshdata={handleCategoryUpdated}
                />
            )}
        </Paper>
    );
};

export default CustomerHeader;
