"use client";

import { HealthAndSafety as HealthIcon } from "@mui/icons-material";
import { alpha, Box, Card, CardContent, Typography, useTheme } from "@mui/material";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";
import {
    CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX,
    CREDIT_DASHBOARD_COMPACT_GAUGE_HEIGHT_PX,
} from "./creditDashboardCompactLayout";

export type CreditHealthIndexGaugeProps = {
    healthIndex: number;
    /** Narrower layout next to the daily trend chart */
    compact?: boolean;
    loading?: boolean;
};

function formatHealthIndexPercent(value: number, lang: string): string {
    const locale = lang === "he" ? "he-IL" : "en-US";
    const ratio = Math.max(0, Math.min(1, value / 100));
    const digits =
        value <= 0
            ? 0
            : value < 0.1
              ? 3
              : value < 1
                ? 2
                : value < 10
                  ? 1
                  : 0;
    return new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
    }).format(ratio);
}

/** Crop around semicircle + value; small margin so arc tips are not clipped. */
const GAUGE_VIEWBOX = "42 36 216 141";

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
    const isLight = theme.palette.mode === "light";
    const safeHealthIndex = Math.max(0, Math.min(100, healthIndex));
    const displayedHealth = formatHealthIndexPercent(safeHealthIndex, i18n.language);

    const gaugeGeometry = useMemo(() => {
        const centerX = 150;
        const centerY = 140;
        const radius = compact ? 92 : 96;
        const innerRadius = radius - 16;
        const needleLength = radius - 12;
        const start = -180;
        const sweep = 180;
        const segments = [
            { from: 0, to: 40, color: theme.palette.error.main },
            { from: 40, to: 70, color: theme.palette.warning.main },
            { from: 70, to: 100, color: theme.palette.success.main },
        ];

        function polar(cx: number, cy: number, r: number, angleDeg: number) {
            const rad = (angleDeg * Math.PI) / 180;
            return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
        }

        function arcPath(fromPct: number, toPct: number) {
            const fromAngle = start + (fromPct / 100) * sweep;
            const toAngle = start + (toPct / 100) * sweep;
            const p1 = polar(centerX, centerY, radius, fromAngle);
            const p2 = polar(centerX, centerY, radius, toAngle);
            const p3 = polar(centerX, centerY, innerRadius, toAngle);
            const p4 = polar(centerX, centerY, innerRadius, fromAngle);
            const largeArc = toAngle - fromAngle > 180 ? 1 : 0;
            return [
                `M ${p1.x} ${p1.y}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
                `L ${p3.x} ${p3.y}`,
                `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
                "Z",
            ].join(" ");
        }

        const needleAngle = start + (safeHealthIndex / 100) * sweep;

        return {
            centerX,
            centerY,
            segments,
            arcPath,
            needleAngle,
            needleLength,
        };
    }, [
        compact,
        safeHealthIndex,
        theme.palette.error.main,
        theme.palette.success.main,
        theme.palette.warning.main,
    ]);

    const gaugePreserveAspect = "xMidYMid meet";

    const gaugeSvg = loading ? (
        <svg
            viewBox={GAUGE_VIEWBOX}
            preserveAspectRatio={gaugePreserveAspect}
            aria-hidden="true"
            style={{ width: "100%", height: "100%", display: "block" }}
        >
            <path
                d={gaugeGeometry.arcPath(0, 100)}
                fill={isLight ? "#E5E7EB" : alpha("#FFFFFF", 0.2)}
            />
            <g
                style={{
                    transformOrigin: `${gaugeGeometry.centerX}px ${gaugeGeometry.centerY}px`,
                    animation: "gaugeNeedleSweep 1.1s ease-in-out infinite alternate",
                }}
            >
                <line
                    x1={gaugeGeometry.centerX}
                    y1={gaugeGeometry.centerY}
                    x2={gaugeGeometry.centerX + gaugeGeometry.needleLength}
                    y2={gaugeGeometry.centerY}
                    stroke={isLight ? "#9CA3AF" : "#CBD5E1"}
                    strokeWidth={4}
                    strokeLinecap="round"
                />
            </g>
            <style>
                {`@keyframes gaugeNeedleSweep {
                    from { transform: rotate(-160deg); }
                    to { transform: rotate(-20deg); }
                }`}
            </style>
            <circle
                cx={gaugeGeometry.centerX}
                cy={gaugeGeometry.centerY}
                r={8}
                fill={isLight ? "#9CA3AF" : "#CBD5E1"}
            />
        </svg>
    ) : (
        <svg
            viewBox={GAUGE_VIEWBOX}
            preserveAspectRatio={gaugePreserveAspect}
            role="img"
            aria-label={t("credit_insurance_dashboard.health_index", {
                ns: "dashboard",
            })}
            style={{ width: "100%", height: "100%", display: "block" }}
        >
            {gaugeGeometry.segments.map((segment) => (
                <path
                    key={`${segment.from}-${segment.to}`}
                    d={gaugeGeometry.arcPath(segment.from, segment.to)}
                    fill={segment.color}
                    opacity={0.95}
                />
            ))}
            <g
                style={{
                    transformOrigin: `${gaugeGeometry.centerX}px ${gaugeGeometry.centerY}px`,
                    transform: `rotate(${gaugeGeometry.needleAngle}deg)`,
                    transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
            >
                <line
                    x1={gaugeGeometry.centerX}
                    y1={gaugeGeometry.centerY}
                    x2={gaugeGeometry.centerX + gaugeGeometry.needleLength}
                    y2={gaugeGeometry.centerY}
                    stroke={isLight ? "#111827" : "#E5E7EB"}
                    strokeWidth={4}
                    strokeLinecap="round"
                />
            </g>
            <circle
                cx={gaugeGeometry.centerX}
                cy={gaugeGeometry.centerY}
                r={8}
                fill={isLight ? "#111827" : "#E5E7EB"}
            />
            <text
                x="150"
                y="168"
                textAnchor="middle"
                style={{
                    fill: isLight ? "#111827" : "#F9FAFB",
                    fontWeight: 700,
                    fontSize: compact ? "18px" : "22px",
                    direction: isRtl ? "rtl" : "ltr",
                    unicodeBidi: isRtl ? "plaintext" : "normal",
                }}
            >
                {displayedHealth}
            </text>
        </svg>
    );

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
                                  minHeight: `calc(48px + ${theme.spacing(1)})`,
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
                        {gaugeSvg}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
