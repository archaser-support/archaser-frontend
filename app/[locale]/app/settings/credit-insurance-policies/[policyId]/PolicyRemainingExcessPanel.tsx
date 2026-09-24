"use client";

import { Box, LinearProgress, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";

import { CreditInsuranceReadonlyField } from "@/app/[locale]/app/customers/[customerId]/CustomerGeneralInfo";
import {
    getPolicyExcessSummary,
    type RemainingExcessYear,
} from "@/shared/services/claimsService";

export type PolicyRemainingExcessPanelProps = {
    policyId: number;
    /** Policy currency for display context in labels (optional). */
    currency?: string | null;
    tCi: (key: string, options?: Record<string, unknown>) => string;
};

function formatMoneyValue(
    value: number | null | undefined,
    empty: string
): string {
    if (value == null || !Number.isFinite(value)) {
        return empty;
    }
    return String(value);
}

function yearRangeLabel(
    year: RemainingExcessYear,
    language: string
): string {
    const format = (raw: string | Date) => {
        const ymd =
            typeof raw === "string"
                ? raw.slice(0, 10)
                : raw.toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
            return null;
        }
        const [y, m, d] = ymd.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        const locale = language.startsWith("he") ? "he-IL" : "en-GB";
        return date.toLocaleDateString(locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };
    const start = format(year.policy_year_start);
    const end = format(year.policy_year_end);
    if (start && end) {
        return `${start} – ${end}`;
    }
    return start || end || "";
}

/**
 * Read-only remaining Aggregate/SDL excess (“access amount”) per Primary
 * policy anniversary year. Values come from the claims remaining-excess API.
 */
export function PolicyRemainingExcessPanel({
    policyId,
    tCi,
}: PolicyRemainingExcessPanelProps): React.ReactElement | null {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === "he";
    const empty = "—";

    const query = useQuery({
        queryKey: ["claims", "policy-excess-summary", policyId, "all"],
        queryFn: () =>
            getPolicyExcessSummary({
                insurance_policy_id: policyId,
                include_claims: false,
            }),
        enabled: Number.isFinite(policyId),
        staleTime: 30_000,
    });

    if (query.isPending) {
        return (
            <Box sx={{ mt: 2, width: "100%" }}>
                <LinearProgress />
            </Box>
        );
    }

    if (query.isError || query.data == null) {
        return (
            <Typography color="error" sx={{ mt: 2 }} variant="body2">
                {tCi("credit_insurance.remaining_excess.load_failed")}
            </Typography>
        );
    }

    const years = query.data.years;
    if (years.length === 0) {
        return null;
    }

    return (
        <Box
            sx={{
                mt: 2,
                direction: isRTL ? "rtl" : "ltr",
                textAlign: isRTL ? "right" : "left",
            }}
        >
            <Typography
                variant="subtitle2"
                sx={{
                    color: "#000",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    mb: 1,
                    textAlign: "inherit",
                    width: "100%",
                }}
            >
                {tCi("credit_insurance.sections.remaining_excess")}
            </Typography>
            <Typography
                variant="body2"
                sx={{ color: "text.secondary", mb: 1.5 }}
            >
                {tCi("credit_insurance.remaining_excess.help")}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {years.map((year) => (
                    <Box key={year.policy_year}>
                        <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, mb: 1 }}
                        >
                            {tCi("credit_insurance.remaining_excess.year_label", {
                                year: year.policy_year,
                                range: yearRangeLabel(year, i18n.language),
                            })}
                        </Typography>
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, 1fr)",
                                    md: "repeat(3, 1fr)",
                                },
                                gap: 1.5,
                                direction: isRTL ? "rtl" : "ltr",
                                textAlign: isRTL ? "right" : "left",
                            }}
                        >
                            <CreditInsuranceReadonlyField
                                label={tCi(
                                    "credit_insurance.fields.remaining_sdl_excess"
                                )}
                                value={formatMoneyValue(
                                    year.remaining_sdl_excess,
                                    empty
                                )}
                            />
                            <CreditInsuranceReadonlyField
                                label={tCi(
                                    "credit_insurance.fields.remaining_aggregate_excess"
                                )}
                                value={formatMoneyValue(
                                    year.remaining_aggregate_excess,
                                    empty
                                )}
                            />
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
