import type { CustomerPolicyCustomerTrendLatestPoint, CustomerPolicyCustomerTrendPoint } from "@/types/creditInsurance";
import { currencies } from "@/shared/data/common/currencies";
import { formatAmountWithoutSymbol } from "@/utils/stringFormatters";

export type DailyCostChangeKpiSource = Pick<
    CustomerPolicyCustomerTrendLatestPoint,
    | "totalDailyCostChange"
    | "policyDailyCostChange"
    | "topUpDailyCostChange"
    | "policyCostCurrency"
    | "topUpCostCurrency"
    | "priorSnapshotDate"
>;

export type DailyCostChangeChartPoint = {
    snapshotDate: string;
    policyDailyCostChange: number | null;
    topUpDailyCostChange: number | null;
    totalDailyCostChange: number | null;
};

export type DailyCostChangeKpiDisplay = {
    primaryValue: string;
    breakdownLine: string | null;
    subtitleDate: string | null;
    isConfigured: boolean;
};

function getCurrencySymbol(currencyCode: string): string {
    const currency = currencies.find((c) => c.code === currencyCode);
    return currency?.symbol || currencyCode;
}

export function normalizeUtcDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
}

export function resolveCalendarYesterdayUtc(todayUtc = new Date()): string {
    const today = new Date(
        Date.UTC(
            todayUtc.getUTCFullYear(),
            todayUtc.getUTCMonth(),
            todayUtc.getUTCDate()
        )
    );
    today.setUTCDate(today.getUTCDate() - 1);
    return normalizeUtcDateString(today);
}

export function resolveTotalCostChangeCurrency(
    source: Pick<
        DailyCostChangeKpiSource,
        "policyCostCurrency" | "topUpCostCurrency"
    >
): string | null {
    const policy = source.policyCostCurrency?.trim() || null;
    const topUp = source.topUpCostCurrency?.trim() || null;
    if (policy && topUp) {
        return policy === topUp ? policy : policy;
    }
    return policy ?? topUp;
}

export function formatSignedCostChangeAmount(
    amount: number | null | undefined,
    currency: string | null | undefined,
    locale: string,
    isRtl: boolean
): string {
    if (amount == null || !Number.isFinite(amount)) {
        return "â€”";
    }
    const absolute = formatAmountWithoutSymbol(Math.abs(amount), locale);
    const code = currency?.trim();
    if (!code) {
        if (amount > 0) {
            return `+${absolute}`;
        }
        if (amount < 0) {
            return `-${absolute}`;
        }
        return absolute;
    }
    const symbol = getCurrencySymbol(code);
    if (isRtl) {
        if (amount > 0) {
            return `+${absolute} ${symbol}`;
        }
        if (amount < 0) {
            return `-${absolute} ${symbol}`;
        }
        return `${absolute} ${symbol}`;
    }
    if (amount > 0) {
        return `+${symbol}${absolute}`;
    }
    if (amount < 0) {
        return `-${symbol}${absolute}`;
    }
    return `${symbol}${absolute}`;
}

export function resolveDailyCostChangeSubtitle(args: {
    priorSnapshotDate: string | null | undefined;
    todayUtc?: Date;
    formatDate: (isoDate: string) => string;
}): string | null {
    const prior = args.priorSnapshotDate?.trim();
    if (!prior) {
        return null;
    }
    const yesterday = resolveCalendarYesterdayUtc(args.todayUtc);
    if (prior === yesterday) {
        return null;
    }
    return args.formatDate(prior);
}

