"use client";

import { Box } from "@mui/material";
import {
    memo,
    useCallback,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import type { CreditDashboardHistoryPoint } from "@/server/services/creditInsurance/creditDashboardSnapshotService";
import { formatDateForDisplay } from "@/utils/datetimeOperations";

export type TrendLineChartSvgProps = {
    series: CreditDashboardHistoryPoint[];
    colors: readonly [string, string, string];
    seriesLabels: readonly [string, string, string];
    axisColor: string;
    gridColor: string;
    language: string;
    dateLocale: string;
    userTimezone: string;
    isWeekly: boolean;
    displayHeight: number;
    /** Non-zero enables sloped labels in the margin below the plot. */
    xLabelRotationDeg?: number;
};

type TooltipState = {
    index: number;
    anchorX: number;
    anchorY: number;
};

type TooltipPosition = {
    left: number;
    top: number;
};

const TOOLTIP_MARGIN_PX = 6;
/** Slopes date labels down into the margin below the plot (SVG y-down). */
const X_LABEL_SLOPE_DEG = 38;
const X_LABEL_INSET_BELOW_AXIS_PX = 10;

function estimateXLabelFontSize(dailyLabelCount: number): number {
    if (dailyLabelCount > 12) {
        return 9;
    }
    if (dailyLabelCount > 9) {
        return 9.5;
    }
    return 10.5;
}

function slopedLabelWidthPx(
    fontSize: number,
    maxLabelChars = 10
): number {
    return maxLabelChars * fontSize * 0.56;
}

function bottomPadForSlopedLabels(
    fontSize: number,
    slopeDeg: number,
    maxLabelChars = 10
): number {
    const angleRad = (slopeDeg * Math.PI) / 180;
    const labelWidth = slopedLabelWidthPx(fontSize, maxLabelChars);
    const verticalSpan =
        Math.sin(angleRad) * labelWidth + fontSize * 1.15;
    return Math.ceil(verticalSpan + X_LABEL_INSET_BELOW_AXIS_PX + 8);
}

/** Horizontal run of sloped labels (start-anchored) beyond the first/last tick. */
function horizontalPadForSlopedLabels(
    fontSize: number,
    slopeDeg: number,
    maxLabelChars = 11
): number {
    const angleRad = (slopeDeg * Math.PI) / 180;
    const labelWidth = slopedLabelWidthPx(fontSize, maxLabelChars);
    const horizontalRun = Math.cos(angleRad) * labelWidth;
    return Math.max(16, Math.ceil(horizontalRun + 16));
}

function fmtInteger(value: number, language: string): string {
    return Math.round(Number(value)).toLocaleString(
        language === "he" ? "he-IL" : "en-US"
    );
}

function parseSnapshotDate(snapshotDate: string): Date {
    return new Date(`${snapshotDate}T12:00:00.000Z`);
}

function sortSeries(
    series: CreditDashboardHistoryPoint[]
): CreditDashboardHistoryPoint[] {
    return [...series].sort((a, b) =>
        a.snapshotDate.localeCompare(b.snapshotDate)
    );
}

function niceStep(span: number): number {
    if (span <= 0 || !Number.isFinite(span)) {
        return 1;
    }
    const magnitude = 10 ** Math.floor(Math.log10(span));
    const normalized = span / magnitude;
    if (normalized <= 1) {
        return magnitude;
    }
    if (normalized <= 2) {
        return 2 * magnitude;
    }
    if (normalized <= 5) {
        return 5 * magnitude;
    }
    return 10 * magnitude;
}

function niceYAxis(
    rawMin: number,
    rawMax: number,
    tickCount = 5
): { yMin: number; yMax: number; ticks: number[] } {
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
        return { yMin: 0, yMax: 100, ticks: [0, 25, 50, 75, 100] };
    }
    let min = rawMin;
    let max = rawMax;
    if (min === max) {
        const pad = Math.max(Math.abs(max) * 0.1, 1);
        min -= pad;
        max += pad;
    }
    const span = max - min;
    const step = niceStep(span / Math.max(tickCount - 1, 1));
    const yMin = Math.max(0, Math.floor(min / step) * step);
    const yMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax + step * 0.001; v += step) {
        ticks.push(v);
        if (ticks.length > tickCount + 2) {
            break;
        }
    }
    if (ticks.length < 2) {
        ticks.push(yMax);
    }
    return { yMin, yMax, ticks };
}

