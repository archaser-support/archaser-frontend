"use client";

import type { CSSProperties } from "react";
import {
    truncatedTextOverflowStyle,
    type TextDirection,
} from "@/utils/textDirection";

type TruncatedChartLabelProps = {
    text: string;
    fallbackDir?: TextDirection;
    textAlign?: CSSProperties["textAlign"];
    className?: string;
    style?: CSSProperties;
};

/** Single-line chart label: ellipsis on the left for Hebrew, right for English. */
export function TruncatedChartLabel({
    text,
    fallbackDir = "ltr",
    textAlign,
    className,
    style,
}: TruncatedChartLabelProps) {
    const overflow = truncatedTextOverflowStyle(text, fallbackDir);
    return (
        <div
            dir={overflow.direction}
            className={className}
            style={{ textAlign, ...style, ...overflow }}
        >
            {text}
        </div>
    );
}
