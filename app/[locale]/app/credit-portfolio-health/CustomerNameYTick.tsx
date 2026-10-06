"use client";

import { TruncatedChartLabel } from "@/shared/components/TruncatedChartLabel";
import { CPH } from "./designTokens";

export const CUSTOMER_NAME_Y_AXIS_WIDTH = 180;

type CustomerNameYTickProps = {
    x?: number | string;
    y?: number | string;
    payload?: { value?: string; rowKey?: string };
    /** When set, map category key → display name; otherwise show the tick value. */
    names?: Map<string, string>;
    isRtl: boolean;
    axisWidth?: number;
};

/** Right-aligned truncated names in the Y-axis slot (LTR chart geometry, RTL text). */
export function CustomerNameYTick(props: CustomerNameYTickProps) {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const raw = props.payload;
    const key = String(raw?.value ?? raw?.rowKey ?? "");
    const name = props.names?.get(key) ?? key;
    const axisWidth = props.axisWidth ?? CUSTOMER_NAME_Y_AXIS_WIDTH;
    const width = axisWidth - 8;
    return (
        <foreignObject x={x - width} y={y - 10} width={width} height={20}>
            <TruncatedChartLabel
                text={name}
                fallbackDir={props.isRtl ? "rtl" : "ltr"}
                textAlign="right"
                style={{
                    fontSize: 11.5,
                    lineHeight: "20px",
                    color: CPH.slate,
                }}
            />
        </foreignObject>
    );
}
