"use client";

import {
    alpha,
    Box,
    Chip,
    Stack,
    Typography,
    useTheme,
} from "@mui/material";
import { lighten } from "@mui/system/colorManipulator";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ApexOptions } from "apexcharts";

import {
    ActivitySequencesNavIcon,
    AgentsNavIcon,
    DisputesNavIcon,
    FinancialDashboardNavIcon,
    LegalNavIcon,
    PromiseToPayNavIcon,
} from "@/shared/components/sidebar-icons";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import { pushFinancialChartDetails } from "@/shared/dashboard/financialChartDetailsTitle";
import AppUrls from "@/utils/appUrls";

import { DashboardDonutChart } from "./DashboardDonutChart";
import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

type PhaseStat = {
    label: string;
    value: string | number;
};

type CollectionEffortsPhaseProps = {
    options?: unknown;
    series?: ApexOptions["series"];
    phaseStats: PhaseStat[];
};

const CollectionEffortsPhase = ({
    series = [],
    phaseStats,
}: CollectionEffortsPhaseProps) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const businessUnitId = useDashboardBusinessUnitId();

    const translateCategoryLabel = (label: string) => {
        const categoryMap: { [key: string]: string } = {
            Automated: "automated",
            Promise_to_pay: "promise_to_pay",
            "Promise to Pay": "promise_to_pay",
            Dispute: "dispute",
            Agent: "agent",
            Legal: "legal",
        };

        const translationKey = categoryMap[label] || label;
        const translationPath = `values.charts_collection_efforts_phase_${translationKey}`;
        const translated = t(translationPath, { ns: "dashboard" });

        if (translated === translationPath) {
            return label;
        }

        return translated || label;
    };

    const handleChartClick = () => {
        router.push(`/${locale}${AppUrls.DASHBOARD}?tab=overdue`);

        setTimeout(() => {
            const searchParams = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: "collection-efforts",
                    period: new Date().toISOString().slice(0, 7),
                }),
                businessUnitId
            );
            pushFinancialChartDetails(
                router,
                `/${locale}${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`,
                t,
                locale
            );
        }, 0);
    };

    const getCategoryIcon = (label: string) => {
        const category = label.toLowerCase();
        const iconSx = { fontSize: 22, overflow: "visible" } as const;
        if (category.includes("legal")) {
            return (
                <LegalNavIcon
                    sx={{ ...iconSx, color: theme.palette.chartPalette.main }}
                />
            );
        }
        if (category.includes("dispute")) {
            return (
                <DisputesNavIcon
                    sx={{ ...iconSx, color: theme.palette.chartPalette.light }}
                />
            );
        }
        if (category.includes("p2pay") || category.includes("promise")) {
            return (
                <PromiseToPayNavIcon
                    sx={{
                        ...iconSx,
                        color: lighten(theme.palette.chartPalette.main, 0.2),
                    }}
                />
            );
        }
        if (category.includes("automated")) {
            return (
                <ActivitySequencesNavIcon
                    sx={{ ...iconSx, color: theme.palette.chartPalette.main }}
                />
            );
        }
        if (category.includes("agent")) {
            return (
                <AgentsNavIcon
                    sx={{ ...iconSx, color: theme.palette.chartPalette.main }}
                />
            );
        }
        return (
            <ActivitySequencesNavIcon sx={{ ...iconSx, color: "#2F3B52" }} />
        );
    };

    const getCategoryColor = (label: string) => {
        const category = label.toLowerCase();
        if (category.includes("legal")) {
            return theme.palette.chartPalette.main;
        }
        if (category.includes("dispute")) {
            return theme.palette.chartPalette.light;
        }
        if (category.includes("p2pay") || category.includes("promise")) {
            return lighten(theme.palette.chartPalette.main, 0.2);
        }
        if (category.includes("automated")) {
            return theme.palette.chartPalette.main;
        }
        if (category.includes("agent")) {
            return theme.palette.chartPalette.main;
        }
        return "#2F3B52";
    };

    const palette = useMemo(
        () => [
            theme.palette.chartPalette.dark,
            theme.palette.chartPalette.main,
            theme.palette.chartPalette.light,
            alpha(theme.palette.chartPalette.main, 0.8),
            alpha(theme.palette.chartPalette.main, 0.6),
            alpha(theme.palette.chartPalette.dark, 0.8),
        ],
        [theme]
    );

    const pieSeries = useMemo(() => {
        if (!Array.isArray(series)) {
            return [] as number[];
        }
        return series.map((val) => (typeof val === "number" ? val : 0));
    }, [series]);

    const total = pieSeries.reduce((sum, val) => sum + val, 0);

    const donutRows = useMemo(() => {
        return phaseStats.map((stat, index) => {
            const raw = pieSeries[index] ?? 0;
            const percentage =
                total > 0 ? Math.round((raw / total) * 100) : 0;
            return {
                name: translateCategoryLabel(stat.label),
                value: percentage > 0 ? percentage : raw,
                color: palette[index % palette.length],
                percentage,
            };
        });
        // translateCategoryLabel depends on t; phaseStats/pieSeries drive data.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phaseStats, pieSeries, total, palette, i18n.language, t]);

    return (
        <FinancialDashboardChartCard
            icon={<FinancialDashboardNavIcon />}
            iconAccent="terms"
            title={t("fields.charts_collection_efforts_phase_title")}
            titleTooltip={t(
                "fields.charts_collection_efforts_phase_description"
            )}
            minHeight={400}
            clickable
            onClick={handleChartClick}
            bodySx={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
            }}
        >
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 5fr) minmax(0, 3fr)",
                    gap: 1,
                    columnGap: 0.75,
                    width: "100%",
                    alignItems: "center",
                }}
            >
                <Box
                    sx={{
                        minWidth: 0,
                        minHeight: 240,
                        overflow: "visible",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <DashboardDonutChart
                        data={donutRows}
                        language={i18n.language}
                        height={260}
                        formatValue={(value) => `${Math.round(value)}%`}
                        showLegend={false}
                        showCenterTotal
                        centerLabel={t("fields.total", { ns: "common" })}
                        centerValue={total.toLocaleString(
                            i18n.language === "he" ? "he-IL" : "en-US"
                        )}
                        showPercentLabels
                        innerRadius={68}
                        outerRadius={104}
                        cyPercent={50}
                    />
                </Box>

                <Box
                    sx={{
                        minWidth: 0,
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                    }}
                >
                    <Stack spacing={1}>
                        {phaseStats.map((stat, index) => (
                            <Box
                                key={index}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    p: 1,
                                    borderRadius: 1,
                                    backgroundColor: alpha(
                                        theme.palette.chartPalette.main,
                                        0.05
                                    ),
                                    border: "1px solid",
                                    borderColor: alpha(
                                        theme.palette.chartPalette.main,
                                        0.1
                                    ),
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                        minWidth: 0,
                                        overflow: "visible",
                                    }}
                                >
                                    {getCategoryIcon(stat.label)}
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontWeight: 600,
                                            color: "#2F3B52",
                                            fontSize: "0.8rem",
                                        }}
                                    >
                                        {translateCategoryLabel(stat.label)}
                                    </Typography>
                                </Box>
                                <Chip
                                    label={stat.value}
                                    size="small"
                                    sx={{
                                        backgroundColor: getCategoryColor(
                                            stat.label
                                        ),
                                        color: "#FFFFFF",
                                        fontWeight: 600,
                                        fontSize: "0.7rem",
                                        boxShadow: `0 2px 4px ${alpha(theme.palette.chartPalette.main, 0.2)}`,
                                    }}
                                />
                            </Box>
                        ))}
                    </Stack>
                </Box>
            </Box>
        </FinancialDashboardChartCard>
    );
};

export default CollectionEffortsPhase;
