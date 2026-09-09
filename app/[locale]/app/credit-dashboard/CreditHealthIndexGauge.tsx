"use client";

import { HealthAndSafety as HealthIcon } from "@mui/icons-material";
import { Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";
import {
    CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
    CREDIT_DASHBOARD_COMPACT_GAUGE_HEIGHT_PX,
} from "./creditDashboardCompactLayout";
import { METRIC_STAT_CARD_ICON_SIZE_PX } from "@/app/theme/metricStatCard";

const GaugeComponent = dynamic(() => import("react-gauge-component"), {
    ssr: false,
});

export type CreditHealthIndexGaugeProps = {
    healthIndex: number;
    /** Narrower layout next to the daily trend chart */
    compact?: boolean;
    loading?: boolean;
};

export function CreditHealthIndexGauge({
    healthIndex,
    compact = false,
    loading = false,
}: CreditHealthIndexGaugeProps) {
    const theme = useTheme();
    const c = theme.creditDashboardChartCard;
    const { t, i18n } = useTranslation(["dashboard"]);
    const isRtl = i18n.language === "he";
    const nsDashboard = { ns: "dashboard" as const };
    const safeHealthIndex = Math.max(0, Math.min(100, healthIndex));

    return (
        <Card
            sx={{
                ...c.card(theme, { clickable: false, hoverable: true }),
                width: "100%",
                ...(compact
                    ? {
                          height: CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
                          minHeight: CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
                          maxHeight: CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                      }
                    : { minHeight: 200 }),
            }}
        >
            <CardContent
                sx={{
                    ...c.cardContent(theme, { withChartBody: compact }),
                    direction: isRtl ? "rtl" : "ltr",
                    ...(compact
                        ? {
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              minHeight: 0,
                              overflow: "hidden",
                              pt: theme.spacing(1),
                              pb: theme.spacing(0.5),
                              px: theme.spacing(1),
                              "&:last-child": {
                                  paddingBottom: theme.spacing(0.5),
                              },
                          }
                        : {}),
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={c.headerIconLeading(theme, isRtl, "healthIndex")}
                >
                    <HealthIcon />
                </Box>
                <Box
                    sx={{
                        ...c.headerColumn(theme, isRtl),
                        flexShrink: 0,
                        ...(compact
                            ? {
                                  mb: 0,
                                  minHeight: `calc(${METRIC_STAT_CARD_ICON_SIZE_PX}px + ${theme.spacing(1)})`,
                              }
                            : {}),
                    }}
                >
                    <Box
                        sx={{
                            ...c.headerTitleRow(theme, isRtl),
                            mb: compact ? 0 : theme.spacing(1),
                        }}
                    >
                        <Typography
                            variant="body2"
                            component="span"
                            sx={{
                                ...c.headerTitleInRow(theme, isRtl),
                                ml: 0,
                                mr: 0,
                                mb: 0,
                                minWidth: 0,
                            }}
                        >
                            {t("credit_insurance_dashboard.health_index", nsDashboard)}
                        </Typography>
                        <CreditDashboardTitleInfoIcon
                            isRtl={isRtl}
                            title={t(
                                "tooltips.credit_insurance_health_index_rule",
                                nsDashboard
                            )}
                            ariaLabel={t(
                                "credit_insurance_dashboard.chart_title_help_aria",
                                nsDashboard
                            )}
                        />
                    </Box>
                </Box>
                <Box
                    sx={{
                        width: "100%",
                        position: "relative",
                        overflow: "hidden",
                        ...(compact
                            ? {
                                  flex: 1,
                                  minHeight: CREDIT_DASHBOARD_COMPACT_GAUGE_HEIGHT_PX,
                              }
                            : { flex: "0 0 auto" }),
                    }}
                >
                    <Box
                        role="img"
                        aria-label={t("credit_insurance_dashboard.health_index", {
                            ns: "dashboard",
                        })}
                        sx={{
                            position: "absolute",
                            ...(compact
                                ? {
                                      top: theme.spacing(0.75),
                                      right: theme.spacing(0.5),
                                      bottom: theme.spacing(0.75),
                                      left: theme.spacing(0.5),
                                  }
                                : { inset: 0 }),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            ...(loading
                                ? {
                                      animation: "gaugePulse 1.2s ease-in-out infinite",
                                      "@keyframes gaugePulse": {
                                          "0%": { opacity: 0.45 },
                                          "50%": { opacity: 0.9 },
                                          "100%": { opacity: 0.45 },
                                      },
                                  }
                                : {}),
                        }}
                    >
                        <GaugeComponent
                            value={loading ? 0 : safeHealthIndex}
                            type="radial"
                            arc={{
                                gradient: true,
                                width: 0.15,
                                padding: 0,
                                subArcs: [],
                                colorArray: ["#5BE12C", "#F5CD19", "#EA4228"],
                                nbSubArcs: 3,
                            }}
                            pointer={{
                                type: "arrow",
                                color: "#dfa810",
                                maxFps: 30,
                            }}
                            labels={{
                                valueLabel: {
                                    formatTextValue: (e) =>
                                        `${Number(e).toFixed(1)}%`,
                                    maxDecimalDigits: 1,
                                    style: {
                                        fontSize: "24px",
                                        fill: "#000000",
                                        textShadow: "none",
                                    },
                                    matchColorWithArc: false,
                                    hide: false,
                                    animateValue: true,
                                },
                                tickLabels: {
                                    type: "outer",
                                    ticks: [
                                        { value: 0 },
                                        { value: 20 },
                                        { value: 40 },
                                        { value: 60 },
                                        { value: 80 },
                                    ],
                                    defaultTickValueConfig: {
                                        style: {
                                            fontSize: "12px",
                                            fill: "#919191",
                                        },
                                    },
                                    defaultTickLineConfig: {
                                        distanceFromArc: 4,
                                        length: 7,
                                        distanceFromText: 9,
                                    },
                                },
                            }}
                        />
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
