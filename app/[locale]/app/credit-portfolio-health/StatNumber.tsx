"use client";

import { useEffect, useRef, useState } from "react";

import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import { CPH } from "./designTokens";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type StatNumberProps = {
    value: number;
    decimals?: number;
    suffix?: string;
    prefix?: string;
    locale?: string;
    className?: string;
    color?: string;
};

const DURATION_MS = 1100;

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

function formatValue(
    value: number,
    decimals: number,
    language: string
): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return value.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function StatNumber({
    value,
    decimals = 1,
    suffix = "",
    prefix = "",
    locale = "en",
    className = "",
    color = CPH.ink,
}: StatNumberProps) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const [display, setDisplay] = useState(() =>
        prefersReducedMotion ? value : 0
    );
    const frameRef = useRef<number | null>(null);
    const fromRef = useRef(0);

    useEffect(() => {
        if (prefersReducedMotion) {
            setDisplay(value);
            return;
        }

        const from = fromRef.current;
        const start = performance.now();

        const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / DURATION_MS);
            const next = from + (value - from) * easeOutCubic(progress);
            setDisplay(next);
            if (progress < 1) {
                frameRef.current = requestAnimationFrame(tick);
            } else {
                fromRef.current = value;
            }
        };

        frameRef.current = requestAnimationFrame(tick);
        return () => {
            if (frameRef.current != null) {
                cancelAnimationFrame(frameRef.current);
            }
            fromRef.current = value;
        };
    }, [value, prefersReducedMotion]);

    return (
        <span
            className={`tabular-nums tracking-tight ${className}`}
            style={{
                fontFamily: SPACE_GROTESK_FONT_FAMILY,
                color,
            }}
        >
            {prefix}
            {formatValue(display, decimals, locale)}
            {suffix}
        </span>
    );
}
