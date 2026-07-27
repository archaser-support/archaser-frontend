"use client";

import {
    DescriptionOutlined as DescriptionOutlinedIcon,
    EmailOutlined as EmailOutlinedIcon,
    PersonOutline as PersonOutlineIcon,
    ReceiptOutlined as ReceiptOutlinedIcon,
} from "@mui/icons-material";
import { Box, Chip, CircularProgress, Tooltip, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import { useParams, useRouter } from "next/navigation";
import React, { use, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

import { CreditMetricCard } from "@/app/[locale]/app/credit-dashboard/CreditMetricCard";
import type { MetricStatCardIconAccent } from "@/app/theme";
import { getMetricStatCardBorderRadius } from "@/app/theme/metricStatCard";
import PageHeader from "@/components/PageHeader";

interface ControlCenterProps {
    params: Promise<{ locale: string }>;
}

interface ControlCenterStats {
    noContacts: {
        active: number;
        inactive: number;
    };
    invalidContacts: {
        active: number;
        inactive: number;
    };
    invoicesWithoutCustomer: {
        active: number;
        inactive: number;
    };
    orphanCreditInvoices: {
        active: number;
        inactive: number;
    };
}

interface ContentProps {
    customersWithoutContact?: {
        active: number;
        inactive: number;
    };
    customersWithInvalidContacts?: {
        active: number;
        inactive: number;
    };
    invoicesWithoutCustomer?: {
        active: number;
        inactive: number;
    };
    orphanCreditInvoices?: {
        active: number;
        inactive: number;
    };
}

const ControlCenter = React.memo(({ params }: ControlCenterProps) => {
    const resolvedParams = use(params);
    const { locale } = resolvedParams;
    const { t, i18n } = useTranslation(["control_center", "common"]);
    const {
        data: controlCenterStats,
        error,
        isLoading,
    } = useQuery<ControlCenterStats>({
        queryKey: ["controlCenterStats"],
        queryFn: async () => {
            const response = await api.get(
                "/api/system/control-center?operation=stats"
            );
            return response.data;
        },
    });
    const dispatch = useDispatch();

    // Memoized language change effect
    useEffect(() => {
        if (locale && i18n.language !== locale) {
            i18n.changeLanguage(locale);
        }
    }, [locale, i18n]);

    // Memoized Redux dispatch
    useEffect(() => {
        if (controlCenterStats) {
            dispatch({
                type: "SET_CONTROL_CENTER_ISSUES",
                payload: {
                    noContacts: controlCenterStats.noContacts,
                    invalidContacts: controlCenterStats.invalidContacts,
                    invoicesWithoutCustomer: controlCenterStats.invoicesWithoutCustomer,
                    orphanCreditInvoices: controlCenterStats.orphanCreditInvoices,
                },
            });
        }
    }, [controlCenterStats, dispatch]);

    // Memoized loading component
    const LoadingComponent = useMemo(() => (
        <Box
            sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "400px",
            }}
        >
            <CircularProgress color="primary" size={40} />
        </Box>
    ), []);

    if (error) return <div>{t("messages.error", { ns: "control_center" })}</div>;
    if (isLoading) return LoadingComponent;

    return (
        <Content
            customersWithoutContact={controlCenterStats?.noContacts}
            customersWithInvalidContacts={controlCenterStats?.invalidContacts}
            invoicesWithoutCustomer={controlCenterStats?.invoicesWithoutCustomer}
            orphanCreditInvoices={controlCenterStats?.orphanCreditInvoices}
        />
    );
});

ControlCenter.displayName = 'ControlCenter';

type CardType = "customers" | "contacts" | "invoices" | "orphanCredits" | "analytics";

interface ControlCenterCard {
    icon: React.ReactNode;
    iconAccent: MetricStatCardIconAccent;
    title: string;
    count: number;
    inactiveCount: number;
    description: string;
    link: string;
    type: CardType;
}

