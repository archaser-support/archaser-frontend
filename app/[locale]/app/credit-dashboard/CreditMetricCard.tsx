"use client";

import {
    TrendingDown as TrendingDownIcon,
    TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import { Box, Card, CardContent, SxProps, Theme, Typography, useTheme } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

import type { MetricStatCardIconAccent } from "@/app/theme";

import { CreditDashboardTitleInfoIcon } from "./creditDashboardTitleTooltip";

/** Dual-currency credit lines use `secondary (account)` — see formatDualCurrencyCreditInsuranceLine. */
function isDualCurrencyMetricValue(value: React.ReactNode): value is string {
    return typeof value === "string" && value.includes(" (") && value.endsWith(")");
}

export type CreditMetricCardProps = {
    icon: React.ReactNode;
    /** Solid tile color; defaults to neutral slate (not account primary/secondary). */
    iconAccent?: MetricStatCardIconAccent;
    label: string;
    value: React.ReactNode;
    secondaryLine?: React.ReactNode;
    /** Keep secondary line on one line. */
    secondaryLineNoWrap?: boolean;
    footnote?: React.ReactNode;
    /** Muted footnote by default; use `error` for overdue / risk callouts. */
    footnoteTone?: "default" | "error";
    onClick?: () => void;
    /** Lift + icon animation on hover without click (default: true when not clickable). */
    hoverable?: boolean;
    tooltip?: string;
    /** Month-over-month percentage change (e.g. 12.5 for +12.5%). null/0 hides the indicator. */
    changePct?: number | null;
    /** Whether an increase is good or bad — controls indicator color. */
    changePolarity?: "up-is-good" | "up-is-bad";
    /** Denser layout for sticky headers and narrow grids. */
    compact?: boolean;
    /** Force the secondary line to render below the value instead of inline. */
    forceSecondaryLineBelow?: boolean;
    /** Override compact value font size (defaults to 1rem). */
    compactValueFontSize?: string;
    /** Custom styling overrides for the card. */
    sx?: SxProps<Theme>;
};

/** Stat card styling matches `app/dashboard/(cards)/*` (e.g. OverdueAmountCard, TotalDueCard). */
export function CreditMetricCard({
    icon,
    iconAccent = "default",
    label,
    value,
    secondaryLine,
    secondaryLineNoWrap = false,
    footnote,
    footnoteTone = "default",
    onClick,
    hoverable,
    tooltip,
    changePct,
    changePolarity = "up-is-bad",
    compact = false,
    forceSecondaryLineBelow = false,
    compactValueFontSize = "1rem",
    sx,
}: CreditMetricCardProps) {
    const theme = useTheme();
    const { i18n } = useTranslation(["common"]);
    const { t } = useTranslation(["dashboard"]);
    const isRtl = i18n.language === "he" || i18n.language.startsWith("he-");
    const clickable = Boolean(onClick);
    const cardHoverable = hoverable ?? !clickable;
    const m = theme.metricStatCard;
    const compactIconSize = 32;
    const compactIconGutter = `calc(${compactIconSize}px + ${theme.spacing(1.75)} + ${theme.spacing(0.5)})`;

    const showChange = changePct != null && changePct !== 0;
    const isPositive = (changePct ?? 0) > 0;
    const isFavorable =
        changePolarity === "up-is-good" ? isPositive : !isPositive;
    const changeColor = isFavorable
        ? theme.palette.success.main
        : theme.palette.error.main;
    const ChangeArrow = isPositive ? TrendingUpIcon : TrendingDownIcon;
    const formattedPct = showChange
        ? `${isPositive ? "+" : ""}${changePct!.toFixed(1)}%`
        : null;
    const isPrimitiveValue = typeof value === "string" || typeof value === "number";
    const dualCurrencyValue = isDualCurrencyMetricValue(value);
    const renderMetricValue = (overrides?: Record<string, unknown>) => {
        const valueSx = {
            ...m.value(theme, isRtl),
            ...(overrides ?? {}),
            ...(dualCurrencyValue
                ? {
                      fontSize: compact
                          ? "0.8125rem"
                          : "clamp(0.8125rem, 0.9vw + 0.45rem, 1.125rem)",
                      whiteSpace: "normal",
                      lineHeight: 1.25,
                  }
                : {}),
        };

        return isPrimitiveValue ? (
            <Typography sx={valueSx}>{value}</Typography>
        ) : (
            <Box sx={{ ...m.valueSlot(theme, isRtl), ...(overrides ?? {}) }}>
                {value}
            </Box>
        );
    };

    return (
        <Card
            elevation={0}
            onClick={onClick}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
                clickable && onClick
                    ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onClick();
                          }
                      }
                    : undefined
            }
            sx={[
                m.card(theme, { clickable, hoverable: cardHoverable }),
                ...(Array.isArray(sx) ? sx : [sx]),
            ] as any}
        >
            <CardContent
                sx={{
                    ...m.cardContent(theme),
                    direction: isRtl ? "rtl" : "ltr",
                    ...(compact
                        ? {
                              p: theme.spacing(1.5),
                              minHeight: 56,
                              "&:last-child": {
                                  paddingBottom: theme.spacing(1.5),
                              },
                          }
                        : {}),
                }}
            >
                <Box
                    className="card-icon"
                    aria-hidden
                    sx={[
                        m.iconBox(theme, isRtl, iconAccent),
                        compact
                            ? {
                                  width: compactIconSize,
                                  height: compactIconSize,
                                  top: 14,
                                  left: isRtl ? 14 : "auto",
                                  right: isRtl ? "auto" : 14,
                                  borderRadius: "10px",
                                  "& .MuiSvgIcon-root": {
                                      fontSize: "1.125rem",
                                  },
                              }
                            : {},
                    ]}
                >
                    {icon}
                </Box>

                <Box
                    sx={[
                        m.bodyColumn(theme, isRtl),
                        compact
                            ? {
                                  paddingInlineEnd: compactIconGutter,
                                  paddingInlineStart: 0,
                              }
                            : {},
                    ]}
                >
                    {tooltip ? (
                        <Box
                            sx={{
                                ...m.labelRow(theme, isRtl),
                                mb: compact ? theme.spacing(0.5) : theme.spacing(1),
                            }}
                        >
                            <Typography
                                component="div"
                                variant="body2"
                                sx={{
                                    ...m.label(theme, isRtl),
                                    mb: 0,
                                    minWidth: 0,
                                    width: "auto",
                                    flex: "0 1 auto",
                                    ...(compact
                                        ? {
                                              fontSize: "0.875rem",
                                              lineHeight: 1.2,
                                          }
                                        : {}),
                                }}
                            >
                                {label}
                            </Typography>
                            <CreditDashboardTitleInfoIcon
                                isRtl={isRtl}
                                title={tooltip}
                                ariaLabel={t(
                                    "credit_insurance_dashboard.chart_title_help_aria",
                                    { ns: "dashboard" }
                                )}
                            />
                        </Box>
                    ) : (
                        <Typography
                            variant="body2"
                            sx={{
                                ...m.label(theme, isRtl),
                                ...(compact
                                    ? {
                                          fontSize: "0.875rem",
                                          lineHeight: 1.2,
                                          mb: theme.spacing(0.5),
                                      }
                                    : {}),
                            }}
                        >
                            {label}
                        </Typography>
                    )}

                    <Box
                        sx={m.valuesStack(theme, {
                            alignValueToEnd:
                                !secondaryLine && !footnote && !(compact && secondaryLine),
                        })}
                    >
                        {secondaryLine && compact && !forceSecondaryLineBelow ? (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "baseline",
                                    flexWrap: "wrap",
                                    gap: theme.spacing(0.5),
                                    width: "100%",
                                    minWidth: 0,
                                    direction: isRtl ? "rtl" : "ltr",
                                    justifyContent: "flex-start",
                                }}
                            >
                                {renderMetricValue({
                                    fontSize: compactValueFontSize,
                                    lineHeight: 1.2,
                                    width: "auto",
                                    flex: "0 1 auto",
                                    whiteSpace: "normal",
                                })}
                                <Typography
                                    variant="body2"
                                    component="span"
                                    sx={{
                                        ...m.secondary(theme, isRtl),
                                        fontSize: "0.6875rem",
                                        mt: 0,
                                        lineHeight: 1.25,
                                        width: "auto",
                                        flex: "0 1 auto",
                                        whiteSpace: secondaryLineNoWrap
                                            ? "nowrap"
                                            : "normal",
                                    }}
                                >
                                    {secondaryLine}
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                {renderMetricValue(
                                    compact
                                        ? {
                                              fontSize: compactValueFontSize,
                                              lineHeight: 1.2,
                                              whiteSpace: "nowrap",
                                          }
                                        : undefined
                                )}
                                {secondaryLine ? (
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            ...m.secondary(theme, isRtl),
                                            whiteSpace: secondaryLineNoWrap
                                                ? "nowrap"
                                                : "normal",
                                            ...(compact
                                                ? {
                                                      fontSize: "0.6875rem",
                                                      mt: 0.25,
                                                      lineHeight: 1.25,
                                                  }
                                                : {}),
                                        }}
                                    >
                                        {secondaryLine}
                                    </Typography>
                                ) : (
                                    forceSecondaryLineBelow && (
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                ...m.secondary(theme, isRtl),
                                                visibility: "hidden",
                                                ...(compact
                                                    ? {
                                                          fontSize: "0.6875rem",
                                                          mt: 0.25,
                                                          lineHeight: 1.25,
                                                      }
                                                    : {}),
                                            }}
                                        >
                                            &nbsp;
                                        </Typography>
                                    )
                                )}
                            </>
                        )}
                        {footnote && (
                            <Typography
                                variant="caption"
                                sx={[
                                    m.footnote(theme, isRtl),
                                    footnoteTone === "error"
                                        ? { color: theme.palette.error.main }
                                        : {},
                                ]}
                            >
                                {footnote}
                            </Typography>
                        )}
                        {showChange && (
                            <Box
                                sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                    mt: 0.5,
                                    width: "100%",
                                    justifyContent: "flex-start",
                                    direction: isRtl ? "rtl" : "ltr",
                                }}
                            >
                                <ChangeArrow
                                    sx={{
                                        fontSize: "0.875rem",
                                        color: changeColor,
                                    }}
                                />
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: changeColor,
                                        fontSize: "0.6875rem",
                                        fontWeight: 600,
                                        lineHeight: 1.35,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {t(
                                        "credit_insurance_dashboard.change_from_last_month",
                                        {
                                            ns: "dashboard",
                                            value: formattedPct,
                                        }
                                    )}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