function computeYBounds(series: CreditDashboardHistoryPoint[]): {
    rawMin: number;
    rawMax: number;
} {
    if (series.length === 0) {
        return { rawMin: 0, rawMax: 100 };
    }
    let rawMin = Infinity;
    let rawMax = -Infinity;
    for (const p of series) {
        rawMin = Math.min(
            rawMin,
            p.totalReceivables,
            p.compliantExposure,
            p.atRiskExposure
        );
        rawMax = Math.max(
            rawMax,
            p.totalReceivables,
            p.compliantExposure,
            p.atRiskExposure
        );
    }
    if (!Number.isFinite(rawMin)) {
        rawMin = 0;
    }
    if (!Number.isFinite(rawMax)) {
        rawMax = 0;
    }
    const span = rawMax - rawMin;
    const pad = span > 0 ? span * 0.06 : Math.max(Math.abs(rawMax) * 0.08, 1);
    return {
        rawMin: Math.max(0, rawMin - pad),
        rawMax: rawMax + pad,
    };
}

function xLabelIndices(count: number, isWeekly: boolean): number[] {
    if (count === 0) {
        return [];
    }
    if (!isWeekly) {
        return Array.from({ length: count }, (_, i) => i);
    }
    if (count <= 8) {
        return Array.from({ length: count }, (_, i) => i);
    }
    const target = 6;
    const last = count - 1;
    const indices = new Set<number>([0, last]);
    const step = last / (target - 1);
    for (let k = 1; k < target - 1; k++) {
        indices.add(Math.round(k * step));
    }
    return Array.from(indices).sort((a, b) => a - b);
}

function formatChartDate(
    snapshotDate: string,
    dateLocale: string,
    userTimezone: string,
    isWeekly: boolean
): string {
    const date = parseSnapshotDate(snapshotDate);
    /** Weekly axis uses calendar dates only — avoid TZ shifting 17.05 → 18.05. */
    if (isWeekly) {
        return formatDateForDisplay(date, "date", dateLocale, "UTC");
    }
    return formatDateForDisplay(date, "date", dateLocale, userTimezone);
}

function nearestPointIndex(
    x: number,
    n: number,
    xAt: (index: number) => number
): number {
    if (n <= 1) {
        return 0;
    }
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
        const dist = Math.abs(xAt(i) - x);
        if (dist < minDist) {
            minDist = dist;
            nearest = i;
        }
    }
    return nearest;
}

