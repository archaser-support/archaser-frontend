"use client";

import { useEffect, useState } from "react";

import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import { CPH } from "./designTokens";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export type CoverageHaloProps = {
    /** Average health percentage (0–100+). */
    valuePct: number;
    label: string;
    locale?: string;
    size?: number;
};

function clampPct(value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        return 0;
    }
    return Math.min(100, value);
}

function formatPct(value: number, language: string): string {
    const locale = language.startsWith("he") ? "he-IL" : "en-US";
    return `${value.toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })}%`;
}

export function CoverageHalo({
    valuePct,
    label,
    locale = "en",
    size = 148,
}: CoverageHaloProps) {
    const prefersReducedMotion = usePrefersReducedMotion();
    const stroke = 12;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const target = clampPct(valuePct);
    const [mounted, setMounted] = useState(prefersReducedMotion);

    useEffect(() => {
        if (prefersReducedMotion) {
            setMounted(true);
            return;
        }
        setMounted(false);
        const timer = window.setTimeout(() => setMounted(true), 120);
        return () => window.clearTimeout(timer);
    }, [target, prefersReducedMotion]);

    const offset =
        circumference - ((mounted ? target : 0) / 100) * circumference;

    return (
        <div
            style={{
                position: "relative",
                width: size,
                height: size,
                flexShrink: 0,
            }}
            role="img"
            aria-label={`${label}: ${formatPct(valuePct, locale)}`}
        >
            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                style={{
                    display: "block",
                    transform: "rotate(-90deg)",
                }}
            >
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={CPH.border}
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={CPH.jade}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        transition: prefersReducedMotion
                            ? undefined
                            : "stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)",
                    }}
                />
            </svg>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    textAlign: "center",
                    padding: 12,
                }}
            >
                <span
                    style={{
                        fontFamily: SPACE_GROTESK_FONT_FAMILY,
                        color: CPH.ink,
                        fontSize: "2rem",
                        fontWeight: 600,
                        lineHeight: 1,
                        letterSpacing: "-0.02em",
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {formatPct(valuePct, locale)}
                </span>
            </div>
        </div>
    );
}
