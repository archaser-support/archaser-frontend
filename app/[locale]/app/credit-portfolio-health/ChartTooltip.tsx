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
    payload?: ReadonlyArray<TooltipPayloadItem>;
    /**
     * When set, render these rows instead of deriving from Recharts payload
     * (e.g. cost breakdown while the bar still uses a single series).
     */
    items?: ReadonlyArray<TooltipPayloadItem>;
    formatValue?: (value: number, name?: string) => string;
    /** When Hebrew, flip tooltip layout (RTL) like ApexCharts credit-dashboard tooltips. */
    language?: string;
};

export function ChartTooltip({
    active,
    label,
    payload,
    items: explicitItems,
    formatValue,
    language,
}: ChartTooltipProps) {
    const items = (explicitItems ?? payload ?? []).filter(
        (entry) => entry.value != null && entry.value !== ""
    );
    if (!active || items.length === 0) {
        return null;
    }

    const isRtl =
        language != null &&
        (language === "he" || language.startsWith("he-"));

    return (
        <div
            dir={isRtl ? "rtl" : "ltr"}
            style={{
                borderRadius: 8,
                border: `1px solid ${CPH.border}`,
                padding: "8px 12px",
                fontSize: 12,
                backgroundColor: CPH.card,
                color: CPH.ink,
                boxShadow: CPH.shadow,
                direction: isRtl ? "rtl" : "ltr",
                textAlign: isRtl ? "right" : "left",
                unicodeBidi: "isolate",
            }}
        >
            {label ? (
                <div
                    style={{
                        marginBottom: 4,
                        fontWeight: 500,
                        color: CPH.slate,
                        direction: isRtl ? "rtl" : "ltr",
                        textAlign: isRtl ? "right" : "left",
                        unicodeBidi: isRtl ? "plaintext" : undefined,
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
                {items.map((entry, index) => {
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
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                direction: isRtl ? "rtl" : "ltr",
                                width: "100%",
                            }}
                        >
                            <span
                                style={{
                                    display: "inline-block",
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                    backgroundColor: entry.color ?? CPH.teal,
                                }}
                            />
                            <span
                                style={{
                                    color: CPH.slate,
                                    flex: 1,
                                    minWidth: 0,
                                    direction: isRtl ? "rtl" : "ltr",
                                    textAlign: isRtl ? "right" : "left",
                                    unicodeBidi: isRtl ? "plaintext" : undefined,
                                }}
                            >
                                {entry.name}
                            </span>
                            <span
                                style={{
                                    flexShrink: 0,
                                    fontWeight: 500,
                                    fontVariantNumeric: "tabular-nums",
                                    color: CPH.ink,
                                    direction: "ltr",
                                    textAlign: isRtl ? "left" : "right",
                                    unicodeBidi: "isolate",
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
