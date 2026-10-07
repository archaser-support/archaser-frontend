"use client";

import { useMemo, useRef } from "react";
import { useTheme } from "@mui/material";
import {
    Bar,
    BarChart,
    Cell,
    Legend,
    ResponsiveContainer,
    Tooltip,
    useXAxisScale,
    useYAxisScale,
    XAxis,
    YAxis,
} from "recharts";

import type { CustomerPolicyTrendTopRow } from "@/types/creditInsurance";

import { BetweenBarDividers } from "./BetweenBarDividers";
import { CustomerNameYTick, CUSTOMER_NAME_Y_AXIS_WIDTH } from "./CustomerNameYTick";
import { CPH } from "./designTokens";
import { chartColors } from "./chartColors";
import {
    formatPortfolioAxisMoney,
    formatPortfolioMoney,
} from "./formatPortfolioMoney";
import { PortaledHoverTooltip } from "./PortaledHoverTooltip";

const ROW_HEIGHT = 36;
const BAR_SIZE = Math.round(ROW_HEIGHT * 0.68);
const CHART_RIGHT = 160;
const CHART_LEFT = 8;

export type CoverageTopCustomersChartLabels = {
    currentAr: string;
    approvedLimit: string;
    topUpTotal: string;
    effectiveLimit: string;
    policyUsage: string;
    topUpUsage: string;
    effectiveUsage: string;
    usagePct: string;
    policySeries: string;
    topUpSeries: string;
    overSeries: string;
};

export type CoverageTopCustomersChartProps = {
    rows: CustomerPolicyTrendTopRow[];
    hasTopUpPolicies: boolean;
    accountCurrency: string;
    language: string;
    isRtl: boolean;
    labels: CoverageTopCustomersChartLabels;
};

type ChartRow = {
    rowKey: string;
    customerName: string;
    amount: number;
    limit: number | null;
    topUpTotal: number | null;
    effectiveLimit: number | null;
    policyUsagePct: number | null;
    topUpUsagePct: number | null;
    effectiveUsagePct: number | null;
    usagePct: number;
    barPolicyPct: number;
    barTopUpPct: number;
    barOverPct: number;
    barFillPct: number;
    barTotalPct: number;
    policyNumber: string | null;
    status: "ok" | "warning" | "danger" | "neutral";
    color: string;
    pillText: string;
};

