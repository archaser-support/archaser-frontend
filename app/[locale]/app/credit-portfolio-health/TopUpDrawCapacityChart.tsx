"use client";

import { useMemo, useRef } from "react";
import { createPortal } from "react-dom";
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
import { CPH } from "./designTokens";
import {
    formatPortfolioAxisMoney,
    formatPortfolioMoney,
} from "./formatPortfolioMoney";
import layout from "./islandLayout.module.css";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const Y_AXIS_WIDTH = 180;
const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 10;
const AXIS_HEIGHT = 32;
const CHART_RIGHT = 56;
const CHART_LEFT = 8;

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
    peakTopUpUsagePct: number | null;
    peakDate: string;
    durationDays: number;
    daysUsed: number;
    durationLabel: string;
};

function formatPct(value: number, language: string, decimals = 1): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    })}%`;
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
    const duration = payload?.durationLabel ?? "";
    const barEnd = x + width;
    const labelX = Math.max(peakX + 10, barEnd + 8);

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={props.fill ?? CPH.violet}
            />
            {payload != null && pxPerUnit > 0 ? (
                <>
                    <circle
                        cx={peakX}
                        cy={cy}
                        r={5}
                        fill={CPH.ink}
                        stroke={CPH.card}
                        strokeWidth={2}
                    />
                    {duration ? (
                        <text
                            x={labelX}
                            y={cy}
                            dy="0.35em"
                            fill={CPH.ink}
                            fontSize={11}
                            fontVariantNumeric="tabular-nums"
                            stroke={CPH.card}
                            strokeWidth={3}
                            paintOrder="stroke"
                            style={{ paintOrder: "stroke fill" }}
                        >
                            {duration}
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
            color: CPH.teal,
        },
        {
            name: topUpName,
            display: formatPortfolioMoney(row.topUpTotal, currency, language),
            color: CPH.violet,
        },
        {
            name: peakName,
            display: formatPortfolioMoney(row.peakUsage, currency, language),
            color: CPH.ink,
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
    const chartRect = chartEl?.getBoundingClientRect();
    const tooltipWidth = 280;
    const tooltipHeight = 220;
    const rawLeft = (chartRect?.left ?? 0) + (coordinate?.x ?? 0) + 12;
    const rawTop = (chartRect?.top ?? 0) + (coordinate?.y ?? 0) + 12;
    const viewW =
        typeof window === "undefined" ? rawLeft + tooltipWidth : window.innerWidth;
    const viewH =
        typeof window === "undefined" ? rawTop + tooltipHeight : window.innerHeight;
    const left = Math.min(Math.max(8, rawLeft), viewW - tooltipWidth - 8);
    const top = Math.min(Math.max(8, rawTop), viewH - tooltipHeight - 8);

    const node = (
        <div
            dir={isRtl ? "rtl" : "ltr"}
            style={{
                position: "fixed",
                left,
                top,
                zIndex: 1300,
                pointerEvents: "none",
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
    );

    if (typeof document === "undefined") {
        return node;
    }
    return createPortal(node, document.body);
}

function CustomerNameTick(props: {
    x?: number;
    y?: number;
    payload?: { value?: string };
    names: Map<string, string>;
    isRtl: boolean;
}) {
    const x = props.x ?? 0;
    const y = props.y ?? 0;
    const raw = props.payload as { value?: string; rowKey?: string } | undefined;
    const key = String(raw?.value ?? raw?.rowKey ?? "");
    const name = props.names.get(key) ?? key;
    const width = Y_AXIS_WIDTH - 8;
    return (
        <foreignObject
            x={x - width}
            y={y - 10}
            width={width}
            height={20}
        >
            <div
                style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    direction: props.isRtl ? "rtl" : "ltr",
                    textAlign: "right",
                    fontSize: 11.5,
                    lineHeight: "20px",
                    color: CPH.slate,
                }}
            >
                {name}
            </div>
        </foreignObject>
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
                peakTopUpUsagePct: row.peakTopUpUsagePct,
                peakDate: row.peakDate,
                durationDays: row.durationDays,
                daysUsed: row.daysUsed,
                durationLabel: t(
                    "credit_portfolio_health.top_up_draw_duration_short",
                    {
                        ...ns,
                        defaultValue: "{{days}}d",
                        days: row.durationDays,
                    }
                ),
            })),
        [customers, t]
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
                        "Customers with active top-up cover in the range. Each bar is policy limit plus top-up on the peak-usage day; the dot is peak usage (it stays inside the policy bar when they did not draw on top-up). Duration is the longest consecutive streak of days usage exceeded the policy limit.",
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
                    color={CPH.violet}
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
                                    backgroundColor: CPH.teal,
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
                                    backgroundColor: CPH.violet,
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
                                    backgroundColor: CPH.ink,
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
                                    width={Y_AXIS_WIDTH}
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
                                        width={Y_AXIS_WIDTH}
                                        interval={0}
                                        tickMargin={6}
                                        tick={(tickProps) => (
                                            <CustomerNameTick
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
                                        fill={CPH.teal}
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
                                        fill={CPH.violet}
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