const Content = React.memo(({
    customersWithoutContact,
    customersWithInvalidContacts,
    invoicesWithoutCustomer,
    orphanCreditInvoices,
}: ContentProps) => {
    const { t, i18n } = useTranslation(["control_center", "common"]);
    const theme = useTheme();
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const isRtl = i18n.language === "he";

    // Memoized tooltip mapping
    const tooltipMap = useMemo(() => ({
        customers: {
            active: "customers_without_contacts_active",
            inactive: "customers_without_contacts_inactive",
        },
        contacts: {
            active: "customers_with_invalid_contacts_active",
            inactive: "customers_with_invalid_contacts_inactive",
        },
        invoices: {
            active: "invoices_without_customer_active",
            inactive: "invoices_without_customer_inactive",
        },
        orphanCredits: {
            active: "orphan_credit_invoices_active",
            inactive: "orphan_credit_invoices_inactive",
        },
        analytics: {
            active: "analytics_channel_selection_active",
            inactive: "analytics_channel_selection_inactive",
        },
    }), []);

    const getTooltipKey = useCallback((
        cardType: CardType,
        status: "active" | "inactive"
    ) => tooltipMap[cardType][status], [tooltipMap]);

    // Memoized cards configuration
    const cards: ControlCenterCard[] = useMemo(() => [
        {
            icon: <PersonOutlineIcon />,
            iconAccent: "atRisk",
            title: t("sections.customers_without_contact_title", { ns: "control_center" }),
            count: customersWithoutContact?.active || 0,
            inactiveCount: customersWithoutContact?.inactive || 0,
            description: t("sections.customers_without_contact_description", { ns: "control_center" }),
            link: "/app/control-center/contacts/no-contacts",
            type: "customers",
        },
        {
            icon: <EmailOutlinedIcon />,
            iconAccent: "limitWarnings",
            title: t("sections.customers_with_invalid_contacts_title", { ns: "control_center" }),
            count: customersWithInvalidContacts?.active || 0,
            inactiveCount: customersWithInvalidContacts?.inactive || 0,
            description: t("sections.customers_with_invalid_contacts_description", { ns: "control_center" }),
            link: "/app/control-center/contacts/invalid-contacts",
            type: "contacts",
        },
        {
            icon: <DescriptionOutlinedIcon />,
            iconAccent: "reporting",
            title: t("sections.invoices_without_customer_title", { ns: "control_center" }),
            count: invoicesWithoutCustomer?.active || 0,
            inactiveCount: invoicesWithoutCustomer?.inactive || 0,
            description: t("sections.invoices_without_customer_description", { ns: "control_center" }),
            link: "/app/control-center/without-customer",
            type: "invoices",
        },
        {
            icon: <ReceiptOutlinedIcon />,
            iconAccent: "overdue",
            title: t("sections.orphan_credit_invoices_title", { ns: "control_center" }),
            count: orphanCreditInvoices?.active || 0,
            inactiveCount: orphanCreditInvoices?.inactive || 0,
            description: t("sections.orphan_credit_invoices_description", { ns: "control_center" }),
            link: "/app/control-center/orphan-credit-invoices",
            type: "orphanCredits",
        },
    ], [t, customersWithoutContact, customersWithInvalidContacts, invoicesWithoutCustomer, orphanCreditInvoices]);

    return (
        <Box
            sx={{
                bgcolor: "background.default",
                borderRadius: getMetricStatCardBorderRadius(theme),
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden",
            }}
        >
            {/* Header Section */}
            <PageHeader
                title={t("actions.title", { ns: "control_center" })}
                description={t("actions.description", { ns: "control_center" })}
            />

            <Box
                sx={{
                    p: { xs: theme.spacing(1.5), sm: theme.spacing(2) },
                    maxWidth: "100%",
                    overflow: "hidden",
                }}
            >
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            sm: "repeat(2, minmax(0, 1fr))",
                            lg: "repeat(3, minmax(0, 1fr))",
                        },
                        alignItems: "stretch",
                        gap: 2,
                        direction: isRtl ? "rtl" : "ltr",
                        maxWidth: "100%",
                    }}
                >
                    {cards.map((card) => (
                        <CreditMetricCard
                            key={card.type}
                            icon={card.icon}
                            iconAccent={card.iconAccent}
                            label={card.title}
                            value={
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 0.5,
                                        direction: isRtl ? "rtl" : "ltr",
                                    }}
                                >
                                    <Tooltip
                                        title={t(
                                            `tooltips.${getTooltipKey(card.type, "active")}`,
                                            { ns: "control_center" }
                                        )}
                                    >
                                        <Chip
                                            label={card.count}
                                            size="small"
                                            data-status="active"
                                        />
                                    </Tooltip>
                                    {card.inactiveCount > 0 && (
                                        <Tooltip
                                            title={t(
                                                `tooltips.${getTooltipKey(card.type, "inactive")}`,
                                                { ns: "control_center" }
                                            )}
                                        >
                                            <Chip
                                                label={card.inactiveCount}
                                                size="small"
                                                data-status="inactive"
                                            />
                                        </Tooltip>
                                    )}
                                </Box>
                            }
                            footnote={card.description}
                            onClick={() =>
                                router.push(`/${locale}${card.link}`)
                            }
                        />
                    ))}
                </Box>
            </Box>
        </Box>
    );
});

Content.displayName = 'Content';

export default ControlCenter;