function formatPct(value: number, language: string, decimals = 1): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}%`;
}

/**
 * Recharts omits zero-width stack segments, so LabelList on `barOverPct`
 * never runs for most rows. Position pills from axis scales instead.
 */
function CoverageBarPills({
    data,
    showTopUpStack,
}: {
    data: ChartRow[];
    showTopUpStack: boolean;
}) {
    const xScale = useXAxisScale();
    const yScale = useYAxisScale();
    if (xScale == null || yScale == null) {
        return null;
    }
    return (
        <g className="coverage-bar-pills" pointerEvents="none">
            {data.map((row) => {
                if (!row.pillText) {
                    return null;
                }
                const endPct = showTopUpStack
                    ? row.barTotalPct
                    : row.barFillPct;
                const x = xScale(endPct);
                const y = yScale(row.rowKey, { position: "middle" });
                if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
                    return null;
                }
                return (
                    <text
                        key={`pill-${row.rowKey}`}
                        x={x + 8}
                        y={y}
                        dy="0.35em"
                        fill={CPH.ink}
                        fontSize={11}
                        style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                        {row.pillText}
                    </text>
                );
            })}
        </g>
    );
}

type CoverageTooltipProps = {
    active?: boolean;
    payload?: Array<{ payload?: ChartRow }>;
    coordinate?: { x: number; y: number };
    chartEl?: HTMLDivElement | null;
    language: string;
    currency: string;
    showTopUpStack: boolean;
    labels: CoverageTopCustomersChartLabels;
};

function CoverageTooltip({
    active,
    payload,
    coordinate,
    chartEl,
    language,
    currency,
    showTopUpStack,
    labels,
}: CoverageTooltipProps) {
    const row = payload?.[0]?.payload;
    if (!active || row == null) {
        return null;
    }
    const isRtl = language === "he" || language.startsWith("he-");
    const money = (v: number | null | undefined) =>
        v != null && v > 0
            ? formatPortfolioMoney(v, currency, language)
            : "-";
    const items: Array<{ name: string; display: string }> = [
        {
            name: labels.currentAr,
            display: formatPortfolioMoney(row.amount, currency, language),
        },
        { name: labels.approvedLimit, display: money(row.limit) },
    ];
    if (showTopUpStack) {
        items.push(
            { name: labels.topUpTotal, display: money(row.topUpTotal) },
            {
                name: labels.effectiveLimit,
                display: money(row.effectiveLimit),
            }
        );
    }
    if (row.policyUsagePct != null) {
        items.push({
            name: labels.policyUsage,
            display: formatPct(row.policyUsagePct, language),
        });
    }
    if (showTopUpStack && row.topUpUsagePct != null) {
        items.push({
            name: labels.topUpUsage,
            display: formatPct(row.topUpUsagePct, language),
        });
    }
    if (showTopUpStack && row.effectiveUsagePct != null) {
        items.push({
            name: labels.effectiveUsage,
            display: formatPct(row.effectiveUsagePct, language),
        });
    } else if (!showTopUpStack) {
        items.push({
            name: labels.usagePct,
            display: formatPct(row.usagePct, language),
        });
    }

    return (
        <PortaledHoverTooltip
            active={active}
            chartEl={chartEl}
            coordinate={coordinate}
            estimatedWidth={280}
            estimatedHeight={220}
        >
            <div
                dir={isRtl ? "rtl" : "ltr"}
                style={{
                    borderRadius: 8,
                    border: `1px solid ${CPH.border}`,
                    padding: "8px 12px",
                    fontSize: 12,
                    backgroundColor: CPH.card,
                    color: CPH.ink,
                    boxShadow: CPH.shadow,
                    minWidth: 200,
                }}
            >
                <div
                    style={{
                        fontWeight: 700,
                        marginBottom: 6,
                        paddingBottom: 4,
                        borderBottom: `1px solid ${CPH.border}`,
                        textAlign: isRtl ? "right" : "left",
                    }}
                >
                    {row.customerName}
                </div>
                {items.map((item) => (
                    <div
                        key={item.name}
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: isRtl ? 8 : 16,
                            marginBottom: 4,
                        }}
                    >
                        <span style={{ color: CPH.ink }}>{item.name}</span>
                        <span
                            style={{
                                color: CPH.slate,
                                direction: "ltr",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {item.display}
                        </span>
                    </div>
                ))}
                {row.policyNumber ? (
                    <div
                        style={{
                            marginTop: 4,
                            fontSize: 11,
                            color: CPH.slate,
                            textAlign: isRtl ? "right" : "left",
                        }}
                    >
                        {row.policyNumber}
                    </div>
                ) : null}
            </div>
        </PortaledHoverTooltip>
    );
}

function CoverageStackLegend({
    items,
}: {
    items: Array<{ label: string; color: string }>;
}) {
    return (
        <ul
            style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 14,
                fontSize: 12,
                color: chartColors.axisText,
            }}
        >
            {items.map((item) => (
                <li
                    key={item.label}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                    }}
                >
                    <span
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            backgroundColor: item.color,
                            flexShrink: 0,
                        }}
                    />
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

export function CoverageTopCustomersChart({
    rows,
    hasTopUpPolicies,
    accountCurrency,
    language,
    isRtl,
    labels,
}: CoverageTopCustomersChartProps) {
    const theme = useTheme();
    const chartElRef = useRef<HTMLDivElement | null>(null);
    const showTopUpStack = hasTopUpPolicies === true;
    const policyBarColor = chartColors.primary;
    const topUpBarColor = chartColors.secondary;
    const overBarColor = theme.palette.error.main;

    const usageStatusColors = useMemo(
        () => ({
            ok: policyBarColor,
            warning: theme.palette.warning.main,
            danger: theme.palette.error.main,
            neutral: theme.palette.action.disabled,
        }),
        [policyBarColor, theme]
    );

    const pillPercentFormatter = useMemo(
        () =>
            new Intl.NumberFormat("en-US", {
                maximumFractionDigits: 1,
                minimumFractionDigits: 0,
            }),
        []
    );

    const chartData = useMemo((): ChartRow[] => {
        return rows.map((row, index) => {
            const primaryPct = showTopUpStack
                ? row.effectiveUsagePct
                : row.policyUsagePct ?? row.usagePct;
            const usagePct = Math.max(0, primaryPct ?? 0);
            let status: ChartRow["status"];
            if (primaryPct == null) {
                status = "neutral";
            } else if (usagePct > 100) {
                status = "danger";
            } else if (usagePct >= 81) {
                status = "warning";
            } else {
                status = "ok";
            }
            let rawPolicyPct = showTopUpStack
                ? Math.max(0, row.barPolicyPct)
                : Math.max(0, row.policyUsagePct ?? row.usagePct ?? 0);
            const rawTopUpPct = showTopUpStack
                ? Math.max(0, row.barTopUpPct)
                : 0;
            let rawOverPct = showTopUpStack
                ? Math.max(0, row.barOverPct)
                : 0;
            if (
                showTopUpStack &&
                rawOverPct === 0 &&
                rawTopUpPct === 0 &&
                rawPolicyPct > 100
            ) {
                rawOverPct = rawPolicyPct - 100;
                rawPolicyPct = 100;
            }
            const rawTotalPct = rawPolicyPct + rawTopUpPct + rawOverPct;
            const limitText =
                row.approvedLimit != null && row.approvedLimit > 0
                    ? formatPortfolioAxisMoney(
                          row.approvedLimit,
                          accountCurrency,
                          language
                      )
                    : null;
            const topUpText =
                showTopUpStack &&
                row.topUpTotal != null &&
                row.topUpTotal > 0
                    ? formatPortfolioAxisMoney(
                          row.topUpTotal,
                          accountCurrency,
                          language
                      )
                    : null;
            const pctText = `${pillPercentFormatter.format(usagePct)}%`;
            const pillText =
                limitText && topUpText
                    ? `${limitText} + ${topUpText} / ${pctText}`
                    : limitText
                      ? `${limitText} / ${pctText}`
                      : pctText;

            return {
                rowKey: `${row.customerId}-${index}`,
                customerName: row.customerName,
                amount: Math.max(0, row.usageAmount ?? 0),
                limit: row.approvedLimit,
                topUpTotal: row.topUpTotal,
                effectiveLimit: row.effectiveApprovedLimit,
                policyUsagePct: row.policyUsagePct,
                topUpUsagePct: row.topUpUsagePct,
                effectiveUsagePct: row.effectiveUsagePct,
                usagePct,
                barPolicyPct: rawPolicyPct,
                barTopUpPct: rawTopUpPct,
                barOverPct: rawOverPct,
                barFillPct: Math.min(100, rawTotalPct),
                barTotalPct: rawTotalPct,
                policyNumber: row.policyNumber,
                status,
                color: usageStatusColors[status],
                pillText,
            };
        });
    }, [
        rows,
        showTopUpStack,
        usageStatusColors,
        accountCurrency,
        language,
        pillPercentFormatter,
    ]);

    const hasTopUpInChart = chartData.some((row) => row.barTopUpPct > 0);
    const hasOverInChart = chartData.some((row) => row.barOverPct > 0);

    const domainMax = useMemo(() => {
        if (!showTopUpStack) {
            return 100;
        }
        const peak = chartData.reduce(
            (max, row) => Math.max(max, row.barTotalPct, row.usagePct),
            0
        );
        return Math.max(100, Math.ceil(peak / 20) * 20);
    }, [chartData, showTopUpStack]);

    const customerNames = useMemo(() => {
        const names = new Map<string, string>();
        for (const row of chartData) {
            names.set(row.rowKey, row.customerName);
        }
        return names;
    }, [chartData]);

    const chartHeight = Math.max(
        showTopUpStack ? 380 : 340,
        chartData.length * ROW_HEIGHT + (showTopUpStack ? 48 : 16)
    );

    return (
        <div
            ref={chartElRef}
            style={{
                width: "100%",
                height: chartHeight,
                direction: "ltr",
                overflow: "visible",
            }}
        >
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{
                        left: CHART_LEFT,
                        right: CHART_RIGHT,
                        top: showTopUpStack ? 8 : 4,
                        bottom: showTopUpStack ? 28 : 4,
                    }}
                    barCategoryGap="16%"
                >
                    <BetweenBarDividers rowCount={chartData.length} />
                    <XAxis
                        type="number"
                        domain={[0, domainMax]}
                        tick={{ fill: chartColors.axisText, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickCount={Math.round(domainMax / 20) + 1}
                        tickFormatter={(v: number) =>
                            formatPct(v, language, 0)
                        }
                    />
                    <YAxis
                        type="category"
                        dataKey="rowKey"
                        width={CUSTOMER_NAME_Y_AXIS_WIDTH}
                        interval={0}
                        tickMargin={6}
                        tick={(tickProps) => (
                            <CustomerNameYTick
                                x={tickProps.x}
                                y={tickProps.y}
                                payload={tickProps.payload}
                                names={customerNames}
                                isRtl={isRtl}
                            />
                        )}
                        axisLine={false}
                        tickLine={false}
                        reversed={isRtl}
                    />
                    <Tooltip
                        cursor={false}
                        allowEscapeViewBox={{ x: true, y: true }}
                        wrapperStyle={{ pointerEvents: "none" }}
                        content={
                            <CoverageTooltip
                                chartEl={chartElRef.current}
                                language={language}
                                currency={accountCurrency}
                                showTopUpStack={showTopUpStack}
                                labels={labels}
                            />
                        }
                    />
                    {showTopUpStack ? (
                        <Legend
                            wrapperStyle={{
                                fontSize: 12,
                                color: chartColors.axisText,
                            }}
                            content={() => (
                                <CoverageStackLegend
                                    items={[
                                        {
                                            label: labels.policySeries,
                                            color: policyBarColor,
                                        },
                                        ...(hasTopUpInChart
                                            ? [
                                                  {
                                                      label: labels.topUpSeries,
                                                      color: topUpBarColor,
                                                  },
                                              ]
                                            : []),
                                        ...(hasOverInChart
                                            ? [
                                                  {
                                                      label: labels.overSeries,
                                                      color: overBarColor,
                                                  },
                                              ]
                                            : []),
                                    ]}
                                />
                            )}
                        />
                    ) : null}
                    {showTopUpStack ? (
                        <>
                            <Bar
                                dataKey="barPolicyPct"
                                stackId="coverage"
                                name={labels.policySeries}
                                fill={policyBarColor}
                                barSize={BAR_SIZE}
                                isAnimationActive={false}
                            />
                            {hasTopUpInChart ? (
                                <Bar
                                    dataKey="barTopUpPct"
                                    stackId="coverage"
                                    name={labels.topUpSeries}
                                    fill={topUpBarColor}
                                    barSize={BAR_SIZE}
                                    isAnimationActive={false}
                                />
                            ) : null}
                            {hasOverInChart ? (
                                <Bar
                                    dataKey="barOverPct"
                                    stackId="coverage"
                                    name={labels.overSeries}
                                    fill={overBarColor}
                                    barSize={BAR_SIZE}
                                    isAnimationActive={false}
                                />
                            ) : null}
                        </>
                    ) : (
                        <Bar
                            dataKey="barFillPct"
                            name={labels.usagePct}
                            barSize={BAR_SIZE}
                            isAnimationActive={false}
                        >
                            {chartData.map((row) => (
                                <Cell
                                    key={row.rowKey}
                                    fill={row.color}
                                />
                            ))}
                        </Bar>
                    )}
                    <CoverageBarPills
                        data={chartData}
                        showTopUpStack={showTopUpStack}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