export function buildDailyCostChangeBreakdownLine(args: {
    policyDailyCostChange: number | null;
    topUpDailyCostChange: number | null;
    policyCostCurrency: string | null;
    topUpCostCurrency: string | null;
    locale: string;
    isRtl: boolean;
    policyLabel: string;
    topUpLabel: string;
}): string | null {
    const parts: string[] = [];

    if (
        args.policyDailyCostChange != null &&
        Number.isFinite(args.policyDailyCostChange)
    ) {
        parts.push(
            `${args.policyLabel}: ${formatSignedCostChangeAmount(
                args.policyDailyCostChange,
                args.policyCostCurrency,
                args.locale,
                args.isRtl
            )}`
        );
    }

    if (
        args.topUpDailyCostChange != null &&
        Number.isFinite(args.topUpDailyCostChange)
    ) {
        parts.push(
            `${args.topUpLabel}: ${formatSignedCostChangeAmount(
                args.topUpDailyCostChange,
                args.topUpCostCurrency,
                args.locale,
                args.isRtl
            )}`
        );
    }

    return parts.length > 0 ? parts.join(" Â· ") : null;
}

export function buildDailyCostChangeKpiDisplay(args: {
    latest: DailyCostChangeKpiSource | null | undefined;
    locale: string;
    isRtl: boolean;
    policyLabel: string;
    topUpLabel: string;
    notConfiguredLabel: string;
    formatPriorDate?: (isoDate: string) => string;
    todayUtc?: Date;
}): DailyCostChangeKpiDisplay {
    if (!args.latest) {
        return {
            primaryValue: args.notConfiguredLabel,
            breakdownLine: null,
            subtitleDate: null,
            isConfigured: false,
        };
    }

    const total = args.latest.totalDailyCostChange;
    const isConfigured =
        total != null ||
        args.latest.policyDailyCostChange != null ||
        args.latest.topUpDailyCostChange != null;

    if (!isConfigured) {
        return {
            primaryValue: args.notConfiguredLabel,
            breakdownLine: null,
            subtitleDate: null,
            isConfigured: false,
        };
    }

    const primaryValue = formatSignedCostChangeAmount(
        total,
        resolveTotalCostChangeCurrency(args.latest),
        args.locale,
        args.isRtl
    );

    const breakdownLine = buildDailyCostChangeBreakdownLine({
        policyDailyCostChange: args.latest.policyDailyCostChange,
        topUpDailyCostChange: args.latest.topUpDailyCostChange,
        policyCostCurrency: args.latest.policyCostCurrency,
        topUpCostCurrency: args.latest.topUpCostCurrency,
        locale: args.locale,
        isRtl: args.isRtl,
        policyLabel: args.policyLabel,
        topUpLabel: args.topUpLabel,
    });

    const priorDate = resolveDailyCostChangeSubtitle({
        priorSnapshotDate: args.latest.priorSnapshotDate,
        todayUtc: args.todayUtc,
        formatDate:
            args.formatPriorDate ??
            ((isoDate) => isoDate),
    });

    return {
        primaryValue,
        breakdownLine,
        subtitleDate: priorDate,
        isConfigured: true,
    };
}

export function mapTrendPointsToDailyCostChartSeries(
    points: CustomerPolicyCustomerTrendPoint[]
): DailyCostChangeChartPoint[] {
    return points.map((point) => ({
        snapshotDate: point.snapshotDate,
        policyDailyCostChange: point.policyDailyCostChange,
        topUpDailyCostChange: point.topUpDailyCostChange,
        totalDailyCostChange: point.totalDailyCostChange,
    }));
}

export function isDailyCostChangeChartEmpty(
    points: DailyCostChangeChartPoint[]
): boolean {
    if (points.length === 0) {
        return true;
    }
    return points.every(
        (point) =>
            point.policyDailyCostChange == null &&
            point.topUpDailyCostChange == null &&
            point.totalDailyCostChange == null
    );
}

export function buildDailyCostChangeChartSeries(points: DailyCostChangeChartPoint[]) {
    const categories = points.map((point) => point.snapshotDate);
    const policySeries = points.map((point) => point.policyDailyCostChange);
    const topUpSeries = points.map((point) => point.topUpDailyCostChange);
    const totalSeries = points.map((point) => point.totalDailyCostChange);
    const showTotal = totalSeries.some((value) => value != null);

    return {
        categories,
        policySeries,
        topUpSeries,
        totalSeries,
        showTotal,
        hasData: categories.length > 0,
    };
}
