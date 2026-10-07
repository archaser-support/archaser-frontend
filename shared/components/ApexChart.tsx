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

/** ApexCharts wrapper: RTL ellipsis on Hebrew axis labels, LTR on English. */
export default function ApexChart({
    labelDirectionFallback = "ltr",
    ...props
}: ApexChartProps) {
    const rootRef = useRef<HTMLDivElement>(null);

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
    }, [labelDirectionFallback, props.options, props.series]);

    return (
        <div ref={rootRef} style={{ display: "contents" }}>
            <ReactApexChart {...props} />
        </div>
    );
}
