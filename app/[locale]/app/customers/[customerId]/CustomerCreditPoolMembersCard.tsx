"use client";

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
import { useParams, useRouter } from "next/navigation";
import React from "react";
import { useTranslation } from "react-i18next";

import AppUrls from "@/utils/appUrls";
import { formatCurrencyWithRTLSupport } from "@/utils/stringFormatters";

export type CreditPoolMemberRow = {
    id: number;
    customer_number: string | null;
    name: string;
    type: "Person" | "Company";
    parent_customer_id: number | null;
    total_due_amount: number;
    total_overdue_amount: number;
    total_ar: number;
    capacity_gap_amount: number;
    at_risk_exposure: number;
    open_claims_count: number;
    total_claims_count: number;
};

export type CreditAggregatedBlock = {
    root_customer_id: number;
    approved_limit: number | null;
    approved_limit_currency: string | null;
    effective_limit: number | null;
    total_due_amount: number;
    total_overdue_amount: number;
    total_ar: number;
    capacity_gap_amount: number | null;
    at_risk_exposure: number;
    uninsured_amount: number | null;
    capacity_gap_amount1?: number | null;
    capacity_gap_currency1?: string | null;
    capacity_gap_amount2?: number | null;
    capacity_gap_currency2?: string | null;
    open_claims_count: number;
    total_claims_count: number;
    members: CreditPoolMemberRow[];
};

type CustomerCreditPoolMembersCardProps = {
    credit: CreditAggregatedBlock;
    accountCurrency: string;
    /** Shell parent whose Dashboard is open — never listed as a member row. */
    excludeCustomerId?: number;
};

/**
 * Local subtree ∩ BU-scoped credit pool member rows for shell parent Dashboard.
 */
const CustomerCreditPoolMembersCard: React.FC<
    CustomerCreditPoolMembersCardProps
> = ({ credit, accountCurrency, excludeCustomerId }) => {
    const { t, i18n } = useTranslation(["customers"]);
    const theme = useTheme();
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const localeTag = i18n.language === "he" ? "he-IL" : "en-US";

    const memberRows =
        excludeCustomerId == null
            ? credit.members
            : credit.members.filter((m) => m.id !== excludeCustomerId);

    if (!memberRows.length) {
        return null;
    }

    const handleMemberClick = (memberId: number) => {
        router.push(`/${locale}${AppUrls.Customer_DETAILS(memberId)}`);
    };

    return (
        <Card
            id="credit-pool-members"
            elevation={0}
            sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: theme.shape.borderRadius,
            }}
        >
            <CardContent>
                <Box
                    sx={{
                        mb: 2,
                        direction: i18n.language === "he" ? "rtl" : "ltr",
                    }}
                >
                    <Typography
                        variant="body2"
                        component="span"
                        sx={{
                            fontSize: "1.125rem",
                            fontWeight: 600,
                        }}
                    >
                        {t("sections.credit_pool_members", { ns: "customers" })}
                    </Typography>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                    }}
                >
                    {memberRows.map((member, index) => {
                        const memberMetrics = [
                            {
                                key: "overdue",
                                label: t(
                                    "credit_insurance.aggregated_total_overdue",
                                    { ns: "customers" }
                                ),
                                value: formatCurrencyWithRTLSupport(
                                    member.total_overdue_amount || 0,
                                    accountCurrency,
                                    localeTag,
                                    i18n.language
                                ),
                            },
                            {
                                key: "due",
                                label: t(
                                    "credit_insurance.aggregated_total_due",
                                    { ns: "customers" }
                                ),
                                value: formatCurrencyWithRTLSupport(
                                    member.total_due_amount || 0,
                                    accountCurrency,
                                    localeTag,
                                    i18n.language
                                ),
                            },
                            {
                                key: "ar",
                                label: t(
                                    "credit_insurance.aggregated_total_ar",
                                    { ns: "customers" }
                                ),
                                value: formatCurrencyWithRTLSupport(
                                    member.total_ar || 0,
                                    accountCurrency,
                                    localeTag,
                                    i18n.language
                                ),
                            },
                            {
                                key: "open_claims",
                                label: t(
                                    "credit_insurance.aggregated_open_claims",
                                    { ns: "customers" }
                                ),
                                value: String(member.open_claims_count),
                            },
                            {
                                key: "total_claims",
                                label: t(
                                    "credit_insurance.aggregated_total_claims",
                                    { ns: "customers" }
                                ),
                                value: String(member.total_claims_count),
                            },
                        ] as const;

                        return (
                            <React.Fragment key={member.id}>
                                {index > 0 && <Divider />}
                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns:
                                            "minmax(12rem, 1.4fr) repeat(5, minmax(5.5rem, 1fr))",
                                        alignItems: "center",
                                        columnGap: 2,
                                        p: 1.5,
                                        minWidth: 0,
                                        overflowX: "auto",
                                        "&:hover": {
                                            bgcolor: theme.palette.action.hover,
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
                                            minWidth: 0,
                                        }}
                                    >
                                        <Link
                                            component="button"
                                            variant="body1"
                                            onClick={() =>
                                                handleMemberClick(member.id)
                                            }
                                            sx={{
                                                fontWeight: 500,
                                                textDecoration: "none",
                                                cursor: "pointer",
                                                "&:hover": {
                                                    textDecoration: "underline",
                                                },
                                            }}
                                        >
                                            {member.name}
                                        </Link>
                                        {member.customer_number && (
                                            <Chip
                                                label={member.customer_number}
                                                size="small"
                                                variant="outlined"
                                            />
                                        )}
                                        {member.id ===
                                            credit.root_customer_id && (
                                            <Chip
                                                label={t(
                                                    "sections.credit_pool_root",
                                                    { ns: "customers" }
                                                )}
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        )}
                                    </Box>
                                    {memberMetrics.map((metric) => (
                                        <Box
                                            key={metric.key}
                                            sx={{
                                                textAlign: "right",
                                                minWidth: 0,
                                            }}
                                        >
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                                noWrap
                                            >
                                                {metric.label}
                                            </Typography>
                                            <Typography
                                                variant="body1"
                                                sx={{ fontWeight: 600 }}
                                                noWrap
                                            >
                                                {metric.value}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </React.Fragment>
                        );
                    })}
                </Box>
            </CardContent>
        </Card>
    );
};

export default React.memo(CustomerCreditPoolMembersCard);
