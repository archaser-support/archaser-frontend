"use client";

import type { ReactNode } from "react";

import { StatNumber } from "./StatNumber";
import { CPH } from "./designTokens";

export type BigNumberProps = {
    value: number;
    decimals?: number;
    suffix?: string;
    prefix?: string;
    label?: string;
    sub?: ReactNode;
    color?: string;
    locale?: string;
};

export function BigNumber({
    value,
    decimals = 1,
    suffix = "%",
    prefix = "",
    label,
    sub,
    color = CPH.ink,
    locale = "en",
}: BigNumberProps) {
    return (
        <div>
            <div
                style={{
                    color,
                    fontSize: 30,
                    fontWeight: 600,
                    letterSpacing: "-0.025em",
                    lineHeight: 1,
                }}
            >
                <StatNumber
                    value={value}
                    decimals={decimals}
                    suffix={suffix}
                    prefix={prefix}
                    locale={locale}
                    color={color}
                />
            </div>
            {label ? (
                <div
                    style={{
                        marginTop: 4,
                        fontSize: 14,
                        color: CPH.slate,
                    }}
                >
                    {label}
                </div>
            ) : null}
            {sub ? (
                <div
                    style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: CPH.muted,
                    }}
                >
                    {sub}
                </div>
            ) : null}
        </div>
    );
}
