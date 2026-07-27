"use client";

import { CPH } from "./designTokens";

type TooltipPayloadItem = {
    name?: string;
    value?: number | string;
    color?: string;
    dataKey?: string | number;
};

export type ChartTooltipProps = {
    active?: boolean;
    label?: string;
    payload?: TooltipPayloadItem[];
    formatValue?: (value: number, name?: string) => string;
};

export function ChartTooltip({
    active,
    label,
    payload,
    formatValue,
}: ChartTooltipProps) {
    if (!active || payload == null || payload.length === 0) {
        return null;
    }

    return (
        <div
            style={{
                borderRadius: 8,
                border: `1px solid ${CPH.border}`,
                padding: "8px 12px",
                fontSize: 12,
                backgroundColor: CPH.card,
                color: CPH.ink,
                boxShadow: CPH.shadow,
            }}
        >
            {label ? (
                <div
                    style={{
                        marginBottom: 4,
                        fontWeight: 500,
                        color: CPH.slate,
                    }}
                >
                    {label}
                </div>
            ) : null}
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
                {payload.map((entry, index) => {
                    const raw =
                        typeof entry.value === "number"
                            ? entry.value
                            : Number(entry.value);
                    const display =
                        Number.isFinite(raw) && formatValue
                            ? formatValue(raw, entry.name)
                            : String(entry.value ?? "");
                    return (
                        <li
                            key={`${entry.dataKey ?? entry.name ?? index}`}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    display: "inline-block",
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                    backgroundColor: entry.color ?? CPH.jade,
                                }}
                            />
                            <span style={{ color: CPH.slate }}>
                                {entry.name}
                            </span>
                            <span
                                style={{
                                    marginInlineStart: "auto",
                                    fontWeight: 500,
                                    fontVariantNumeric: "tabular-nums",
                                    color: CPH.ink,
                                }}
                            >
                                {display}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
