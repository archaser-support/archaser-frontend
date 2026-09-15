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

/**
 * react-gauge-component `gradient: true` paints a horizontal linearGradient, not along the
 * arc. Near 100% that compresses high-end stops, so 90–100 reads orange/red instead of green.
 * Build real arc wedges with a short blend at each threshold instead.
 */
function buildCreditProtectionSubArcs(red: string, orange: string, green: string) {
    const blend = (from: string, to: string, t: number) => {
        const parse = (hex: string) => {
            const h = hex.replace("#", "");
            const full =
                h.length === 3
                    ? h
                          .split("")
                          .map((c) => c + c)
                          .join("")
                    : h;
            return [
                Number.parseInt(full.slice(0, 2), 16),
                Number.parseInt(full.slice(2, 4), 16),
                Number.parseInt(full.slice(4, 6), 16),
            ] as const;
        };
        const [r1, g1, b1] = parse(from);
        const [r2, g2, b2] = parse(to);
        const toHex = (n: number) =>
            Math.round(n).toString(16).padStart(2, "0");
        return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`;
    };

    const subArcs: Array<{
        limit: number;
        color: string;
        showTick?: boolean;
    }> = [];

    for (let limit = 1; limit <= 100; limit += 1) {
        let color = green;
        if (limit <= 80) {
            color = red;
        } else if (limit <= 85) {
            color = blend(red, orange, (limit - 80) / 5);
        } else if (limit <= 87) {
            color = orange;
        } else if (limit <= 90) {
            color = blend(orange, green, (limit - 87) / 3);
        }

        subArcs.push({
            limit,
            color,
        });
    }

    return subArcs;
}

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
                        // Outer tick labels sit outside the arc; do not clip them.
                        overflow: "visible",
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
                            overflow: "visible",
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
                            style={{ overflow: "visible" }}
                            // Leave room so outer tick labels clear the arc band.
                            marginInPercent={{
                                top: 0.12,
                                bottom: 0.04,
                                left: 0.14,
                                right: 0.14,
                            }}
                            arc={{
                                // Do not use library gradient mode — see buildCreditProtectionSubArcs.
                                gradient: false,
                                width: 0.15,
                                padding: 0,
                                subArcs: buildCreditProtectionSubArcs(
                                    theme.palette.error.main,
                                    theme.palette.warning.main,
                                    theme.palette.success.main
                                ),
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
                                        distanceFromArc: 6,
                                        length: 7,
                                        distanceFromText: 14,
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