function TrendLineChartSvgInner({
    series,
    colors,
    seriesLabels,
    axisColor,
    gridColor,
    language,
    dateLocale,
    userTimezone,
    isWeekly,
    displayHeight,
    xLabelRotationDeg = 0,
}: TrendLineChartSvgProps) {
    const plotClipId = useId().replace(/:/g, "");
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [plotWidth, setPlotWidth] = useState(0);
    const [tooltip, setTooltip] = useState<TooltipState | null>(null);
    const [tooltipPos, setTooltipPos] = useState<TooltipPosition | null>(null);

    const isHebrew = language === "he";

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) {
            return;
        }
        const measure = () => {
            const w = Math.floor(el.getBoundingClientRect().width);
            if (w > 0) {
                setPlotWidth((prev) => (prev === w ? prev : w));
            }
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const viewW = plotWidth > 0 ? plotWidth : 800;
    const viewH = displayHeight;

    const hasRotatedXLabels = xLabelRotationDeg !== 0;

    const pad = useMemo(() => {
        const top = Math.round(viewH * 0.08);
        const dailyCount = !isWeekly ? series.length : 0;
        const xFont = estimateXLabelFontSize(dailyCount);
        const bottom = hasRotatedXLabels
            ? bottomPadForSlopedLabels(xFont, X_LABEL_SLOPE_DEG)
            : Math.round(viewH * 0.26);
        const xMargin = hasRotatedXLabels
            ? horizontalPadForSlopedLabels(xFont, X_LABEL_SLOPE_DEG)
            : null;
        return {
            top,
            right: xMargin ?? 12,
            bottom,
            left: xMargin != null ? Math.max(58, xMargin) : 58,
        };
    }, [hasRotatedXLabels, isWeekly, series.length, viewH]);

    const model = useMemo(() => {
        const sorted = sortSeries(series);
        const { rawMin, rawMax } = computeYBounds(sorted);
        const { yMin, yMax, ticks: yTickValues } = niceYAxis(rawMin, rawMax, 5);
        const n = sorted.length;
        const plotW = viewW - pad.left - pad.right;
        const plotH = viewH - pad.top - pad.bottom;
        const xSpan = Math.max(n - 1, 1);

        const xAt = (index: number) => pad.left + (index / xSpan) * plotW;
        const yAt = (value: number) => {
            const t = yMax === yMin ? 0 : (value - yMin) / (yMax - yMin);
            return pad.top + plotH - t * plotH;
        };

        const toPath = (pick: (p: CreditDashboardHistoryPoint) => number) => {
            if (n === 0) {
                return "";
            }
            return sorted
                .map((p, i) => {
                    const cmd = i === 0 ? "M" : "L";
                    return `${cmd}${xAt(i).toFixed(2)},${yAt(pick(p)).toFixed(2)}`;
                })
                .join(" ");
        };

        const labelIndices = xLabelIndices(n, isWeekly);
        const axisY = pad.top + plotH;
        const xLabelAnchorY = hasRotatedXLabels
            ? axisY + X_LABEL_INSET_BELOW_AXIS_PX
            : viewH - pad.bottom * 0.45;

        return {
            sorted,
            n,
            plotW,
            plotH,
            axisY,
            xLabelAnchorY,
            paths: {
                compliant: toPath((p) => p.compliantExposure),
                atRisk: toPath((p) => p.atRiskExposure),
                receivables: toPath((p) => p.totalReceivables),
            },
            yTickValues,
            xAt,
            yAt,
            labelIndices,
            dailyLabelCount: !isWeekly ? n : 0,
        };
    }, [hasRotatedXLabels, isWeekly, pad, series, viewH, viewW]);

    const clearTooltip = useCallback(() => {
        setTooltip(null);
        setTooltipPos(null);
    }, []);

    const updateTooltipFromEvent = useCallback(
        (clientX: number) => {
            const svg = svgRef.current;
            const container = containerRef.current;
            if (!svg || !container || model.n === 0) {
                return;
            }
            const svgRect = svg.getBoundingClientRect();
            const x = ((clientX - svgRect.left) / svgRect.width) * viewW;
            const index = nearestPointIndex(x, model.n, model.xAt);
            const p = model.sorted[index];
            if (!p) {
                return;
            }
            const pointX = (model.xAt(index) / viewW) * svgRect.width;
            const pointY =
                (Math.min(
                    model.yAt(p.totalReceivables),
                    model.yAt(p.compliantExposure),
                    model.yAt(p.atRiskExposure)
                ) /
                    viewH) *
                svgRect.height;
            setTooltip({
                index,
                anchorX: pointX,
                anchorY: pointY,
            });
        },
        [model, viewH, viewW]
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent<SVGSVGElement>) => {
            updateTooltipFromEvent(e.clientX);
        },
        [updateTooltipFromEvent]
    );

    const tooltipContent = useMemo(() => {
        if (tooltip == null) {
            return null;
        }
        const p = model.sorted[tooltip.index];
        if (!p) {
            return null;
        }
        const dateLabel = formatChartDate(
            p.snapshotDate,
            dateLocale,
            userTimezone,
            isWeekly
        );
        const rows: Array<{ label: string; color: string; value: number }> = [
            {
                label: seriesLabels[0],
                color: colors[0],
                value: p.totalReceivables,
            },
            {
                label: seriesLabels[1],
                color: colors[1],
                value: p.compliantExposure,
            },
            {
                label: seriesLabels[2],
                color: colors[2],
                value: p.atRiskExposure,
            },
        ];
        return { dateLabel, rows };
    }, [
        colors,
        dateLocale,
        model.sorted,
        seriesLabels,
        tooltip,
        userTimezone,
    ]);

    useLayoutEffect(() => {
        if (tooltip == null || !tooltipRef.current || !containerRef.current) {
            setTooltipPos(null);
            return;
        }
        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        const tipW = tooltipRef.current.offsetWidth;
        const tipH = tooltipRef.current.offsetHeight;
        const margin = TOOLTIP_MARGIN_PX;

        let left = tooltip.anchorX - tipW / 2;
        left = Math.max(margin, Math.min(left, containerW - tipW - margin));

        let top = tooltip.anchorY - tipH - margin;
        if (top < margin) {
            top = Math.min(
                tooltip.anchorY + margin + 8,
                containerH - tipH - margin
            );
        }
        top = Math.max(margin, Math.min(top, containerH - tipH - margin));

        setTooltipPos({ left, top });
    }, [tooltip, tooltipContent, plotWidth, displayHeight]);

    if (model.sorted.length === 0) {
        return null;
    }

    const activeIndex = tooltip?.index ?? null;
    const xFontSize = hasRotatedXLabels
        ? model.dailyLabelCount > 12
            ? 9
            : model.dailyLabelCount > 9
              ? 9.5
              : 10.5
        : model.dailyLabelCount > 12
          ? 7.5
          : model.dailyLabelCount > 9
            ? 8
            : model.dailyLabelCount > 7
              ? 8.5
              : 10;

    const hitBandWidth =
        model.n > 1 ? model.plotW / (model.n - 1) : model.plotW;

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                height: displayHeight,
                minHeight: displayHeight,
                maxHeight: displayHeight,
                overflow: "hidden",
                direction: "ltr",
            }}
            onMouseLeave={clearTooltip}
        >
            {plotWidth > 0 ? (
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${viewW} ${viewH}`}
                    width={viewW}
                    height={viewH}
                    role="img"
                    aria-hidden
                    style={{
                        display: "block",
                        width: "100%",
                        height: displayHeight,
                        overflow: "hidden",
                        cursor: "crosshair",
                    }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={clearTooltip}
                >
                    <defs>
                        <clipPath id={plotClipId}>
                            <rect
                                x={pad.left}
                                y={pad.top}
                                width={model.plotW}
                                height={model.plotH}
                            />
                        </clipPath>
                    </defs>

                    {model.yTickValues.map((tick) => {
                        const y = model.yAt(tick);
                        return (
                            <g key={`grid-${tick}`}>
                                <line
                                    x1={pad.left}
                                    y1={y}
                                    x2={viewW - pad.right}
                                    y2={y}
                                    stroke={gridColor}
                                    strokeWidth={1}
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={pad.left - 8}
                                    y={y + 4}
                                    textAnchor="end"
                                    fill={axisColor}
                                    fontSize={11}
                                    fontFamily="inherit"
                                >
                                    {fmtInteger(tick, language)}
                                </text>
                            </g>
                        );
                    })}

                    {hasRotatedXLabels ? (
                        <line
                            x1={pad.left}
                            y1={model.axisY}
                            x2={viewW - pad.right}
                            y2={model.axisY}
                            stroke={gridColor}
                            strokeWidth={1}
                            pointerEvents="none"
                        />
                    ) : null}

                    <g clipPath={`url(#${plotClipId})`}>
                        {activeIndex != null ? (
                            <line
                                x1={model.xAt(activeIndex)}
                                y1={pad.top}
                                x2={model.xAt(activeIndex)}
                                y2={model.axisY}
                                stroke={axisColor}
                                strokeWidth={1}
                                strokeDasharray="3 3"
                                opacity={0.45}
                                pointerEvents="none"
                            />
                        ) : null}

                        <path
                            d={model.paths.compliant}
                            fill="none"
                            stroke={colors[1]}
                            strokeWidth={2}
                            pointerEvents="none"
                        />
                        <path
                            d={model.paths.atRisk}
                            fill="none"
                            stroke={colors[2]}
                            strokeWidth={2}
                            pointerEvents="none"
                        />
                        <path
                            d={model.paths.receivables}
                            fill="none"
                            stroke={colors[0]}
                            strokeWidth={2.5}
                            pointerEvents="none"
                        />

                        {model.sorted.map((p, i) => (
                            <rect
                                key={`hit-${p.snapshotDate}-${i}`}
                                x={model.xAt(i) - hitBandWidth / 2}
                                y={pad.top}
                                width={hitBandWidth}
                                height={model.plotH}
                                fill="transparent"
                            />
                        ))}

                        {model.sorted.map((p, i) => {
                            const x = model.xAt(i);
                            const isActive = activeIndex === i;
                            const seriesValues: Array<{ v: number; s: number }> =
                                [
                                    { v: p.totalReceivables, s: 0 },
                                    { v: p.compliantExposure, s: 1 },
                                    { v: p.atRiskExposure, s: 2 },
                                ];
                            return seriesValues.map(({ v, s }) => (
                                <circle
                                    key={`${p.snapshotDate}-${i}-${s}`}
                                    cx={x}
                                    cy={model.yAt(v)}
                                    r={
                                        isActive
                                            ? s === 0
                                                ? 5
                                                : 4.5
                                            : s === 0
                                              ? 3.5
                                              : 3
                                    }
                                    fill={colors[s]}
                                    stroke="#fff"
                                    strokeWidth={1.25}
                                    pointerEvents="none"
                                />
                            ));
                        })}
                    </g>

                    {model.labelIndices.map((i) => {
                        const p = model.sorted[i];
                        if (!p) {
                            return null;
                        }
                        const x = model.xAt(i);
                        const label = formatChartDate(
                            p.snapshotDate,
                            dateLocale,
                            userTimezone,
                            isWeekly
                        );
                        const anchorY = model.xLabelAnchorY;
                        return (
                            <text
                                key={`${p.snapshotDate}-${i}`}
                                x={x}
                                y={anchorY}
                                textAnchor={
                                    hasRotatedXLabels ? "start" : "middle"
                                }
                                transform={
                                    hasRotatedXLabels
                                        ? `rotate(${X_LABEL_SLOPE_DEG} ${x} ${anchorY})`
                                        : undefined
                                }
                                fill={axisColor}
                                fontSize={xFontSize}
                                fontFamily="inherit"
                                dominantBaseline={
                                    hasRotatedXLabels ? "hanging" : "middle"
                                }
                                pointerEvents="none"
                            >
                                {label}
                            </text>
                        );
                    })}
                </svg>
            ) : null}

            {tooltip != null && tooltipContent ? (
                <Box
                    ref={tooltipRef}
                    sx={{
                        position: "absolute",
                        left: tooltipPos?.left ?? -9999,
                        top: tooltipPos?.top ?? -9999,
                        visibility: tooltipPos ? "visible" : "hidden",
                        zIndex: 10,
                        pointerEvents: "none",
                        bgcolor: "#fff",
                        border: "1px solid #DCE3EB",
                        borderRadius: "4px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        px: 0.75,
                        py: 0.625,
                        width: "max-content",
                        maxWidth: `calc(100% - ${TOOLTIP_MARGIN_PX * 2}px)`,
                        direction: isHebrew ? "rtl" : "ltr",
                        fontSize: "0.6875rem",
                        lineHeight: 1.3,
                    }}
                >
                    <Box
                        component="div"
                        sx={{
                            fontWeight: 700,
                            fontSize: "0.6875rem",
                            color: "#2F3B52",
                            borderBottom: "1px solid #DCE3EB",
                            pb: 0.375,
                            mb: 0.375,
                            textAlign: isHebrew ? "right" : "left",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {tooltipContent.dateLabel}
                    </Box>
                    {tooltipContent.rows.map((row) => (
                        <Box
                            key={row.label}
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 0.75,
                                mb: 0.125,
                                minWidth: 0,
                            }}
                        >
                            <Box
                                component="span"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "0.625rem",
                                    color: "#2F3B52",
                                    textAlign: isHebrew ? "right" : "left",
                                    flex: 1,
                                    minWidth: 0,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {row.label}
                            </Box>
                            <Box
                                component="span"
                                sx={{
                                    fontWeight: 500,
                                    fontSize: "0.625rem",
                                    color: row.color,
                                    direction: "ltr",
                                    flexShrink: 0,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {fmtInteger(row.value, language)}
                            </Box>
                        </Box>
                    ))}
                </Box>
            ) : null}
        </div>
    );
}

export const TrendLineChartSvg = memo(
    TrendLineChartSvgInner,
    (prev, next) =>
        prev.series === next.series &&
        prev.isWeekly === next.isWeekly &&
        prev.displayHeight === next.displayHeight &&
        prev.xLabelRotationDeg === next.xLabelRotationDeg &&
        prev.colors[0] === next.colors[0] &&
        prev.colors[1] === next.colors[1] &&
        prev.colors[2] === next.colors[2] &&
        prev.seriesLabels[0] === next.seriesLabels[0] &&
        prev.seriesLabels[1] === next.seriesLabels[1] &&
        prev.seriesLabels[2] === next.seriesLabels[2] &&
        prev.axisColor === next.axisColor &&
        prev.gridColor === next.gridColor &&
        prev.language === next.language &&
        prev.dateLocale === next.dateLocale &&
        prev.userTimezone === next.userTimezone
);
