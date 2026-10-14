"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, type ComponentProps } from "react";
import {
    applyChartLabelTextDirection,
    type TextDirection,
} from "@/utils/textDirection";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
    ssr: false,
});

type ReactApexChartProps = ComponentProps<typeof ReactApexChart>;

export type ApexChartProps = ReactApexChartProps & {
    labelDirectionFallback?: TextDirection;
};

/**
 * Pixel height used when callers pass `height="100%"`.
 * Flex card bodies often only have `minHeight`, so percentage height collapses
 * to 0; measuring the parent with ResizeObserver caused unbounded growth
 * (child height → parent grows → remasure → repeat).
 */
const PERCENT_HEIGHT_FALLBACK_PX = 280;

/**
 * ApexCharts wrapper: RTL ellipsis on Hebrew axis labels, LTR on English.
 * Maps `height="100%"` to a fixed pixel height so charts render without a
 * parent-size feedback loop.
 */
export default function ApexChart({
    labelDirectionFallback = "ltr",
    height,
    ...props
}: ApexChartProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const pixelHeight =
        typeof height === "number" && Number.isFinite(height) && height > 0
            ? height
            : PERCENT_HEIGHT_FALLBACK_PX;

    useLayoutEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        let frame = 0;
        const run = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                applyChartLabelTextDirection(root, labelDirectionFallback);
            });
        };

        run();
        const observer = new MutationObserver(run);
        observer.observe(root, {
            subtree: true,
            childList: true,
            characterData: true,
        });
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
        };
    }, [labelDirectionFallback, props.options, props.series, pixelHeight]);

    return (
        <div
            ref={rootRef}
            style={{
                display: "block",
                width: "100%",
                height: pixelHeight,
            }}
        >
            <ReactApexChart {...props} height={pixelHeight} />
        </div>
    );
}
