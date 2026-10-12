"use client";

import dynamic from "next/dynamic";
import {
    useLayoutEffect,
    useRef,
    useState,
    type ComponentProps,
} from "react";
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

/** Fallback when parent flex/`minHeight` leaves percentage height as 0. */
const PERCENT_HEIGHT_FALLBACK_PX = 280;

/**
 * ApexCharts wrapper: RTL ellipsis on Hebrew axis labels, LTR on English.
 * Resolves `height="100%"` to a pixel height so charts render inside flex
 * cards that only have `minHeight` (percentage height otherwise collapses to 0).
 */
export default function ApexChart({
    labelDirectionFallback = "ltr",
    height,
    ...props
}: ApexChartProps) {
    const rootRef = useRef<HTMLDivElement>(null);
    const [resolvedHeight, setResolvedHeight] = useState<number | string>(
        typeof height === "number" ? height : PERCENT_HEIGHT_FALLBACK_PX
    );

    useLayoutEffect(() => {
        if (typeof height === "number") {
            setResolvedHeight(height);
            return;
        }

        const el = rootRef.current;
        const parent = el?.parentElement;
        if (!parent) {
            setResolvedHeight(PERCENT_HEIGHT_FALLBACK_PX);
            return;
        }

        const measure = () => {
            const h = parent.clientHeight;
            setResolvedHeight(h > 0 ? h : PERCENT_HEIGHT_FALLBACK_PX);
        };

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(parent);
        return () => observer.disconnect();
    }, [height, props.series, props.options]);

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
    }, [labelDirectionFallback, props.options, props.series, resolvedHeight]);

    const pixelHeight =
        typeof resolvedHeight === "number"
            ? resolvedHeight
            : PERCENT_HEIGHT_FALLBACK_PX;

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
