"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { PortfolioHealthDailyPoint } from "@/types/creditInsurance";

import {
    PORTFOLIO_HEALTH_BELOW_THRESHOLD_DEFAULT,
    clampPortfolioHealthBelowThreshold,
    computePctDaysBelowThreshold,
    readPortfolioHealthBelowThreshold,
    writePortfolioHealthBelowThreshold,
} from "./portfolioHealthBelowThreshold";

export function usePortfolioHealthBelowThreshold(
    daily: PortfolioHealthDailyPoint[]
): {
    thresholdPct: number;
    setThresholdPct: (value: number) => void;
    pctDaysBelow: number;
} {
    const [thresholdPct, setThresholdPctState] = useState(
        PORTFOLIO_HEALTH_BELOW_THRESHOLD_DEFAULT
    );

    useEffect(() => {
        setThresholdPctState(readPortfolioHealthBelowThreshold());
    }, []);

    const setThresholdPct = useCallback((value: number) => {
        const next = clampPortfolioHealthBelowThreshold(value);
        setThresholdPctState(next);
        writePortfolioHealthBelowThreshold(next);
    }, []);

    const pctDaysBelow = useMemo(
        () => computePctDaysBelowThreshold(daily, thresholdPct),
        [daily, thresholdPct]
    );

    return { thresholdPct, setThresholdPct, pctDaysBelow };
}
