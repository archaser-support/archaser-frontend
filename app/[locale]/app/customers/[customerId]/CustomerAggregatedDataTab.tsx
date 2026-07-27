"use client";

import {
    BarChart as BarChartIcon,
    AttachMoney as MoneyIcon,
    Payment as PaymentIcon,
    People as PeopleIcon,
    PieChart as PieChartIcon,
    Receipt as ReceiptIcon,
    Schedule as ScheduleIcon,
} from "@mui/icons-material";
import {
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    Link,
    Typography,
    useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getCustomerAggregatedData } from "@/shared/services/customerService";
import AppUrls from "@/utils/appUrls";
import {
    formatAmountWithoutSymbol,
    formatCurrencyWithRTLSupport,
    resolveCustomerFirstCurrency,
} from "@/utils/stringFormatters";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

interface CustomerAggregatedDataTabProps {
    customerId: number;
}

interface ChildCustomer {
    id: number;
    customer_number: string | null;
    name: string;
    type: "Person" | "Company";
    outstanding_amount: number;
    overdue_invoices: number;
    currency: string | null;
    due_amount: number;
    due_invoices: number;
    due_currency: string | null;
}

interface AggregatedData {
    id: number;
    customer_id: number;
    total_outstanding_amount: number | null;
    customer_outstanding_amount1: number | null;
    customer_outstanding_amount2: number | null;
    customer_currency1: string | null;
    customer_currency2: string | null;
    no_of_overdue_invoices: number | null;
    no_of_due_invoices: number | null;
    total_invoices_count: number | null;
    total_paid_amount: number | null;
    customer_total_paid_amount1: number | null;
    customer_total_paid_amount2: number | null;
    total_collection_periods: number | null;
    active_collection_periods: number | null;
    child_customers_count: number | null;
}

