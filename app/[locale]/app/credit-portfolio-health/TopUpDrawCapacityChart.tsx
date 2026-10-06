"use client";

import { useMemo, useRef } from "react";
import { CustomerNameYTick, CUSTOMER_NAME_Y_AXIS_WIDTH } from "./CustomerNameYTick";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import type {
    PortfolioTopUpDrawCustomer,
    PortfolioUtilizationDailyPoint,
} from "@/types/creditInsurance";

import { BigNumber } from "./BigNumber";
import { Eyebrow } from "./Eyebrow";
import { IslandCard } from "./IslandCard";
import { PortaledHoverTooltip } from "./PortaledHoverTooltip";
import { CPH } from "./designTokens";
import {
    formatPortfolioAxisMoney,
    formatPortfolioMoney,
} from "./formatPortfolioMoney";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 10;
const AXIS_HEIGHT = 32;
const CHART_RIGHT = 72;
const CHART_LEFT = 8;
const POLICY_FILL = CPH.seriesSky;
const TOP_UP_FILL = CPH.seriesOrange;
const PEAK_FILL = CPH.ink;

export type TopUpDrawCapacityChartProps = {
    customers: PortfolioTopUpDrawCustomer[];
    customerCount: number;
    averageDurationDays: number | null;
    daily: PortfolioUtilizationDailyPoint[];
    accountCurrency: string;
};

type ChartRow = {
    rowKey: string;
    customerId: number;
    customerName: string;
    policyLimit: number;
    topUpTotal: number;
    peakUsage: number;
    peakUsagePct: number | null;
    peakTopUpUsagePct: number | null;
    peakDate: string;
    durationDays: number;
    daysUsed: number;
    peakPctLabel: string;
};

