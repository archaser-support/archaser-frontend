"use client";

import {
    AccountBalance as AccountBalanceIcon,
    Group as GroupIcon,
    Receipt as ReceiptIcon,
    ShieldOutlined as ShieldOutlinedIcon,
} from "@mui/icons-material";
import { Box, Card, CardContent, Typography, alpha, useTheme } from "@mui/material";
import React, { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { CreditDashboardSummary } from "@/types/creditInsurance";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

import type { CreditReportType } from "./creditReportTypes";

type Props = {
    type: CreditReportType;
    summary: CreditDashboardSummary;
    userLocale: string;
    /** Default account currency (ISO) for mixed totals. */
    accountCurrency: string;
};

export function CreditReportSummaryCards({
    type,
    summary,
    userLocale,
    accountCurrency,
}: Props) {
    const theme = useTheme();
    const { t, i18n } = useTranslation("dashboard");

    const fmt = useCallback(
        (n: number) =>
            formatCurrencyWithRTLSupport(
                n,
                accountCurrency,
                userLocale,
                i18n.language
            ),
        [accountCurrency, userLocale, i18n.language]
    );

    const cardStyle = useMemo(
        () => ({
            bgcolor: "background.paper" as const,
            border: "1px solid",
            borderColor: "divider" as const,
            position: "relative" as const,
            overflow: "hidden" as const,
            boxShadow: "none",
            transition: "all 0.3s ease-in-out",
            minHeight: 120,
            "&:hover": {
                transform: "translateY(-2px)",
                boxShadow: 2,
                "& .card-icon": {
                    transform: "scale(1.08) rotate(3deg)",
                },
            },
        }),
        []
    );

    const isRtl = i18n.language === "he";
    const iconAtStart = (color: "secondary" | "success") => {
        const main =
            color === "success"
                ? theme.palette.success.main
                : theme.palette.secondary.main;
        return {
            position: "absolute" as const,
            top: { xs: 12, sm: 16 },
            right: isRtl ? undefined : { xs: 12, sm: 16 },
            left: isRtl ? { xs: 12, sm: 16 } : undefined,
            width: { xs: 40, sm: 48 },
            height: { xs: 40, sm: 48 },
            borderRadius: "50%",
            background: alpha(main, 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        };
    };

    const labelSx = {
        color: "#7C8DA1",
        fontSize:
            isRtl
                ? { xs: "1.8rem", sm: "1.45rem" }
                : { xs: "1rem", sm: "1.1rem" },
        fontWeight: 500,
        textTransform: "uppercase" as const,
        letterSpacing: "0.5px",
        direction: isRtl ? ("rtl" as const) : ("ltr" as const),
        textAlign: isRtl ? ("right" as const) : ("left" as const),
        wordWrap: "break-word" as const,
        overflowWrap: "break-word" as const,
        lineHeight: 1.5,
    };

    const valueSx = {
        fontWeight: 700,
        fontSize: { xs: "1.5rem", sm: "1.75rem" },
        color: "#000000",
        lineHeight: 1,
        fontFamily: "inherit",
        direction: isRtl ? ("rtl" as const) : ("ltr" as const),
        textAlign: isRtl ? ("right" as const) : ("left" as const),
    };

    const contentPadding = {
        p: { xs: 2, sm: 3 },
        pr: isRtl ? { xs: 2, sm: 3 } : { xs: 6, sm: 8 },
        pl: isRtl ? { xs: 6, sm: 8 } : undefined,
        pb: { xs: 1.5, sm: 2 },
    };

    if (type === "overdue") {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    mb: { xs: 3, sm: 4 },
                    flexWrap: "wrap",
                    flexDirection: { xs: "column", sm: "row" },
                }}
            >
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                        width: { xs: "100%", sm: "auto" },
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("secondary")}>
                            <GroupIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.secondary.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_overdue_customers"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {summary.overdueBlockCustomerCount.toLocaleString(
                                    userLocale
                                )}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                        width: { xs: "100%", sm: "auto" },
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("success")}>
                            <AccountBalanceIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.success.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_total_amount"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {fmt(summary.overdueBlockTotalOutstanding)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        );
    }

    if (type === "capacity") {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    mb: { xs: 3, sm: 4 },
                    flexWrap: "wrap",
                    flexDirection: { xs: "column", sm: "row" },
                }}
            >
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("secondary")}>
                            <GroupIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.secondary.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_over_limit_customers"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {summary.capacityGap.customerOverLimitCount.toLocaleString(
                                    userLocale
                                )}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("success")}>
                            <AccountBalanceIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.success.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_total_amount_gap"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {fmt(summary.capacityGap.totalAmount)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        );
    }

    if (type === "reporting") {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    mb: { xs: 3, sm: 4 },
                    flexWrap: "wrap",
                    flexDirection: { xs: "column", sm: "row" },
                }}
            >
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("secondary")}>
                            <ReceiptIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.secondary.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_invoices_to_report"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {summary.reportingCountdown.invoiceCount.toLocaleString(
                                    userLocale
                                )}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("success")}>
                            <AccountBalanceIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.success.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_total_amount"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {fmt(summary.reportingCountdown.totalAmount)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        );
    }

    if (type === "reported") {
        return (
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
                <Typography variant="body2" color="text.secondary">
                    {t("credit_insurance_report.summary_reported_hint")}
                </Typography>
            </Box>
        );
    }

    if (type === "zero_limit_warning") {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    mb: { xs: 3, sm: 4 },
                    flexWrap: "wrap",
                    flexDirection: { xs: "column", sm: "row" },
                }}
            >
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "0 0 calc(50% - 12px)" },
                        minWidth: 0,
                        width: { xs: "100%", sm: "calc(50% - 12px)" },
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("secondary")}>
                            <GroupIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.secondary.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_zero_limit_customers"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {summary.zeroLimitWarnings?.customerCount.toLocaleString(
                                    userLocale
                                ) ?? 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        );
    }

    if (type === "limit_warning") {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    mb: { xs: 3, sm: 4 },
                    flexWrap: "wrap",
                    flexDirection: { xs: "column", sm: "row" },
                }}
            >
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("secondary")}>
                            <GroupIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.secondary.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_customers_warning_scope"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {summary.limitWarnings.customerCount.toLocaleString(
                                    userLocale
                                )}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("success")}>
                            <AccountBalanceIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.success.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_total_open_ar_customers"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {fmt(summary.limitWarnings.totalAmount)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        );
    }

    if (type === "policy_risk") {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    mb: { xs: 3, sm: 4 },
                    flexWrap: "wrap",
                    flexDirection: { xs: "column", sm: "row" },
                }}
            >
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("secondary")}>
                            <GroupIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.secondary.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_number_of_customers"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {summary.policyRiskExposureCustomerCount.toLocaleString(
                                    userLocale
                                )}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box
                    sx={{
                        flex: { xs: "1 1 auto", sm: "1 1 300px" },
                        minWidth: 0,
                    }}
                >
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("success")}>
                            <ShieldOutlinedIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.success.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    mb: 1.5,
                                }}
                            >
                                <Typography variant="body2" sx={labelSx}>
                                    {t(
                                        "credit_insurance_report.summary_policy_risk_portfolio"
                                    )}
                                </Typography>
                            </Box>
                            <Typography sx={valueSx}>
                                {fmt(summary.policyRiskExposure)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        );
    }

    if (type === "no_policy_exposure") {
        return (
            <Box
                sx={{
                    display: "flex",
                    gap: { xs: 2, sm: 3 },
                    mb: { xs: 3, sm: 4 },
                    flexWrap: "wrap",
                    flexDirection: { xs: "column", sm: "row" },
                }}
            >
                <Box sx={{ flex: { xs: "1 1 auto", sm: "1 1 300px" }, minWidth: 0 }}>
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("secondary")}>
                            <GroupIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.secondary.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Typography variant="body2" sx={labelSx}>
                                {t("credit_insurance_report.summary_number_of_customers")}
                            </Typography>
                            <Typography sx={valueSx}>
                                {summary.withoutPolicy.customerCount.toLocaleString(
                                    userLocale
                                )}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box sx={{ flex: { xs: "1 1 auto", sm: "1 1 300px" }, minWidth: 0 }}>
                    <Card sx={cardStyle}>
                        <Box className="card-icon" sx={iconAtStart("success")}>
                            <AccountBalanceIcon
                                sx={{
                                    fontSize: { xs: 20, sm: 24 },
                                    color: theme.palette.success.main,
                                }}
                            />
                        </Box>
                        <CardContent sx={contentPadding}>
                            <Typography variant="body2" sx={labelSx}>
                                {t("credit_insurance_report.summary_total_amount")}
                            </Typography>
                            <Typography sx={valueSx}>
                                {fmt(summary.withoutPolicy.totalAmount)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        );
    }

    // terms
    return (
        <Box
            sx={{
                display: "flex",
                gap: { xs: 2, sm: 3 },
                mb: { xs: 3, sm: 4 },
                flexWrap: "wrap",
                flexDirection: { xs: "column", sm: "row" },
            }}
        >
            <Box
                sx={{
                    flex: { xs: "1 1 auto", sm: "1 1 300px" },
                    minWidth: 0,
                }}
            >
                <Card sx={cardStyle}>
                    <Box className="card-icon" sx={iconAtStart("secondary")}>
                        <ReceiptIcon
                            sx={{
                                fontSize: { xs: 20, sm: 24 },
                                color: theme.palette.secondary.main,
                            }}
                        />
                    </Box>
                    <CardContent sx={contentPadding}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                mb: 1.5,
                            }}
                        >
                            <Typography variant="body2" sx={labelSx}>
                                {t(
                                    "credit_insurance_report.summary_invoices_terms_breach"
                                )}
                            </Typography>
                        </Box>
                        <Typography sx={valueSx}>
                            {summary.termsBreach.invoiceCount.toLocaleString(
                                userLocale
                            )}
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
            <Box
                sx={{
                    flex: { xs: "1 1 auto", sm: "1 1 300px" },
                    minWidth: 0,
                }}
            >
                <Card sx={cardStyle}>
                    <Box className="card-icon" sx={iconAtStart("success")}>
                        <AccountBalanceIcon
                            sx={{
                                fontSize: { xs: 20, sm: 24 },
                                color: theme.palette.success.main,
                            }}
                        />
                    </Box>
                    <CardContent sx={contentPadding}>
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                mb: 1.5,
                            }}
                        >
                            <Typography variant="body2" sx={labelSx}>
                                {t(
                                    "credit_insurance_report.summary_total_amount"
                                )}
                            </Typography>
                        </Box>
                        <Typography sx={valueSx}>
                            {fmt(summary.termsBreach.totalAmount)}
                        </Typography>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