const CustomerAggregatedDataTab: React.FC<CustomerAggregatedDataTabProps> = ({
    customerId,
}) => {
    const { t, i18n } = useTranslation(["customers", "common"]);
    const theme = useTheme();
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";

    const { data, isLoading, error } = useQuery({
        queryKey: ["customerAggregatedData", customerId],
        queryFn: () => getCustomerAggregatedData(customerId),
        enabled: !!customerId,
    });

    const aggregatedData: AggregatedData | null = data?.aggregatedData || null;
    const childCustomers: ChildCustomer[] = useMemo(
        () => data?.childCustomers || [],
        [data?.childCustomers]
    );
    const totalDueAmount: number = data?.totalDueAmount || 0;
    const accountCurrency: string = resolveCustomerFirstCurrency({
        fallbackCurrency: data?.accountCurrency,
    });
    const customerTotalDueAmount1: number | null =
        data?.customerTotalDueAmount1 ?? null;
    const customerTotalDueCurrency1: string | null =
        data?.customerTotalDueCurrency1 ?? null;
    const customerTotalDueAmount2: number | null =
        data?.customerTotalDueAmount2 ?? null;
    const customerTotalDueCurrency2: string | null =
        data?.customerTotalDueCurrency2 ?? null;

    // Inject CSS for wrapping labels in donut chart (center label and legend)
    useEffect(() => {
        const styleId = "apexcharts-legend-wrap";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
                .apexcharts-legend {
                    max-width: 100% !important;
                }
                .apexcharts-legend-series {
                    max-width: 100% !important;
                }
                .apexcharts-legend-text {
                    white-space: normal !important;
                    word-wrap: break-word !important;
                    max-width: 150px !important;
                    line-height: 1.4 !important;
                }
                .apexcharts-datalabels-group {
                    text-align: center !important;
                }
                .apexcharts-datalabel-label {
                    white-space: pre-line !important;
                    word-wrap: break-word !important;
                    text-align: center !important;
                    line-height: 1.4 !important;
                    max-width: 120px !important;
                    margin: 0 auto !important;
                }
            `;
            document.head.appendChild(style);
        }
        return () => {
            // Cleanup is optional - we can keep the style for other charts
        };
    }, []);

    // Prepare chart data - must be called before any early returns
    const outstandingByChildChartData = useMemo(() => {
        if (!childCustomers || childCustomers.length === 0) {
            return { labels: [], series: [] };
        }
        return {
            labels: childCustomers.map(
                (child) =>
                    child.name ||
                    child.customer_number ||
                    `Customer ${child.id}`
            ),
            series: childCustomers.map(
                (child) => child.outstanding_amount || 0
            ),
        };
    }, [childCustomers]);

    const invoicesByChildChartData = useMemo(() => {
        if (!childCustomers || childCustomers.length === 0) {
            return { categories: [], overdue: [], due: [] };
        }
        return {
            categories: childCustomers.map(
                (child) =>
                    child.name ||
                    child.customer_number ||
                    `Customer ${child.id}`
            ),
            overdue: childCustomers.map((child) => child.overdue_invoices || 0),
            due: childCustomers.map((child) => child.due_invoices || 0),
        };
    }, [childCustomers]);

    // Donut chart options for outstanding amounts - must be called before any early returns
    const outstandingChartOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: "donut",
                background: "#F3F6FA",
                foreColor: "#2F3B52",
                toolbar: { show: false },
                animations: {
                    enabled: true,
                    easing: "easeinout",
                    speed: 800,
                },
            },
            labels: outstandingByChildChartData.labels,
            colors: [
                theme.palette.chartPalette.dark,
                theme.palette.chartPalette.main,
                theme.palette.chartPalette.light,
                "#A78BFA",
                "#C4B5FD",
                "#DDD6FE",
                theme.palette.warning.main,
                theme.palette.error.main,
            ],
            dataLabels: {
                enabled: true,
                formatter: (val: number) => `${val.toFixed(1)}%`,
                style: {
                    fontSize: "12px",
                    fontWeight: 600,
                    colors: ["#FFFFFF"],
                },
                background: {
                    enabled: true,
                    foreColor: "#2F3B52",
                    borderRadius: 4,
                    padding: 4,
                    opacity: 0.9,
                    borderWidth: 1,
                    borderColor: "#ffffff",
                },
                dropShadow: {
                    enabled: true,
                    opacity: 0.5,
                    blur: 3,
                    left: 0,
                    top: 0,
                },
            },
            legend: {
                position: "bottom",
                horizontalAlign: "center",
                fontSize: "12px",
                fontFamily: "inherit",
                labels: {
                    colors: theme.palette.text.primary,
                },
                formatter: (seriesName: string, opts: any) => {
                    // Wrap text at 20 characters
                    const maxLength = 20;
                    if (seriesName.length <= maxLength) {
                        return seriesName;
                    }
                    // Split into words and wrap
                    const words = seriesName.split(" ");
                    const lines: string[] = [];
                    let currentLine = "";

                    words.forEach((word) => {
                        if ((currentLine + word).length <= maxLength) {
                            currentLine += (currentLine ? " " : "") + word;
                        } else {
                            if (currentLine) lines.push(currentLine);
                            currentLine = word;
                        }
                    });
                    if (currentLine) lines.push(currentLine);

                    return lines.join("\n");
                },
            },
            tooltip: {
                theme: "light",
                style: {
                    fontSize: "12px",
                    fontFamily: "inherit",
                },
                y: {
                    formatter: (val: number) => formatAmountWithoutSymbol(val),
                },
            },
            grid: {
                borderColor: "#DCE3EB",
                strokeDashArray: 5,
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: "60%",
                        labels: {
                            show: true,
                            name: {
                                show: true,
                                fontSize: "14px",
                                fontWeight: 600,
                                color: theme.palette.text.primary,
                                formatter: (seriesName: string) => {
                                    // Wrap the label text at 15 characters
                                    const maxLength = 15;
                                    const label = t(
                                        "fields.total_outstanding_amount",
                                        {
                                            ns: "customers",
                                        }
                                    );
                                    if (label.length <= maxLength) {
                                        return label;
                                    }
                                    // Split into words and wrap
                                    const words = label.split(" ");
                                    const lines: string[] = [];
                                    let currentLine = "";

                                    words.forEach((word) => {
                                        if (
                                            (currentLine + word).length <=
                                            maxLength
                                        ) {
                                            currentLine +=
                                                (currentLine ? " " : "") + word;
                                        } else {
                                            if (currentLine)
                                                lines.push(currentLine);
                                            currentLine = word;
                                        }
                                    });
                                    if (currentLine) lines.push(currentLine);

                                    return lines.join("\n");
                                },
                            },
                            value: {
                                show: true,
                                fontSize: "16px",
                                fontWeight: 700,
                                color: theme.palette.chartPalette.main,
                                formatter: (val: string) =>
                                    formatAmountWithoutSymbol(parseFloat(val)),
                            },
                            total: {
                                show: true,
                                label: t("fields.total_outstanding_amount", {
                                    ns: "customers",
                                }),
                                fontSize: "14px",
                                fontWeight: 600,
                                color: theme.palette.text.primary,
                                formatter: () => {
                                    const total =
                                        outstandingByChildChartData.series.reduce(
                                            (a, b) => a + b,
                                            0
                                        );
                                    const currency =
                                        childCustomers.length > 0 &&
                                            childCustomers[0].currency
                                            ? childCustomers[0].currency
                                            : accountCurrency;
                                    return formatCurrencyWithRTLSupport(
                                        total,
                                        currency,
                                        i18n.language === "he" ? "he-IL" : "en-US",
                                        i18n.language
                                    );
                                },
                            },
                        },
                    },
                },
            },
        }),
        [outstandingByChildChartData, theme, t, childCustomers, i18n.language, accountCurrency]
    );

    // Bar chart options for invoices - must be called before any early returns
    const invoicesChartOptions: ApexOptions = useMemo(
        () => ({
            chart: {
                type: "bar",
                background: "#F3F6FA",
                foreColor: "#2F3B52",
                toolbar: { show: false },
                stacked: false,
                animations: {
                    enabled: true,
                    easing: "easeinout",
                    speed: 800,
                },
            },
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: "60%",
                    borderRadius: 4,
                    dataLabels: {
                        position: "top",
                    },
                },
            },
            dataLabels: {
                enabled: true,
                style: {
                    fontSize: "11px",
                    fontWeight: 600,
                    colors: ["#FFFFFF"],
                },
                background: {
                    enabled: true,
                    foreColor: "#2F3B52",
                    borderRadius: 4,
                    padding: 4,
                    opacity: 0.9,
                    borderWidth: 1,
                    borderColor: "#ffffff",
                },
                dropShadow: {
                    enabled: true,
                    opacity: 0.5,
                    blur: 3,
                    left: 0,
                    top: 0,
                },
            },
            xaxis: {
                categories: invoicesByChildChartData.categories,
                labels: {
                    style: {
                        colors: "#7C8DA1",
                        fontSize: "11px",
                        fontFamily: "inherit",
                    },
                    rotate: i18n.language === "he" ? -45 : 0,
                },
                axisBorder: {
                    color: "#DCE3EB",
                },
                axisTicks: {
                    color: "#DCE3EB",
                },
            },
            yaxis: {
                labels: {
                    style: {
                        colors: "#7C8DA1",
                        fontSize: "11px",
                        fontFamily: "inherit",
                    },
                },
            },
            colors: [theme.palette.chartPalette.main, theme.palette.chartPalette.light],
            legend: {
                position: "top",
                horizontalAlign: "right",
                fontSize: "12px",
                fontFamily: "inherit",
                labels: {
                    colors: theme.palette.text.primary,
                },
            },
            tooltip: {
                theme: "light",
                style: {
                    fontSize: "12px",
                    fontFamily: "inherit",
                },
                y: {
                    formatter: (val: number) => `${val}`,
                },
            },
            grid: {
                borderColor: "#DCE3EB",
                strokeDashArray: 5,
                xaxis: {
                    lines: {
                        show: true,
                        color: "#DCE3EB",
                        opacity: 0.3,
                    },
                },
                yaxis: {
                    lines: {
                        show: true,
                        color: "#DCE3EB",
                        opacity: 0.3,
                    },
                },
            },
        }),
        [invoicesByChildChartData, theme, i18n.language]
    );

    if (isLoading) {
        return null;
    }

    if (error) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 4,
                }}
            >
                <Typography color="error">
                    {t("messages.error_loading_customer_data", {
                        ns: "customers",
                    })}
                </Typography>
            </Box>
        );
    }

    if (!data || !aggregatedData) {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 4,
                }}
            >
                <Typography color="text.secondary">
                    {t("messages.no_child_customers", { ns: "customers" })}
                </Typography>
            </Box>
        );
    }

    const handleChildCustomerClick = (childId: number) => {
        router.push(`/${locale}${AppUrls.Customer_DETAILS(childId)}`);
    };

    return (
        <Box
            sx={{
                p: { xs: 1.5, sm: 2 },
                direction: i18n.language === "he" ? "rtl" : "ltr",
            }}
        >
            {/* Summary Cards */}
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, 1fr)",
                        md: "repeat(3, 1fr)",
                        lg: "repeat(6, 1fr)",
                    },
                    gap: 2,
                    mb: 3,
                }}
            >
                {/* Child Customers Count */}
                <Box>
                    <Card
                        elevation={0}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: theme.shape.borderRadius,
                            height: "100%",
                        }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <PeopleIcon
                                    sx={{
                                        color: theme.palette.secondary.main,
                                        fontSize: 20,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600 }}
                                >
                                    {t("fields.child_customers_count", {
                                        ns: "customers",
                                    })}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {aggregatedData.child_customers_count || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>

                {/* Total Outstanding Amount */}
                <Box>
                    <Card
                        elevation={0}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: theme.shape.borderRadius,
                            height: "100%",
                        }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <MoneyIcon
                                    sx={{
                                        color: theme.palette.warning.main,
                                        fontSize: 20,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600 }}
                                >
                                    {t("fields.total_outstanding_amount", {
                                        ns: "customers",
                                    })}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {formatCurrencyWithRTLSupport(
                                    aggregatedData.total_outstanding_amount ||
                                        0,
                                    accountCurrency,
                                    i18n.language === "he" ? "he-IL" : "en-US",
                                    i18n.language
                                )}
                            </Typography>
                            {(aggregatedData.customer_outstanding_amount1 ||
                                aggregatedData.customer_outstanding_amount2) && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.5 }}
                                >
                                    {[
                                        aggregatedData
                                            .customer_outstanding_amount1 !=
                                            null &&
                                        aggregatedData.customer_currency1
                                            ? formatCurrencyWithRTLSupport(
                                                  aggregatedData.customer_outstanding_amount1,
                                                  aggregatedData.customer_currency1,
                                                  i18n.language === "he"
                                                      ? "he-IL"
                                                      : "en-US",
                                                  i18n.language
                                              )
                                            : null,
                                        aggregatedData
                                            .customer_outstanding_amount2 !=
                                            null &&
                                        aggregatedData.customer_currency2
                                            ? formatCurrencyWithRTLSupport(
                                                  aggregatedData.customer_outstanding_amount2,
                                                  aggregatedData.customer_currency2,
                                                  i18n.language === "he"
                                                      ? "he-IL"
                                                      : "en-US",
                                                  i18n.language
                                              )
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" + ")}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Box>

                {/* Total Overdue Invoices */}
                <Box>
                    <Card
                        elevation={0}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: theme.shape.borderRadius,
                            height: "100%",
                        }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <ReceiptIcon
                                    sx={{
                                        color: theme.palette.error.main,
                                        fontSize: 20,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600 }}
                                >
                                    {t("fields.no_of_overdue_invoices", {
                                        ns: "customers",
                                    })}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {aggregatedData.no_of_overdue_invoices || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>

                {/* Total Paid Amount */}
                <Box>
                    <Card
                        elevation={0}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: theme.shape.borderRadius,
                            height: "100%",
                        }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <PaymentIcon
                                    sx={{
                                        color: theme.palette.success.main,
                                        fontSize: 20,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600 }}
                                >
                                    {t("fields.total_paid_amount", {
                                        ns: "customers",
                                    })}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {formatCurrencyWithRTLSupport(
                                    aggregatedData.total_paid_amount || 0,
                                    accountCurrency,
                                    i18n.language === "he" ? "he-IL" : "en-US",
                                    i18n.language
                                )}
                            </Typography>
                            {(aggregatedData.customer_total_paid_amount1 ||
                                aggregatedData.customer_total_paid_amount2) && (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.5 }}
                                >
                                    {[
                                        aggregatedData
                                            .customer_total_paid_amount1 !=
                                            null &&
                                        aggregatedData.customer_currency1
                                            ? formatCurrencyWithRTLSupport(
                                                  aggregatedData.customer_total_paid_amount1,
                                                  aggregatedData.customer_currency1,
                                                  i18n.language === "he"
                                                      ? "he-IL"
                                                      : "en-US",
                                                  i18n.language
                                              )
                                            : null,
                                        aggregatedData
                                            .customer_total_paid_amount2 !=
                                            null &&
                                        aggregatedData.customer_currency2
                                            ? formatCurrencyWithRTLSupport(
                                                  aggregatedData.customer_total_paid_amount2,
                                                  aggregatedData.customer_currency2,
                                                  i18n.language === "he"
                                                      ? "he-IL"
                                                      : "en-US",
                                                  i18n.language
                                              )
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" + ")}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Box>

                {/* Total Due Amount */}
                <Box>
                    <Card
                        elevation={0}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: theme.shape.borderRadius,
                            height: "100%",
                        }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <ScheduleIcon
                                    sx={{
                                        color: theme.palette.info.main,
                                        fontSize: 20,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600 }}
                                >
                                    {t("fields.total_due_amount", {
                                        ns: "customers",
                                    })}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {formatCurrencyWithRTLSupport(
                                    totalDueAmount,
                                    accountCurrency,
                                    i18n.language === "he" ? "he-IL" : "en-US",
                                    i18n.language
                                )}
                            </Typography>
                            {(customerTotalDueAmount1 != null &&
                                customerTotalDueCurrency1) ||
                                (customerTotalDueAmount2 != null &&
                                    customerTotalDueCurrency2) ? (
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.5 }}
                                >
                                    {[
                                        customerTotalDueAmount1 != null &&
                                        customerTotalDueCurrency1
                                            ? formatCurrencyWithRTLSupport(
                                                  customerTotalDueAmount1,
                                                  customerTotalDueCurrency1,
                                                  i18n.language === "he"
                                                      ? "he-IL"
                                                      : "en-US",
                                                  i18n.language
                                              )
                                            : null,
                                        customerTotalDueAmount2 != null &&
                                        customerTotalDueCurrency2
                                            ? formatCurrencyWithRTLSupport(
                                                  customerTotalDueAmount2,
                                                  customerTotalDueCurrency2,
                                                  i18n.language === "he"
                                                      ? "he-IL"
                                                      : "en-US",
                                                  i18n.language
                                              )
                                            : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" + ")}
                                </Typography>
                            ) : null}
                        </CardContent>
                    </Card>
                </Box>

                {/* Number of Due Invoices */}
                <Box>
                    <Card
                        elevation={0}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: theme.shape.borderRadius,
                            height: "100%",
                        }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 1,
                                }}
                            >
                                <ReceiptIcon
                                    sx={{
                                        color: theme.palette.info.main,
                                        fontSize: 20,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600 }}
                                >
                                    {t("fields.no_of_due_invoices", {
                                        ns: "customers",
                                    })}
                                </Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                {aggregatedData.no_of_due_invoices || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>

            {/* Charts Section */}
            {childCustomers.length > 0 && (
                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr",
                            md: "1fr 1fr",
                        },
                        gap: 2,
                        mb: 3,
                    }}
                >
                    {/* Outstanding Amounts by Child Customer - Donut Chart */}
                    <Card
                        elevation={0}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: theme.shape.borderRadius,
                            height: "100%",
                            minHeight: "400px",
                        }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 2,
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                <PieChartIcon
                                    sx={{
                                        color: theme.palette.secondary.main,
                                        fontSize: 24,
                                    }}
                                />
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontWeight: 600,
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    {t("sections.outstanding_by_child", {
                                        ns: "customers",
                                    })}
                                </Typography>
                            </Box>
                            {outstandingByChildChartData.series.length > 0 ? (
                                <Box
                                    sx={{
                                        height: "300px",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    <ReactApexChart
                                        options={outstandingChartOptions}
                                        series={
                                            outstandingByChildChartData.series
                                        }
                                        type="donut"
                                        height="100%"
                                    />
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        height: "300px",
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {t("messages.no_data", {
                                            ns: "common",
                                        })}
                                    </Typography>
                                </Box>
                            )}
                        </CardContent>
                    </Card>

                    {/* Invoices by Child Customer - Bar Chart */}
                    <Card
                        elevation={0}
                        sx={{
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: theme.shape.borderRadius,
                            height: "100%",
                            minHeight: "400px",
                        }}
                    >
                        <CardContent>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                    mb: 2,
                                    direction:
                                        i18n.language === "he" ? "rtl" : "ltr",
                                }}
                            >
                                <BarChartIcon
                                    sx={{
                                        color: theme.palette.secondary.main,
                                        fontSize: 24,
                                    }}
                                />
                                <Box
                                    sx={{
                                        flex: 1,
                                        display: "flex",
                                        flexDirection: "column",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 600,
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t("sections.invoices_by_child", {
                                            ns: "customers",
                                        })}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            direction:
                                                i18n.language === "he"
                                                    ? "rtl"
                                                    : "ltr",
                                        }}
                                    >
                                        {t(
                                            "sections.overdue_and_due_invoices",
                                            { ns: "customers" }
                                        )}
                                    </Typography>
                                </Box>
                            </Box>
                            {invoicesByChildChartData.categories.length > 0 ? (
                                <Box
                                    sx={{
                                        height: "300px",
                                        direction:
                                            i18n.language === "he"
                                                ? "rtl"
                                                : "ltr",
                                    }}
                                >
                                    <ReactApexChart
                                        options={invoicesChartOptions}
                                        series={[
                                            {
                                                name: t(
                                                    "fields.no_of_overdue_invoices",
                                                    { ns: "customers" }
                                                ),
                                                data: invoicesByChildChartData.overdue,
                                            },
                                            {
                                                name: t(
                                                    "fields.no_of_due_invoices",
                                                    { ns: "customers" }
                                                ),
                                                data: invoicesByChildChartData.due,
                                            },
                                        ]}
                                        type="bar"
                                        height="100%"
                                    />
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        height: "300px",
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {t("messages.no_data", {
                                            ns: "common",
                                        })}
                                    </Typography>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Box>
            )}

            {/* Child Customers List */}
            {childCustomers.length > 0 && (
                <Card
                    elevation={0}
                    sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: theme.shape.borderRadius,
                    }}
                >
                    <CardContent>
                        <Typography
                            variant="h6"
                            sx={{
                                mb: 2,
                                fontWeight: 600,
                                direction:
                                    i18n.language === "he" ? "rtl" : "ltr",
                            }}
                        >
                            {t("sections.child_customers", { ns: "customers" })}
                        </Typography>

                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 1,
                            }}
                        >
                            {childCustomers.map((child, index) => (
                                <React.Fragment key={child.id}>
                                    {index > 0 && <Divider />}
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            p: 1.5,
                                            "&:hover": {
                                                bgcolor:
                                                    theme.palette.action.hover,
                                                borderRadius:
                                                    theme.shape.borderRadius,
                                            },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 2,
                                                flex: 1,
                                            }}
                                        >
                                            <Link
                                                component="button"
                                                variant="body1"
                                                onClick={() =>
                                                    handleChildCustomerClick(
                                                        child.id
                                                    )
                                                }
                                                sx={{
                                                    fontWeight: 500,
                                                    textDecoration: "none",
                                                    cursor: "pointer",
                                                    "&:hover": {
                                                        textDecoration:
                                                            "underline",
                                                    },
                                                    direction:
                                                        i18n.language === "he"
                                                            ? "rtl"
                                                            : "ltr",
                                                }}
                                            >
                                                {child.name}
                                            </Link>
                                            {child.customer_number && (
                                                <Chip
                                                    label={
                                                        child.customer_number
                                                    }
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                            <Chip
                                                label={
                                                    child.type === "Person"
                                                        ? t(
                                                            "values.type_person",
                                                            {
                                                                ns: "customers",
                                                            }
                                                        )
                                                        : t(
                                                            "values.type_company",
                                                            {
                                                                ns: "customers",
                                                            }
                                                        )
                                                }
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                            />
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 2,
                                                direction:
                                                    i18n.language === "he"
                                                        ? "rtl"
                                                        : "ltr",
                                            }}
                                        >
                                            <Box sx={{ textAlign: "right" }}>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.total_outstanding_amount",
                                                        {
                                                            ns: "customers",
                                                        }
                                                    )}
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {formatCurrencyWithRTLSupport(
                                                        child.outstanding_amount,
                                                        resolveCustomerFirstCurrency(
                                                            {
                                                                customerCurrencyPrimary:
                                                                    child.currency,
                                                            }
                                                        ),
                                                        "en-US",
                                                        i18n.language
                                                    )}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: "right" }}>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.total_due_amount",
                                                        {
                                                            ns: "customers",
                                                        }
                                                    )}
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {formatCurrencyWithRTLSupport(
                                                        child.due_amount,
                                                        child.due_currency ||
                                                        "USD",
                                                        "en-US",
                                                        i18n.language
                                                    )}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: "right" }}>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.no_of_overdue_invoices",
                                                        {
                                                            ns: "customers",
                                                        }
                                                    )}
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {child.overdue_invoices}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: "right" }}>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {t(
                                                        "fields.no_of_due_invoices",
                                                        {
                                                            ns: "customers",
                                                        }
                                                    )}
                                                </Typography>
                                                <Typography
                                                    variant="body1"
                                                    sx={{ fontWeight: 600 }}
                                                >
                                                    {child.due_invoices}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                </React.Fragment>
                            ))}
                        </Box>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
};

export default CustomerAggregatedDataTab;