function formatPct(value: number, language: string, decimals = 1): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}%`;
}

function peakCoverUsagePct(
    policyLimit: number,
    topUpTotal: number,
    peakUsage: number
): number | null {
    const cover = Math.max(0, policyLimit) + Math.max(0, topUpTotal);
    if (!(cover > 0)) {
        return null;
    }
    return (Math.max(0, peakUsage) / cover) * 100;
}

function formatDay(ymd: string, language: string): string {
    const date = new Date(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
        return ymd;
    }
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return date.toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function portfolioPeakTopUpUsage(daily: PortfolioUtilizationDailyPoint[]): {
    pct: number | null;
    date: string | null;
} {
    let pct: number | null = null;
    let date: string | null = null;
    for (const point of daily) {
        const value = point.topUpUtilizationPct;
        if (value == null || !Number.isFinite(value)) {
            continue;
        }
        if (
            pct == null ||
            value > pct ||
            (value === pct && date != null && point.snapshotDate > date)
        ) {
            pct = value;
            date = point.snapshotDate;
        }
    }
    return { pct, date };
}

function TopUpBarWithPeak(props: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    payload?: ChartRow;
}) {
    const x = props.x ?? 0;
    const y = props.y ?? 0;
    const width = Math.max(0, props.width ?? 0);
    const height = Math.max(0, props.height ?? 0);
    const payload = props.payload;
    const topUp = Math.max(0, payload?.topUpTotal ?? 0);
    const policy = Math.max(0, payload?.policyLimit ?? 0);
    const peak = Math.max(0, payload?.peakUsage ?? 0);
    const units = topUp > 0 ? topUp : policy > 0 ? policy : 1;
    const pxPerUnit = width > 0 ? width / (topUp > 0 ? topUp : units) : 0;
    const stackStart = topUp > 0 ? x - policy * pxPerUnit : x;
    const peakX = stackStart + peak * pxPerUnit;
    const cy = y + height / 2;
    const peakPctLabel = payload?.peakPctLabel ?? "";
    const barEnd = x + width;
    const labelX = Math.max(peakX + 10, barEnd + 8);

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={props.fill ?? TOP_UP_FILL}
            />
            {payload != null && pxPerUnit > 0 ? (
                <>
                    <circle
                        cx={peakX}
                        cy={cy}
                        r={5}
                        fill={PEAK_FILL}
                        stroke={CPH.card}
                        strokeWidth={2}
                    />
                    {peakPctLabel ? (
                        <text
                            x={labelX}
                            y={cy}
                            dy="0.35em"
                            fill={CPH.ink}
                            fontSize={11}
                            stroke={CPH.card}
                            strokeWidth={3}
                            paintOrder="stroke"
                            style={{
                                paintOrder: "stroke fill",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {peakPctLabel}
                        </text>
                    ) : null}
                </>
            ) : null}
        </g>
    );
}

type DrawTooltipProps = {
    active?: boolean;
    payload?: Array<{ payload?: ChartRow; color?: string }>;
    coordinate?: { x: number; y: number };
    chartEl?: HTMLDivElement | null;
    language: string;
    currency: string;
    policyName: string;
    topUpName: string;
    peakName: string;
    peakUsagePctName: string;
    durationName: string;
    daysUsedName: string;
    peakDateName: string;
    peakPctName: string;
};

function DrawTooltip({
    active,
    payload,
    coordinate,
    chartEl,
    language,
    currency,
    policyName,
    topUpName,
    peakName,
    peakUsagePctName,
    durationName,
    daysUsedName,
    peakDateName,
    peakPctName,
}: DrawTooltipProps) {
    const row = payload?.[0]?.payload;
    if (!active || row == null) {
        return null;
    }
    const items = [
        {
            name: policyName,
            display: formatPortfolioMoney(row.policyLimit, currency, language),
            color: POLICY_FILL,
        },
        {
            name: topUpName,
            display: formatPortfolioMoney(row.topUpTotal, currency, language),
            color: TOP_UP_FILL,
        },
        {
            name: peakName,
            display: formatPortfolioMoney(row.peakUsage, currency, language),
            color: PEAK_FILL,
        },
        {
            name: peakUsagePctName,
            display:
                row.peakUsagePct == null
                    ? "—"
                    : formatPct(row.peakUsagePct, language),
            color: PEAK_FILL,
        },
        {
            name: peakPctName,
            display:
                row.peakTopUpUsagePct == null
                    ? "—"
                    : formatPct(row.peakTopUpUsagePct, language),
            color: CPH.ink,
        },
        {
            name: peakDateName,
            display: formatDay(row.peakDate, language),
            color: CPH.slate,
        },
        {
            name: durationName,
            display: String(row.durationDays),
            color: CPH.slate,
        },
        {
            name: daysUsedName,
            display: String(row.daysUsed),
            color: CPH.slate,
        },
    ];

    const isRtl = language === "he" || language.startsWith("he-");

    return (
        <PortaledHoverTooltip
            active={active}
            coordinate={coordinate}
            chartEl={chartEl}
            estimatedHeight={220}
        >
        <div
            dir={isRtl ? "rtl" : "ltr"}
            style={{
                maxWidth: 280,
                borderRadius: 8,
                border: `1px solid ${CPH.border}`,
                padding: "8px 12px",
                fontSize: 12,
                backgroundColor: CPH.card,
                color: CPH.ink,
                boxShadow: CPH.shadow,
            }}
        >
            <div
                style={{
                    marginBottom: 4,
                    fontWeight: 500,
                    color: CPH.slate,
                }}
            >
                {row.customerName}
            </div>
            <ul
                style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                }}
            >
                {items.map((item) => (
                    <li
                        key={item.name}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                flexShrink: 0,
                                backgroundColor: item.color,
                            }}
                        />
                        <span style={{ color: CPH.slate, flex: 1 }}>
                            {item.name}
                        </span>
                        <span
                            style={{
                                fontWeight: 500,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {item.display}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
        </PortaledHoverTooltip>
    );
}

export function TopUpDrawCapacityChart({
    customers,
    customerCount,
    averageDurationDays,
    daily,
    accountCurrency,
}: TopUpDrawCapacityChartProps) {
    const { t, i18n } = useTranslation(["dashboard"]);
    const language = i18n.language;
    const isRtl = language === "he" || language.startsWith("he-");
    const ns = { ns: "dashboard" as const };
    const prefersReducedMotion = usePrefersReducedMotion();
    const animDuration = prefersReducedMotion ? 0 : 1100;
    const router = useRouter();
    const params = useParams();
    const locale = typeof params?.locale === "string" ? params.locale : "en";
    const chartElRef = useRef<HTMLDivElement>(null);

    const data = useMemo<ChartRow[]>(
        () =>
            customers.map((row) => ({
                rowKey: String(row.customerId),
                customerId: row.customerId,
                customerName: row.customerName,
                policyLimit: row.policyLimit,
                topUpTotal: row.topUpTotal,
                peakUsage: row.peakUsageAmount,
                peakUsagePct: peakCoverUsagePct(
                    row.policyLimit,
                    row.topUpTotal,
                    row.peakUsageAmount
                ),
                peakTopUpUsagePct: row.peakTopUpUsagePct,
                peakDate: row.peakDate,
                durationDays: row.durationDays,
                daysUsed: row.daysUsed,
                peakPctLabel: (() => {
                    const pct = peakCoverUsagePct(
                        row.policyLimit,
                        row.topUpTotal,
                        row.peakUsageAmount
                    );
                    return pct == null ? "" : formatPct(pct, language);
                })(),
            })),
        [customers, language, t]
    );

    const customerNames = useMemo(() => {
        const names = new Map<string, string>();
        for (const row of data) {
            names.set(row.rowKey, row.customerName);
        }
        return names;
    }, [data]);

    const domainMax = useMemo(() => {
        const peak = data.reduce((max, row) => {
            const cover = row.policyLimit + row.topUpTotal;
            return Math.max(max, cover, row.peakUsage);
        }, 0);
        if (!(peak > 0)) {
            return 1;
        }
        return peak * 1.08;
    }, [data]);

    const innerHeight = Math.max(data.length, 1) * ROW_HEIGHT;
    const viewportHeight = Math.min(
        Math.max(data.length, 1),
        VISIBLE_ROWS
    ) * ROW_HEIGHT;
    const sharedMargin = {
        left: CHART_LEFT,
        right: CHART_RIGHT,
        top: 4,
        bottom: 4,
    };
    const portfolioPeak = useMemo(
        () => portfolioPeakTopUpUsage(daily),
        [daily]
    );

    const policyName = t("credit_portfolio_health.chart_bar_policy_limit", {
        ...ns,
        defaultValue: "Policy limit",
    });
    const topUpName = t("credit_portfolio_health.chart_bar_top_up", {
        ...ns,
        defaultValue: "Top-up",
    });
    const peakName = t("credit_portfolio_health.chart_peak_usage", {
        ...ns,
        defaultValue: "Peak usage",
    });

    const openCustomer = (customerId: number) => {
        router.push(`/${locale}/app/customers/${customerId}`);
    };

    return (
        <IslandCard
            accent="violet"
            className={`${layout.span12} ${layout.cardPad}`}
        >
            <Eyebrow
                icon={RefreshCw}
                help={t("credit_portfolio_health.top_up_draw_help", {
                    ...ns,
                    defaultValue:
                        "Customers with active top-up cover in the range. Each bar is policy limit plus top-up on the peak-usage day; the dot is peak usage as a % of that cover (it stays inside the policy bar when they did not draw on top-up). The % on the right is that peak usage. Hover for longest streak of days usage exceeded the policy limit.",
                })}
            >
                {t("credit_portfolio_health.top_up_draw_title", {
                    ...ns,
                    defaultValue: "Top-up draw",
                })}
            </Eyebrow>
            <div className={layout.kpiStrip}>
                <BigNumber
                    value={customerCount}
                    decimals={0}
                    suffix=""
                    label={t(
                        "credit_portfolio_health.top_up_draw_customers_used",
                        {
                            ...ns,
                            defaultValue: "Customers with top-up",
                        }
                    )}
                    color={CPH.ink}
                    locale={language}
                />
                <BigNumber
                    value={averageDurationDays ?? 0}
                    decimals={1}
                    suffix=""
                    label={t(
                        "credit_portfolio_health.top_up_draw_avg_duration",
                        {
                            ...ns,
                            defaultValue: "Avg. duration (days)",
                        }
                    )}
                    color={CPH.ink}
                    locale={language}
                />
                <BigNumber
                    value={portfolioPeak.pct ?? 0}
                    suffix="%"
                    label={
                        portfolioPeak.date != null
                            ? t(
                                  "credit_portfolio_health.top_up_draw_portfolio_peak_on",
                                  {
                                      ...ns,
                                      defaultValue: "Portfolio peak · {{date}}",
                                      date: formatDay(
                                          portfolioPeak.date,
                                          language
                                      ),
                                  }
                              )
                            : t(
                                  "credit_portfolio_health.top_up_draw_portfolio_peak",
                                  {
                                      ...ns,
                                      defaultValue: "Portfolio peak top-up usage",
                                  }
                              )
                    }
                    color={TOP_UP_FILL}
                    locale={language}
                />
            </div>
            {data.length === 0 ? (
                <p className="m-0 mt-4 text-sm" style={{ color: CPH.slate }}>
                    {t("credit_portfolio_health.top_up_draw_empty", {
                        ...ns,
                        defaultValue:
                            "No customers had top-up cover in this range.",
                    })}
                </p>
            ) : (
                <div className="mt-4">
                    <div
                        className="mb-1"
                        style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 16,
                            fontSize: 12,
                            color: CPH.slate,
                        }}
                    >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 2,
                                    backgroundColor: POLICY_FILL,
                                }}
                            />
                            {policyName}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span
                                style={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: 2,
                                    backgroundColor: TOP_UP_FILL,
                                }}
                            />
                            {topUpName}
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    backgroundColor: PEAK_FILL,
                                }}
                            />
                            {peakName}
                        </span>
                    </div>
                    <div
                        style={{
                            width: "100%",
                            height: AXIS_HEIGHT,
                            direction: "ltr",
                        }}
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                layout="vertical"
                                data={[{ rowKey: "_" }]}
                                margin={{
                                    ...sharedMargin,
                                    top: 0,
                                    bottom: 0,
                                }}
                            >
                                <XAxis
                                    type="number"
                                    domain={[0, domainMax]}
                                    orientation="top"
                                    tick={{ fill: CPH.slate, fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v: number) =>
                                        formatPortfolioAxisMoney(
                                            v,
                                            accountCurrency,
                                            language
                                        )
                                    }
                                />
                                <YAxis
                                    type="category"
                                    dataKey="rowKey"
                                    width={CUSTOMER_NAME_Y_AXIS_WIDTH}
                                    hide
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <div
                        ref={chartElRef}
                        style={{
                            width: "100%",
                            maxHeight: viewportHeight,
                            overflowY:
                                data.length > VISIBLE_ROWS ? "auto" : "visible",
                            overflowX: "visible",
                            direction: "ltr",
                        }}
                    >
                        <div style={{ width: "100%", height: innerHeight }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    layout="vertical"
                                    data={data}
                                    margin={sharedMargin}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 6"
                                        stroke={CPH.border}
                                        horizontal={false}
                                    />
                                    <XAxis
                                        type="number"
                                        domain={[0, domainMax]}
                                        hide
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
                                        cursor={{ fill: CPH.surfaceMuted }}
                                        allowEscapeViewBox={{
                                            x: true,
                                            y: true,
                                        }}
                                        wrapperStyle={{
                                            pointerEvents: "none",
                                        }}
                                        content={
                                            <DrawTooltip
                                                chartEl={chartElRef.current}
                                                language={language}
                                                currency={accountCurrency}
                                                policyName={policyName}
                                                topUpName={topUpName}
                                                peakName={peakName}
                                                peakUsagePctName={t(
                                                    "credit_portfolio_health.chart_peak_usage_pct",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Peak usage %",
                                                    }
                                                )}
                                                durationName={t(
                                                    "credit_portfolio_health.top_up_draw_duration",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Longest streak (days)",
                                                    }
                                                )}
                                                daysUsedName={t(
                                                    "credit_portfolio_health.top_up_draw_days_used",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Days used",
                                                    }
                                                )}
                                                peakDateName={t(
                                                    "credit_portfolio_health.top_up_draw_peak_date",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Peak date",
                                                    }
                                                )}
                                                peakPctName={t(
                                                    "credit_portfolio_health.top_up_draw_peak_pct",
                                                    {
                                                        ...ns,
                                                        defaultValue:
                                                            "Peak top-up usage",
                                                    }
                                                )}
                                            />
                                        }
                                    />
                                    <Bar
                                        dataKey="policyLimit"
                                        stackId="cover"
                                        name={policyName}
                                        fill={POLICY_FILL}
                                        cursor="pointer"
                                        animationDuration={animDuration}
                                        onClick={(entry) => {
                                            const id = (
                                                entry as {
                                                    payload?: ChartRow;
                                                }
                                            )?.payload?.customerId;
                                            if (id != null) {
                                                openCustomer(id);
                                            }
                                        }}
                                    />
                                    <Bar
                                        dataKey="topUpTotal"
                                        stackId="cover"
                                        name={topUpName}
                                        fill={TOP_UP_FILL}
                                        shape={TopUpBarWithPeak}
                                        cursor="pointer"
                                        animationDuration={animDuration}
                                        legendType="rect"
                                        onClick={(entry) => {
                                            const id = (
                                                entry as {
                                                    payload?: ChartRow;
                                                }
                                            )?.payload?.customerId;
                                            if (id != null) {
                                                openCustomer(id);
                                            }
                                        }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </IslandCard>
    );
}
