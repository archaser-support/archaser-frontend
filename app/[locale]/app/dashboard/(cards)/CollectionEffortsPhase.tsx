import {
    AccountBalance as AccountBalanceIcon,
    AutoAwesome as AutoAwesomeIcon,
    CheckCircle as CheckCircleIcon,
    Gavel as GavelIcon,
    Person as PersonIcon,
    PieChart as PieChartIcon,
    TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import {
    alpha,
    Box,
    Chip,
    Stack,
    Typography,
    useTheme,
} from "@mui/material";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import AppUrls from "@/utils/appUrls";
import { useDashboardBusinessUnitId } from "@/shared/dashboard/DashboardBusinessUnitContext";
import { appendDashboardBusinessUnitId } from "@/shared/dashboard/dashboardBusinessUnitParams";
import { lighten } from "@mui/system/colorManipulator";
import { FinancialDashboardChartCard } from "./FinancialDashboardChartCard";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

type PhaseStat = {
    label: string;
    value: string | number;
};

type CollectionEffortsPhaseProps = {
    options?: ApexOptions;
    series?: ApexAxisChartSeries | ApexNonAxisChartSeries;
    phaseStats: PhaseStat[];
};

const CollectionEffortsPhase = ({
    options = {},
    series = [],
    phaseStats,
}: CollectionEffortsPhaseProps) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["dashboard", "common"]);
    const router = useRouter();
    const params = useParams();
    const locale = (params?.locale as string) || "en";
    const businessUnitId = useDashboardBusinessUnitId();

    // Helper function to translate category labels
    const translateCategoryLabel = (label: string) => {
        const categoryMap: { [key: string]: string } = {
            Automated: "automated",
            Promise_to_pay: "promise_to_pay",
            "Promise to Pay": "promise_to_pay", // Handle space version
            Dispute: "dispute",
            Agent: "agent",
            Legal: "legal",
        };

        const translationKey = categoryMap[label] || label;
        const translationPath = `values.charts_collection_efforts_phase_${translationKey}`;
        const translated = t(translationPath, { ns: "dashboard" });

        // If translation is not found, return the original label
        if (translated === translationPath) {
            return label;
        }

        return translated || label;
    };

    const handleChartClick = () => {
        // Navigate to dashboard with tab parameter first
        router.push(`/${locale}${AppUrls.DASHBOARD}?tab=overdue`);

        // Then navigate to chart details after a short delay
        setTimeout(() => {
            const searchParams = appendDashboardBusinessUnitId(
                new URLSearchParams({
                    type: "collection-efforts",
                    period: new Date().toISOString().slice(0, 7),
                }),
                businessUnitId
            );
            router.push(
                `/${locale}${AppUrls.DASHBOARD}/chart-details?${searchParams.toString()}`
            );
        }, 0);
    };

    // Get icon for each category using theme chart palette
    const getCategoryIcon = (label: string) => {
        const category = label.toLowerCase();
        if (category.includes("legal")) {
            return <AccountBalanceIcon sx={{ color: theme.palette.chartPalette.main }} />;
        } else if (category.includes("dispute")) {
            return <GavelIcon sx={{ color: theme.palette.chartPalette.light }} />;
        } else if (category.includes("p2pay") || category.includes("promise")) {
            return <CheckCircleIcon sx={{ color: lighten(theme.palette.chartPalette.main, 0.2) }} />;
        } else if (category.includes("automated")) {
            return <AutoAwesomeIcon sx={{ color: theme.palette.chartPalette.main }} />;
        } else if (category.includes("agent")) {
            return <PersonIcon sx={{ color: theme.palette.chartPalette.main }} />;
        }
        return <TrendingUpIcon sx={{ color: "#2F3B52" }} />; // Main Text
    };

    // Get color for each category using theme chart palette
    const getCategoryColor = (label: string) => {
        const category = label.toLowerCase();
        if (category.includes("legal")) {
            return theme.palette.chartPalette.main;
        } else if (category.includes("dispute")) {
            return theme.palette.chartPalette.light;
        } else if (category.includes("p2pay") || category.includes("promise")) {
            return lighten(theme.palette.chartPalette.main, 0.2);
        } else if (category.includes("automated")) {
            return theme.palette.chartPalette.main;
        } else if (category.includes("agent")) {
            return theme.palette.chartPalette.main;
        }
        return "#2F3B52"; // Main Text
    };

    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [chartWidth, setChartWidth] = useState(0);

    useEffect(() => {
        const el = chartContainerRef.current;
        if (!el) return;

        const updateWidth = () => {
            setChartWidth(Math.max(0, Math.floor(el.clientWidth)));
        };

        updateWidth();
        const observer = new ResizeObserver(updateWidth);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    /** Square canvas — slightly smaller than the column width so it doesn’t dominate the card. */
    const donutChartSize =
        chartWidth > 0 ? Math.max(240, Math.round(chartWidth * 0.88)) : 250;

    // Create pie chart options with primary/secondary color palette
    const pieChartOptions: ApexOptions = useMemo(
        () => ({
        chart: {
            type: "donut",
            height: donutChartSize,
            toolbar: {
                show: false,
            },
            background: theme.palette.background.paper,
            foreColor: "#2F3B52",
            zoom: {
                enabled: false,
            },
            animations: {
                enabled: true,
                speed: 800,
                animateGradually: {
                    enabled: true,
                    delay: 150,
                },
                dynamicAnimation: {
                    enabled: true,
                    speed: 350,
                },
            },
        },
        plotOptions: {
            pie: {
                customScale: 0.92,
                offsetX: 0,
                donut: {
                    size: "58%",
                    labels: {
                        show: true,
                        name: {
                            show: false,
                        },
                        value: {
                            show: false,
                        },
                        total: {
                            show: true,
                            label: "Total",
                            fontSize: "16px",
                            fontFamily: "inherit",
                            fontWeight: 700,
                            color: "#2F3B52",
                        },
                    },
                },
            },
        },
        colors: [
            theme.palette.chartPalette.dark,
            theme.palette.chartPalette.main,
            theme.palette.chartPalette.light,
            alpha(theme.palette.chartPalette.main, 0.8),
            alpha(theme.palette.chartPalette.main, 0.6),
            alpha(theme.palette.chartPalette.dark, 0.8),
        ],
        dataLabels: {
            enabled: true,
            style: {
                fontSize: "12px",
                fontFamily: "inherit",
                fontWeight: "700",
                colors: ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"], // Explicit white for all segments
            },
            background: {
                enabled: true,
                foreColor: "#2F3B52",
                borderRadius: 4,
                padding: 4,
                opacity: 0.6,
                borderWidth: 1,
                borderColor: "#ffffff",
            },
            dropShadow: {
                enabled: true,
                opacity: 0.3,
                blur: 3,
                left: 0,
                top: 0,
            },
            formatter: function (val: number) {
                return `${Math.round(val).toString()}%`;
            },
        },
        legend: {
            show: false,
        },
        labels: phaseStats.map((stat) => translateCategoryLabel(stat.label)),
        tooltip: {
            enabled: true,
            theme: "light",
            style: {
                fontSize: "12px",
                fontFamily: "inherit",
            },
            y: {
                formatter: function (value: number) {
                    return `${Math.round(value).toString()}%`;
                },
            },
            custom: function ({
                series,
                seriesIndex,
                dataPointIndex,
                w: _w,
            }: {
                series: number[];
                seriesIndex: number;
                dataPointIndex: number;
                w: any;
            }) {
                const tooltipColors = [
                    theme.palette.chartPalette.dark,
                    theme.palette.chartPalette.main,
                    theme.palette.chartPalette.light,
                    alpha(theme.palette.chartPalette.main, 0.8),
                ];

                // Get the translated labels from the chart configuration
                const translatedLabels = phaseStats.map((stat) =>
                    translateCategoryLabel(stat.label)
                );

                // For donut charts, dataPointIndex is null, so we need to use seriesIndex
                const actualIndex =
                    dataPointIndex !== null ? dataPointIndex : seriesIndex;

                const value = Array.isArray(series)
                    ? series[actualIndex]
                    : series;
                const label =
                    translatedLabels[actualIndex] ||
                    `Category ${actualIndex + 1}`;

                // Ensure we have valid data
                const displayValue = isNaN(value) ? 0 : Math.round(value);
                const displayLabel = label || `Category ${actualIndex + 1}`;

                // RTL alignment for Hebrew
                const isHebrew = i18n.language === "he";
                const textAlign = isHebrew ? "right" : "left";
                const direction = isHebrew ? "rtl" : "ltr";

                let tooltipContent = `<div class="custom-tooltip" style="background: white !important; border: 1px solid #DCE3EB !important; border-radius: 4px !important; padding: 8px !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; font-size: 12px !important; font-family: inherit !important; text-align: ${textAlign} !important; direction: ${direction} !important; width: 100% !important; max-width: 200px !important;">`;

                if (isHebrew) {
                    // For Hebrew: label on right, value on left (RTL order)
                    tooltipContent +=
                        `<div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 4px !important; gap: 8px !important; width: 100% !important;">` +
                        `<div style="font-weight: 600 !important; color: #2F3B52 !important; text-align: right !important; direction: rtl !important; flex: 1 !important;">${displayLabel}</div>` +
                        `<div style="color: ${tooltipColors[actualIndex] || tooltipColors[0]} !important; font-weight: 500 !important; text-align: left !important; direction: ltr !important; flex-shrink: 0 !important;">${displayValue}%</div>` +
                        `</div>`;
                } else {
                    // For English: label on left, value on right (LTR order)
                    tooltipContent +=
                        `<div style="display: flex !important; justify-content: space-between !important; align-items: center !important; margin-bottom: 4px !important; gap: 8px !important; width: 100% !important;">` +
                        `<div style="font-weight: 600 !important; color: #2F3B52 !important; text-align: left !important; direction: ltr !important; flex: 1 !important;">${displayLabel}</div>` +
                        `<div style="color: ${tooltipColors[actualIndex] || tooltipColors[0]} !important; font-weight: 500 !important; text-align: right !important; direction: ltr !important; flex-shrink: 0 !important;">${displayValue}%</div>` +
                        `</div>`;
                }

                tooltipContent += "</div>";
                return tooltipContent;
            },
        },
        }),
        [donutChartSize, i18n.language, phaseStats, theme]
    );

    // Transform series data for pie chart
    const pieSeries = Array.isArray(series)
        ? series.map((val: any) => (typeof val === "number" ? val : 0))
        : [];

    // Convert to percentages if we have data
    const total = pieSeries.reduce((sum, val) => sum + val, 0);
    const pieSeriesPercentages =
        total > 0
            ? pieSeries.map((val) => Math.round((val / total) * 100))
            : pieSeries;

    return (
        <FinancialDashboardChartCard
            icon={<PieChartIcon />}
            iconAccent="terms"
            title={t("fields.charts_collection_efforts_phase_title")}
            subtitle={t("fields.charts_collection_efforts_phase_description")}
            minHeight={400}
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
                    {/* Chart Section */}
                    <Box
                        ref={chartContainerRef}
                        sx={{
                            minWidth: 0,
                            minHeight: 240,
                            overflow: "visible",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            "& .apexcharts-canvas": {
                                maxWidth: "100%",
                            },
                        }}
                    >
                        {chartWidth > 0 ? (
                            <ReactApexChart
                                options={pieChartOptions}
                                series={pieSeriesPercentages}
                                type="donut"
                                width={donutChartSize}
                                height={donutChartSize}
                            />
                        ) : null}
                    </Box>

                    {/* Stats Section — 40% width */}
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
                                        backgroundColor: alpha(theme.palette.chartPalette.main, 0.05),
                                        border: "1px solid",
                                        borderColor: alpha(theme.palette.chartPalette.main, 0.1),
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1,
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
