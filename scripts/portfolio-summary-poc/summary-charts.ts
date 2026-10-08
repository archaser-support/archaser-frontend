/**
 * Static inline-SVG versions of the Portfolio Health dashboard charts for the
 * portfolio summary PDF (used by `render-skeleton-pdf.ts`).
 *
 * Recharts 3 renders only an empty wrapper under `renderToStaticMarkup`, so the
 * geometry is drawn here while series derivation, colors and formatters come
 * from the dashboard modules.
 */
import { chartColors } from "@/app/[locale]/app/credit-portfolio-health/chartColors";
import {
    formatChartDayLabel,
    formatChartMonthLabel,
    formatChartPct,
    formatCurrencyCompact,
    formatPct,
} from "@/app/[locale]/app/credit-portfolio-health/chartFormat";
import { CPH } from "@/app/[locale]/app/credit-portfolio-health/designTokens";
import { exposureAtRiskSharePct } from "@/app/[locale]/app/credit-portfolio-health/ExposureTrendLinesChart";
import { SPACE_GROTESK_FONT_FAMILY } from "@/app/[locale]/app/credit-portfolio-health/fontTokens";
import { formatPortfolioAxisMoney } from "@/app/[locale]/app/credit-portfolio-health/formatPortfolioMoney";
import { portfolioHealthChartYMin } from "@/app/[locale]/app/credit-portfolio-health/portfolioHealthBelowThreshold";
import {
    padSeriesByUtcMonth,
    padSeriesByUtcYmd,
} from "@/shared/creditInsurance/portfolioHealthDateRange";
import type {
    PortfolioCostsSection,
    PortfolioHealthSection,
    PortfolioUtilizationDailyPoint,
    PortfolioUtilizationSection,
} from "@/types/creditInsurance";

export type ChartContext = {
    language: string;
    currency: string;
    from: string;
    to: string;
    thresholdPct: number;
    label: (key: string, vars?: Record<string, string | number>) => string;
    pct: (value: number | null | undefined, decimals?: number) => string;
    count: (value: number | null | undefined, decimals?: number) => string;
    date: (ymd: string | null | undefined) => string;
};

const WIDTH = 700;
const AXIS_FONT = 12;
/** Dashboard Recharts time axes run left → right in Hebrew too; keep parity. */
const TIME_AXIS_REVERSED = false;
const HEBREW = /[\u0590-\u05FF]/;

type Anchor = "start" | "middle" | "end";

function esc(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

const n = (value: number) => Number(value.toFixed(2));

/** `anchor` is visual (start = left edge at x); Hebrew text flips it for `direction="rtl"`. */
function text(
    x: number,
    y: number,
    value: string,
    {
        anchor = "start",
        size = AXIS_FONT,
        fill = chartColors.axisText,
        weight,
        halo = false,
    }: {
        anchor?: Anchor;
        size?: number;
        fill?: string;
        weight?: number;
        halo?: boolean;
    } = {}
): string {
    const rtl = HEBREW.test(value);
    const svgAnchor =
        rtl && anchor !== "middle"
            ? anchor === "start"
                ? "end"
                : "start"
            : anchor;
    const attrs = [
        `x="${n(x)}"`,
        `y="${n(y)}"`,
        `dy="0.35em"`,
        `text-anchor="${svgAnchor}"`,
        `direction="${rtl ? "rtl" : "ltr"}"`,
        `font-size="${size}"`,
        `fill="${fill}"`,
        weight ? `font-weight="${weight}"` : "",
        halo
            ? `stroke="${CPH.card}" stroke-width="3" paint-order="stroke"`
            : "",
    ].filter(Boolean);
    return `<text ${attrs.join(" ")}>${esc(value)}</text>`;
}

function hLine(
    x1: number,
    x2: number,
    y: number,
    stroke: string,
    dash?: string,
    width = 1
): string {
    return `<line x1="${n(x1)}" x2="${n(x2)}" y1="${n(y)}" y2="${n(y)}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} />`;
}

function svg(height: number, body: string[]): string {
    return `<svg class="chart-svg" viewBox="0 0 ${WIDTH} ${height}" width="100%" role="img" direction="ltr" xmlns="http://www.w3.org/2000/svg">${body.join("")}</svg>`;
}

/** Recharts-style "nice" ticks from 0 (or `min`) up to at least `max`. */
function niceTicks(min: number, max: number, count = 5): number[] {
    if (!(max > min)) {
        return [min, min + 1];
    }
    const rough = (max - min) / (count - 1);
    const mag = 10 ** Math.floor(Math.log10(rough));
    const norm = rough / mag;
    const step =
        (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) *
        mag;
    const ticks: number[] = [];
    for (let v = min; v < max + step - 1e-9; v += step) {
        ticks.push(Number(v.toPrecision(12)));
    }
    return ticks;
}

type Plot = { left: number; right: number; top: number; bottom: number };

function linearY(plot: Plot, min: number, max: number) {
    return (v: number) =>
        plot.bottom - ((v - min) / (max - min || 1)) * (plot.bottom - plot.top);
}

function bandX(plot: Plot, count: number) {
    const band = (plot.right - plot.left) / Math.max(count, 1);
    return {
        band,
        center: (i: number) =>
            plot.left +
            band * ((TIME_AXIS_REVERSED ? count - 1 - i : i) + 0.5),
    };
}

function yAxis(
    plot: Plot,
    ticks: number[],
    y: (v: number) => number,
    format: (v: number) => string,
    size = AXIS_FONT
): string[] {
    return ticks.flatMap((tick) => [
        hLine(plot.left, plot.right, y(tick), chartColors.grid, "3 3"),
        text(plot.left - 8, y(tick), format(tick), { anchor: "end", size }),
    ]);
}

/** Index ticks like Recharts `preserveStartEnd` with a min label gap. */
function timeTickIndexes(count: number, plotWidth: number, labelWidth: number) {
    if (count <= 1) {
        return count === 1 ? [0] : [];
    }
    const maxTicks = Math.max(2, Math.floor(plotWidth / labelWidth));
    const step = Math.max(1, Math.ceil((count - 1) / (maxTicks - 1)));
    const out: number[] = [];
    for (let i = 0; i < count; i += step) {
        out.push(i);
    }
    const last = count - 1;
    if (out[out.length - 1] !== last) {
        const gapPx = ((last - out[out.length - 1]) / count) * plotWidth;
        if (gapPx < labelWidth) {
            out.pop();
        }
        out.push(last);
    }
    return out;
}

function xAxis(
    plot: Plot,
    labels: string[],
    x: (i: number) => number,
    labelWidth: number,
    size = AXIS_FONT
): string[] {
    return [
        hLine(plot.left, plot.right, plot.bottom, CPH.border),
        ...timeTickIndexes(labels.length, plot.right - plot.left, labelWidth).map(
            (i) => text(x(i), plot.bottom + 14, labels[i], { anchor: "middle", size })
        ),
    ];
}

/** Polyline path split on nulls (`connectNulls={false}`). */
function linePath(points: Array<[number, number] | null>): string {
    let d = "";
    let pen = false;
    for (const point of points) {
        if (point == null) {
            pen = false;
            continue;
        }
        d += `${pen ? "L" : "M"}${n(point[0])},${n(point[1])}`;
        pen = true;
    }
    return d;
}

/** Closed area between `upper` and `lower` per contiguous non-null run. */
function areaPath(
    xs: number[],
    upper: Array<number | null>,
    lower: Array<number | null>
): string {
    let d = "";
    let run: number[] = [];
    const flush = () => {
        if (run.length > 0) {
            d += run
                .map((i, k) => `${k === 0 ? "M" : "L"}${n(xs[i])},${n(upper[i] as number)}`)
                .join("");
            d += [...run]
                .reverse()
                .map((i) => `L${n(xs[i])},${n(lower[i] as number)}`)
                .join("");
            d += "Z";
        }
        run = [];
    };
    xs.forEach((_x, i) => {
        if (upper[i] == null || lower[i] == null) {
            flush();
        } else {
            run.push(i);
        }
    });
    flush();
    return d;
}

function topRoundedBar(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string
): string {
    if (!(w > 0) || !(h > 0)) {
        return "";
    }
    const rr = Math.min(r, w / 2, h);
    return `<path d="M${n(x)},${n(y + h)} V${n(y + rr)} Q${n(x)},${n(y)} ${n(x + rr)},${n(y)} H${n(x + w - rr)} Q${n(x + w)},${n(y)} ${n(x + w)},${n(y + rr)} V${n(y + h)} Z" fill="${fill}" />`;
}

type LegendItem = {
    label: string;
    color: string;
    kind: "square" | "line" | "dashed" | "peak";
};

function legend(items: LegendItem[]): string {
    const swatch = (item: LegendItem) => {
        switch (item.kind) {
            case "square":
                return `<span class="sw-square" style="background:${item.color}"></span>`;
            case "line":
                return `<span class="sw-line" style="border-top-color:${item.color}"></span>`;
            case "dashed":
                return `<span class="sw-line sw-dashed" style="border-top-color:${item.color}"></span>`;
            case "peak":
                return `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">${peakDot(7, 7)}</svg>`;
        }
    };
    return `<ul class="chart-legend">${items
        .map((item) => `<li>${swatch(item)}${esc(item.label)}</li>`)
        .join("")}</ul>`;
}

function card(
    title: string,
    accent: string,
    body: string,
    footnote?: string
): string {
    return `<figure class="chart-card" style="border-inline-start-color:${accent}">
<figcaption>${esc(title)}</figcaption>
${body}${footnote ? `<p class="chart-note">${esc(footnote)}</p>` : ""}
</figure>`;
}

function emptyCard(title: string, accent: string, message: string): string {
    return card(title, accent, `<p class="chart-note">${esc(message)}</p>`);
}

/** Mirrors `PeakDot`: black dot with a white ring. */
function peakDot(cx: number, cy: number): string {
    return `<circle cx="${n(cx)}" cy="${n(cy)}" r="7" fill="${chartColors.marker}" /><circle cx="${n(cx)}" cy="${n(cy)}" r="5.5" fill="none" stroke="${chartColors.markerRing}" stroke-width="2" /><circle cx="${n(cx)}" cy="${n(cy)}" r="3.5" fill="${chartColors.marker}" />`;
}

export function monthlyCostChart(
    section: PortfolioCostsSection,
    ctx: ChartContext
): string {
    const title = ctx.label("monthly_cost_chart_title");
    const rows = padSeriesByUtcMonth(
        section.monthly ?? [],
        ctx.from,
        ctx.to,
        (p) => p.month
    ).map(({ month, point }) => ({
        label: formatChartMonthLabel(month, ctx.language),
        cost: point?.totalCost ?? null,
    }));
    if (rows.length === 0) {
        return "";
    }
    const height = 220;
    const plot: Plot = { left: 8 + 84, right: WIDTH - 10, top: 10, bottom: height - 30 };
    const max = Math.max(0, ...rows.map((r) => r.cost ?? 0));
    const ticks = niceTicks(0, max);
    const y = linearY(plot, 0, ticks[ticks.length - 1]);
    const { band, center } = bandX(plot, rows.length);
    const barW = band * 0.8;
    const body = [
        ...yAxis(plot, ticks, y, (v) =>
            formatPortfolioAxisMoney(v, ctx.currency, ctx.language)
        , 11),
        ...rows.map((row, i) =>
            row.cost == null
                ? ""
                : topRoundedBar(
                      center(i) - barW / 2,
                      y(Math.max(0, row.cost)),
                      barW,
                      plot.bottom - y(Math.max(0, row.cost)),
                      3,
                      chartColors.primary
                  )
        ),
        ...rows.map((row, i) =>
            text(center(i), plot.bottom + 14, row.label, { anchor: "middle" })
        ),
    ];
    return card(title, chartColors.primary, svg(height, body));
}

export function dailyHealthChart(
    section: PortfolioHealthSection,
    ctx: ChartContext
): string {
    const title = ctx.label("daily_health_chart_title");
    const threshold = ctx.thresholdPct;
    const rows = padSeriesByUtcYmd(
        section.dailyA,
        ctx.from,
        ctx.to,
        (p) => p.snapshotDate
    ).map(({ ymd, point }) => ({
        label: formatChartDayLabel(ymd, ctx.language),
        health: point?.healthIndex ?? null,
        stale: Boolean(point?.isStaleCarriedForward),
    }));
    if (rows.length === 0) {
        return emptyCard(title, chartColors.primary, ctx.label("no_chart_data"));
    }
    const average = section.seriesA.averageHealthPct;
    const height = 260;
    const plot: Plot = { left: 40, right: WIDTH - 110, top: 10, bottom: height - 30 };
    const yMin = portfolioHealthChartYMin(
        rows.map((r) => r.health),
        threshold
    );
    const y = linearY(plot, yMin, 100);
    const span = 100 - yMin;
    const step = span > 50 ? 20 : span > 25 ? 10 : 5;
    const ticks: number[] = [];
    for (let v = yMin; v <= 100; v += step) {
        ticks.push(v);
    }
    if (ticks[ticks.length - 1] !== 100) {
        ticks.push(100);
    }
    const { center } = bandX(plot, rows.length);

    let thresholdLabelY = y(threshold);
    let avgLabelY = Number.isFinite(average) ? y(average) : null;
    if (avgLabelY != null && Math.abs(avgLabelY - thresholdLabelY) < 14) {
        const mid = (avgLabelY + thresholdLabelY) / 2;
        const sign = avgLabelY <= thresholdLabelY ? -1 : 1;
        avgLabelY = mid + sign * 7;
        thresholdLabelY = mid - sign * 7;
    }

    const dots = rows.map((row, i) => {
        if (row.health == null) {
            return "";
        }
        const cx = n(center(i));
        const cy = n(y(row.health));
        if (row.health < threshold) {
            return `<circle cx="${cx}" cy="${cy}" r="4" fill="${chartColors.danger}" stroke="${chartColors.markerRing}" stroke-width="1.5" />`;
        }
        if (row.stale) {
            return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${chartColors.markerRing}" stroke="${chartColors.muted}" stroke-width="1.5" />`;
        }
        return "";
    });

    const body = [
        `<rect x="${plot.left}" y="${n(y(threshold))}" width="${plot.right - plot.left}" height="${n(plot.bottom - y(threshold))}" fill="${chartColors.danger}" fill-opacity="0.08" />`,
        ...yAxis(plot, ticks, y, formatPct),
        ...xAxis(plot, rows.map((r) => r.label), center, 64),
        hLine(plot.left, plot.right, y(threshold), chartColors.danger, "6 4", 1.5),
        text(
            plot.right + 5,
            thresholdLabelY,
            ctx.label("chart_threshold_ref", { pct: threshold }),
            { fill: chartColors.danger }
        ),
        ...(avgLabelY != null
            ? [
                  hLine(plot.left, plot.right, y(average), chartColors.reference, "2 3", 1.5),
                  text(
                      plot.right + 5,
                      avgLabelY,
                      ctx.label("chart_avg_health_ref_value", {
                          pct: average.toFixed(1),
                      }),
                      { fill: chartColors.reference }
                  ),
              ]
            : []),
        `<path d="${linePath(
            rows.map((row, i) =>
                row.health == null ? null : [center(i), y(row.health)]
            )
        )}" fill="none" stroke="${chartColors.primary}" stroke-width="2" stroke-linejoin="round" />`,
        ...dots,
    ];
    const showNote = rows.some(
        (r) => r.health != null && (r.stale || r.health < threshold)
    );
    return card(
        title,
        chartColors.primary,
        svg(height, body),
        showNote ? ctx.label("chart_stale_days_note") : undefined
    );
}

export function monthlyExposureChart(
    section: PortfolioHealthSection,
    ctx: ChartContext
): string {
    const title = ctx.label("monthly_chart_title");
    const rows = padSeriesByUtcMonth(
        section.monthlyA,
        ctx.from,
        ctx.to,
        (p) => p.month
    ).map(({ month, point }) => {
        const total = point?.totalReceivables ?? null;
        const atRisk = point?.atRiskExposure ?? null;
        return {
            label: formatChartMonthLabel(month, ctx.language),
            total,
            compliant: point?.compliantExposure ?? null,
            atRisk,
            share: exposureAtRiskSharePct(total, atRisk),
        };
    });
    if (rows.length === 0) {
        return emptyCard(title, chartColors.primary, ctx.label("no_chart_data"));
    }

    const mainHeight = 288;
    const plot: Plot = { left: 8 + 84, right: WIDTH - 12, top: 10, bottom: mainHeight - 30 };
    const max = Math.max(
        0,
        ...rows.map((r) =>
            Math.max(r.total ?? 0, (r.compliant ?? 0) + (r.atRisk ?? 0))
        )
    );
    const ticks = niceTicks(0, max);
    const y = linearY(plot, 0, ticks[ticks.length - 1]);
    const { center } = bandX(plot, rows.length);
    const xs = rows.map((_r, i) => center(i));
    const compliantTop = rows.map((r) => (r.compliant == null ? null : y(r.compliant)));
    const stackTop = rows.map((r) =>
        r.compliant == null || r.atRisk == null ? null : y(r.compliant + r.atRisk)
    );
    const zero = rows.map(() => y(0));
    const labels = rows.map((r) => r.label);

    const main = [
        ...yAxis(plot, ticks, y, (v) => formatCurrencyCompact(v, ctx.currency), 11),
        ...xAxis(plot, labels, center, 40),
        `<path d="${areaPath(xs, compliantTop, zero)}" fill="${chartColors.primary}" fill-opacity="0.15" />`,
        `<path d="${linePath(xs.map((x, i) => (compliantTop[i] == null ? null : [x, compliantTop[i] as number])))}" fill="none" stroke="${chartColors.primary}" stroke-width="1" />`,
        `<path d="${areaPath(xs, stackTop, compliantTop)}" fill="${chartColors.secondary}" fill-opacity="0.35" />`,
        `<path d="${linePath(xs.map((x, i) => (stackTop[i] == null ? null : [x, stackTop[i] as number])))}" fill="none" stroke="${chartColors.secondary}" stroke-width="1" />`,
        `<path d="${linePath(rows.map((r, i) => (r.total == null ? null : [xs[i], y(r.total)])))}" fill="none" stroke="${chartColors.marker}" stroke-width="2" />`,
        ...rows.map((r, i) =>
            r.total == null
                ? ""
                : `<circle cx="${n(xs[i])}" cy="${n(y(r.total))}" r="3" fill="${chartColors.marker}" stroke="${chartColors.markerRing}" stroke-width="1.5" />`
        ),
    ];

    const shareHeight = 120;
    const sharePlot: Plot = { left: 8 + 48, right: WIDTH - 12, top: 18, bottom: shareHeight - 30 };
    const shareTicks = niceTicks(0, Math.max(0, ...rows.map((r) => r.share ?? 0)), 3);
    const sy = linearY(sharePlot, 0, shareTicks[shareTicks.length - 1]);
    const share = bandX(sharePlot, rows.length);
    const shareBarW = share.band * 0.8;
    const companion = [
        ...yAxis(sharePlot, shareTicks, sy, (v) => `${Number(v).toFixed(0)}%`, 11),
        ...xAxis(sharePlot, labels, share.center, 40, 11),
        ...rows.flatMap((r, i) =>
            r.share == null
                ? []
                : [
                      topRoundedBar(
                          share.center(i) - shareBarW / 2,
                          sy(r.share),
                          shareBarW,
                          sharePlot.bottom - sy(r.share),
                          3,
                          chartColors.secondary
                      ),
                      text(share.center(i), sy(r.share) - 8, `${r.share.toFixed(1)}%`, {
                          anchor: "middle",
                          size: 10,
                          fill: chartColors.valueLabel,
                      }),
                  ]
        ),
    ];

    return card(
        title,
        chartColors.primary,
        `${legend([
            { label: ctx.label("chart_series_compliant"), color: chartColors.primary, kind: "square" },
            { label: ctx.label("chart_series_at_risk"), color: chartColors.secondary, kind: "square" },
            { label: ctx.label("chart_series_total_ar"), color: chartColors.marker, kind: "line" },
        ])}${svg(mainHeight, main)}
<div class="chart-subtitle">${esc(ctx.label("chart_at_risk_share"))}</div>
${svg(shareHeight, companion)}`
    );
}

type UtilSeries = {
    key: keyof Pick<
        PortfolioUtilizationDailyPoint,
        | "utilizationPct"
        | "dclUtilizationPct"
        | "namedUtilizationPct"
        | "topUpUtilizationPct"
    >;
    labelKey: string;
    color: string;
    width: number;
    dash?: string;
};

const UTIL_SERIES: UtilSeries[] = [
    { key: "dclUtilizationPct", labelKey: "chart_util_sdl", color: CPH.seriesOrange, width: 2 },
    { key: "namedUtilizationPct", labelKey: "chart_util_issuer", color: CPH.seriesSky, width: 2 },
    { key: "topUpUtilizationPct", labelKey: "chart_util_top_up", color: CPH.seriesRose, width: 2 },
    { key: "utilizationPct", labelKey: "chart_util_portfolio", color: CPH.ink, width: 2.5, dash: "6 4" },
];

export function dailyUtilizationChart(
    section: PortfolioUtilizationSection,
    ctx: ChartContext
): string {
    const title = ctx.label("daily_util_chart_title");
    const rows = padSeriesByUtcYmd(
        section.daily,
        ctx.from,
        ctx.to,
        (p) => p.snapshotDate
    ).map(({ ymd, point }) => ({
        label: formatChartDayLabel(ymd, ctx.language),
        point,
    }));
    const values = rows.flatMap((r) =>
        UTIL_SERIES.map((s) => r.point?.[s.key] ?? null)
    );
    if (!values.some((v) => v != null)) {
        return emptyCard(title, chartColors.primary, ctx.label("no_chart_data"));
    }
    const height = 260;
    const plot: Plot = { left: 40, right: WIDTH - 10, top: 10, bottom: height - 30 };
    const max = Math.max(
        0,
        ...values.filter((v): v is number => v != null && Number.isFinite(v))
    );
    const ticks = niceTicks(0, max);
    const y = linearY(plot, 0, ticks[ticks.length - 1]);
    const { center } = bandX(plot, rows.length);
    const body = [
        ...yAxis(plot, ticks, y, (v) => formatChartPct(v, ctx.language)),
        ...xAxis(plot, rows.map((r) => r.label), center, 64),
        ...UTIL_SERIES.map(
            (s) =>
                `<path d="${linePath(
                    rows.map((r, i) => {
                        const v = r.point?.[s.key];
                        return v == null || !Number.isFinite(v)
                            ? null
                            : [center(i), y(v)];
                    })
                )}" fill="none" stroke="${s.color}" stroke-width="${s.width}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""} stroke-linejoin="round" />`
        ),
    ];
    return card(
        title,
        chartColors.primary,
        `${svg(height, body)}${legend(
            UTIL_SERIES.map((s) => ({
                label: ctx.label(s.labelKey),
                color: s.color,
                kind: s.dash ? "dashed" : "line",
            }))
        )}`
    );
}

/** Same as the dashboard top-up draw chart: peak usage ÷ (policy limit + top-up). */
function peakCoverUsagePct(
    policyLimit: number,
    topUpTotal: number,
    peakUsage: number
): number | null {
    const cover = Math.max(0, policyLimit) + Math.max(0, topUpTotal);
    return cover > 0 ? (Math.max(0, peakUsage) / cover) * 100 : null;
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

const DRAW_ROW_HEIGHT = 36;
const DRAW_NAME_WIDTH = 180;
const DRAW_RIGHT = 72;

export function topUpDrawChart(
    section: PortfolioUtilizationSection,
    ctx: ChartContext
): string {
    const title = ctx.label("top_up_draw_title");
    const draw = section.topUpDraw;
    const peak = portfolioPeakTopUpUsage(section.daily);
    const stat = (value: string, label: string, color: string = CPH.ink) =>
        `<div class="stat"><div class="stat-value" style="color:${color};font-family:${esc(SPACE_GROTESK_FONT_FAMILY)}"><bdi>${esc(value)}</bdi></div><div class="stat-label">${esc(label)}</div></div>`;
    const kpis = `<div class="stat-strip">${[
        stat(ctx.count(draw?.customerCount ?? 0), ctx.label("top_up_draw_customers_used")),
        stat(ctx.count(draw?.averageDurationDays ?? 0, 1), ctx.label("top_up_draw_avg_duration")),
        stat(
            ctx.pct(peak.pct ?? 0),
            peak.date
                ? ctx.label("top_up_draw_portfolio_peak_on", { date: ctx.date(peak.date) })
                : ctx.label("top_up_draw_portfolio_peak"),
            chartColors.secondaryText
        ),
    ].join("")}</div>`;

    const customers = draw?.customers ?? [];
    if (customers.length === 0) {
        return card(
            title,
            chartColors.secondary,
            `${kpis}<p class="chart-note">${esc(ctx.label("top_up_draw_empty"))}</p>`
        );
    }

    const rtl = ctx.language.startsWith("he");
    const ordered = rtl ? [...customers].reverse() : customers;
    const axisHeight = 24;
    const plot: Plot = {
        left: DRAW_NAME_WIDTH + 8,
        right: WIDTH - DRAW_RIGHT,
        top: axisHeight,
        bottom: axisHeight + ordered.length * DRAW_ROW_HEIGHT,
    };
    const peakMax = ordered.reduce(
        (max, r) =>
            Math.max(max, r.policyLimit + r.topUpTotal, r.peakUsageAmount),
        0
    );
    const domainMax = peakMax > 0 ? peakMax * 1.08 : 1;
    const x = (v: number) =>
        plot.left + (Math.max(0, v) / domainMax) * (plot.right - plot.left);
    const ticks = niceTicks(0, domainMax).filter((v) => v <= domainMax);
    const barH = Math.round(DRAW_ROW_HEIGHT * 0.68);
    const r = 3;

    const body: string[] = ticks.map((tick) =>
        text(x(tick), axisHeight / 2, formatPortfolioAxisMoney(tick, ctx.currency, ctx.language), {
            anchor: "middle",
            size: 11,
        })
    );
    for (let i = 1; i < ordered.length; i++) {
        body.push(hLine(plot.left, plot.right, plot.top + i * DRAW_ROW_HEIGHT, CPH.border, "3 6"));
    }
    ordered.forEach((row, i) => {
        const cy = plot.top + (i + 0.5) * DRAW_ROW_HEIGHT;
        const top = cy - barH / 2;
        const x0 = x(0);
        const xPolicy = x(row.policyLimit);
        const xEnd = x(row.policyLimit + row.topUpTotal);
        const policyW = xPolicy - x0;
        if (policyW > 0) {
            const rr = Math.min(r, policyW / 2, barH / 2);
            body.push(
                `<path d="M${n(xPolicy)},${n(top)} H${n(x0 + rr)} Q${n(x0)},${n(top)} ${n(x0)},${n(top + rr)} V${n(top + barH - rr)} Q${n(x0)},${n(top + barH)} ${n(x0 + rr)},${n(top + barH)} H${n(xPolicy)} Z" fill="${chartColors.primary}" />`
            );
        }
        const topUpW = xEnd - xPolicy;
        if (topUpW > 0) {
            const rr = Math.min(r, topUpW / 2, barH / 2);
            body.push(
                `<path d="M${n(xPolicy)},${n(top)} H${n(xEnd - rr)} Q${n(xEnd)},${n(top)} ${n(xEnd)},${n(top + rr)} V${n(top + barH - rr)} Q${n(xEnd)},${n(top + barH)} ${n(xEnd - rr)},${n(top + barH)} H${n(xPolicy)} Z" fill="${chartColors.secondary}" stroke="${chartColors.segmentGap}" stroke-width="2" />`
            );
        }
        const peakX = x(row.peakUsageAmount);
        body.push(peakDot(peakX, cy));
        const pctValue = peakCoverUsagePct(row.policyLimit, row.topUpTotal, row.peakUsageAmount);
        if (pctValue != null) {
            body.push(
                text(Math.max(peakX + 12, xEnd + 8), cy, ctx.pct(pctValue), {
                    size: 11,
                    fill: CPH.ink,
                    halo: true,
                })
            );
        }
        body.push(
            `<foreignObject x="0" y="${n(cy - 10)}" width="${DRAW_NAME_WIDTH}" height="20"><div xmlns="http://www.w3.org/1999/xhtml" class="bar-name" dir="auto" title="${esc(row.customerName)}">${esc(row.customerName)}</div></foreignObject>`
        );
    });

    return card(
        title,
        chartColors.secondary,
        `${kpis}${legend([
            { label: ctx.label("chart_bar_policy_limit"), color: chartColors.primary, kind: "square" },
            { label: ctx.label("chart_bar_top_up"), color: chartColors.secondary, kind: "square" },
            { label: ctx.label("chart_peak_usage"), color: chartColors.marker, kind: "peak" },
        ])}${svg(plot.bottom + 4, body)}`
    );
}

/** CSS for the chart cards — scoped to the generated report HTML only. */
export const CHART_CSS = `
.chart-card { margin: 10px 0 12px; padding: 12px 14px 10px; border: 1px solid ${CPH.border}; border-inline-start: 3px solid ${chartColors.primary}; border-radius: 12px; background: ${CPH.card}; break-inside: avoid; page-break-inside: avoid; }
.chart-card figcaption { font-size: 13px; font-weight: 600; color: ${CPH.ink}; margin-bottom: 6px; }
.chart-subtitle { font-size: 12px; color: ${CPH.slate}; margin: 8px 0 2px; }
.chart-svg { display: block; overflow: visible; font-family: inherit; }
.chart-note { margin: 6px 0 0; font-size: 11px; color: ${CPH.slate}; }
.chart-legend { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-wrap: wrap; gap: 14px; font-size: 11px; color: ${chartColors.axisText}; }
.chart-legend li { display: inline-flex; align-items: center; gap: 6px; }
.sw-square { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.sw-line { width: 14px; height: 0; border-top: 2px solid; display: inline-block; }
.sw-dashed { border-top-style: dashed; }
.stat-strip { display: flex; gap: 28px; margin: 4px 0 10px; }
.stat-value { font-size: 22px; font-weight: 600; letter-spacing: -0.025em; line-height: 1.1; }
.stat-label { margin-top: 2px; font-size: 11px; color: ${CPH.slate}; }
.bar-name { font-size: 11.5px; line-height: 20px; color: ${chartColors.axisText}; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-inline: 4px; }
`;
